import {
  blankContact,
  contactProfile,
  IMPORT_LIMIT,
  matchesContact,
  type ContactProfile,
} from "./contact-model";

export const csvHeader = "kind,name,email,phone,group";
const fields = new Set([...csvHeader.split(","), "website", "address", "relationship"]);
type ImportRow = { row: number; name: string; profile?: ContactProfile; issue?: string };

// Parse CSV records, including quoted commas, escaped quotes and CRLF.
function csvRecords(input: string): string[][] {
  if (!input.trim() || input.length > 65536) throw Error("csvSize");
  const records: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const endCell = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
  };
  const endRow = () => {
    endCell();
    if (row.some(Boolean)) records.push(row);
    row = [];
  };
  const text = input.replace(/^\uFEFF/u, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (c === ",") endCell();
    else if (c === "\n") endRow();
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === '"' || (closed && c.trim())) throw Error("csvQuotes");
    else cell += c;
  }
  if (quoted) throw Error("csvQuotes");
  endRow();
  return records;
}
export function reviewContactCsv(text: string, existing: readonly ContactProfile[]): ImportRow[] {
  const [header, ...records] = csvRecords(text);
  if (
    !header ||
    !header.includes("kind") ||
    !header.includes("name") ||
    header.some((k) => !fields.has(k)) ||
    new Set(header).size !== header.length
  )
    throw Error("csvHeader");
  if (!records.length || records.length > IMPORT_LIMIT) throw Error("csvRows");
  const accepted: ContactProfile[] = [];
  return records.map((cells, index) => {
    const row = index + 2,
      name = cells[header.indexOf("name")] || "";
    try {
      if (cells.length !== header.length) throw Error("csvColumns");
      const values = Object.fromEntries(header.map((k, i) => [k, cells[i]]));
      const profile = contactProfile({ ...blankContact("person"), ...values });
      if (
        existing.some((c) => matchesContact(c, profile)) ||
        accepted.some((c) => matchesContact(c, profile))
      )
        throw Error("duplicate");
      accepted.push(profile);
      return { row, name, profile };
    } catch (error) {
      return { row, name, issue: error instanceof Error ? error.message : "invalid" };
    }
  });
}
