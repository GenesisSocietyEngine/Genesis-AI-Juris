abstract final class LivingCaseStrings {
  static String text(String locale, String english, String russian) =>
      locale == 'ru' ? russian : english;

  static String desk(String locale) =>
      text(locale, 'CRISIS DESK', 'КРИЗИСНЫЙ ШТАБ');

  static String openingEyebrow(String locale) => text(
        locale,
        'A LIVING CASE',
        'ЖИВОЕ ДЕЛО',
      );

  static String enterCase(String locale) =>
      text(locale, 'Enter case', 'Открыть дело');

  static String operationalRecord(String locale) => text(
        locale,
        'Live operational record',
        'Активная оперативная сводка',
      );

  static String activePressure(String locale) =>
      text(locale, 'ACTIVE PRESSURE', 'АКТИВНОЕ ДАВЛЕНИЕ');

  static String quietDesk(String locale) => text(
        locale,
        'No configured regulatory pressure is active.',
        'Активное регуляторное давление не отображается.',
      );

  static String remaining(String locale) =>
      text(locale, 'game minutes remaining', 'игровых минут осталось');

  static String source(String locale) => text(locale, 'Source', 'Источник');

  static String responseWindow(String locale) => text(
        locale,
        'Response window',
        'Окно для ответа',
      );

  static String reviewResponse(String locale) =>
      text(locale, 'Review response', 'Изучить ответ');

  static String controlled(String locale) =>
      text(locale, 'CONTROLLED', 'КОНТРОЛИРУЕМЫЙ');

  static String disclosedRisk(String locale) =>
      text(locale, 'DISCLOSED RISK', 'РАСКРЫТЫЙ РИСК');

  static String visibleMaterial(String locale) => text(
        locale,
        'VISIBLE MATERIAL',
        'ВИДИМЫЕ МАТЕРИАЛЫ',
      );

  static String openDossier(String locale) =>
      text(locale, 'Open dossier', 'Открыть досье');

  static String state(String locale, String english, String russian) =>
      text(locale, english, russian);
}
