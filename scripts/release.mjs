import fs from "node:fs";
import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const jsonMode = args.has("--json");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function runInherit(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function ensureCleanTree() {
  const status = run("git status --porcelain");
  if (status) {
    throw new Error("Working tree is dirty. Release requires a clean tree.");
  }
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function fileExists(path) {
  return fs.existsSync(path);
}

function ensureDist() {
  if (!fileExists("dist/aneskit.css") || !fileExists("dist/aneskit.min.css")) {
    throw new Error("dist artifacts missing after build.");
  }
}

function tagExists(tag) {
  try {
    run(`git rev-parse -q --verify refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
}

if (!dryRun) {
  ensureCleanTree();
}
runInherit("npm run build");

const gateRaw = run("node scripts/release-gate.mjs --json");
const gate = JSON.parse(gateRaw);

if (gate.status !== "APPROVED") {
  throw new Error(`Release gate blocked: ${gate.violations.join(" | ")}`);
}

if (gate.classification === "NONE") {
  const result = {
    status: "SKIPPED",
    reason: "No release needed",
    classification: gate.classification,
    version: null,
    baselineTag: gate.baselineTag
  };
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log("No release needed");
  }
  process.exit(0);
}

if (gate.classification === "RISKY") {
  throw new Error("RISKY classification requires manual override. Automated release blocked.");
}

const calcRaw = run(`node scripts/calc-version.mjs --classification ${gate.classification} --json`);
const calc = JSON.parse(calcRaw);
if (calc.skip || !calc.nextVersion) {
  throw new Error("Version calculation did not produce a releasable next version.");
}

const nextVersion = calc.nextVersion;
const nextTag = `v${nextVersion}`;
if (tagExists(nextTag)) {
  throw new Error(`Tag already exists: ${nextTag}. Refusing to overwrite tags.`);
}

const notesFile = ".release-notes.md";
run(`node scripts/generate-changelog.mjs --version ${nextVersion} --classification ${gate.classification} --from-tag ${calc.lastTag} --notes-file ${notesFile}${dryRun ? "" : " --apply"}`);

if (!dryRun) {
  runInherit(`npm version ${nextVersion} --no-git-tag-version`);
  runInherit("npm install --package-lock-only");
  runInherit("npm run build");
  ensureDist();

  run("git add package.json package-lock.json CHANGELOG.md dist/aneskit.css dist/aneskit.min.css .release-notes.md");
  const staged = run("git diff --cached --name-only");
  if (!staged) {
    throw new Error("No staged release changes detected.");
  }

  run(`git commit -m "chore(release): ${nextTag}"`);
  run(`git tag -a ${nextTag} -m "Release ${nextTag}"`);
}

const result = {
  status: dryRun ? "DRY_RUN" : "READY",
  classification: gate.classification,
  version: nextVersion,
  tag: nextTag,
  baselineTag: calc.lastTag,
  notesFile,
  plannedChanges: [
    `Set package.json version to ${nextVersion}`,
    "Prepend CHANGELOG entry",
    "Rebuild dist artifacts",
    dryRun ? "Skip commit/tag/publish (dry run)" : "Commit and tag release"
  ]
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(`Classification: ${result.classification}`);
  console.log(`Next version: ${result.version}`);
  console.log(`Tag: ${result.tag}`);
  console.log("Planned changes:");
  for (const line of result.plannedChanges) {
    console.log(`- ${line}`);
  }
}
