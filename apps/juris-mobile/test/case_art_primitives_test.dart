import 'dart:ui' show ClipOp, PathMetric;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/design/juris_design.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest.dart';

const CaseVisualPalette _palette = CaseVisualPalette(
  background: Color(0xFF07111F),
  surface: Color(0xFF30455C),
  accent: Color(0xFFC7A35B),
  signal: Color(0xFF70D3E2),
);

void main() {
  test('hero painter repaints only when a complete typed input changes', () {
    const CaseArtSpec spec = CaseArtSpec(
      motif: CaseVisualMotif.systemsGrid,
      palette: _palette,
      artSeed: 1234,
    );
    const CaseHeroPainter painter = CaseHeroPainter(spec: spec);

    expect(
      painter.shouldRepaint(const CaseHeroPainter(spec: spec)),
      isFalse,
    );
    expect(
      painter.shouldRepaint(
        const CaseHeroPainter(
          spec: CaseArtSpec(
            motif: CaseVisualMotif.freightRoutes,
            palette: _palette,
            artSeed: 1234,
          ),
        ),
      ),
      isTrue,
    );
    expect(
      painter.shouldRepaint(
        const CaseHeroPainter(
          spec: CaseArtSpec(
            motif: CaseVisualMotif.systemsGrid,
            palette: _palette,
            artSeed: 1235,
          ),
        ),
      ),
      isTrue,
    );
    expect(
      painter.shouldRepaint(
        const CaseHeroPainter(
          spec: CaseArtSpec(
            motif: CaseVisualMotif.systemsGrid,
            palette: CaseVisualPalette(
              background: Color(0xFF07111F),
              surface: Color(0xFF30455C),
              accent: Color(0xFFD8B66A),
              signal: Color(0xFF70D3E2),
            ),
            artSeed: 1234,
          ),
        ),
      ),
      isTrue,
    );

    const DossierFramePainter frame = DossierFramePainter(
      accent: Color(0xFFC7A35B),
      signal: Color(0xFF70D3E2),
      borderWidth: 1,
      radius: 20,
    );
    expect(frame.shouldRepaint(frame), isFalse);
    expect(
      frame.shouldRepaint(
        const DossierFramePainter(
          accent: Color(0xFFC7A35B),
          signal: Color(0xFF70D3E2),
          borderWidth: 2,
          radius: 20,
        ),
      ),
      isTrue,
    );
  });

  test('all six motifs produce deterministic bounded canvas operations', () {
    List<String> render(CaseVisualTreatment treatment) {
      final _FingerprintCanvas canvas = _FingerprintCanvas();
      CaseHeroPainter(
        spec: CaseArtSpec.fromTreatment(
          treatment,
          palette: treatment.palette,
        ),
      ).paint(canvas, const Size(240, 160));
      return List<String>.unmodifiable(canvas.operations);
    }

    final Set<String> motifFingerprints = <String>{};
    for (final CaseVisualMotif motif in CaseVisualMotif.values) {
      final CaseVisualTreatment treatment = CaseVisualTreatment(
        motif: motif,
        palette: _palette,
        artSeed: 1000 + motif.index * 97,
      );
      final List<String> first = render(treatment);
      final List<String> second = render(treatment);
      expect(
        second,
        orderedEquals(first),
        reason: '${motif.wireName} must be deterministic for equal inputs',
      );
      expect(first, isNotEmpty);
      motifFingerprints.add(first.join('|'));

      final List<String> changedSeed = render(
        CaseVisualTreatment(
          motif: motif,
          palette: _palette,
          artSeed: treatment.artSeed + 1,
        ),
      );
      expect(
        changedSeed,
        isNot(orderedEquals(first)),
        reason: '${motif.wireName} must consume its bounded art seed',
      );
    }
    expect(motifFingerprints, hasLength(CaseVisualMotif.values.length));
  });

  testWidgets('scope and primitives expose only intentional semantics', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle semantics = tester.ensureSemantics();
    const CaseVisualTreatment treatment = CaseVisualTreatment(
      motif: CaseVisualMotif.institutionalGrid,
      palette: _palette,
      artSeed: 42,
    );
    CaseVisualTreatment? resolved;

    await tester.pumpWidget(
      MaterialApp(
        theme: JurisTheme.dark(),
        home: Scaffold(
          body: CaseTreatmentScope(
            treatment: treatment,
            child: Builder(
              builder: (BuildContext context) {
                resolved = CaseTreatmentScope.of(context);
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const SizedBox(
                      width: 120,
                      height: 80,
                      child: CaseHeroArt(treatment: treatment),
                    ),
                    DossierFrame(
                      child: Semantics(
                        label: 'Dossier content',
                        child: const SizedBox(width: 120, height: 40),
                      ),
                    ),
                    const CaseIndexMark(
                      indexLabel: '01 / 05',
                      fileReference: 'FILE 001',
                      selected: true,
                      semanticLabel: 'Case 1 of 5, selected',
                    ),
                    const JurisdictionStamp(
                      label: 'BE · FICTIONAL',
                      semanticLabel: 'Belgium, fictional jurisdiction mark',
                    ),
                    CinematicScrim(
                      role: JurisScrimRole.content,
                      child: Semantics(
                        label: 'Scrim child content',
                        child: const SizedBox(width: 120, height: 30),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(resolved, treatment);
    expect(find.bySemanticsLabel('Dossier content'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Case 1 of 5, selected'),
      findsOneWidget,
    );
    expect(
      tester.getSemantics(find.byType(CaseIndexMark)),
      matchesSemantics(
        label: 'Case 1 of 5, selected',
        hasSelectedState: true,
        isSelected: true,
      ),
    );
    expect(
      find.bySemanticsLabel('Belgium, fictional jurisdiction mark'),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Scrim child content'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('hero|systems', caseSensitive: false)),
        findsNothing);

    final ColoredBox overlay = tester.widget<ColoredBox>(
      find.descendant(
        of: find.byType(CinematicScrim),
        matching: find.byType(ColoredBox),
      ),
    );
    expect(overlay.color, JurisScrims.dark.content);
    semantics.dispose();
  });
}

final class _FingerprintCanvas extends TestRecordingCanvas {
  final List<String> operations = <String>[];

  @override
  void save() => operations.add('save');

  @override
  void restore() => operations.add('restore');

  @override
  void clipRect(
    Rect rect, {
    ClipOp clipOp = ClipOp.intersect,
    bool doAntiAlias = true,
  }) {
    operations.add('clipRect:${_rect(rect)}:${clipOp.name}:$doAntiAlias');
  }

  @override
  void drawRect(Rect rect, Paint paint) {
    operations.add('drawRect:${_rect(rect)}:${_paint(paint)}');
  }

  @override
  void drawLine(Offset point1, Offset point2, Paint paint) {
    operations.add(
      'drawLine:${_offset(point1)}:${_offset(point2)}:${_paint(paint)}',
    );
  }

  @override
  void drawCircle(Offset center, double radius, Paint paint) {
    operations.add(
      'drawCircle:${_offset(center)}:${_number(radius)}:${_paint(paint)}',
    );
  }

  @override
  void drawPath(Path path, Paint paint) {
    final String metrics = path
        .computeMetrics()
        .map(
          (PathMetric metric) => '${_number(metric.length)}:${metric.isClosed}',
        )
        .join(',');
    operations.add(
      'drawPath:${_rect(path.getBounds())}:$metrics:${_paint(paint)}',
    );
  }
}

String _paint(Paint paint) {
  return '${paint.color.toARGB32().toRadixString(16)}:'
      '${paint.style.name}:${_number(paint.strokeWidth)}:'
      '${paint.strokeCap.name}';
}

String _rect(Rect rect) {
  return '${_number(rect.left)},${_number(rect.top)},'
      '${_number(rect.right)},${_number(rect.bottom)}';
}

String _offset(Offset offset) {
  return '${_number(offset.dx)},${_number(offset.dy)}';
}

String _number(double value) => value.toStringAsFixed(6);
