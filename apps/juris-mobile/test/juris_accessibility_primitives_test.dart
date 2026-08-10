import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

void main() {
  test('either Flutter accessibility signal collapses every motion token', () {
    const JurisMotion motion = JurisMotion.standard;

    for (final MediaQueryData media in <MediaQueryData>[
      const MediaQueryData(disableAnimations: true),
      const MediaQueryData(accessibleNavigation: true),
      const MediaQueryData(
        disableAnimations: true,
        accessibleNavigation: true,
      ),
    ]) {
      expect(JurisMotionPolicy.reducesMotion(media), isTrue);
      final JurisMotion resolved = JurisMotionPolicy.resolve(
        motion: motion,
        media: media,
      );
      expect(resolved.immediate, Duration.zero);
      expect(resolved.selection, Duration.zero);
      expect(resolved.reveal, Duration.zero);
      expect(resolved.immediateCurve, motion.immediateCurve);
      expect(resolved.selectionCurve, motion.selectionCurve);
      expect(resolved.revealCurve, motion.revealCurve);
    }

    const MediaQueryData standardMedia = MediaQueryData();
    expect(JurisMotionPolicy.reducesMotion(standardMedia), isFalse);
    expect(
      JurisMotionPolicy.resolve(motion: motion, media: standardMedia),
      same(motion),
    );
  });

  test('normal and high-contrast token pairs meet declared thresholds', () {
    final ThemeData theme = JurisTheme.dark();
    const JurisSurfaces surfaces = JurisSurfaces.dark;

    expect(
      JurisContrast.meetsNormalText(
        theme.colorScheme.onSurface,
        theme.colorScheme.surface,
      ),
      isTrue,
    );
    expect(
      JurisContrast.meetsNormalText(
        theme.colorScheme.onPrimary,
        theme.colorScheme.primary,
      ),
      isTrue,
    );
    expect(
      JurisContrast.meetsUiBoundary(
        surfaces.focusRing,
        surfaces.brandNavy,
      ),
      isTrue,
    );
    expect(
      JurisContrast.meetsUiBoundary(
        surfaces.brandGold,
        surfaces.brandNavy,
      ),
      isTrue,
    );

    const CaseVisualPalette normal = CaseVisualPalette(
      background: Color(0xFF102030),
      surface: Color(0xFF304050),
      accent: Color(0xFFB09050),
      signal: Color(0xFF50B0C0),
    );
    expect(
      JurisCasePaletteResolver.resolve(
        palette: normal,
        surfaces: surfaces,
        highContrast: false,
      ),
      same(normal),
    );
    final CaseVisualPalette highContrast = JurisCasePaletteResolver.resolve(
      palette: normal,
      surfaces: surfaces,
      highContrast: true,
    );
    expect(highContrast.background, surfaces.brandNavy);
    expect(highContrast.surface, surfaces.evidenceNeutral);
    expect(highContrast.accent, surfaces.highContrastGold);
    expect(highContrast.signal, surfaces.highContrastCyan);
    for (final Color foreground in <Color>[
      highContrast.surface,
      highContrast.accent,
      highContrast.signal,
    ]) {
      expect(
        JurisContrast.meetsUiBoundary(foreground, highContrast.background),
        isTrue,
      );
    }
  });

  test('contrast resolves alpha and rejects an unresolved background', () {
    expect(
      JurisContrast.ratio(
        const Color(0x80FFFFFF),
        const Color(0xFF000000),
      ),
      greaterThan(1),
    );
    expect(
      () => JurisContrast.ratio(
        const Color(0xFFFFFFFF),
        const Color(0x80000000),
      ),
      throwsArgumentError,
    );
  });

  testWidgets('target and focus helpers enforce size, contrast, and motion', (
    WidgetTester tester,
  ) async {
    Future<void> pump({
      required bool focused,
      required MediaQueryData media,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: JurisTheme.dark(),
          home: MediaQuery(
            data: media,
            child: Scaffold(
              body: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const JurisMinimumTarget(
                    key: ValueKey<String>('minimum-target'),
                    child: SizedBox.square(dimension: 10),
                  ),
                  JurisFocusOutline(
                    key: const ValueKey<String>('focus-outline'),
                    focused: focused,
                    child: const SizedBox(width: 24, height: 24),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    await pump(
      focused: true,
      media: const MediaQueryData(
        highContrast: true,
        disableAnimations: true,
      ),
    );
    expect(
      tester.getSize(find.byKey(const ValueKey<String>('minimum-target'))),
      const Size.square(48),
    );
    AnimatedContainer animated = tester.widget<AnimatedContainer>(
      find.descendant(
        of: find.byKey(const ValueKey<String>('focus-outline')),
        matching: find.byType(AnimatedContainer),
      ),
    );
    expect(animated.duration, Duration.zero);
    BoxDecoration decoration = animated.decoration! as BoxDecoration;
    expect(decoration.border!.top.width, JurisBorders.standardWeights.focus);
    expect(decoration.border!.top.color, JurisSurfaces.dark.highContrastCyan);
    expect(
      JurisContrast.meetsUiBoundary(
        decoration.border!.top.color,
        JurisSurfaces.dark.brandNavy,
      ),
      isTrue,
    );

    await pump(focused: false, media: const MediaQueryData());
    animated = tester.widget<AnimatedContainer>(
      find.descendant(
        of: find.byKey(const ValueKey<String>('focus-outline')),
        matching: find.byType(AnimatedContainer),
      ),
    );
    expect(animated.duration, JurisMotion.standard.immediate);
    decoration = animated.decoration! as BoxDecoration;
    expect(decoration.border!.top.color, Colors.transparent);
    expect(decoration.border!.top.width, JurisBorders.standardWeights.focus);
  });
}
