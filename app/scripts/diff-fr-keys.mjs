import fs from "fs";
const text = fs.readFileSync("src/lib/i18n/uiStrings.ts", "utf8");
function keysBetween(startMarker, endMarker) {
  const i = text.indexOf(startMarker);
  const j = text.indexOf(endMarker, i + 1);
  const chunk = text.slice(i, j);
  return new Set([...chunk.matchAll(/\n\s+"([^"]+)":/g)].map((m) => m[1]));
}
const enKeys = keysBetween("const EN: UiMessages = {", "\n};\n\nconst FR:");
const frKeys = keysBetween("const FR: UiMessages = {", "\n};\n\nconst ES:");
const missing = [...enKeys].filter((k) => !frKeys.has(k)).sort();
console.log("Missing from FR:", missing.length);
