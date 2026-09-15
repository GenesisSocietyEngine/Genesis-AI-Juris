function label(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
}

function InputValues({ values }: { values: Record<string, unknown> }) {
  return <dl>{Object.entries(values).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value !== null && typeof value === "object" && !Array.isArray(value) ? <InputValues values={value as Record<string, unknown>}/> : String(value).replace(/_/g, " ")}</dd></div>)}</dl>;
}

/** A reading projection only: editing and export retain the exact original detail. */
export default function StudioNodeSummary({ node, locale }: { node: { title: string; detail: string }; locale: "en" | "ru" }) {
  const marker = "Pinned reviewed inputs: ";
  const split = node.detail.indexOf(marker);
  let values: Record<string, unknown> | null = null;
  if (split >= 0) {
    try {
      const parsed: unknown = JSON.parse(node.detail.slice(split + marker.length));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) values = parsed as Record<string, unknown>;
    } catch { /* Non-JSON detail is shown verbatim. */ }
  }
  return <div className="studio-node-summary"><h3>{node.title}</h3><p>{values ? node.detail.slice(0, split).trim() : node.detail}</p>{values && <details><summary>{locale === "en" ? "Reviewed inputs" : "Проверенные исходные данные"}</summary><InputValues values={values}/></details>}</div>;
}
