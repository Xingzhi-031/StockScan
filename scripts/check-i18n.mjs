import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["en", "zh", "id"].map((lang) => ({
  lang,
  json: JSON.parse(readFileSync(join(root, "src/i18n", `${lang}.json`), "utf8")),
}));

function keysOf(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keysOf(v, path));
    else out.push(path);
  }
  return out;
}

const [en, ...rest] = files;
const enKeys = keysOf(en.json).sort();
let failed = false;

for (const file of rest) {
  const keys = keysOf(file.json).sort();
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.error(`${file.lang} missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`${file.lang} extra: ${extra.join(", ")}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`i18n keys ok (${enKeys.length})`);
