import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';

const String canonicalVisualGoldenDirectory =
    'goldens/visual_identity/foundation/'
    'windows_x64_flutter_3_44_8_engine_0cd6107';

const String canonicalCatalogueGoldenDirectory =
    'goldens/visual_identity/catalogue/'
    'windows_x64_flutter_3_44_8_engine_0cd6107';

const Key visualGoldenBoundaryKey = ValueKey<String>('visual-golden-boundary');

/// Pixel tests are intentionally skipped outside the documented canonical
/// Windows profile. Structural visual tests remain cross-platform.
bool get skipCanonicalVisualGoldens => !Platform.isWindows;

@immutable
final class VisualGoldenConfiguration {
  const VisualGoldenConfiguration({
    required this.logicalSize,
    required this.locale,
    this.devicePixelRatio = 1,
    this.textScale = 1,
    this.highContrast = false,
    this.reducedMotion = false,
  });

  final Size logicalSize;
  final Locale locale;
  final double devicePixelRatio;
  final double textScale;
  final bool highContrast;
  final bool reducedMotion;
}

Future<void>? _fontLoad;
Future<void>? _catalogueFontLoad;

Future<void> loadJurisGoldenFonts() {
  return _fontLoad ??= Future.wait<void>(<Future<void>>[
    _loadFontFamily(
      'JurisLiterata',
      const <String>['assets/fonts/Literata-SemiBold.ttf'],
    ),
    _loadFontFamily(
      'JurisPlexSans',
      const <String>[
        'assets/fonts/IBMPlexSans-Regular.ttf',
        'assets/fonts/IBMPlexSans-SemiBold.ttf',
      ],
    ),
    _loadFontFamily(
      'JurisPlexMono',
      const <String>['assets/fonts/IBMPlexMono-Medium.ttf'],
    ),
  ]);
}

/// Adds Flutter's bundled Material icon font for catalogue screenshots.
///
/// Foundation baselines intentionally retain their established font-load
/// boundary; catalogue screens render production icon controls and therefore
/// load the exact test-bundle MaterialIcons asset as well.
Future<void> loadCatalogueGoldenFonts() {
  return _catalogueFontLoad ??= Future.wait<void>(<Future<void>>[
    loadJurisGoldenFonts(),
    _loadFontFamily(
      'MaterialIcons',
      const <String>['fonts/MaterialIcons-Regular.otf'],
    ),
  ]);
}

Future<void> _loadFontFamily(String family, List<String> assets) {
  final FontLoader loader = FontLoader(family);
  for (final String asset in assets) {
    loader.addFont(rootBundle.load(asset));
  }
  return loader.load();
}

Future<void> pumpVisualGolden(
  WidgetTester tester, {
  required VisualGoldenConfiguration configuration,
  required Widget subject,
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
    ..platformBrightnessTestValue = Brightness.dark
    ..textScaleFactorTestValue = configuration.textScale
    ..accessibilityFeaturesTestValue = FakeAccessibilityFeatures(
      disableAnimations: configuration.reducedMotion,
      accessibleNavigation: configuration.reducedMotion,
      reduceMotion: configuration.reducedMotion,
      highContrast: configuration.highContrast,
    );

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
      theme: JurisTheme.dark().copyWith(platform: TargetPlatform.windows),
      builder: (BuildContext context, Widget? appChild) {
        final MediaQueryData media = MediaQuery.of(context).copyWith(
          size: configuration.logicalSize,
          devicePixelRatio: configuration.devicePixelRatio,
          textScaler: TextScaler.linear(configuration.textScale),
          platformBrightness: Brightness.dark,
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
        return MediaQuery(data: media, child: appChild!);
      },
      home: RepaintBoundary(
        key: visualGoldenBoundaryKey,
        child: SizedBox.fromSize(
          size: configuration.logicalSize,
          child: Material(
            color: JurisTheme.dark().scaffoldBackgroundColor,
            child: subject,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  expect(tester.binding.transientCallbackCount, 0);
}

Future<void> expectVisualGolden(
  WidgetTester tester,
  String fileName, {
  String directory = canonicalVisualGoldenDirectory,
}) async {
  final Finder boundary = find.byKey(visualGoldenBoundaryKey);
  expect(boundary, findsOneWidget);
  await expectLater(
    boundary,
    matchesGoldenFile('$directory/$fileName'),
  );
}
