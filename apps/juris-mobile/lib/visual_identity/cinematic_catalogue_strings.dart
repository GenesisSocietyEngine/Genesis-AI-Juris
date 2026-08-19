import 'package:flutter/foundation.dart';

/// Presentation-only copy required before the authoritative catalogue loads.
///
/// Case narrative and gameplay copy continue to come exclusively from the
/// mobile case bundle. This resource contains only neutral catalogue chrome,
/// with exact English/Russian parity.
@immutable
final class CinematicCatalogueStrings {
  const CinematicCatalogueStrings._({
    required this.applicationName,
    required this.loadingLibrary,
    required this.loadFailed,
    required this.retry,
    required this.caseIndex,
    required this.selectedCase,
    required this.details,
    required this.selectCase,
    required this.fictionalMark,
    required this.jurisdictionStamp,
    required this.previousCase,
    required this.nextCase,
    required this.browseAllCases,
    required this.allCases,
    required this.playableState,
    required this.authoringState,
    required this.selectedState,
  });

  static const CinematicCatalogueStrings english = CinematicCatalogueStrings._(
    applicationName: 'GENESIS: AI Juris',
    loadingLibrary: 'Loading case library',
    loadFailed: 'The case library could not be loaded.',
    retry: 'Retry',
    caseIndex: 'Case index',
    selectedCase: 'Selected case',
    details: 'Details',
    selectCase: 'Select case',
    fictionalMark: 'FICTIONAL',
    jurisdictionStamp: 'Fictional jurisdiction',
    previousCase: 'Previous case',
    nextCase: 'Next case',
    browseAllCases: 'Browse all cases',
    allCases: 'All cases',
    playableState: 'Playable',
    authoringState: 'In authoring',
    selectedState: 'Selected',
  );

  static const CinematicCatalogueStrings russian = CinematicCatalogueStrings._(
    applicationName: 'GENESIS: AI Juris',
    loadingLibrary: 'Загрузка библиотеки дел',
    loadFailed: 'Не удалось загрузить библиотеку дел.',
    retry: 'Повторить',
    caseIndex: 'Указатель дел',
    selectedCase: 'Выбранное дело',
    details: 'Подробнее',
    selectCase: 'Выбрать дело',
    fictionalMark: 'ВЫМЫШЛЕНО',
    jurisdictionStamp: 'Вымышленная юрисдикция',
    previousCase: 'Предыдущее дело',
    nextCase: 'Следующее дело',
    browseAllCases: 'Все дела',
    allCases: 'Список дел',
    playableState: 'Доступно для игры',
    authoringState: 'В разработке',
    selectedState: 'Выбрано',
  );

  static CinematicCatalogueStrings of(String locale) {
    return locale.toLowerCase().split(RegExp('[-_]')).first == 'ru'
        ? russian
        : english;
  }

  final String applicationName;
  final String loadingLibrary;
  final String loadFailed;
  final String retry;
  final String caseIndex;
  final String selectedCase;
  final String details;
  final String selectCase;
  final String fictionalMark;
  final String jurisdictionStamp;
  final String previousCase;
  final String nextCase;
  final String browseAllCases;
  final String allCases;
  final String playableState;
  final String authoringState;
  final String selectedState;

  String casePosition(int index, int total) {
    return '${index.toString().padLeft(2, '0')} / '
        '${total.toString().padLeft(2, '0')}';
  }

  String selectCaseLabel(String title) => '$selectCase: $title';

  String selectedCaseLabel(String title) => '$selectedCase: $title';

  String startCaseLabel(String action, String title) => '$action: $title';

  String detailsLabel(String title) => '$details: $title';

  String jurisdictionLabel(String jurisdiction) {
    return '$jurisdictionStamp: $jurisdiction';
  }

  String caseSemanticsLabel({
    required int index,
    required int total,
    required String title,
    required String jurisdiction,
    required bool playable,
    required bool selected,
  }) {
    return '${casePosition(index, total)}. $title. $jurisdiction. '
        '${playable ? playableState : authoringState}'
        '${selected ? '. $selectedState' : ''}';
  }
}
