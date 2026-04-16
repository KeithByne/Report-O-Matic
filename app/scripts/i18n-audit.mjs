/**
 * Lists EN UI keys that have no entry in each locale's overlay / partial bundle
 * (so they still fall back to English at runtime).
 *
 * Usage:
 *   node scripts/i18n-audit.mjs              # all locales, summary + key lists
 *   node scripts/i18n-audit.mjs nl           # only locale `nl`
 *   node scripts/i18n-audit.mjs --count-only # one line per locale: missing count
 *   node scripts/i18n-audit.mjs --json       # machine-readable (stdout)
 *   node scripts/i18n-audit.mjs --help
 *
 * Locales `fr` and `es` are built as full merges in `uiStrings.ts` (+ `localeUiFill.ts`);
 * they are not listed here. This audit is for partial / patch bundles only.
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

function read(p) {
  return fs.readFileSync(p, "utf8");
}

/** Keys declared as "key": in a TS/JS object literal slice (string keys only). */
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
  return new Set(Object.keys(obj));
}

/** Patch locale: keys in PATCH export literal + keys in *_EXTRA (spread into patch). */
function patchOverlayKeys(patchExportStart, patchExportEnd, extraExportStart, extraExportEnd) {
  const p6 = read(patchesPath);
  const ex = read(extraPath);
  const a = keysInLiteralSlice(p6, patchExportStart, patchExportEnd);
  const b = keysInLiteralSlice(ex, extraExportStart, extraExportEnd);
  return new Set([...a, ...b]);
}

const AUDIT_LOCALES = [
  {
    code: "nl",
    label: "Dutch (NL_PATCH ∪ NL_EXTRA)",
    overlay: () => patchOverlayKeys("export const NL_PATCH", "export const PL_PATCH", "export const NL_EXTRA:", "export const PL_EXTRA:"),
  },
  {
    code: "pl",
    label: "Polish (PL_PATCH ∪ PL_EXTRA)",
    overlay: () => patchOverlayKeys("export const PL_PATCH", "export const RO_PATCH", "export const PL_EXTRA:", "export const RO_EXTRA:"),
  },
  {
    code: "ro",
    label: "Romanian (RO_PATCH ∪ RO_EXTRA)",
    overlay: () => patchOverlayKeys("export const RO_PATCH", "export const RU_PATCH", "export const RO_EXTRA:", "export const RU_EXTRA:"),
  },
  {
    code: "ru",
    label: "Russian (RU_PATCH ∪ RU_EXTRA)",
    overlay: () => patchOverlayKeys("export const RU_PATCH", "export const UK_PATCH", "export const RU_EXTRA:", "export const UK_EXTRA:"),
  },
  {
    code: "uk",
    label: "Ukrainian (UK_PATCH ∪ UK_EXTRA)",
    overlay: () => patchOverlayKeys("export const UK_PATCH", "export const AR_PATCH", "export const UK_EXTRA:", "export const AR_EXTRA:"),
  },
  {
    code: "ar",
    label: "Arabic (AR_PATCH ∪ AR_EXTRA)",
    overlay: () => {
      const p6 = read(patchesPath);
      const ex = read(extraPath);
      const a = keysInLiteralSlice(p6, "export const AR_PATCH", null);
      const b = keysInLiteralSlice(ex, "export const AR_EXTRA:", null);
      return new Set([...a, ...b]);
    },
  },
  {
    code: "de",
    label: "German (DE_LABELS)",
    overlay: () => keysInLiteralSlice(read(extraTsPath), "export const DE_LABELS:", null),
  },
  {
    code: "it",
    label: "Italian (IT_LABELS)",
    overlay: () => keysInLiteralSlice(read(extraTsPath), "export const IT_LABELS:", "export const PT_LABELS:"),
  },
  {
    code: "pt",
    label: "Portuguese (PT_LABELS)",
    overlay: () => keysInLiteralSlice(read(extraTsPath), "export const PT_LABELS:", "export const DE_LABELS:"),
  },
  {
    code: "el",
    label: "Greek (EL_BODY ∪ UI_FILL_EL)",
    overlay: () => {
      const el = keysInLiteralSlice(read(elBodyPath), "export const EL_BODY:", null);
      const fill = keysInLiteralSlice(read(uiFillPath), "export const UI_FILL_EL:", null);
      return new Set([...el, ...fill]);
    },
  },
];

function missingKeys(enKeys, overlayKeys) {
  return [...enKeys].filter((k) => !overlayKeys.has(k)).sort();
}

function orphans(overlayKeys, enKeys) {
  return [...overlayKeys].filter((k) => !enKeys.has(k)).sort();
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`i18n-audit — EN keys missing from each locale overlay (runtime English fallback).

Usage:
  node scripts/i18n-audit.mjs              # all locales: summary + full missing key lists
  node scripts/i18n-audit.mjs nl           # single locale (nl|pl|ro|ru|uk|ar|de|it|pt|el)
  node scripts/i18n-audit.mjs --count-only
  node scripts/i18n-audit.mjs --json

Locales fr and es use full merges in uiStrings (+ localeUiFill); they are not audited here.
`);
    return;
  }
  const countOnly = argv.includes("--count-only");
  const asJson = argv.includes("--json");
  const filter = argv.find((a) => !a.startsWith("--"));

  const enKeys = loadEnKeys();
  const rows = [];

  for (const def of AUDIT_LOCALES) {
    if (filter && def.code !== filter) continue;
    const overlay = def.overlay();
    const missing = missingKeys(enKeys, overlay);
    const orphan = orphans(overlay, enKeys);
    rows.push({
      code: def.code,
      label: def.label,
      enKeyCount: enKeys.size,
      overlayKeyCount: overlay.size,
      missingCount: missing.length,
      missing,
      orphanKeys: orphan,
    });
  }

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (countOnly) {
    for (const r of rows) {
      console.log(`${r.code}\t${r.missingCount}\t(missing of ${r.enKeyCount} EN keys)`);
    }
    return;
  }

  console.log(`EN keys (baseline): ${enKeys.size}`);
  console.log("Locales fr / es: full bundles in uiStrings — not audited here.");
  console.log("Patch locales: overlay = PATCH literals + *_EXTRA spread in localePatches6.\n");

  for (const r of rows) {
    console.log("—".repeat(72));
    console.log(`${r.code} — ${r.label}`);
    console.log(`  Overlay entries: ${r.overlayKeyCount} | Missing vs EN: ${r.missingCount}`);
    if (r.orphanKeys.length) {
      console.log(`  Warning: ${r.orphanKeys.length} overlay key(s) not in EN (typos or stale):`);
      for (const k of r.orphanKeys.slice(0, 30)) console.log(`    ${k}`);
      if (r.orphanKeys.length > 30) console.log(`    … +${r.orphanKeys.length - 30} more`);
    }
    if (r.missing.length) {
      console.log("  Keys in EN but not in this locale overlay (fall back to English):");
      for (const k of r.missing) console.log(`    ${k}`);
    } else {
      console.log("  (Every EN key has an overlay entry — still check values match intent.)");
    }
    console.log("");
  }

  if (filter && rows.length === 0) {
    console.error(`Unknown locale "${filter}". Use one of: ${AUDIT_LOCALES.map((d) => d.code).join(", ")}`);
    process.exit(1);
  }
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
