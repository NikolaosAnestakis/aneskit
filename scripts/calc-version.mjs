import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith("--")) {
    argMap.set(args[i], args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true");
  }
}

const classification = (argMap.get("--classification") || "NONE").toUpperCase();
const jsonMode = argMap.has("--json");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function parseSemver(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

const tags = run("git tag --list 'v*' --sort=-v:refname")
  .split("\n")
  .map((t) => t.trim())
  .filter(Boolean);

if (tags.length === 0) {
  throw new Error("No version tags found. Expected at least one vX.Y.Z tag.");
}

const lastTag = tags[0];
const baseVersion = lastTag.replace(/^v/, "");
const base = parseSemver(baseVersion);
if (!base) {
  throw new Error(`Latest tag is not semver: ${lastTag}`);
}

let next = null;
let bump = "none";
let skip = false;
let reason = "";

if (classification === "NONE") {
  skip = true;
  reason = "No release needed";
} else if (classification === "RISKY") {
  throw new Error("RISKY classification requires manual override. Automated release blocked.");
} else if (classification === "BREAKING") {
  bump = "major";
  next = `${base.major + 1}.0.0`;
} else if (classification === "SAFE") {
  bump = "minor";
  next = `${base.major}.${base.minor + 1}.0`;
} else {
  throw new Error(`Unknown classification: ${classification}`);
}

const result = {
  lastTag,
  baseVersion,
  classification,
  bump,
  nextVersion: next,
  skip,
  reason
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (skip) {
  console.log(reason);
} else {
  console.log(next);
}
