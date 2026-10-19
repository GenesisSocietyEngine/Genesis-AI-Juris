"use client";
import { useState } from "react";
import { parseStudioSources, studioSourceFeedback, suggestStudioHttps } from "./studio-source-input";

export default function StudioSourceField({ sources, locale, onFocus, onChange, onBlur, onCorrect }: {
  sources: string[]; locale: "en" | "ru"; onFocus: (value: string) => void;
  onChange: (sources: string[]) => void; onBlur: (value: string) => void; onCorrect: (sources: string[]) => void;
}) {
  const serialized = sources.join("\n");
  const [input, setInput] = useState({ serialized, text: serialized });
  // Preserve harmless editing whitespace, but reconcile real external changes
  // (undo, restoration) before rendering instead of cascading through an effect.
  if (input.serialized !== serialized) setInput({ serialized, text: parseStudioSources(input.text).join("\n") === serialized ? input.text : serialized });
  const text = input.text;
  const setText = (text: string) => setInput({ serialized, text });
  const en = locale === "en";
  const feedback = studioSourceFeedback(sources, locale);
  const corrections = sources.map(source => suggestStudioHttps(source) ?? source);
  const canCorrect = corrections.some((source, index) => source !== sources[index]);
  return <div className="source-field">
    <label htmlFor="studio-source-urls"><span>{en ? "HTTPS legal sources · one per line" : "HTTPS-источники права · по одному в строке"}</span></label>
    <textarea id="studio-source-urls" rows={3} value={text} placeholder="https://www.nbb.be/" aria-describedby="studio-source-feedback" aria-invalid={sources.length > 0 && !feedback.valid}
      onFocus={() => onFocus(text)} onChange={event => { setText(event.target.value); onChange(parseStudioSources(event.target.value)); }} onBlur={() => onBlur(text)}/>
    <p id="studio-source-feedback" role="status">{feedback.message}</p>
    {canCorrect && <button type="button" className="secondary-cta" onClick={() => { setText(corrections.join("\n")); onCorrect(corrections); }}>{en ? "Add https:// to bare source addresses" : "Добавить https:// к адресам без протокола"}</button>}
  </div>;
}
