import fs from "fs";
const text = fs.readFileSync("src/lib/i18n/uiStrings.ts", "utf8");
function keysBetween(startMarker, endMarker) {
  const i = text.indexOf(startMarker);
  const j = text.indexOf(endMarker, i + 1);
  const chunk = text.slice(i, j);
  return new Set([...chunk.matchAll(/\n\s+"([^"]+)":/g)].map((m) => m[1]));
}
const enKeys = keysBetween("const EN: UiMessages = {", "\n};\n\nconst FR:");
const esKeys = keysBetween("const ES: UiMessages = {", "\n};\n\nconst DE:");
const missing = [...enKeys].filter((k) => !esKeys.has(k)).sort();
console.log("EN keys:", enKeys.size);
console.log("ES override keys:", esKeys.size);
console.log("Missing from ES (still English in Spanish UI):", missing.length);
missing.forEach((k) => console.log(k));
