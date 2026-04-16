import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ui = fs.readFileSync(path.join(__dirname, "../src/lib/i18n/uiStrings.ts"), "utf8");
const p6 = fs.readFileSync(path.join(__dirname, "../src/lib/i18n/localePatches6.ts"), "utf8");
const fill = fs.readFileSync(path.join(__dirname, "../src/lib/i18n/localeUiFill.ts"), "utf8");

function keysBetween(s, start, end) {
  const i = s.indexOf(start);
  const j = s.indexOf(end, i + 1);
  if (i < 0 || j < 0) throw new Error(`markers not found: ${start} -> ${end}`);
  const block = s.slice(i, j);
  const re = /"([a-zA-Z0-9_.]+)"\s*:/g;
  const out = new Set();
  let m;
  while ((m = re.exec(block))) out.add(m[1]);
  return out;
}

const en = keysBetween(ui, "const EN: UiMessages = {", "const FR:");
const frMain = keysBetween(ui, "const FR: UiMessages = {", "...UI_FILL_FR");
const frFill = keysBetween(fill, "export const UI_FILL_FR:", "export const UI_FILL_EL:");
const fr = new Set([...frMain, ...frFill]);
const esMain = keysBetween(ui, "const ES: UiMessages = {", "...UI_FILL_ES");
const esFill = keysBetween(fill, "export const UI_FILL_ES:", "export const UI_FILL_FR:");
const es = new Set([...esMain, ...esFill]);
const nlPatch = keysBetween(p6, "export const NL_PATCH", "export const PL_PATCH");

const enNotFr = [...en].filter((k) => !fr.has(k));
const enNotEs = [...en].filter((k) => !es.has(k));
const enNotNl = [...en].filter((k) => !nlPatch.has(k));

console.log("EN keys:", en.size);
console.log("FR explicit keys in block:", fr.size);
console.log("ES explicit keys in block:", es.size);
console.log("NL_PATCH keys:", nlPatch.size);
console.log("EN keys not in FR block (still English in FR):", enNotFr.length);
console.log("EN keys not in ES block:", enNotEs.length);
console.log("EN keys not in NL_PATCH (English in NL):", enNotNl.length);
console.log("sample EN\\FR:", enNotFr.slice(0, 25));
