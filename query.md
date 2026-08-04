# Разрешённый архитектурный запрос: миграция Failed ERP в authoritative Rust runtime

## Статус: решения получены и реализованы локально

Этот файл сохраняется как исходная ambiguity matrix и provenance принятых
решений. Он больше не описывает текущий implementation status и не блокирует
локальную реализацию.

Authoritative решения получены 2026-08-04 и реализованы на ветке
`refactor/failed-erp-authoritative-rust` от base
`3c27eb2782a61662d7ceffbd19e5434bce389470`. Проверенный implementation HEAD
до документационного коммита:
`6a27e53549b06911e81fe8c9a61eae3e814fca30`.

Итоговый контракт, compatibility policy, fingerprint, traces, тесты, Android
evidence и остающиеся риски записаны в
`docs/development/FAILED_ERP_RUST_MIGRATION_V1.md` и накопительном
`docs/development/CURRENT_PROGRESS.md`.

## Назначение документа

Изначально этот документ предназначался для передачи в ChatGPT как
самостоятельный архитектурный запрос до начала реализации. Нижеследующее
состояние и формулировки сохранены исторически, чтобы было видно, какие именно
противоречия были разрешены без молчаливой смены семантики.

## Проверенное состояние репозитория на момент запроса

- Репозиторий: `GenesisSocietyEngine/Genesis-AI-Juris`.
- Текущая локальная ветка: `refactor/failed-erp-authoritative-rust`.
- Проверенный base, HEAD и `origin/main`: `3c27eb2782a61662d7ceffbd19e5434bce389470`.
- Рабочее дерево чистое; изменений и коммитов Failed ERP пока нет.
- Неожиданных коммитов после проверенного base не обнаружено.
- PR #4 не изменялся и не закрывался.
- Публикация, PR, tag и release для этой миграции не выполнялись.

Desert Water безопасно отложен:

- локальная ветка: `feat/desert-water-case`;
- HEAD: `44e565b22c52a4c3a3e69b2c137353b7771fcf77`;
- все четыре коммита `c0ad5a3`, `18f65ce`, `7ca533c`, `44e565b` достижимы;
- ветка не опубликована, PR/tag/release отсутствуют;
- изменять или публиковать Desert Water до завершения Failed ERP нельзя.

## Цель checkpoint

Мигрировать Failed ERP, находящийся на позиции 1 каталога, из Flutter/Dart-owned gameplay в обычный декларативный `ScenarioDefinition`, исполняемый generic authoritative Rust runtime.

После миграции Rust должен владеть:

- командами и их допустимостью;
- стадиями и переходами;
- временем и стоимостью;
- фактами и доказательствами;
- deadlines и async tasks;
- исходами, Matter Lifecycle и Dossier Projection;
- deterministic replay, persistence, fingerprint и canonical traces.

Flutter должен только отображать authoritative snapshot и отправлять команды. Case-specific ветви в generic Rust runtime, bridge или Flutter mapper запрещены.

## Текущая граница authority

Failed ERP пока не является Rust-сценарием:

- `CaseRuntimeFactory` направляет adapter `demo_failed_erp` непосредственно в `DemoGameRepository`;
- mutable session state, action legality, ordering, time, costs, deadlines, evidence, score calculations, outcomes и closure находятся в `apps/juris-mobile/lib/data/demo_game_repository.dart`;
- generated mobile bundle публикует `scenario_id: be_commercial_failed_erp_001`, `runtime_adapter: demo_failed_erp`, `engine_runtime: false` и не содержит `ScenarioDefinition`;
- текущая реализация содержит 37 реально создаваемых действий и один недостижимый switch alias;
- полноценного набора `FactDefinition` и `DossierProjection` нет;
- gameplay-тексты находятся на английском даже при выборе русского языка; локализована только карточка каталога.

## Persistence: установленный факт

Поддерживаемый legacy save для Failed ERP не мог быть создан приложением:

- `GameRuntimeRepository.supportsPersistence` по умолчанию возвращает `false`;
- `DemoGameRepository` не переопределяет persistence API;
- factory не передаёт Demo repository хранилище сохранений;
- save/load реализован только для `RustScenarioRepository`;
- отдельного Demo serializer, command log или альтернативного хранилища не найдено.

Следствие: формат legacy save для миграции отсутствует. Произвольно внедрённый или несовместимый файл следует отклонять атомарно, не изменяя активную Rust/Flutter session.

Нельзя изменять следующие compatibility contracts:

- `genesis.ai-juris.command-log`;
- envelope schema version `1` и восьмиполевая envelope;
- `scenario-runtime-v2`;
- существующий final-state digest contract;
- C ABI version `1` и три существующих native exports.

