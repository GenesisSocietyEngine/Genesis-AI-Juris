/** A local compatibility copy must never override an intentional 4xx denial. */
export function mayUseBundledCatalogueFallback(responseStatus: number | null) {
  return responseStatus === null || responseStatus >= 500;
}

export function playedCaseFallbackMode(responseStatus: number | null): "bundled" | "legacy-only" | "none" {
  if (mayUseBundledCatalogueFallback(responseStatus)) return "bundled";
  if (responseStatus !== null && responseStatus >= 200 && responseStatus < 300) return "legacy-only";
  return "none";
}

export const bundledCataloguePresentation: Record<string, {
  titleRu: string;
  subtitleEn: string;
  subtitleRu: string;
  sectorRu: string;
  summaryRu: string;
  urgency: "critical" | "elevated" | "standard";
}> = {
  be_commercial_failed_erp_001: {
    titleRu: "Неудачное внедрение ERP",
    subtitleEn: "A systems failure becomes a contract dispute",
    subtitleRu: "Системный сбой стал договорным конфликтом",
    sectorRu: "Технологии / внедрение",
    summaryRu: "Asteron Systems предъявляет иск поставщику ERP после провального внедрения. На исход влияют изменения объёма работ, формулировки приёмки, причинность, доказательства, сроки и последовательные средства защиты.",
    urgency: "elevated",
  },
  be_commercial_logistics_001: {
    titleRu: "Неоплаченные логистические счета",
    subtitleEn: "Three routes, one debtor and disappearing cargo",
    subtitleRu: "Три маршрута, один должник и исчезающий груз",
    sectorRu: "Логистика",
    summaryRu: "Velmont Logistics взыскивает неоплаченные счета за перевозку и хранение, а Orbis Retail оспаривает уровень услуг, плату за простой и договорные надбавки.",
    urgency: "standard",
  },
  greenfire_first_72_hours: {
    titleRu: "GreenFire — первые 72 часа",
    subtitleEn: "Fire, regulator and conflicting instructions",
    subtitleRu: "Пожар, регулятор и конфликт инструкций",
    sectorRu: "Промышленность / кризис",
    summaryRu: "Экстренная юридическая работа после промышленного пожара: доказательства, конфликт интересов, страхование, регулятор и защищённая передача дела.",
    urgency: "critical",
  },
  nl_food_safety_goldenshell_001: {
    titleRu: "GoldenShell — отзыв на рассвете",
    subtitleEn: "Contaminated egg supply chain",
    subtitleRu: "Загрязнение цепочки поставок яиц",
    sectorRu: "Пищевая безопасность",
    summaryRu: "Первые 72 часа кризисной работы по загрязнению продукции, отзыву, страхованию и подготовке согласованной претензионной позиции.",
    urgency: "critical",
  },
  us_environmental_desert_water_001: {
    titleRu: "Вода пустыни",
    subtitleEn: "Groundwater, a shared source and the price of proof",
    subtitleRu: "Подземные воды, общий источник и цена доказательства",
    sectorRu: "Экология / массовые требования",
    summaryRu: "Жители Сандиал-Месы подозревают, что шестивалентный хром с объекта Caldera попал в их скважины. Нужно сохранить доказательства, подтвердить источник, соблюсти процессуальные сроки и не утратить право на апелляцию.",
    urgency: "elevated",
  },
};
