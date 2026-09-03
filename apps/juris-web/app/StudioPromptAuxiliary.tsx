"use client";

export function CanonicalPromptAction({locale,analysing,disabled,verify}:{locale:"en"|"ru";analysing:boolean;disabled:boolean;verify:()=>void}){
  return <button className="generate-button" disabled={disabled} onClick={verify} aria-busy={analysing}><span className="prompt-action-mark" aria-hidden="true">✓</span><span>{analysing ? (locale === "en" ? "Verifying canonical case…" : "Проверяется канонический кейс…") : (locale === "en" ? "Verify canonical case" : "Проверить канонический кейс")}<small>{locale === "en" ? "Local fingerprint verification · no AI call" : "Локальная проверка отпечатка · без вызова AI"}</small></span><span className="prompt-action-arrow" aria-hidden="true">→</span></button>;
}

export function CanonicalReadyAction({locale,review}:{locale:"en"|"ru";review:()=>void}){
  return <button className="generate-button" onClick={review}><span className="prompt-action-mark" aria-hidden="true">✓</span><span>{locale==="en"?"Review the exact case below":"Проверьте точный кейс ниже"}<small>{locale==="en"?"The embedded fingerprint and graph are valid":"Встроенный отпечаток и схема действительны"}</small></span><span className="prompt-action-arrow" aria-hidden="true">→</span></button>;
}

export function StudioPromptPrivacyNote({locale,canonical}:{locale:"en"|"ru";canonical:boolean}){
  return <p className="ai-privacy-note"><span className="privacy-note-mark" aria-hidden="true">{canonical ? "✓" : "△"}</span>{canonical ? (locale === "en" ? "Canonical case verification is performed locally. The Markdown and embedded graph are not sent to AI." : "Канонический кейс проверяется локально. Markdown и встроенная схема не отправляются AI.") : (locale === "en" ? "AI analysis is explicit: clicking the AI button sends the prompt and current graph to the configured OpenAI API with response storage disabled. API abuse-monitoring logs may still retain content for up to 30 days unless approved retention controls apply. De-identify first; never enter privileged, personal or secret information." : "AI-анализ запускается явно: после нажатия промпт и текущая схема отправляются в настроенный OpenAI API с отключённым хранением ответа. При этом журналы контроля злоупотреблений API могут хранить данные до 30 дней, если для аккаунта не действуют специальные ограничения хранения. Сначала обезличьте данные; не вводите адвокатскую тайну, персональные данные или секреты.")}</p>;
}