## Блокирующие противоречия

### 1. Сторона игрока

Authoritative catalogue identity говорит:

- case ID: `be_commercial_failed_erp_001`;
- claimant: Asteron Systems NV;
- defendant: Northbridge Consulting BV;
- `player_client_id: northbridge_consulting`.

Но фактический Dart gameplay ведётся от лица покупателя/истца:

- opening message сообщает, что «наш ERP supplier» сорвал проект;
- клиент оценивает свои потери в EUR 240,000;
- действия включают начало производства, statement of claim, claimant appeal и claimant cassation;
- благоприятное решение устанавливает material supplier breach и присуждает damages.

Одновременно сохранить Northbridge как клиента-ответчика и claimant-side gameplay невозможно.

### 2. Stable scenario identity

Существуют три конкурирующие поверхности identity:

- case ID: `be_commercial_failed_erp_001`;
- ID старого template: `failed-erp-implementation`;
- текущий generated bundle публикует `scenario_id: be_commercial_failed_erp_001`, потому что `engine_runtime` отключён.

После включения Rust exporter берёт ID из `ScenarioDefinition.metadata.id` и разрешает только underscore-style stable IDs. Значение `failed-erp-implementation` с дефисами exporter не принимает. Поддерживаемого persisted Failed ERP ID нет, поскольку legacy persistence отсутствует.

### 3. Template JSON против реально исполняемого Dart

`content/cases/failed_erp.json` не является фактическим gameplay authority и расходится с наблюдаемым поведением:

- opponent offer: EUR 60,000 в template против EUR 64,500 в игре;
- junior turnaround: 240 минут против фиксированного Day 1 13:30;
- expert turnaround: 600 минут против `currentDay + 2` в 08:00;
- hearing delay: 2 дня против `max(currentDay + 3, Day 5)`.

Нужно определить, является ли источником parity фактический `DemoGameRepository` или старый template.

### 4. Непредставимые финансовые и числовые состояния

Legacy Dart накапливает и показывает:

- legal spend;
- authorized budget;
- action billable minutes;
- fatigue и cumulative strain;
- merits, evidence, procedure, leverage, ethics и client trust.

Эти значения влияют на availability и исходы. Generic `ScenarioRuntime` сейчас содержит clock и `cost_eur` отдельных доступных действий, но не authoritative accumulated spend/budget/billable state. Flutter mapper для Rust-сценариев подставляет `spendEur: 0`, `authorizedBudgetEur: 0`, а `billableMinutes` приравнивает ко всему clock time.

Буквальная parity требует generic, не case-specific, расширения runtime/snapshot/replay. Необходимо определить, как сделать это без изменения compatibility-sensitive persistence и digest контрактов существующих сценариев.

### 5. Непредставимая динамическая механика

Текущий `ScenarioDefinition` не выражает буквально:

- score- и seed-based judgment/appeal/cassation formulas;
- relative deadlines, создаваемые после judgment или appeal result;
- динамическую hearing date и её rescheduling;
- inactivity counters, warnings и client termination;
- dynamic rest/fast-forward до следующего рабочего дня;
- fact-revision-dependent repeatability;
- dynamic budget authorization;
- start-before-deadline против completion-before-deadline semantics.

Условия generic schema работают со stage, flags, facts, evidence, deadlines, tasks, Inbox и judicial result, но не с clock predicates, числовыми scores, seed predicates или arithmetic counters. Deadlines имеют только абсолютный `due_at`.

### 6. Legacy time defects

Наблюдаемое Dart-поведение само противоречиво:

- некоторые действия показывают 30 минут, но фактически не двигают clock;
- ряд handlers выставляет абсолютное время и способен перевести clock назад;
- `_timeAfter` может перейти через полночь без увеличения номера дня;
- claim/appeal/cassation могут начаться до deadline, завершиться после него и всё равно закрыть deadline как выполненный;
- некоторые action handlers не обрабатывают промежуточные deadline/event boundaries.

Нужно решить, считать ли эти дефекты частью обязательной parity или исправить их общей authoritative boundary-processing семантикой.

### 7. Matter Lifecycle

Legacy Failed ERP не устанавливает authoritative `matterLifecycle`, `judicialResult` или `judicialDecisionInstance`. Closure выводится из `outcomeSummary`.

Дополнительное противоречие:

- результат cassation `quashed and remitted for rehearing` сейчас terminal и закрывает дело, хотя текст прямо говорит, что спор возвращён на новое рассмотрение;
- `limited cassation review admitted` также принудительно закрывается, несмотря на необходимость дальнейшей работы.

