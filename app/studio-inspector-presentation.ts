import type { StudioDraft } from "./types";

/** Display only. Never rewrite authored text, runtime rules or historical case bytes. */
export function studioInspectorPresentation(caseType: StudioDraft["caseType"], locale: "en" | "ru") {
  const training = caseType?.id === "training_simulation";
  const label = (en: string, ru: string) => locale === "en" ? en : ru;
  return {
    workflow: training ? "training" : "professional",
    relationAction: training ? label("Choice", "Выбор") : label("Option", "Вариант"),
    optionSection: training ? label("Player choice settings", "Настройки выбора игрока") : label("Option settings", "Настройки варианта"),
    optionBadge: training ? label("PLAYER CHOICE", "ВЫБОР ИГРОКА") : label("DECISION OPTION", "ВАРИАНТ РЕШЕНИЯ"),
    optionQuestion: training ? label("What can the player choose here?", "Что игрок может выбрать здесь?") : label("What can the decision-maker choose here?", "Какие варианты есть у принимающего решение?"),
    optionLabel: training ? label("Action label", "Название действия") : label("Option label", "Название варианта"),
    optionCost: training ? label("Cost · EUR", "Стоимость · EUR") : label("Estimated cost · EUR", "Оценочная стоимость · EUR"),
    optionDuration: training ? label("Duration · minutes", "Длительность · минуты") : label("Estimated duration · minutes", "Оценочная длительность · минуты"),
    consequence: training ? label("Consequence text", "Текст последствия") : label("Hypothetical consequence", "Гипотетическое последствие"),
    optionHelp: training
      ? label("These fields define what the player sees and the time, cost and consequence of this choice.", "Эти поля задают, что увидит игрок, а также время, стоимость и последствие выбора.")
      : label("Estimates and hypothetical consequences support comparison. They do not record work done, time spent, payments or approval.", "Оценки и гипотетические последствия помогают сравнить варианты. Они не подтверждают выполненную работу, затраченное время, платежи или утверждение."),
    costPlaceholder: training ? "0" : label("Step default", "Значение шага"),
    durationPlaceholder: training ? "20" : label("Step default", "Значение шага"),
    stepCost: training ? label("Budgeted node cost · EUR", "Бюджетная стоимость нода · EUR") : label("Estimated step cost · EUR", "Оценочная стоимость шага · EUR"),
    stepDuration: training ? label("Node duration · minutes", "Продолжительность нода · минуты") : label("Estimated step duration · minutes", "Оценочная длительность шага · минуты"),
    stepHelp: training
      ? label("These defaults are charged when the player enters this node. A relation rule may override them.", "Эти значения применяются при входе игрока в узел. Правило конкретной связи может их переопределить.")
      : label("Planning inputs for this step. Option rules may override them in a route simulation. They do not record actual time spent or payments.", "Данные для планирования шага. Правила варианта могут переопределять их в симуляции маршрута. Это не учёт фактического времени или платежей."),
    participantsReady: training ? label("Jurisdiction and player role are explicit", "Юрисдикция и роль игрока определены") : label("Jurisdiction and responsible role are explicit", "Юрисдикция и ответственная роль определены"),
  };
}
