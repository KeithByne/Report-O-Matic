/**
 * Builds `src/lib/i18n/localeItCompletion.ts` from `scripts/missing-it-en.json`
 * using the public MyMemory translate API (no key). Run from repo:
 *   cd app && node scripts/generate-it-completion-mt.mjs
 *
 * Respects `{var}` placeholders by temporarily substituting markers before translate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, "missing-it-en.json");
const outPath = path.join(__dirname, "../src/lib/i18n/localeItCompletion.ts");

/** ASCII-only markers — Unicode brackets were mangled by some MT backends. */
const PLACEHOLDER_TOKEN = (i) => `__ROM_PH_${i}__`;

function protectPlaceholders(s) {
  const vars = [];
  let out = s.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => {
    const t = PLACEHOLDER_TOKEN(vars.length);
    vars.push(name);
    return t;
  });
  return { out, vars };
}

function restorePlaceholders(s, vars) {
  let r = s;
  for (let i = 0; i < vars.length; i++) {
    r = r.split(PLACEHOLDER_TOKEN(i)).join(`{${vars[i]}}`);
  }
  return r;
}

function placeholdersCorrupt(s, vars) {
  if (s.includes("__ROM_PH_")) return true;
  for (const v of vars) {
    if (!s.includes(`{${v}}`)) return true;
  }
  return false;
}

async function translateMyMemory(text) {
  const q = text.length > 450 ? text.slice(0, 450) : text;
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(q) +
    "&langpair=en|it";
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 + attempt * 2500));
      lastErr = new Error("HTTP 429");
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const tr = j?.responseData?.translatedText;
    if (!tr || typeof tr !== "string") throw new Error(JSON.stringify(j).slice(0, 200));
    return tr;
  }
  throw lastErr ?? new Error("translate failed");
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  let keys = Object.keys(raw).sort();
  const max = process.env.IT_MT_MAX ? Number.parseInt(process.env.IT_MT_MAX, 10) : 0;
  if (max > 0) keys = keys.slice(0, max);
  const lines = [
    "/**",
    " * Machine-translated Italian strings for keys missing from `IT_LABELS` (en→it).",
    " * Merged in `uiStrings.ts` as `{ ...EN, ...IT_LABELS, ...IT_COMPLETION }`.",
    " * Regenerate: `node scripts/export-missing-it-en.mjs && node scripts/generate-it-completion-mt.mjs`",
    " */",
    "",
    "export const IT_COMPLETION: Record<string, string> = {",
  ];

  let i = 0;
  for (const key of keys) {
    const en = raw[key];
    const { out: shielded, vars } = protectPlaceholders(en);
    let it;
    try {
      it = await translateMyMemory(shielded);
      it = restorePlaceholders(it, vars);
      if (placeholdersCorrupt(it, vars)) {
        console.error("Placeholder corrupt, keeping EN:", key);
        it = en;
      }
    } catch (e) {
      console.error("Failed key:", key, e);
      it = en;
    }
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(it)},`);
    i++;
    if (i % 25 === 0) console.error("Progress", i, "/", keys.length);
    await new Promise((r) => setTimeout(r, 550));
  }
  lines.push("};", "");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log("Wrote", outPath, keys.length, "entries");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
