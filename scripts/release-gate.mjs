import fs from "node:fs";
import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function safeRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return "";
  }
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function fileExists(path) {
  return fs.existsSync(path);
}

function parseSemver(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function getBumpType(fromVersion, toVersion) {
  const from = parseSemver(fromVersion);
  const to = parseSemver(toVersion);
  if (!from || !to) return "invalid";
  if (from.major === to.major && from.minor === to.minor && from.patch === to.patch) return "none";
  if (to.major < from.major || (to.major === from.major && to.minor < from.minor) || (to.major === from.major && to.minor === from.minor && to.patch < from.patch)) {
    return "downgrade";
  }
  if (to.major > from.major) return "major";
  if (to.minor > from.minor) return "minor";
  return "patch";
}

function normalizeDecls(block) {
  return block
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(";");
}

function parseRules(css, context = "root", out = new Map()) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;

  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (i >= text.length) break;

    const open = text.indexOf("{", i);
    if (open === -1) break;

    const selector = text.slice(i, open).trim();
    if (!selector) {
      i = open + 1;
      continue;
    }

    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth += 1;
      else if (text[j] === "}") depth -= 1;
      j += 1;
    }
    if (depth !== 0) break;

    const block = text.slice(open + 1, j - 1);
    if (selector.startsWith("@")) {
      parseRules(block, `${context}|${selector.replace(/\s+/g, " ").trim()}`, out);
    } else {
      const decl = normalizeDecls(block);
      for (const sel of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
        out.set(`${context}||${sel}`, decl);
      }
    }

    i = j;
  }

  return out;
}

