import { caseId, createWorkflow, staff } from "./workflow.mjs";

const flow = createWorkflow();
const el = id => document.getElementById(id);
let ru = false;
let notice = null;
const t = (en, russian) => ru ? russian : en;
const names = {
  intake: ["Intake submitted", "Анкета отправлена"],
  authorize: ["Signature authorized", "Подписание разрешено"],
  sign: ["Test signature recorded", "Тестовая подпись зафиксирована"],
  revise: ["New document version", "Новая версия документа"],
  revoke: ["Access revoked", "Доступ отозван"],
};
const labels = {
  title: ["Client intake and signature", "Анкета клиента и подпись"],
  pilot: ["Local prototype. Use synthetic answers. Signatures are simulated. Reload to reset.", "Локальный прототип. Используйте вымышленные ответы. Подпись имитируется. Чтобы начать заново, обновите страницу."],
  roleLabel: ["Test user", "Тестовый пользователь"],
  intakeTitle: ["Client intake", "Анкета клиента"],
  question: ["What should the case team follow up on?", "Что должна уточнить команда дела?"],
  submit: ["Submit intake", "Отправить анкету"],
  signatureTitle: ["Signature request", "Запрос подписи"],
  confirmLabel: ["I reviewed this exact document version.", "Я ознакомился с этой версией документа."],
  sign: ["Record test signature", "Зафиксировать тестовую подпись"],
  authorize: ["Authorize signature for this recipient", "Разрешить подписание этому получателю"],
  controlsTitle: ["Document and access", "Документ и доступ"],
  revise: ["Create new test version", "Создать новую тестовую версию"],
  revoke: ["Revoke test access", "Отозвать тестовый доступ"],
  evidenceTitle: ["Completion record", "История действий"],
};
function render() {
  const actor = el("role").value, isStaff = actor === staff, view = flow.view(actor);
  document.documentElement.lang = ru ? "ru" : "en";
  el("language").textContent = t("Русский", "English");
  for (const [id, copy] of Object.entries(labels)) el(id).textContent = t(...copy);
  [t("Assigned client","Назначенный клиент"),t("Case staff","Сотрудник"),t("Other client","Другой клиент")].forEach((v,i)=>el("role").options[i].textContent=v);
  el("status").textContent = notice ? t(...notice) : "";
  for (const id of ["record","intake","signature","evidence"]) el(id).hidden = !view;
  el("controls").hidden = !view || !isStaff;
  el("denied").textContent = view ? "" : t("Access unavailable for this test user.", "Этому пользователю доступ закрыт.");
  el("history").replaceChildren();
  if (!view) {
    for (const id of ["identity","content","document","submitted","step"]) el(id).textContent="";
    return;
  }
  el("document").textContent = t("Engagement summary · Version ", "Сводка по поручению · Версия ") + view.version;
  el("identity").textContent = caseId + t(" · Recipient: ", " · Получатель: ") + view.recipient;
  el("content").textContent = view.text;
  const entering = !isStaff && !view.intake;
  for (const id of ["answer","question","submit"]) el(id).hidden = !entering;
  el("submit").disabled = !el("answer").value.trim();
  el("submitted").textContent = view.intake ? view.intake.answer : entering ? "" : t("Awaiting the client's answer.", "Ожидается ответ клиента.");
  el("step").textContent = !view.active ? t("Access revoked.", "Доступ отозван.") : view.signature ? t(...names.sign) : view.authorization ? t("Ready for client review and signature.", "Можно ознакомиться с документом и подписать его.") : t("Case staff must authorize this version after intake.", "После заполнения анкеты сотрудник должен разрешить подписание этой версии.");
  const signing = !isStaff && !!view.authorization && !view.signature;
  el("consent").hidden = el("sign").hidden = !signing;
  el("sign").disabled = !el("confirm").checked;
  el("authorize").hidden = !isStaff;
  el("authorize").disabled = !view.active || !view.intake || !!view.authorization;
  el("revise").disabled = el("revoke").disabled = !view.active;
  for (const event of view.history) {
    const li = document.createElement("li");
    li.textContent = "#" + event.sequence + " · " + t(...names[event.action]) + " · " + event.actor + " → " + event.recipient
      + " · v" + event.version + " · " + new Date(event.at).toLocaleString(ru ? "ru" : "en-GB")
      + (event.authorizationSequence ? t(" · Authorization #", " · Разрешение №") + event.authorizationSequence : "");
    el("history").append(li);
  }
}
function resetForm() { el("answer").value=""; el("confirm").checked=false; }
el("role").onchange = () => { notice=null; resetForm(); render(); };
el("language").onclick = () => { ru=!ru; render(); };
el("answer").oninput = () => { el("submit").disabled = !el("answer").value.trim(); };
el("confirm").onchange = render;
for (const [id, action] of Object.entries({submit:"intake", authorize:"authorize", sign:"sign", revise:"revise", revoke:"revoke"})) {
  el(id).onclick = () => {
    const actor = el("role").value, view = flow.view(actor);
    if (!view) return;
    if (id === "submit") flow.submit(actor, view.version, el("answer").value);
    else if (id === "sign") flow.sign(actor, view.version, el("confirm").checked);
    else if (id === "authorize") flow.authorize(actor, view.version);
    else if (id === "revise") flow.revise(actor);
    else flow.revoke(actor);
    notice=names[action]; resetForm(); render();
  };
}
render();
