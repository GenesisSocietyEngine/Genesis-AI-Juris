import type { Content, ContentTable, TableCell } from "pdfmake/interfaces";
import type { TaxReportModel } from "./tax-report-model";

/** Presentation only: every value was prepared by the shared Rust report path.
 * Own fresh arrays because pdfmake mutates content during layout. */
export function buildTaxReportPdfSection(model: TaxReportModel): Content[] {
  if (!model.includeEconomics) return [];
  const en = model.language === "en";
  const content: Content[] = [{
    text: en ? "Tax analysis" : "Налоговый анализ",
    fontSize: 16, bold: true, color: "#163445", headlineLevel: 1, margin: [0, 16, 0, 8],
  }];
  for (const section of model.sections) {
    const heading: TableCell[] = [
      { text: section.title, colSpan: 2, bold: true, fontSize: 11, color: "#163445", border: [false, false, false, false] },
      { text: "", border: [false, false, false, false] },
    ];
    const table: ContentTable = {
      table: {
        headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: false, widths: ["43%", "57%"],
        body: [heading, [en ? "Item" : "Параметр", en ? "Value / source" : "Значение / источник"].map(text => ({
          text, bold: true, color: "#ffffff", fillColor: "#163445",
        })), ...section.rows.map(([label, value]) => [{ text: label }, { text: value }])],
      },
      fontSize: 9, lineHeight: 1.15, margin: [0, 6, 0, 10],
      layout: { hLineColor: () => "#b6c4c8", vLineColor: () => "#b6c4c8",
        paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5 },
    };
    content.push(table);
    if (section.note) content.push({ text: section.note, fontSize: 8.5, color: "#53666e", margin: [0, 0, 0, 10] });
  }
  return content;
}