function extractVersionEntry(changelog, version) {
  const esc = version.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const header = new RegExp(`^## \\[${esc}\\]\\s*$`, "m");
  const match = changelog.match(header);
  if (!match) return null;
  const start = changelog.indexOf(match[0]);
  const rest = changelog.slice(start + match[0].length);
  const next = rest.search(/^##\s+\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function getTags() {
  return safeRun("git tag --list 'v*' --sort=-v:refname")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

function readTagFile(tag, filePath) {
  try {
    return run(`git show ${tag}:${filePath}`);
  } catch {
    return null;
  }
}

const violations = [];
const pkg = JSON.parse(readText("package.json"));
const currentVersion = pkg.version;
const currentTagName = `v${currentVersion}`;

if (!fileExists("dist/aneskit.css") || !fileExists("dist/aneskit.min.css")) {
  violations.push("Build artifacts missing. Run npm run build before release gate.");
}

if (!fileExists("examples/baseline.html")) {
  violations.push("Baseline file missing: examples/baseline.html");
}

const tags = getTags();
if (tags.length === 0) {
  violations.push("No baseline tags found (expected at least one v* tag).");
}

const refType = process.env.GITHUB_REF_TYPE || "";
const refName = process.env.GITHUB_REF_NAME || "";

let baselineTag = tags[0] || "";
if (refType === "tag" && refName && baselineTag === refName && tags.length > 1) {
  baselineTag = tags[1];
}
if (!baselineTag) {
  violations.push("Unable to determine baseline tag for comparison.");
}

const baselineVersion = baselineTag ? baselineTag.replace(/^v/, "") : "0.0.0";
const versionChange = getBumpType(baselineVersion, currentVersion);

let classification = "NONE";
let addedSelectors = [];
let removedSelectors = [];
let changedSelectors = [];
let removedClassSelectors = [];
let changedClassSelectors = [];

if (baselineTag && fileExists("dist/aneskit.css") && fileExists("dist/aneskit.min.css")) {
  const oldCss = readTagFile(baselineTag, "dist/aneskit.css");
  const oldMin = readTagFile(baselineTag, "dist/aneskit.min.css");
  const newCss = readText("dist/aneskit.css");
  const newMin = readText("dist/aneskit.min.css");

  if (oldCss === null || oldMin === null) {
    violations.push(`Baseline dist files missing in ${baselineTag}.`);
  } else {
    const oldRules = parseRules(oldCss);
    const newRules = parseRules(newCss);

    const oldKeys = new Set(oldRules.keys());
    const newKeys = new Set(newRules.keys());

    addedSelectors = [...newKeys].filter((k) => !oldKeys.has(k));
    removedSelectors = [...oldKeys].filter((k) => !newKeys.has(k));
    changedSelectors = [...oldKeys].filter((k) => newKeys.has(k) && oldRules.get(k) !== newRules.get(k));

    const isClassSelector = (k) => (k.split("||")[1] || "").startsWith(".");
    removedClassSelectors = removedSelectors.filter(isClassSelector);
    changedClassSelectors = changedSelectors.filter(isClassSelector);

    if (addedSelectors.length === 0 && removedSelectors.length === 0 && changedSelectors.length === 0) {
      classification = "NONE";
    } else if (removedClassSelectors.length > 0 || changedClassSelectors.length > 0) {
      classification = "BREAKING";
    } else if (removedSelectors.length > 0 || changedSelectors.length > 0) {
      classification = "RISKY";
    } else {
      classification = "SAFE";
    }

    if (removedSelectors.length > 0) {
      violations.push(`Removed selectors detected (${removedSelectors.length}).`);
    }
    if (changedClassSelectors.length > 0) {
      violations.push(`Existing class behavior changed (${changedClassSelectors.length} class selectors with value diffs).`);
    }

    if (classification === "BREAKING" && versionChange !== "major") {
      violations.push(`BREAKING changes require MAJOR bump (detected ${versionChange.toUpperCase()} from ${baselineVersion} -> ${currentVersion}).`);
    }
    if (classification === "SAFE" && !["minor", "patch"].includes(versionChange) && versionChange !== "none") {
      violations.push(`SAFE changes require PATCH or MINOR bump (detected ${versionChange.toUpperCase()}).`);
    }
    if (classification === "RISKY") {
      violations.push("RISKY changes detected and blocked by policy until explicitly approved.");
    }

    if (classification !== "NONE" && versionChange === "none") {
      violations.push("Dist changed but version did not change.");
    }

    if (oldMin === newMin && oldCss !== newCss && classification === "NONE") {
      // comment/order-only diff typically; keep NONE.
    }
  }
}

if (classification !== "NONE") {
  if (versionChange === "invalid") {
    violations.push(`Invalid semver values (baseline=${baselineVersion}, current=${currentVersion}).`);
  }
  if (versionChange === "downgrade") {
    violations.push(`Version downgrade detected (${baselineVersion} -> ${currentVersion}).`);
  }

  if (refType === "tag") {
    const sha = process.env.GITHUB_SHA || "HEAD";
    const branches = safeRun(`git branch -r --contains ${sha}`);
    if (!branches.includes("origin/main")) {
      violations.push("Tag commit is not contained in origin/main. Tags must be created via PR merge only.");
    }
    if (refName && refName !== currentTagName) {
      violations.push(`Tag name (${refName}) does not match package.json version (${currentTagName}).`);
    }
  }

  const changelog = readText("CHANGELOG.md");
  if (versionChange !== "none") {
    const entry = extractVersionEntry(changelog, currentVersion);
    if (!entry) {
      violations.push(`CHANGELOG.md missing entry for version ${currentVersion}.`);
    } else {
      for (const section of ["### Added", "### Changed", "### Fixed", "### Breaking Changes"]) {
        if (!entry.includes(section)) {
          violations.push(`CHANGELOG entry ${currentVersion} missing section: ${section}`);
        }
      }
      if (classification === "BREAKING") {
        const m = entry.match(/### Breaking Changes([\s\S]*)/);
        const text = m ? m[1].trim() : "";
        if (!text || /none\.?$/i.test(text)) {
          violations.push("BREAKING changes detected but CHANGELOG breaking section is empty/None.");
        }
      }
    }
  }
}

console.log("DEBUG classification:", classification);
console.log("DEBUG versionChange:", versionChange);
console.log("DEBUG violations:", JSON.stringify(violations, null, 2));

const status = violations.length === 0 ? "APPROVED" : "BLOCKED";
const reason = classification === "NONE" && status === "APPROVED"
  ? "no changes detected"
  : (violations[0] || "all validations passed");
const result = {
  baselineTag,
  baselineVersion,
  currentVersion,
  versionChange,
  classification,
  status,
  reason,
  selectorSummary: {
    added: addedSelectors.length,
    removed: removedSelectors.length,
    changed: changedSelectors.length,
    removedClass: removedClassSelectors.length,
    changedClass: changedClassSelectors.length
  },
  violations
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log("Detected version change:", `${baselineVersion} -> ${currentVersion} (${versionChange.toUpperCase()})`);
  console.log("Diff classification:", classification);
  console.log("Release status:", status);
  console.log("Selector diff summary:", result.selectorSummary);
  if (violations.length > 0) {
    console.log("Failure reasons:");
    for (const v of violations) console.log(`- ${v}`);
  }
}

if (status !== "APPROVED") {
  process.exit(1);
}
