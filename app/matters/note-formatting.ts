/** Stored content is plain text. Block commands operate on whole selected lines. */
export function formatNoteBlock(body: string, start: number, end: number, marker: string) {
  const from = start <= 0 ? 0 : body.lastIndexOf("\n", start - 1) + 1;
  const selectedEnd = end > start && body[end - 1] === "\n" ? end - 1 : end;
  const next = body.indexOf("\n", selectedEnd);
  const to = next < 0 ? body.length : next;
  const lines = body.slice(from, to).split("\n");
  const offsets:Array<{at:number;removed:number;added:number}>=[];
  let lineStart=from;
  const formatted = lines.map((line, index) => {
    const content = line.replace(/^(?:#{1,3} |\d+\. |- \[[ xX]\] |- |> \[!NOTE\] |> )/, "");
    const prefix=marker === "1. " ? `${index + 1}. ` : marker;
    offsets.push({at:lineStart,removed:line.length-content.length,added:prefix.length});
    lineStart+=line.length+1;
    return prefix + content;
  }).join("\n");
  const mapped=(point:number)=>{let delta=0;for(const item of offsets){if(point<item.at)break;if(point<=item.at+item.removed)return item.at+delta+item.added;delta+=item.added-item.removed;}return point+delta;};
  return { body: body.slice(0, from) + formatted + body.slice(to), start: mapped(start), end: mapped(end) };
}
