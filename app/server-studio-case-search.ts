import { sql, type SQLWrapper } from "drizzle-orm";

/** SQLite lower() handles ASCII only. Fold the fixed Russian alphabet too;
 * instr keeps punctuation literal and avoids D1's 50-byte LIKE/GLOB limit.
 * Only fixed alphabet constants use raw SQL; the query is always a binding.
 */
export function studioMetadataMatch(column: SQLWrapper, query: string) {
  let folded = sql`${column}`;
  for (const upper of "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ") {
    folded = sql`replace(${folded}, ${sql.raw(`'${upper}'`)}, ${sql.raw(`'${upper.toLowerCase()}'`)})`;
  }
  return sql`instr(lower(${folded}), ${query}) > 0`;
}
