"use client";

import type { DecisionOption, Scenario } from "./types";

export default function OperationsDossier({ locale, materials, activeMaterial, selectMaterial, caseId, decisions }: {
  locale: "en" | "ru";
  materials: Scenario["materials"];
  activeMaterial: Scenario["materials"][number] | undefined;
  selectMaterial: (ref: string) => void;
  caseId: string;
  decisions: { option: DecisionOption }[];
}) {
  const en = locale === "en";
  return <aside className="dossier-pane" aria-labelledby="operations-dossier-title">
    <div className="pane-heading"><h2 id="operations-dossier-title">{en ? "Dossier" : "Досье"}</h2><b>{materials.length}</b></div>
    <p className="pane-intro">{en ? "Select a document to review its source." : "Выберите документ, чтобы проверить его источник."}</p>
    <div className="material-tabs" aria-label={en ? "Case documents" : "Документы дела"}>
      {materials.map((material, index) => <button type="button" key={material.ref} className={material.ref === activeMaterial?.ref ? "active" : ""} aria-pressed={material.ref === activeMaterial?.ref} onClick={() => selectMaterial(material.ref)}>
        <span className="material-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="material-title">{material.title[locale]}</span>
      </button>)}
    </div>
    {activeMaterial ? <article className="material-sheet" aria-live="polite">
      <span className="document-type">{en ? "Case document" : "Документ дела"}</span>
      <h3>{activeMaterial.title[locale]}</h3>
      <dl>
        <div><dt>{en ? "Source" : "Источник"}</dt><dd>{activeMaterial.source[locale].replace("Canonical mobile case record", "Case record")}</dd></div>
        <div><dt>{en ? "Date / time" : "Дата / время"}</dt><dd>{activeMaterial.date}</dd></div>
      </dl>
      <details className="material-record-details"><summary>{en ? "Record details" : "Сведения о записи"}</summary><dl>
        <div><dt>{en ? "Reference" : "Код документа"}</dt><dd><code>{activeMaterial.ref}</code></dd></div>
        <div><dt>{en ? "Case reference" : "Код кейса"}</dt><dd><code>{caseId}</code></dd></div>
        <div><dt>{en ? "Record type" : "Тип записи"}</dt><dd>{activeMaterial.type[locale]}</dd></div>
      </dl></details>
    </article> : <p className="pane-intro">{en ? "No documents are available at this stage." : "На этом этапе документы ещё недоступны."}</p>}
    {decisions.length > 0 && <section className="mini-log"><h3>{en ? "Decision record" : "Принятые решения"}</h3>{decisions.map((entry, index) => <div key={`${entry.option.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{entry.option.label[locale]}</p></div>)}</section>}
  </aside>;
}
