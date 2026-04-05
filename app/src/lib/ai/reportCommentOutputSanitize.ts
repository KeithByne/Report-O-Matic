/**
 * Remove trailing letter-style closings and fill-in placeholders from AI report comments.
 * Parents see a single narrative body; signatures and [Your name] blocks belong in the product, not the model.
 */

const CLOSING_LINE = new RegExp(
  "^(" +
    [
      "kind regards",
      "best regards",
      "warm regards",
      "yours sincerely",
      "yours faithfully",
      "sincerely",
      "best wishes",
      "many thanks",
      "thanks",
      "regards",
      "yours",
      "cordialement",
      "bien cordialement",
      "salutations distinguées",
      "mit freundlichen grüßen",
      "mit freundlichem gruß",
      "hochachtungsvoll",
      "atentamente",
      "un saludo cordial",
      "saludos cordiales",
    ].join("|") +
    ")[,.]?\\s*$",
  "i",
);

/** [Your name], [Name], [Your position], etc. */
const PLACEHOLDER_BRACKET_LINE =
  /^\s*\[(?:your\s+)?(?:name|position|title|signature|role|job\s*title|teacher\s*name|school)\]\s*$/i;

export function stripReportCommentLetterArtifacts(text: string): string {
  let t = text.replace(/\r\n/g, "\n").trim();
  for (let pass = 0; pass < 20; pass++) {
    const lines = t.split("\n");
    if (lines.length === 0) break;
    const lastRaw = lines[lines.length - 1];
    const last = lastRaw.trim();
    if (last === "") {
      lines.pop();
      t = lines.join("\n").trimEnd();
      continue;
    }
    if (PLACEHOLDER_BRACKET_LINE.test(last) || isGenericPlaceholderBracket(last)) {
      lines.pop();
      t = lines.join("\n").trimEnd();
      continue;
    }
    if (CLOSING_LINE.test(last)) {
      lines.pop();
      t = lines.join("\n").trimEnd();
      continue;
    }
    break;
  }
  return t.trim();
}

/** Lines that are only [square brackets], likely template prompts. */
function isGenericPlaceholderBracket(line: string): boolean {
  const m = line.trim().match(/^\[([^\]]+)\]$/);
  if (!m) return false;
  const inner = m[1].trim().toLowerCase();
  if (inner.length > 60) return false;
  return /\b(your|name|position|title|signature|sign|teacher|class|date|role|here)\b/.test(inner);
}
