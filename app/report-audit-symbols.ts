import type { ContentText, TFontDictionary } from "pdfmake/interfaces";

// This face preserves the Unicode arrow already recorded by visual editing.
// It is restricted to audit text, outside the fixed Roboto graph geometry.
export const REPORT_AUDIT_SYMBOL_FONT = "ReportAuditSymbols";
export const REPORT_AUDIT_SYMBOL_FONT_SHA256 = "589ea36b4e8c91f01cf9b32f7470e3ba2b48abf2789ac01b08865c2ce5bb8a5f";
export const CASE_REPORT_PDF_FONTS: TFontDictionary = {
  Roboto: {
    normal: "Roboto-Regular.ttf", bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf", bolditalics: "Roboto-MediumItalic.ttf",
  },
  [REPORT_AUDIT_SYMBOL_FONT]: {
    normal: "ReportAuditArrow.ttf", bold: "ReportAuditArrow.ttf",
    italics: "ReportAuditArrow.ttf", bolditalics: "ReportAuditArrow.ttf",
  },
};

/** Preserve the original string exactly, selecting a font only for the arrow. */
export function reportAuditText(value: string): string | ContentText {
  if (!value.includes("→")) return value;
  return {
    text: value.split(/(→+)/u).filter(Boolean).map((text) => /^→+$/u.test(text)
      ? { text, font: REPORT_AUDIT_SYMBOL_FONT }
      : { text }),
  };
}
