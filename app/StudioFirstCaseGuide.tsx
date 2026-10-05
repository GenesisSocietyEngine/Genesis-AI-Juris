"use client";

/** Guidance reflects current content and a confirmed save, never approval. */
export default function StudioFirstCaseGuide({ locale, hasStructure, hasTitle, saved, busy, canSave, needsSignIn, needsProfile = false, savedCaseHref, onBrief, onTitle, onSave, onReport }: {
  locale: "en" | "ru";
  hasStructure: boolean;
  hasTitle: boolean;
  saved: boolean;
  busy: boolean;
  canSave: boolean;
  needsSignIn: boolean;
  needsProfile?: boolean;
  savedCaseHref?: string;
  onBrief: () => void;
  onTitle: () => void;
  onSave: () => void;
  onReport: () => void;
}) {
  const en = locale === "en";
  const structured = hasStructure && hasTitle;
  const action = !hasStructure
    ? { title: en ? "Start with the decision you need to make" : "Начните с решения, которое нужно принять", detail: en ? "Describe the situation, known facts and desired outcome. Review the proposed structure before applying it." : "Опишите ситуацию, известные факты и желаемый результат. Проверьте предложенную структуру перед применением.", label: en ? "Write the brief" : "Описать задачу", run: onBrief }
    : !hasTitle
      ? { title: en ? "Give this case a name" : "Назовите кейс", detail: en ? "A clear title helps you find the saved case and identify its report." : "Понятное название поможет найти сохранённый кейс и его отчёт.", label: en ? "Add a title" : "Добавить название", run: onTitle }
      : !saved
        ? { title: en ? "Save this version so you can return to it" : "Сохраните версию, чтобы вернуться к ней", detail: en ? "Wait for “Saved to workspace”. You can then find it in My cases → Personal. Changes in this tab alone are not a confirmed save." : "Дождитесь статуса «Сохранено в workspace». Затем кейс можно найти в «Мои кейсы → Личные». Правки во вкладке ещё не означают, что кейс сохранён.", label: needsSignIn ? (en ? "Sign in and save" : "Войти и сохранить") : needsProfile ? (en ? "Complete profile and save" : "Заполнить профиль и сохранить") : (en ? "Save this case" : "Сохранить кейс"), run: onSave }
        : { title: en ? "Your saved case is ready to revisit" : "К сохранённому кейсу можно вернуться", detail: en ? "Open the saved copy to check it, or preview a report. A report remains preliminary until independently reviewed and approved." : "Откройте сохранённую копию для проверки или просмотрите отчёт. Отчёт остаётся предварительным до независимой проверки и утверждения.", label: en ? "Preview report" : "Посмотреть отчёт", run: onReport };
  const disabled = busy || (structured && !saved && !canSave);
  return <aside className="first-case-guide page-width" aria-labelledby="first-case-next-title">
    <div className="first-case-next">
      <div><span className="workspace-eyebrow">{en ? "Next step" : "Следующий шаг"}</span><h2 id="first-case-next-title">{action.title}</h2><p>{action.detail}</p></div>
      <div className="first-case-actions"><button type="button" className="primary-cta" onClick={action.run} disabled={disabled} aria-describedby={structured && !canSave ? "first-case-save-limit" : undefined}>{busy ? (en ? "Checking current changes…" : "Проверка текущих изменений…") : action.label}</button>
        {structured && !canSave && <p id="first-case-save-limit" role="status">{en ? "Shorten the case before saving: the working draft exceeds the supported size." : "Сократите кейс перед сохранением: черновик превышает допустимый размер."}</p>}
        {saved && savedCaseHref && <a className="secondary-cta" href={savedCaseHref} target="_blank" rel="noopener noreferrer">{en ? "Open saved copy in a new tab" : "Открыть сохранённую копию в новой вкладке"}</a>}
      </div>
    </div>
    <details className="first-case-checkpoints"><summary>{en ? "Your first case: three checkpoints" : "Первый кейс: три контрольные точки"}</summary>
      <ol>
        <li><b>{en ? "1. Structure the case" : "1. Создайте структуру"}</b><span>{structured ? (en ? "Title and case records are present. Check their accuracy." : "Есть название и записи кейса. Проверьте их точность.") : (en ? "Add a title and reviewed facts, options or outcomes." : "Добавьте название и проверенные факты, варианты или исходы.")}</span></li>
        <li><b>{en ? "2. Save and reopen" : "2. Сохраните и откройте снова"}</b><span>{saved ? (en ? "This version has a confirmed workspace save." : "Сохранение этой версии в рабочем пространстве подтверждено.") : (en ? "Save to your account; a downloaded file or browser draft is separate." : "Сохраните в аккаунте; скачанный файл и черновик браузера хранятся отдельно.")}</span></li>
        <li><b>{en ? "3. Check the report" : "3. Проверьте отчёт"}</b><span>{en ? "Preview, download and open the actual PDF. Saving and exporting do not grant approval." : "Просмотрите, скачайте и откройте PDF. Сохранение и экспорт не означают утверждения."}</span></li>
      </ol>
    </details>
  </aside>;
}
