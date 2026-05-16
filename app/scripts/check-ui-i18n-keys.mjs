import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nDir = path.join(appRoot, "src/lib/i18n");

function extractKeys(block) {
  const keys = new Set();
  for (const m of block.matchAll(/"([^"\\]+)":/g)) keys.add(m[1]);
  return keys;
}

function loadFillExport(name) {
  const file = path.join(i18nDir, "localeUiFill.ts");
  const s = fs.readFileSync(file, "utf8");
  const start = s.indexOf(`export const ${name}`);
  if (start < 0) return new Set();
  const brace = s.indexOf("{", start);
  let depth = 0;
  let end = brace;
  for (let i = brace; i < s.length; i++) {
    if (s[i] === "{") depth++;
    if (s[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return extractKeys(s.slice(brace, end));
}

const uiPath = path.join(i18nDir, "uiStrings.ts");
const s = fs.readFileSync(uiPath, "utf8");

const en = extractKeys(s.slice(s.indexOf("const EN:"), s.indexOf("const FR:")));
const frInline = extractKeys(s.slice(s.indexOf("const FR:"), s.indexOf("const ES:")));
const esInline = extractKeys(s.slice(s.indexOf("const ES:"), s.indexOf("const EL:")));
const fillFr = loadFillExport("UI_FILL_FR");
const fillEs = loadFillExport("UI_FILL_ES");

const fr = new Set([...frInline, ...fillFr]);
const es = new Set([...esInline, ...fillEs]);

const recent = [
  "tenant.subjectSkillMetricLabelsTitle",
  "tenant.subjectSkillMetricLabelsHint",
  "tenant.saveSubjectSkillMetricLabels",
  "tenant.subjectSkillMetricLabelsReset",
  "tenant.subjectSkillMetricLabelsNeedSubject",
  "class.deleteCustomSubjectSectionTitle",
  "class.reportsPerCourseLabel",
  "dash.guide.ownerSubjects4",
];

console.log("Recent keys coverage:");
for (const k of recent) {
  const inEn = en.has(k);
  const inFr = fr.has(k);
  const inEs = es.has(k);
  console.log(`  ${k}: en=${inEn} fr=${inFr} es=${inEs}`);
}

const missFr = [...en].filter((k) => !fr.has(k)).length;
const missEs = [...en].filter((k) => !es.has(k)).length;
console.log(`\nMerged totals: EN ${en.size}, FR ${fr.size} (${missFr} missing vs EN), ES ${es.size} (${missEs} missing vs ES)`);
