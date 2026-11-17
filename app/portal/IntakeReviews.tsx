import { ANSWER_LIMIT, answersFit } from "../intake/intake-model";
import type { IntakeReview } from "./contracts";
import s from "./portal.module.css";

type Props = {
  items: IntakeReview[];
  team: boolean;
  active: boolean;
  disabled: boolean;
  recipient?: string;
  ru: boolean;
  drafts: Record<string, string[]>;
  edit: (request: string, answers: string[] | null) => void;
  act: (action: string, fields: Record<string, unknown>) => void;
};

export function IntakeReviews({ items, team, active, disabled, recipient, ru, drafts, edit, act }: Props) {
  if (!items.length) return null;
  return <section className={s.card}>
    <h3>{ru ? "Проверка анкет" : "Intake review"}</h3>
    {items.map(item => {
      const request = item.request;
      const editable = !team && active && !!request && !!item.current && !item.received;
      const answers = (request && drafts[request]) || item.answers;
      return <details className={s.intakeReview} key={item.id + ":" + item.revision}>
        <summary>{item.title} · {ru ? "Версия" : "Version"} {item.revision}</summary>
        {editable && <p>{ru ? "Проверьте ответы и при необходимости измените их перед отправкой." :
          "Review the answers and make any corrections before submitting."}</p>}
        {item.questions.map((question, index) => <div key={index}>
          {editable ? <label>{question.label}
            <textarea data-intake-request={request} required={question.required} disabled={disabled}
              value={answers[index]} maxLength={ANSWER_LIMIT} onChange={event => {
                const next = answers.map((answer, i) => i === index ? event.target.value : answer);
                edit(request, next.every((answer, i) => answer === item.answers[i]) ? null : next);
              }} />
          </label> : <dl><dt>{question.label}</dt>
            <dd>{(item.submitted ?? item.answers)[index] || (ru ? "Без ответа" : "Unanswered")}</dd></dl>}
        </div>)}
        {item.received ? <p>{ru ? "Ответы получены" : "Answers received"} · <time dateTime={item.received}>
          {new Date(item.received).toLocaleString(ru ? "ru" : "en-GB")}</time><br /><small>{ru ? "Номер подтверждения" : "Receipt number"} · {item.receiptNumber}</small></p> :
          !item.current ? <p>{ru ? "Предыдущая версия" : "Previous version"}</p> :
          team && request ? <p>{ru ? "Ожидает ответа клиента" : "Awaiting client response"}</p> :
          team && active ? <button type="button" disabled={disabled} onClick={() =>
            act("requestIntake", { target: item.id, revision: item.revision })}>
            {(ru ? "Отправить эту версию на проверку: " : "Share this version for review with ") + recipient}
          </button> : editable && <button type="button" disabled={disabled || !answersFit(item.questions, answers, true)}
            onClick={() => act("ackIntake", {target: item.id, revision: item.revision, request, answers, confirmed: true})}>
            {ru ? "Подтвердить и отправить ответы" : "Confirm and submit answers"}
          </button>}
      </details>;
    })}
  </section>;
}
