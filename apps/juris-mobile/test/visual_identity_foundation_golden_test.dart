import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

import 'support/visual_golden_harness.dart';

const CaseVisualPalette _foundationPalette = CaseVisualPalette(
  background: Color(0xFF07111F),
  surface: Color(0xFF1B3348),
  accent: Color(0xFFC7A35B),
  signal: Color(0xFF70D3E2),
);

const Key _motionToggleKey = ValueKey<String>('foundation-motion-toggle');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    if (!skipCanonicalVisualGoldens) {
      await loadJurisGoldenFonts();
    }
  });

  testWidgets(
    'foundation typography and controls render in English',
    (WidgetTester tester) async {
      await pumpVisualGolden(
        tester,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(800, 720),
          locale: Locale('en'),
        ),
        subject: const _EnglishTypographyGallery(),
      );

      await expectVisualGolden(
        tester,
        'typography_controls_en_800x720_dpr1_ts100_hc0_rm0.png',
      );
    },
    skip: skipCanonicalVisualGoldens,
  );

  testWidgets(
    'foundation typography renders representative long Russian',
    (WidgetTester tester) async {
      await pumpVisualGolden(
        tester,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(800, 720),
          locale: Locale('ru'),
        ),
        subject: const _RussianTypographyGallery(),
      );

      await expectVisualGolden(
        tester,
        'typography_long_ru_800x720_dpr1_ts100_hc0_rm0.png',
      );
    },
    skip: skipCanonicalVisualGoldens,
  );

  testWidgets(
    'all six generic motifs render at identical geometry',
    (WidgetTester tester) async {
      await pumpVisualGolden(
        tester,
        configuration: const VisualGoldenConfiguration(
          logicalSize: Size(1024, 768),
          locale: Locale('en'),
        ),
        subject: const _MotifGallery(),
      );

      await expectVisualGolden(
        tester,
        'motifs_en_1024x768_dpr1_ts100_hc0_rm0.png',
      );
    },
    skip: skipCanonicalVisualGoldens,
  );

  const List<_AccessibilityVariant> variants = <_AccessibilityVariant>[
    _AccessibilityVariant(
      name: 'standard',
      fileName:
          'accessibility_standard_en_800x600_dpr1_ts100_hc0_rm0_frame110ms.png',
    ),
    _AccessibilityVariant(
      name: 'high contrast',
      fileName:
          'accessibility_high_contrast_en_800x600_dpr1_ts100_hc1_rm0_frame110ms.png',
      highContrast: true,
    ),
    _AccessibilityVariant(
      name: 'reduced motion',
      fileName:
          'accessibility_reduced_motion_en_800x600_dpr1_ts100_hc0_rm1_frame110ms.png',
      reducedMotion: true,
    ),
  ];

  for (final _AccessibilityVariant variant in variants) {
    testWidgets(
      'foundation accessibility probe renders ${variant.name}',
      (WidgetTester tester) async {
        await pumpVisualGolden(
          tester,
          configuration: VisualGoldenConfiguration(
            logicalSize: const Size(800, 600),
            locale: const Locale('en'),
            highContrast: variant.highContrast,
            reducedMotion: variant.reducedMotion,
          ),
          subject: const _AccessibilityGallery(),
        );

        await tester.tap(find.byKey(_motionToggleKey));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 110));
        await expectVisualGolden(tester, variant.fileName);

        await tester.pump(const Duration(milliseconds: 200));
        expect(tester.binding.transientCallbackCount, 0);
      },
      skip: skipCanonicalVisualGoldens,
    );
  }
}

@immutable
final class _AccessibilityVariant {
  const _AccessibilityVariant({
    required this.name,
    required this.fileName,
    this.highContrast = false,
    this.reducedMotion = false,
  });

  final String name;
  final String fileName;
  final bool highContrast;
  final bool reducedMotion;
}

final class _EnglishTypographyGallery extends StatelessWidget {
  const _EnglishTypographyGallery();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    const CaseVisualTreatment treatment = CaseVisualTreatment(
      motif: CaseVisualMotif.institutionalGrid,
      palette: _foundationPalette,
      artSeed: 14248,
    );

