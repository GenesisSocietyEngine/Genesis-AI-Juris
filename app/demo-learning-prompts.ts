import type { LocalText } from "./types";

const text = (en: string, ru: string): LocalText => ({ en, ru });
export const CANOPY_LEARNING_PROMPT = text(
  "Compare expansion, a conditional 90-day pilot, deferral and decline. Identify the evidence and clearance needed before commitment; explain your preferred route.",
  "Сравните расширение, условный пилот на 90 дней, отсрочку и отказ. Укажите доказательства и разрешения, необходимые до принятия обязательств; обоснуйте выбранный маршрут.",
);
const prompts: Record<string, LocalText> = {
  be_commercial_failed_erp_001: text("Compare settlement and a claim after the ERP failure. Identify acceptance and causation evidence before choosing a remedy.", "Сравните соглашение и предъявление требования после сбоя ERP. Проверьте доказательства приёмки и причинности до выбора средства защиты."),
  be_commercial_logistics_001: text("Separate supported invoice amounts from disputed charges. Choose a recovery route and explain which delivery evidence you still need.", "Отделите подтверждённые суммы счетов от спорных начислений. Выберите путь взыскания и укажите недостающие доказательства доставки."),
  greenfire_first_72_hours: text("Prioritize evidence preservation, regulatory response and insurance notice in the first 72 hours. Explain how you handle conflicting instructions.", "Определите приоритеты сохранения доказательств, ответа регулятору и уведомления страховщика в первые 72 часа. Объясните действия при конфликте инструкций."),
  nl_food_safety_goldenshell_001: text("Choose the first containment and recall actions. Trace affected products and explain what evidence supports your next decision.", "Выберите первые меры локализации и отзыва. Проследите затронутую продукцию и обоснуйте следующее решение доказательствами."),
  us_environmental_desert_water_001: text("Assess the suspected contamination without assuming causation. Choose evidence-preservation steps and identify procedural questions requiring verification.", "Оцените предполагаемое загрязнение без допущения доказанной причинности. Выберите меры сохранения доказательств и процессуальные вопросы для проверки."),
};

/** Learner tasks, never additional scenario facts or verified legal conclusions. */
export function demoLearningPrompt(id: string, locale: "en" | "ru"): string {
  return (prompts[id] ?? text(
    "Compare the available choices, identify missing evidence and explain your decision before reviewing the outcome.",
    "Сравните доступные варианты, укажите недостающие доказательства и обоснуйте решение до просмотра исхода.",
  ))[locale];
}
