import fs from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
};

const version = getArg("--version");
const classification = (getArg("--classification") || "NONE").toUpperCase();
const fromTag = getArg("--from-tag");
const apply = args.includes("--apply");
const notesFile = getArg("--notes-file");
const jsonMode = args.includes("--json");

if (!version) {
  throw new Error("Missing required --version");
}
if (!fromTag) {
  throw new Error("Missing required --from-tag");
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const subjects = run(`git log --format=%s ${fromTag}..HEAD`)
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const added = [];
const changed = [];
const fixed = [];
const breaking = [];

for (const subject of subjects) {
  const m = subject.match(/^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/);
  if (!m) {
    changed.push(subject);
    continue;
  }

  const type = m[1];
  const bang = m[3] === "!";
  const message = m[4];

  if (bang) {
    breaking.push(message);
  }

  if (type === "feat") {
    added.push(message);
  } else if (type === "fix") {
    fixed.push(message);
  } else {
    changed.push(message);
  }
}

if (classification === "BREAKING" && breaking.length === 0) {
  breaking.push("Detected breaking API/behavior changes require migration review.");
}

const toBullets = (items, fallback = "None.") => {
  if (items.length === 0) return [`- ${fallback}`];
  return items.map((x) => `- ${x}`);
};

const entry = [
  `## [${version}]`,
  "",
  "### Added",
  ...toBullets(added),
  "",
  "### Changed",
  ...toBullets(changed),
  "",
  "### Fixed",
  ...toBullets(fixed),
  "",
  "### Breaking Changes",
  ...toBullets(breaking),
  ""
].join("\n");

if (apply) {
  const changelogPath = "CHANGELOG.md";
  const previous = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
  fs.writeFileSync(changelogPath, `${entry}\n${previous}`.trimEnd() + "\n", "utf8");
}

if (notesFile) {
  fs.writeFileSync(notesFile, entry, "utf8");
}

const result = {
  version,
  classification,
  fromTag,
  commitCount: subjects.length,
  sections: {
    added: added.length,
    changed: changed.length,
    fixed: fixed.length,
    breaking: breaking.length
  },
  entry
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`${entry}\n`);
}

if (classification === "BREAKING" && breaking.length === 0) {
  throw new Error("Breaking classification detected but no breaking section content generated.");
}
