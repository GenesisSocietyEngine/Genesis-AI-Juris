"use client";

/** Guidance reflects current content and a confirmed save, never approval. */
export default function StudioFirstCaseGuide({ locale, hasStructure, hasTitle, saved, busy, busyReason = "checking", canSave, needsSignIn, needsProfile = false, onBrief, onTitle }: {
  locale: "en" | "ru";
  hasStructure: boolean;
  hasTitle: boolean;
  saved: boolean;
  busy: boolean;
  busyReason?: "checking" | "saving" | "restoring" | "check_failed";
  canSave: boolean;
  needsSignIn: boolean;
  needsProfile?: boolean;
  onBrief: () => void;
  onTitle: () => void;
}) {
  const en = locale === "en";
  const structured = hasStructure && hasTitle;
  // The header owns Save/Report and their confirmed state.
  if (saved && structured && canSave) return null;
  const action = !hasStructure
    ? { title: en ? "Start with the decision you need to make" : "Начните с решения, которое нужно принять", detail: en ? "Describe the situation, known facts and desired outcome. Review the proposed structure before applying it." : "Опишите ситуацию, известные факты и желаемый результат. Проверьте предложенную структуру перед применением.", label: en ? "Write the brief" : "Описать задачу", run: onBrief }
    : !hasTitle
      ? { title: en ? "Give this case a name" : "Назовите кейс", detail: en ? "A clear title helps you find the saved case and identify its report." : "Понятное название поможет найти сохранённый кейс и его отчёт.", label: en ? "Add a title" : "Добавить название", run: onTitle }
      : { title: en ? "Save your changes using Save above" : "Сохраните изменения кнопкой «Сохранить» выше", detail: en ? "Wait for “Saved to workspace”. You can then find it in My cases → Personal. Changes in this tab alone are not a confirmed save." : "Дождитесь статуса «Сохранено в workspace». Затем кейс можно найти в «Мои кейсы → Личные». Правки во вкладке ещё не означают, что кейс сохранён.", label: "", run: undefined };
  const pending = busyReason === "saving" ? (en ? "Saving…" : "Сохранение…") : busyReason === "restoring" ? (en ? "Preparing workspace…" : "Подготовка рабочего пространства…") : busyReason === "check_failed" ? (en ? "Check needs retry" : "Повторите проверку") : (en ? "Checking current changes…" : "Проверка текущих изменений…");
  return <aside className="first-case-guide first-case-compact page-width" aria-labelledby="first-case-next-title">
    <div className="first-case-prompt">
      <p id="first-case-next-title"><strong>{action.title}</strong></p>
      {action.run && <button type="button" className="secondary-cta" onClick={action.run} disabled={busy}>{action.label}</button>}
      {busy && <p role="status">{pending}</p>}
      {structured && !canSave && <p id="first-case-save-limit" role="status">{en ? "Shorten the case before saving: the working draft exceeds the supported size." : "Сократите кейс перед сохранением: черновик превышает допустимый размер."}</p>}
    </div>
    <details className="first-case-checkpoints"><summary>{en ? "Help with this step" : "Помощь на этом шаге"}</summary>
      <p>{action.detail}</p>
      {needsSignIn && <p>{en ? "Sign in when you use Save above." : "Войдите в аккаунт при сохранении кнопкой выше."}</p>}
      {needsProfile && <p>{en ? "Complete your profile when you use Save above." : "Заполните профиль при сохранении кнопкой выше."}</p>}
      <ol>
        <li><b>{en ? "1. Structure the case" : "1. Создайте структуру"}</b><span>{structured ? (en ? "Title and case records are present. Check their accuracy." : "Есть название и записи кейса. Проверьте их точность.") : (en ? "Add a title and reviewed facts, options or outcomes." : "Добавьте название и проверенные факты, варианты или исходы.")}</span></li>
        <li><b>{en ? "2. Save and reopen" : "2. Сохраните и откройте снова"}</b><span>{saved ? (en ? "This version has a confirmed workspace save." : "Сохранение этой версии в рабочем пространстве подтверждено.") : (en ? "Save to your account; a downloaded file or browser draft is separate." : "Сохраните в аккаунте; скачанный файл и черновик браузера хранятся отдельно.")}</span></li>
        <li><b>{en ? "3. Check the report" : "3. Проверьте отчёт"}</b><span>{en ? "Preview, download and open the actual PDF. Saving and exporting do not grant approval." : "Просмотрите, скачайте и откройте PDF. Сохранение и экспорт не означают утверждения."}</span></li>
      </ol>
    </details>
  </aside>;
}
