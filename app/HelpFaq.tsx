"use client";

type Locale = "en" | "ru";

const answers: Record<Locale, Array<[string, string]>> = {
  en: [
    ["How does AI turn my prompt into a scheme?", "After sign-in and professional-profile registration, Understand with AI proposes semantic actors, facts, evidence, decisions, outcomes and relationships from the prompt and current graph you explicitly provide. De-identify both first. Nothing changes until every proposed runtime field and relationship rule is reviewed and applied. Studio then assigns stable IDs and coordinates, validates the graph and records one undoable revision. AI does not verify law, evidence or tax conclusions; the exact-command fallback remains available."],
    ["Where is my Studio case saved?", "Save on this device is limited to signed-in, local, unprotected and non-Private drafts; the copy is account-scoped and cleared on sign-out. Anonymous, workspace, protected and Private cases are not cached there. Save to workspace stores the custom case under your account."],
    ["Who can see a custom case?", "A restricted custom case is visible to its owner, the platform administrator and registered users with an explicit grant. It is not discoverable by other users or listed in the General Library."],
    ["What changes when I turn on Private?", "Only the owner can open the workspace case through the product; grants are revoked and administrators and reviewers are excluded. This is application access control, not end-to-end encryption. Private cases cannot be submitted or promoted."],
    ["Where do the case rules live?", "Rules DSL v1 lives on relationships and node runtime fields: guards, metric effects, time, cost, repeatability, deadlines and terminal outcomes. The server recompiles publication and validates each signed-in decision. Fingerprints protect integrity and version identity, not secrecy."],
    ["What does JSON lineage protection prevent?", "A server code and HMAC seal bind the exact Studio fingerprint, parent identity and copy policy. A locked parent keeps every child locked, and non-owner recipients cannot export, duplicate or fork it through the product. This is tamper-evident lineage and access control, not encryption or DRM."],
    ["What happens with hundreds of cases and about 100 users?", "The library pages metadata and loads one immutable manifest on launch. A Worker evaluates one bounded decision and persists a revisioned D1 session; stale tabs receive a conflict. AI authoring is isolated behind profile, tier, network and tenant-wide budget limits."],
    ["How is a custom case published?", "After structural, source and applicable legal or tax review gates pass, an administrator publishes an immutable server-compiled snapshot. The centrally managed publication and custom workspace source remain separate."],
    ["How does Private-case feedback work?", "Keep an owner-only note, or send product feedback with case identifiers, fingerprint and node context removed. For substantive case review, turn off Private and share or submit that exact restricted version."],
    ["Do I need an account?", "Not for General Library cases. Sign-in is required for workspace, sharing, attributed feedback, profiles and targeted updates. A local password can be enrolled after trusted ChatGPT identity confirmation and reset by a 15-minute email link, offline code or that trusted identity."],
    ["Can I create tax-planning cases?", "Yes. Studio supports entities, cash flows, tax rules and implementation economics. ROI, payback and NPV are authored estimates, not advice or guaranteed savings. Publication requires current sources and anti-abuse review."],
    ["What data is stored?", "The service can store registration email, derived password credentials, hashed session/recovery proofs, profile, opt-in preferences, subscriptions, workspace cases, feedback and private notes. Plaintext passwords and recovery proofs are not stored. Never submit privileged or client-identifying facts."],
    ["Is this legal or tax advice?", "No. These are simulations for training and structured professional discussion. Verify current law and facts before real-world use."],
  ],
  ru: [
    ["Как ИИ превращает промпт в схему?", "После входа и регистрации профессионального профиля команда «Понять с ИИ» предлагает содержательные узлы и связи на основе явно переданных промпта и текущего графа. Сначала обезличьте оба источника. До проверки всех runtime-полей и правил связей и применения плана ничего не меняется. Studio назначает стабильные ID и координаты, проверяет граф и создаёт одну отменяемую ревизию. ИИ не проверяет право, доказательства или налоговые выводы; режим точных команд остаётся доступным."],
    ["Где сохраняется кейс Studio?", "Сохранение на устройстве доступно авторизованному пользователю только для локального, незащищённого и неприватного черновика; копия привязана к аккаунту и удаляется при выходе. Анонимные, workspace-, защищённые и приватные кейсы там не кэшируются. Workspace хранит custom-кейс в аккаунте."],
    ["Кто видит custom-кейс?", "Ограниченный custom-кейс видят владелец, администратор платформы и зарегистрированные пользователи с явным доступом. Для остальных он недоступен и не появляется в Общей библиотеке."],
    ["Что меняется при включении «Приватно»?", "Кейс через продукт открывает только владелец; доступы отзываются, администратор и рецензенты исключаются. Это контроль доступа, а не сквозное шифрование. Приватный кейс нельзя отправить или опубликовать."],
    ["Где находятся правила кейса?", "Rules DSL v1 задаётся на связях и runtime-полях узлов: guards, метрики, время, стоимость, повторяемость, сроки и исходы. Сервер заново компилирует публикацию и проверяет каждое авторизованное решение. Fingerprints защищают целостность и версию, но не скрывают правила."],
    ["От чего защищает JSON lineage protection?", "Серверный код и HMAC-печать связывают точный Studio fingerprint, родителя и политику копирования. Защита родителя наследуется детьми, а не-владелец не может экспортировать, копировать или форкнуть кейс через продукт. Это контроль линии и доступа, не шифрование и не DRM."],
    ["Что происходит при сотнях кейсов и примерно 100 пользователях?", "Библиотека загружает страницы метаданных и один неизменяемый манифест при запуске. Worker обсчитывает одно ограниченное решение и сохраняет ревизионную сессию в D1; устаревшая вкладка получает конфликт. AI отделён лимитами профиля, тарифа, сети и общего бюджета."],
    ["Как custom-кейс публикуется?", "После структурных, источниковых и применимых юридических или налоговых проверок администратор публикует неизменяемый снимок, скомпилированный сервером. Публикация и источник workspace остаются раздельными."],
    ["Как работает фидбэк по приватному кейсу?", "Сохраните заметку только владельцу либо отправьте продуктовый отзыв без ID кейса, fingerprint и контекста узлов. Для содержательной рецензии отключите «Приватно» и поделитесь точной ограниченной версией."],
    ["Нужна ли регистрация?", "Не для Общей библиотеки. Вход нужен для workspace, доступа, авторизованных отзывов, профиля и обновлений. Локальный пароль подключается после доверенного подтверждения ChatGPT и сбрасывается по 15-минутной email-ссылке, офлайн-коду или доверенной личности."],
    ["Можно ли создавать налоговые кейсы?", "Да. Studio поддерживает компании, денежные потоки, налоговые правила и экономику внедрения. ROI, окупаемость и NPV — авторские оценки, а не совет или гарантия. Для публикации нужны актуальные источники и anti-abuse review."],
    ["Какие данные сохраняются?", "Сервис может хранить email, производные пароля, хэши сессионных и recovery-доказательств, профиль, opt-in настройки, подписки, workspace-кейсы, отзывы и приватные заметки. Пароли и recovery-доказательства в открытом виде не сохраняются. Не отправляйте адвокатскую тайну или данные клиента."],
    ["Это юридическая или налоговая консультация?", "Нет. Это симуляции для обучения и профессионального обсуждения. Перед реальным применением проверяйте факты и актуальное право."],
  ],
};

export default function HelpFaq({ locale }: { locale: Locale }) {
  return <section className="help-faq">
    <h2>{locale === "en" ? "Short answers" : "Короткие ответы"}</h2>
    {answers[locale].map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}</summary><p>{answer}</p></details>)}
  </section>;
}
