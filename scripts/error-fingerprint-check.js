const fs = require("node:fs");
const path = require("node:path");

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/error-fingerprint-check.js <log-file>");
  process.exit(1);
}

const logPath = path.resolve(process.cwd(), source);
if (!fs.existsSync(logPath)) {
  console.error(`Log file not found: ${logPath}`);
  process.exit(1);
}

const content = fs.readFileSync(logPath, "utf8");
const fingerprints = [
  "Illegal invocation",
  "Receiver must be an instance",
  "is not a function",
  "Cannot read properties of undefined",
];

const hits = [];
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  fingerprints.forEach((fp) => {
    if (line.includes(fp)) {
      hits.push({ line: index + 1, fingerprint: fp, text: line.trim() });
    }
  });
});

const result = {
  file: logPath,
  totalLines: lines.length,
  hitsCount: hits.length,
  hits,
};

console.log(JSON.stringify(result, null, 2));

if (hits.length > 0) {
  process.exitCode = 2;
}

