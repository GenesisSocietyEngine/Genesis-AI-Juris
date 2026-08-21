import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/design/juris_design.dart';

import 'visual_golden_harness.dart';

const String canonicalProfessionalUiPilotV2GoldenDirectory =
    'goldens/visual_identity/professional_ui_pilot_v2/'
    'windows_x64_flutter_3_44_8_engine_0cd6107';

const String professionalUiPilotV2GoldenPrefix = 'professional_ui_pilot_v2_';

const Key professionalUiPilotV2GoldenBoundaryKey = ValueKey<String>(
  'professional-ui-pilot-v2-root-overlay-boundary',
);

/// Canonical pixels are owned by the guarded Windows x64 renderer profile.
bool get skipProfessionalUiPilotV2Goldens => !Platform.isWindows;

@immutable
final class ProfessionalUiPilotV2GoldenConfiguration {
  const ProfessionalUiPilotV2GoldenConfiguration({
    required this.logicalSize,
    required this.locale,
    required this.mode,
    this.devicePixelRatio = 1,
    this.textScale = 1,
    this.highContrast = false,
    this.reducedMotion = false,
  });

  final Size logicalSize;
  final Locale locale;
  final JurisVisualMode mode;
  final double devicePixelRatio;
  final double textScale;
  final bool highContrast;
  final bool reducedMotion;
}

typedef ProfessionalUiPilotV2SubjectBuilder = Widget Function(
  JurisVisualModeController visualModeController,
);

Future<void> loadProfessionalUiPilotV2GoldenFonts() =>
    loadCatalogueGoldenFonts();

/// Pumps one deterministic V2 state and captures the complete root Navigator.
///
/// The boundary intentionally lives in [MaterialApp.builder], above the
/// Navigator and its Overlay. Bottom sheets, dialogs, and pushed dossier routes
/// are therefore part of the same canonical image as their shell background.
Future<void> pumpProfessionalUiPilotV2Golden(
  WidgetTester tester, {
  required ProfessionalUiPilotV2GoldenConfiguration configuration,
  required ProfessionalUiPilotV2SubjectBuilder subjectBuilder,
}) async {
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);

  tester.view.devicePixelRatio = configuration.devicePixelRatio;
  tester.view.physicalSize = Size(
    configuration.logicalSize.width * configuration.devicePixelRatio,
    configuration.logicalSize.height * configuration.devicePixelRatio,
  );
  tester.platformDispatcher
    ..localeTestValue = configuration.locale
    ..platformBrightnessTestValue = configuration.mode == JurisVisualMode.office
        ? Brightness.light
        : Brightness.dark
    ..textScaleFactorTestValue = configuration.textScale
    ..accessibilityFeaturesTestValue = FakeAccessibilityFeatures(
      disableAnimations: configuration.reducedMotion,
      accessibleNavigation: configuration.reducedMotion,
      reduceMotion: configuration.reducedMotion,
      highContrast: configuration.highContrast,
    );

  final JurisVisualModeController visualModeController =
      JurisVisualModeController.fixed(configuration.mode);
  addTearDown(visualModeController.dispose);
  final ThemeData theme = JurisTheme.forMode(
    configuration.mode,
    highContrast: configuration.highContrast,
  ).copyWith(platform: TargetPlatform.windows);

  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: configuration.locale,
      supportedLocales: const <Locale>[Locale('en'), Locale('ru')],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: theme,
      darkTheme: theme,
      themeMode: ThemeMode.light,
      builder: (BuildContext context, Widget? navigatorAndOverlay) {
        final MediaQueryData media = MediaQuery.of(context).copyWith(
          size: configuration.logicalSize,
          devicePixelRatio: configuration.devicePixelRatio,
          textScaler: TextScaler.linear(configuration.textScale),
          platformBrightness: configuration.mode == JurisVisualMode.office
              ? Brightness.light
              : Brightness.dark,
          alwaysUse24HourFormat: false,
          highContrast: configuration.highContrast,
          onOffSwitchLabels: false,
          disableAnimations: configuration.reducedMotion,
          invertColors: false,
          accessibleNavigation: configuration.reducedMotion,
          boldText: false,
          supportsAnnounce: false,
          navigationMode: NavigationMode.traditional,
        );
        return MediaQuery(
          data: media,
          child: RepaintBoundary(
            key: professionalUiPilotV2GoldenBoundaryKey,
            child: SizedBox.fromSize(
              size: configuration.logicalSize,
              child: ColoredBox(
                color: theme.scaffoldBackgroundColor,
                child: navigatorAndOverlay!,
              ),
            ),
          ),
        );
      },
      home: subjectBuilder(visualModeController),
    ),
  );
  await settleProfessionalUiPilotV2Golden(tester);
}

Future<void> settleProfessionalUiPilotV2Golden(WidgetTester tester) async {
  await tester.pump();
  await tester.pumpAndSettle(
    const Duration(milliseconds: 100),
    EnginePhase.sendSemanticsUpdate,
    const Duration(seconds: 5),
  );
  expect(tester.takeException(), isNull);
  expect(tester.binding.transientCallbackCount, 0);
}

Future<void> expectProfessionalUiPilotV2Golden(
  WidgetTester tester,
  String fileName,
) async {
  if (!fileName.startsWith(professionalUiPilotV2GoldenPrefix) ||
      !fileName.endsWith('.png') ||
      fileName.contains('/') ||
      fileName.contains(r'\')) {
    throw ArgumentError.value(
      fileName,
      'fileName',
      'V2 golden names must use the canonical prefix and contain no path',
    );
  }
  final Finder boundary = find.byKey(
    professionalUiPilotV2GoldenBoundaryKey,
  );
  expect(boundary, findsOneWidget);
  await expectLater(
    boundary,
    matchesGoldenFile(
      '$canonicalProfessionalUiPilotV2GoldenDirectory/$fileName',
    ),
  );
}
