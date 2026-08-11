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
}
