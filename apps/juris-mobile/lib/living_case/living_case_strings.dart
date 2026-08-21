abstract final class LivingCaseStrings {
  static String text(String locale, String english, String russian) =>
      locale == 'ru' ? russian : english;

  static String desk(String locale) =>
      text(locale, 'CRISIS DESK', 'КРИЗИСНЫЙ ШТАБ');

  static String operations(String locale) =>
      text(locale, 'OPERATIONS', 'ОПЕРАЦИИ');

  static String currentSituation(String locale) => text(
        locale,
        'CURRENT SITUATION',
        'ТЕКУЩАЯ СИТУАЦИЯ',
      );

  static String operationalStatus(String locale) => text(
        locale,
        'OPERATIONAL STATUS',
        'ОПЕРАТИВНЫЙ СТАТУС',
      );

  static String currentPhase(String locale) =>
      text(locale, 'Current phase', 'Текущая стадия');

  static String attention(String locale) =>
      text(locale, 'Inbox attention', 'Требуют внимания');

  static String decisions(String locale) =>
      text(locale, 'Available decisions', 'Доступные решения');

  static String pressureResponses(String locale) =>
      text(locale, 'Pressure responses', 'Ответы на давление');

  static String matterStatus(String locale) =>
      text(locale, 'Matter status', 'Статус дела');

  static String lifecycle(String locale) =>
      text(locale, 'Lifecycle', 'Стадия производства');

  static String matterState(String locale) =>
      text(locale, 'Matter state', 'Состояние дела');

  static String openMatter(String locale) => text(locale, 'Open', 'Открыто');

  static String closedMatter(String locale) =>
      text(locale, 'Closed', 'Закрыто');

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

  static String source(String locale) => text(locale, 'Source', 'Источник');

  static String responseWindow(String locale) => text(
        locale,
        'Response window',
        'Окно для ответа',
      );

  static String reviewResponses(String locale, int count) => text(
        locale,
        'Review pressure responses · $count',
        'Рассмотреть ответы на давление · $count',
      );

  static String noResponses(String locale) => text(
        locale,
        'No projected responses are available.',
        'Доступные ответы не отображаются.',
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

  static String noVisibleMaterial(String locale) => text(
        locale,
        'No additional projected material is visible.',
        'Дополнительные отображаемые материалы отсутствуют.',
      );

  static String recentCommunication(String locale) => text(
        locale,
        'Recent communication',
        'Последнее сообщение',
      );

  static String deadline(String locale) => text(locale, 'Deadline', 'Срок');

  static String status(String locale) => text(locale, 'Status', 'Статус');

  static String reviewAllActions(String locale) => text(
        locale,
        'Review all available decisions',
        'Все доступные решения',
      );

  static String openOutcomeDossier(String locale) => text(
        locale,
        'Open outcome dossier',
        'Открыть итоговое досье',
      );

  static String openDossier(String locale) =>
      text(locale, 'Open dossier', 'Открыть досье');

  static String state(String locale, String english, String russian) =>
      text(locale, english, russian);
}
