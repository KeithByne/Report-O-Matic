/**
 * Writes JSON lines: each line { "locale": "nl", "key": "auth.x", "en": "..." }
 * for EN keys not present in that locale's overlay (same definition as i18n-audit.mjs).
 *
 * Usage (from app/): node scripts/i18n-export-missing.mjs > missing-keys.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const uiStringsPath = path.join(root, "src/lib/i18n/uiStrings.ts");
const patchesPath = path.join(root, "src/lib/i18n/localePatches6.ts");
const extraPath = path.join(root, "src/lib/i18n/localePatches6Extra.ts");
const extraTsPath = path.join(root, "src/lib/i18n/localeExtra.ts");
const elBodyPath = path.join(root, "src/lib/i18n/localeElBody.ts");
const uiFillPath = path.join(root, "src/lib/i18n/localeUiFill.ts");
const itCompletionPath = path.join(root, "src/lib/i18n/localeItCompletion.ts");

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function keysInLiteralSlice(s, startNeedle, endNeedle) {
  const i = s.indexOf(startNeedle);
  if (i < 0) throw new Error(`Start not found: ${startNeedle}`);
  const j = endNeedle ? s.indexOf(endNeedle, i + startNeedle.length) : s.length;
  if (endNeedle && j < 0) throw new Error(`End not found: ${endNeedle}`);
  const block = s.slice(i, j);
  const re = /"([a-zA-Z0-9_.]+)"\s*:/g;
  const out = new Set();
  let m;
  while ((m = re.exec(block))) out.add(m[1]);
  return out;
}

function loadEnKeys() {
  const ui = read(uiStringsPath);
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
  const literal = ui.slice(brace, i);
  const obj = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 10_000 });
  return obj;
}

function patchOverlayKeys(patchExportStart, patchExportEnd, extraExportStart, extraExportEnd) {
  const p6 = read(patchesPath);
  const ex = read(extraPath);
  const a = keysInLiteralSlice(p6, patchExportStart, patchExportEnd);
  const b = keysInLiteralSlice(ex, extraExportStart, extraExportEnd);
  return new Set([...a, ...b]);
}

const DEFS = [
  { code: "nl", overlay: () => patchOverlayKeys("export const NL_PATCH", "export const PL_PATCH", "export const NL_EXTRA:", "export const PL_EXTRA:") },
  { code: "pl", overlay: () => patchOverlayKeys("export const PL_PATCH", "export const RO_PATCH", "export const PL_EXTRA:", "export const RO_EXTRA:") },
  { code: "ro", overlay: () => patchOverlayKeys("export const RO_PATCH", "export const RU_PATCH", "export const RO_EXTRA:", "export const RU_EXTRA:") },
  { code: "ru", overlay: () => patchOverlayKeys("export const RU_PATCH", "export const UK_PATCH", "export const RU_EXTRA:", "export const UK_EXTRA:") },
  { code: "uk", overlay: () => patchOverlayKeys("export const UK_PATCH", "export const AR_PATCH", "export const UK_EXTRA:", "export const AR_EXTRA:") },
  {
    code: "ar",
    overlay: () => {
      const p6 = read(patchesPath);
      const ex = read(extraPath);
      const a = keysInLiteralSlice(p6, "export const AR_PATCH", null);
      const b = keysInLiteralSlice(ex, "export const AR_EXTRA:", null);
      return new Set([...a, ...b]);
    },
  },
  { code: "de", overlay: () => keysInLiteralSlice(read(extraTsPath), "export const DE_LABELS:", null) },
  {
    code: "it",
    overlay: () => {
      const ex = read(extraTsPath);
      const a = keysInLiteralSlice(ex, "export const IT_LABELS:", "export const PT_LABELS:");
      let b = new Set();
      try {
        b = keysInLiteralSlice(read(itCompletionPath), "export const IT_COMPLETION:", null);
      } catch {
        /* optional */
      }
      return new Set([...a, ...b]);
    },
  },
  { code: "pt", overlay: () => keysInLiteralSlice(read(extraTsPath), "export const PT_LABELS:", "export const DE_LABELS:") },
  {
    code: "el",
    overlay: () => {
      const el = keysInLiteralSlice(read(elBodyPath), "export const EL_BODY:", null);
      const fill = keysInLiteralSlice(read(uiFillPath), "export const UI_FILL_EL:", null);
      return new Set([...el, ...fill]);
    },
  },
];

const enObj = loadEnKeys();
const enKeys = Object.keys(enObj).sort();

for (const def of DEFS) {
  const overlay = def.overlay();
  for (const key of enKeys) {
    if (!overlay.has(key)) {
      const line = JSON.stringify({ locale: def.code, key, en: enObj[key] });
      process.stdout.write(`${line}\n`);
    }
  }
}