Нужно определить authoritative lifecycle для каждого результата без нарушения принципа «Lost != Closed».

### 8. Dossier и локализация

Legacy implementation содержит только presentation-level evidence:

- `contract`;
- `changes`;
- `emails`;
- `acceptance`;
- `independent-expert-report`.

Формальных facts, hidden entities, relationships и nested Dossier нет. Создание Rust Dossier неизбежно вводит новые stable IDs и visibility semantics.

Также требуется решить, является ли полная EN/RU локализация gameplay обязательной частью миграции или нужно сохранять старый English-only дефект.

## Вопросы, требующие решения ChatGPT

Дайте однозначный ответ по каждому пункту.

1. **Кого представляет игрок?**
   - Asteron Systems NV как claimant/buyer, сохраняя фактический legacy gameplay; или
   - Northbridge Consulting BV как defendant/supplier, сохраняя catalogue identity, но переписывая перспективу дела?

2. **Какой stable Rust scenario ID использовать?**
   - `be_commercial_failed_erp_001`;
   - новый underscore ID, например `failed_erp_implementation`;
   - иной ID с описанной alias/compatibility policy?

3. **Какой источник считать behavioral authority?**
   - фактически исполняемый `DemoGameRepository`;
   - старый `content/cases/failed_erp.json`;
   - явно описанный гибрид с таблицей каждого выбранного значения?

4. **Разрешено ли расширить generic ScenarioDefinition/runtime?**
   Нужны как минимум initial clock, accumulated financial projection, числовые metrics/counters, relative deadlines, deterministic seed predicates и dynamic fast-forward. Предложите backward-compatible способ, который не изменит fingerprints, traces, saves и digests Logistics, GreenFire и GoldenShell.

5. **Какая deadline semantics является authoritative?**
   - действие должно завершиться до deadline;
   - достаточно начать действие до deadline;
   - отдельная policy на уровне action/deadline?

6. **Следует ли сохранять legacy time bugs?**
   Определите правила для zero-minute действий, clock rewind, midnight rollover и пропущенных intermediate boundaries.

7. **Как сопоставить результаты с Matter Lifecycle?**
   Перечислите lifecycle, judicial result, remedy availability и closure для settlement, procedural default, first-instance win/mixed/loss, appeal win/loss, cassation dismissed, cassation admitted и quashed/remitted.

8. **Как определить Dossier v1 для Failed ERP?**
   Предложите минимальный набор stable fact/evidence IDs, initial visibility, reveal transitions и relationships, не добавляя новую сюжетную информацию.

9. **Как поступить с RU presentation?**
   - создать полную RU localization с теми же stable IDs и ordering; или
   - сохранить English-only legacy presentation?

10. **Как обеспечить cost parity без нарушения persistence/digest compatibility?**
    Нужен конкретный ownership и derivation design: что хранится в runtime state, что выводится из command log, что входит в snapshot и final-state digest.

## Ограничения для предлагаемого решения

Ответ не должен:

- добавлять case-specific код в generic Rust runtime, bridge или Flutter mapper;
- менять существующие fingerprints, canonical traces, outcomes, costs или final minutes Logistics, GreenFire и GoldenShell;
- менять `genesis.ai-juris.command-log`, envelope v1, восьмиполевую envelope, `scenario-runtime-v2`, C ABI v1 или три native symbols;
- изменять или публиковать Desert Water;
- начинать Snapshot Visibility Hardening, Pressure & Countermove или Legal Theory;
- предлагать push, PR, tag, release или merge на этом этапе.

## Требуемый формат ответа

1. Таблица решений по всем десяти вопросам: **решение**, **обоснование**, **совместимость**, **последствие для legacy gameplay**.
2. Явный список того, что считается обязательной parity, а что является одобренным исправлением legacy defect.
3. Предлагаемая generic архитектура без case-specific branches.
4. Compatibility strategy для существующих трёх Rust-сценариев и будущих Failed ERP saves.
5. Authoritative mapping всех terminal и non-terminal результатов на Matter Lifecycle.
6. Минимальный Dossier stable-ID inventory и visibility transitions.
7. Последовательность локальных implementation commits и validation gates.
8. Список остающихся рисков или вопросов, по которым всё ещё требуется решение владельца продукта.

Это условие выполнено: реализация началась только после получения решений.
Текущий stop point — локальное ревью семи изолированных коммитов. Push, PR,
merge, tag, release, публикация Desert Water и последующие roadmap-фазы всё
ещё требуют отдельного явного разрешения.