    return CaseTreatmentScope(
      treatment: treatment,
      child: Padding(
        padding: EdgeInsets.all(spacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            SizedBox(
              height: 220,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'GENESIS:\nAI JURIS',
                          style: typography.resolveCaseDisplay(wide: true),
                        ),
                        SizedBox(height: spacing.sm),
                        Text(
                          'LIVING CASE FILE / VISUAL FOUNDATION',
                          style: typography.controlLabel.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        ),
                        SizedBox(height: spacing.md),
                        Text(
                          'A restrained institutional interface for evidence, '
                          'judgment, and accountable decisions.',
                          style: typography.bodyReading.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: spacing.lg),
                  SizedBox(
                    width: 286,
                    child: Stack(
                      fit: StackFit.expand,
                      children: <Widget>[
                        const CinematicScrim(
                          child: CaseHeroArt(treatment: treatment),
                        ),
                        Positioned(
                          left: spacing.md,
                          right: spacing.md,
                          bottom: spacing.md,
                          child: Text(
                            'FOUNDATION / 01',
                            style: typography.metadata.copyWith(
                              color: theme.colorScheme.onSurface,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: spacing.lg),
            Expanded(
              child: DossierFrame(
                child: Padding(
                  padding: EdgeInsets.all(spacing.lg),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: <Widget>[
                            _TypeSample(
                              label: 'SECTION',
                              text: 'Institutional simulation',
                              style: typography.sectionTitle,
                            ),
                            _TypeSample(
                              label: 'READING',
                              text: 'Evidence remains distinct from inference.',
                              style: typography.bodyReading,
                            ),
                            _TypeSample(
                              label: 'COMPACT',
                              text: 'Five current matters / one selected',
                              style: typography.bodyCompact,
                            ),
                            _TypeSample(
                              label: 'CAPTION',
                              text: 'Fictional training environment',
                              style: typography.caption,
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: spacing.lg),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: <Widget>[
                            _TypeSample(
                              label: 'CONTROL',
                              text: 'REVIEW CASE',
                              style: typography.controlLabel,
                            ),
                            _TypeSample(
                              label: 'INDEX',
                              text: '03 / 05',
                              style: typography.caseIndex,
                            ),
                            _TypeSample(
                              label: 'METADATA',
                              text: 'FILE GF-72 / BE',
                              style: typography.metadata,
                            ),
                            _TypeSample(
                              label: 'BODY',
                              text: 'Authority never comes from decoration.',
                              style: typography.bodyCompact,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SizedBox(height: spacing.md),
            SizedBox(
              height: 72,
              child: Row(
                children: <Widget>[
                  FilledButton(
                      onPressed: _noop, child: const Text('OPEN CASE')),
                  SizedBox(width: spacing.sm),
                  OutlinedButton(
                    onPressed: _noop,
                    child: const Text('DETAILS'),
                  ),
                  SizedBox(width: spacing.sm),
                  TextButton(onPressed: _noop, child: const Text('FILTER')),
                  const Spacer(),
                  const CaseIndexMark(
                    indexLabel: '01 / 05',
                    fileReference: 'FILE 001',
                    selected: true,
                    semanticLabel: 'Case 1 of 5, selected',
                  ),
                  SizedBox(width: spacing.sm),
                  const JurisdictionStamp(
                    label: 'BE · FICTIONAL',
                    semanticLabel: 'Belgium, fictional jurisdiction mark',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _RussianTypographyGallery extends StatelessWidget {
  const _RussianTypographyGallery();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;

    return Padding(
      padding: EdgeInsets.all(spacing.xl),
      child: DossierFrame(
        child: Padding(
          padding: EdgeInsets.all(spacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  const CaseIndexMark(
                    indexLabel: '04 / 05',
                    fileReference: 'ДЕЛО № 17',
                    selected: true,
                    semanticLabel: 'Дело 4 из 5, выбрано',
                  ),
                  const Spacer(),
                  const JurisdictionStamp(
                    label: 'NL · ВЫМЫШЛЕНО',
                    semanticLabel: 'Нидерланды, вымышленная отметка',
                  ),
                ],
              ),
              SizedBox(height: spacing.xl),
              Text(
                '«ЗАГРЯЗНЕНИЕ ЦЕПОЧКИ ПОСТАВОК»',
                style: typography.resolveCaseDisplay(wide: false),
              ),
              SizedBox(height: spacing.md),
              Text(
                'Неотложная проверка доказательств — материалы дела № 17',
                style: typography.sectionTitle.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
              SizedBox(height: spacing.lg),
              Text(
                'Ёмкая типографика сохраняет иерархию длинного русского '
                'заголовка. Факты, выводы и процессуальные решения остаются '
                'различимыми; декоративный мотив не сообщает исход дела.',
                style: typography.bodyReading.copyWith(
                  color: theme.colorScheme.onSurface,
                ),
              ),
              SizedBox(height: spacing.xl),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Expanded(
                      child: _RussianRolePanel(
                        title: 'МЕТАДАННЫЕ',
                        lines: const <String>[
                          'ЮРИСДИКЦИЯ / НИДЕРЛАНДЫ',
                          'РОЛЬ / ЮРИСКОНСУЛЬТ',
                          'СТАТУС / ГОТОВО К ПРОВЕРКЕ',
                        ],
                      ),
                    ),
                    SizedBox(width: spacing.lg),
                    Expanded(
                      child: _RussianRolePanel(
                        title: 'РЕДАКЦИОННАЯ ЗАМЕТКА',
                        lines: const <String>[
                          '«Ёж» проверяет Ё/ё и кавычки.',
                          'Тире — длинное; номер — № 17.',
                          'Текст растёт, а не обрезается.',
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: spacing.lg),
              Row(
                children: <Widget>[
                  FilledButton(
                    onPressed: _noop,
                    child: const Text('ОТКРЫТЬ ДЕЛО'),
                  ),
                  SizedBox(width: spacing.md),
                  OutlinedButton(
                    onPressed: _noop,
                    child: const Text('ПОДРОБНЕЕ'),
                  ),
                  const Spacer(),
                  Text(
                    'ВЫМЫШЛЕННАЯ УЧЕБНАЯ СРЕДА',
                    style: typography.caption.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _RussianRolePanel extends StatelessWidget {
  const _RussianRolePanel({required this.title, required this.lines});

  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainer,
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: EdgeInsets.all(spacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: typography.controlLabel),
            SizedBox(height: spacing.md),
            for (final String line in lines) ...<Widget>[
              Text(
                line,
                style: typography.bodyCompact.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              SizedBox(height: spacing.sm),
            ],
          ],
        ),
      ),
    );
  }
}

final class _MotifGallery extends StatelessWidget {
  const _MotifGallery();

  @override
  Widget build(BuildContext context) {
    const List<CaseVisualMotif> motifs = CaseVisualMotif.values;
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              for (int index = 0; index < 3; index += 1) ...<Widget>[
                _MotifTile(motif: motifs[index]),
                if (index != 2) const SizedBox(width: 16),
              ],
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              for (int index = 3; index < 6; index += 1) ...<Widget>[
                _MotifTile(motif: motifs[index]),
                if (index != 5) const SizedBox(width: 16),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

final class _MotifTile extends StatelessWidget {
  const _MotifTile({required this.motif});

  final CaseVisualMotif motif;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    const double width = 312;
    const double height = 348;
    final CaseVisualTreatment treatment = CaseVisualTreatment(
      motif: motif,
      palette: _foundationPalette,
      artSeed: 4242,
    );

    return SizedBox(
      width: width,
      height: height,
      child: DossierFrame(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                motif.wireName.toUpperCase(),
                style: typography.metadata.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 10),
              Expanded(child: CaseHeroArt(treatment: treatment)),
              const SizedBox(height: 10),
              Text(
                'SEED 4242 / 240 × 160 BASIS',
                style: typography.caption.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _AccessibilityGallery extends StatelessWidget {
  const _AccessibilityGallery();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final MediaQueryData media = MediaQuery.of(context);
    const CaseVisualTreatment treatment = CaseVisualTreatment(
      motif: CaseVisualMotif.aquiferContours,
      palette: _foundationPalette,
      artSeed: 5501,
    );

    return Padding(
      padding: EdgeInsets.all(spacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text(
                'ACCESSIBLE VISUAL STATE',
                style: typography.sectionTitle,
              ),
              const Spacer(),
              CaseIndexMark(
                indexLabel: '05 / 05',
                fileReference:
                    media.highContrast ? 'HIGH CONTRAST' : 'STANDARD',
                selected: true,
                semanticLabel: 'Case 5 of 5, selected',
              ),
            ],
          ),
          SizedBox(height: spacing.lg),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                SizedBox(
                  width: 352,
                  child: DossierFrame(
                    child: CaseHeroArt(treatment: treatment),
                  ),
                ),
                SizedBox(width: spacing.xl),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Text(
                        'Focus, contrast, and motion remain explicit.',
                        style: typography.bodyReading,
                      ),
                      SizedBox(height: spacing.lg),
                      JurisFocusOutline(
                        focused: true,
                        child: JurisMinimumTarget(
                          child: FilledButton(
                            onPressed: _noop,
                            child: const Text('PRIMARY ACTION'),
                          ),
                        ),
                      ),
                      SizedBox(height: spacing.lg),
                      Text(
                        media.disableAnimations
                            ? 'MOTION / IMMEDIATE'
                            : 'MOTION / 220 MS',
                        style: typography.metadata.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: spacing.lg),
          const _MotionTrack(),
        ],
      ),
    );
  }
}

final class _MotionTrack extends StatefulWidget {
  const _MotionTrack();

  @override
  State<_MotionTrack> createState() => _MotionTrackState();
}

final class _MotionTrackState extends State<_MotionTrack> {
  bool _atEnd = false;

  @override
  Widget build(BuildContext context) {
    final JurisMotion motion = JurisMotionPolicy.of(context);
    final JurisSurfaces surfaces =
        Theme.of(context).extension<JurisSurfaces>()!;
    final bool highContrast = MediaQuery.of(context).highContrast;
    final Color marker =
        highContrast ? surfaces.highContrastCyan : surfaces.brandGold;

    return Semantics(
      button: true,
      label: 'Demonstrate the selection transition',
      child: GestureDetector(
        key: _motionToggleKey,
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _atEnd = !_atEnd),
        child: JurisMinimumTarget(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: surfaces.surfaceContainer,
              border: Border.all(color: surfaces.evidenceNeutral),
            ),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: AnimatedAlign(
                alignment:
                    _atEnd ? Alignment.centerRight : Alignment.centerLeft,
                duration: motion.selection,
                curve: motion.selectionCurve,
                child: SizedBox(
                  width: 64,
                  height: 40,
                  child: ColoredBox(color: marker),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final class _TypeSample extends StatelessWidget {
  const _TypeSample({
    required this.label,
    required this.text,
    required this.style,
  });

  final String label;
  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          label,
          style: typography.caption.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 2),
        Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: style),
      ],
    );
  }
}

void _noop() {}
