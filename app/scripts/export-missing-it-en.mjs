import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ui = fs.readFileSync(path.join(__dirname, "../src/lib/i18n/uiStrings.ts"), "utf8");
const ex = fs.readFileSync(path.join(__dirname, "../src/lib/i18n/localeExtra.ts"), "utf8");

function loadEn() {
  const start = ui.indexOf("const EN: UiMessages = ");
  const brace = ui.indexOf("{", start);
  let depth = 0;
  let i = brace;
  for (; i < ui.length; i++) {
    const c = ui[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return vm.runInNewContext(`(${ui.slice(brace, i)})`, Object.create(null), { timeout: 15_000 });
}

function itLabelKeys() {
  const a = ex.indexOf("export const IT_LABELS:");
  const z = ex.indexOf("export const PT_LABELS:", a);
  const block = ex.slice(a, z);
  const re = /"([^"]+)"\s*:/g;
  const s = new Set();
  let m;
  while ((m = re.exec(block))) s.add(m[1]);
  return s;
}

const en = loadEn();
const it = itLabelKeys();
const missing = Object.keys(en)
  .filter((k) => !it.has(k))
  .sort();
const out = {};
for (const k of missing) out[k] = en[k];
const outPath = path.join(__dirname, "missing-it-en.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log("Wrote", outPath, Object.keys(out).length, "entries");
