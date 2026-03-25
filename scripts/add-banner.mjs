import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/add-banner.mjs <file>");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
const banner = `/*!\n * aneskit v${pkg.version}\n * https://github.com/nikolaosanestakis/aneskit\n */\n`;

const filePath = path.resolve(target);
const content = fs.readFileSync(filePath, "utf8");
const normalized = content.replace(
  /^\/\*!\n \* aneskit v[^\n]+\n \* https:\/\/github\.com\/nikolaosanestakis\/aneskit\n \*\/\n?/,
  ""
);

fs.writeFileSync(filePath, banner + normalized, "utf8");
