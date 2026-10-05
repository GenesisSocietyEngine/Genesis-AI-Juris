"use client";

import { useSyncExternalStore } from "react";
import { CASEVANT_HOST, FALCON_STUDIO_HOST } from "./host-mode";

const subscribe = () => () => {};
const currentDomain = () => window.location.hostname === CASEVANT_HOST;
const serverDomain = () => false;

export function CaseVantDomainGuide({ locale }: { locale: "en" | "ru" }) {
  const en = locale === "en";
  const personal = `/matters?collection=personal&lang=${locale}`;
  return <aside className="domain-continuity page-width">
    <details>
      <summary>{en ? "Moving from studio.falcon-merlin.com? Find your existing work" : "Переходите со studio.falcon-merlin.com? Найдите прежнюю работу"}</summary>
      <p>{en ? "Sign in again on casevant.pro with the same account. Your saved workspace cases remain in that account. Device-only drafts and your previous sign-in stay with the earlier address." : "Войдите на casevant.pro в тот же аккаунт. Сохранённые в рабочем пространстве кейсы остаются в аккаунте. Черновики только на устройстве и прежний сеанс входа привязаны к старому адресу."}</p>
      <ol>
        <li>{en ? "Keep the earlier tab open in the same browser and profile. Do not sign out or clear its browser data before preserving a device draft." : "Оставьте старую вкладку открытой в том же браузере и профиле. Не выходите из аккаунта и не очищайте данные браузера, пока не сохраните локальный черновик."}</li>
        <li>{en ? "At the earlier address, open the draft and choose Save to workspace. Wait for Saved to workspace. If export is allowed, you can also keep a case file and use Import case or prompt at the new address." : "На старом адресе откройте черновик и сохраните его в рабочем пространстве. Дождитесь статуса «Сохранено в workspace». Если экспорт разрешён, сохраните также файл кейса и используйте «Импортировать кейс или промпт» на новом адресе."}</li>
        <li>{en ? "On casevant.pro, sign in to the same account, open My cases → Personal and inspect the saved content. Keep the original tab until you have checked the reopened copy. For team cases, select the same organization and use Team." : "На casevant.pro войдите в тот же аккаунт, откройте «Мои кейсы → Личные» и проверьте сохранённое содержимое. Закрывайте исходную вкладку только после проверки копии. Для дел команды выберите ту же организацию и раздел «Команда»."}</li>
      </ol>
      <p>{en ? "If saving or export is unavailable, keep the original tab and resolve the access or save error there. Opening the new address does not transfer an unsaved draft." : "Если сохранение или экспорт недоступны, оставьте исходную вкладку и устраните в ней ошибку доступа или сохранения. Открытие нового адреса не переносит несохранённый черновик."}</p>
      <div className="training-downloads">
        <a href={`https://${FALCON_STUDIO_HOST}/studio?lang=${locale}`} target="_blank" rel="noopener noreferrer">{en ? "Open earlier address in a new tab" : "Открыть старый адрес в новой вкладке"}</a>
        <a href={`/account?lang=${locale}&return_to=${encodeURIComponent(personal)}`} target="_blank" rel="noopener noreferrer">{en ? "Sign in in a new tab" : "Войти в новой вкладке"}</a>
        <a href={personal} target="_blank" rel="noopener noreferrer">{en ? "Open Personal cases in a new tab" : "Открыть личные кейсы в новой вкладке"}</a>
      </div>
    </details>
  </aside>;
}

export default function CaseVantDomainNotice({ locale }: { locale: "en" | "ru" }) {
  const visible = useSyncExternalStore(subscribe, currentDomain, serverDomain);
  return visible ? <CaseVantDomainGuide locale={locale}/> : null;
}
