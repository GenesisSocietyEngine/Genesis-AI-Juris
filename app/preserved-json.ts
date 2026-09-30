/** Classify JSON without discarding ambiguous duplicate keys. Callers retain the
 * original text separately: this reader never supplies a reencoded recovery file.
 * JSON.parse remains the grammar/parser; the bounded second walk only checks keys.
 */
export function parsePreservedJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  let position = 0;
  const space = () => { while (/\s/.test(text[position] ?? "") && position < text.length) position++; };
  const string = () => {
    const start = position++;
    while (position < text.length) {
      const character = text[position++];
      if (character === "\\") position++;
      else if (character === '"') return JSON.parse(text.slice(start, position)) as string;
    }
    throw new Error("Invalid JSON string");
  };
  function walk(depth: number): void {
    if (depth > 64) throw new Error("JSON nesting exceeds the supported preservation view");
    space();
    if (text[position] === "{") {
      position++; space();
      const keys = new Set<string>();
      if (text[position] === "}") { position++; return; }
      while (position < text.length) {
        space();
        const key = string();
        if (keys.has(key)) throw new Error(`Duplicate JSON field: ${key}`);
        keys.add(key); space(); position++; // colon, already checked by JSON.parse
        walk(depth + 1); space();
        if (text[position++] === "}") return;
      }
    } else if (text[position] === "[") {
      position++; space();
      if (text[position] === "]") { position++; return; }
      while (position < text.length) {
        walk(depth + 1); space();
        if (text[position++] === "]") return;
      }
    } else if (text[position] === '"') string();
    else while (position < text.length && !/[\s,}\]]/.test(text[position])) position++;
  }
  walk(0);
  return value;
}
