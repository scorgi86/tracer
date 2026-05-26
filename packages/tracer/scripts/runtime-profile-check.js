const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "examples"];
const FORBIDDEN_PATTERNS = [
  /setTraceProfile\(\s*["']full["']\s*\)/g,
  /configure\(\s*\{[^}]*traceProfile\s*:\s*["']full["']/g,
];

const files = [];

const walk = (dir) => {
  if (!fs.existsSync(dir)) {
    return;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      return;
    }
    if (!/\.(js|ts|mjs|cjs)$/.test(entry.name)) {
      return;
    }
    files.push(full);
  });
};

TARGET_DIRS.forEach((dir) => walk(path.join(ROOT, dir)));

const violations = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  FORBIDDEN_PATTERNS.forEach((pattern) => {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      violations.push({
        file: path.relative(ROOT, file),
        pattern: pattern.toString(),
        sample: match[0],
      });
    }
  });
});

if (violations.length > 0) {
  console.error("Runtime profile check failed:");
  violations.forEach((item) => {
    console.error(`- ${item.file}: ${item.sample}`);
  });
  process.exit(1);
}

console.log("Runtime profile check passed: no forced full profile usage found.");

