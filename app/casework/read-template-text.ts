/** Import only editable paragraph text. No package relationships, macros or embedded objects are loaded. */
export async function readTemplateText(file: File) {
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decode = (data: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(data);
  let text: string;
  if (/\.docx$/i.test(file.name)) {
    const { unzipSync } = await import("fflate");
    let matches = 0;
    const parts = unzipSync(bytes, {filter(entry) {
      if (entry.name !== "word/document.xml") return false;
      if (++matches !== 1 || entry.originalSize > 1024 * 1024) throw new Error("invalid document");
      return true;
    }});
    if (!parts["word/document.xml"]) throw new Error("missing body");
    const xml = decode(parts["word/document.xml"]);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("invalid XML");
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    if (dom.querySelector("parsererror") || dom.documentElement.namespaceURI !== ns) throw new Error("invalid XML");
    text = Array.from(dom.getElementsByTagNameNS(ns, "p"), p =>
      Array.from(p.getElementsByTagNameNS(ns, "*"), run => {
        if (run.localName === "t") return run.textContent ?? "";
        if (run.localName === "tab") return "\t";
        if (run.localName === "br" || run.localName === "cr") return "\n";
        return "";
      }).join("")
    ).join("\n");
  } else if (/\.txt$/i.test(file.name)) {
    text = decode(bytes);
  } else throw new Error("type");
  if (!text.trim() || text.length > 16000 || text.includes("\0")) throw new Error("body");
  return text;
}
