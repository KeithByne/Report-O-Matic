/**
 * Report PDF layout model — single source of truth for structure, versioning, and tokens.
 *
 * When you change page flow, add pages, or swap major sections: bump
 * `REPORT_PDF_LAYOUT_VERSION`, give a new `REPORT_PDF_LAYOUT_ID`, add a new renderer
 * (e.g. `renderReportPdfLayoutV2`), and branch from `buildReportPdfBuffer` in `reportPdf.ts`.
 *
 * For visual tweaks inside the same structure, adjust `PDF_TYPOGRAPHY_V1` / `PDF_PAGE_SPEC`.
 */

export const REPORT_PDF_LAYOUT_VERSION = 8;

/** Stable id embedded in PDF metadata and logs; change when the layout is not the same document shape. */
export const REPORT_PDF_LAYOUT_ID = "report-a4-v8" as const;

export type ReportPdfLayoutId = typeof REPORT_PDF_LAYOUT_ID;

export type ReportPdfLayoutVersion = typeof REPORT_PDF_LAYOUT_VERSION;

export const PDF_PAGE_SPEC = {
  widthPt: 595.28,
  heightPt: 841.89,
  marginPt: 48,
} as const;

/** Logo slot beside letterhead text: landscape width × height = 3 × 1 (points). */
export const PDF_LETTERHEAD_BLOCK_SPEC_V1 = {
  logoSlotWidthPt: 216,
  logoSlotHeightPt: 72,
  columnGapPt: 16,
} as const;

/** Teacher signature rectangle height (points). */
export const PDF_SIGNATURE_BOX_HEIGHT_PT = 52;

/** Semantic styles for layout v1 — edit here to restyle without hunting through draw calls. */
export const PDF_TYPOGRAPHY_V1 = {
  letterheadName: { fontSize: 16, font: "Helvetica-Bold" as const, fill: "#0f172a" },
  letterheadTagline: { fontSize: 10, font: "Helvetica" as const, fill: "#475569", lineGap: 2 },
  letterheadAddress: { fontSize: 8, font: "Helvetica" as const, fill: "#64748b", lineGap: 2 },
  reportSubtitle: { fontSize: 11, font: "Helvetica-Bold" as const, fill: "#334155" },
  studentLine: { fontSize: 10, font: "Helvetica" as const, fill: "#475569" },
  metaLine: { fontSize: 9, font: "Helvetica" as const, fill: "#334155" },
  /** Parent / OpenAI comment on page 2 */
  narrative: { fontSize: 14, font: "Helvetica" as const, fill: "#0f172a", lineGap: 4 },
  generatedStamp: { fontSize: 8, font: "Helvetica" as const, fill: "#94a3b8" },
  gradesSectionTitle: { fontSize: 13, font: "Helvetica-Bold" as const, fill: "#0f172a" },
  gradesSectionIntro: { fontSize: 10, font: "Helvetica" as const, fill: "#475569", lineGap: 2 },
  /** Academic grid — body at 14 pt for readability */
  gradesHeader: { fontSize: 14, font: "Helvetica-Bold" as const, fill: "#111" },
  gradesDivision: { fontSize: 12, font: "Helvetica-Bold" as const, fill: "#333" },
  gradesCellLabel: { fontSize: 14, font: "Helvetica" as const, fill: "#111" },
  gradesFooter: { fontSize: 12, font: "Helvetica" as const, fill: "#444" },
  signatureLabel: { fontSize: 10, font: "Helvetica-Bold" as const, fill: "#334155" },
  divider: { stroke: "#cbd5e1", lineWidth: 0.5 },
} as const;

/** Grade grid layout tokens (column ratios and row heights). */
export const PDF_GRADES_TABLE_SPEC_V1 = {
  colLabelRatio: 0.52,
  rowHeight: 19,
  headerHeight: 22,
  /** Reserve bottom space on a page for term-average lines + signature box */
  pageBreakReserve: 165,
} as const;

/** Rounded rectangles around each term (or short-course) data column — stroke scales with ~14 pt cell text. */
export const PDF_GRADES_TERM_BOX_V1 = {
  cornerRadiusPt: 3.5,
  strokeWidthPt: 1.15,
  /** Inset from column edges so adjacent term boxes do not double-stroke the gutter. */
  columnInsetPt: 0.85,
  strokeColor: "#94a3b8",
} as const;

/** Page 1: letterhead, context, academic record, teacher signature. */
export const REPORT_PDF_PAGE1_SECTIONS = [
  "letterhead_block",
  "report_subtitle",
  "student_line",
  "meta_strip",
  "divider",
  "grades_title",
  "grades_intro",
  "grades_table",
  "teacher_signature",
] as const;

export type ReportPdfPage1Section = (typeof REPORT_PDF_PAGE1_SECTIONS)[number];

/** Page 2: parent-facing comment only, then footer + teacher signature. */
export const REPORT_PDF_PAGE2_SECTIONS = ["parent_comment", "generated_stamp", "teacher_signature"] as const;

export type ReportPdfPage2Section = (typeof REPORT_PDF_PAGE2_SECTIONS)[number];

export type ReportPdfLayoutManifest = {
  layoutId: ReportPdfLayoutId;
  layoutVersion: ReportPdfLayoutVersion;
  pageSize: "A4";
  pages: readonly [
    { index: 1; sections: readonly ReportPdfPage1Section[] },
    { index: 2; sections: readonly ReportPdfPage2Section[] },
  ];
};

export const REPORT_PDF_LAYOUT_MANIFEST_V1: ReportPdfLayoutManifest = {
  layoutId: REPORT_PDF_LAYOUT_ID,
  layoutVersion: REPORT_PDF_LAYOUT_VERSION,
  pageSize: "A4",
  pages: [
    { index: 1, sections: REPORT_PDF_PAGE1_SECTIONS },
    { index: 2, sections: REPORT_PDF_PAGE2_SECTIONS },
  ],
};

export function reportPdfLayoutKeywords(): string {
  return `report-o-matic;layout=${REPORT_PDF_LAYOUT_ID};v=${REPORT_PDF_LAYOUT_VERSION}`;
}
