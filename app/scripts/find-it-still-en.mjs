import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, "missing-it-en.json"), "utf8"));
const body = fs.readFileSync(path.join(__dirname, "../src/lib/i18n/localeItCompletion.ts"), "utf8");
const obj = {};
const re = /^\s*"([^"]+)"\s*:\s*(.+),?\s*$/gm;
let m;
while ((m = re.exec(body))) {
  try {
    obj[m[1]] = JSON.parse(m[2].replace(/,$/, ""));
  } catch {
    /* skip header */
  }
}
const still = Object.keys(obj).filter((k) => en[k] !== undefined && obj[k] === en[k]);
console.log("still identical to EN:", still.length);
console.log(still.join("\n"));
