import { strToU8, zipSync } from "fflate";
const xml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
/** A new macro-free OOXML file, using only the saved text. No external relationships or executable content. */
export function wordDocument(body: string) {
  const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    rel = "http://schemas.openxmlformats.org/package/2006/relationships";
  const p = body
    .split(/\r\n?|\n/)
    .map(
      (line) =>
        "<w:p><w:r>" +
        line
          .split("\t")
          .map((part) => '<w:t xml:space="preserve">' + xml(part) + "</w:t>")
          .join("<w:tab/>") +
        "</w:r></w:p>",
    )
    .join("");
  return zipSync(
    {
      "[Content_Types].xml": strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      "_rels/.rels": strToU8(
        '<Relationships xmlns="' +
          rel +
          '"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      "word/document.xml": strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="' +
          word +
          '"><w:body>' +
          p +
          '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>',
      ),
    },
    { level: 6, mtime: new Date(2000, 0, 1) },
  );
}
