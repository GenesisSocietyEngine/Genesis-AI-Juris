import 'package:flutter/material.dart';

import '../visual_identity/case_visual_manifest.dart';
import 'juris_accessibility.dart';
import 'juris_surfaces.dart';

/// The complete painter input. It intentionally has no case identity field.
@immutable
final class CaseArtSpec {
  const CaseArtSpec({
    required this.motif,
    required this.palette,
    required this.artSeed,
  }) : assert(artSeed >= 0 && artSeed <= 65535);

  factory CaseArtSpec.fromTreatment(
    CaseVisualTreatment treatment, {
    required CaseVisualPalette palette,
  }) {
    return CaseArtSpec(
      motif: treatment.motif,
      palette: palette,
      artSeed: treatment.artSeed,
    );
  }

  final CaseVisualMotif motif;
  final CaseVisualPalette palette;
  final int artSeed;

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CaseArtSpec &&
            motif == other.motif &&
            palette == other.palette &&
            artSeed == other.artSeed;
  }

  @override
  int get hashCode => Object.hash(motif, palette, artSeed);
}

/// Deterministic decorative hero art for one resolved visual treatment.
final class CaseHeroArt extends StatelessWidget {
  const CaseHeroArt({super.key, required this.treatment});

  final CaseVisualTreatment treatment;

  @override
  Widget build(BuildContext context) {
    final JurisSurfaces? surfaces =
        Theme.of(context).extension<JurisSurfaces>();
    if (surfaces == null) {
      throw FlutterError(
        'CaseHeroArt requires JurisSurfaces on the current theme.',
      );
    }
    final MediaQueryData media =
        MediaQuery.maybeOf(context) ?? const MediaQueryData();
    final CaseVisualPalette palette = JurisCasePaletteResolver.resolve(
      palette: treatment.palette,
      surfaces: surfaces,
      highContrast: media.highContrast,
    );

    return ExcludeSemantics(
      child: CustomPaint(
        painter: CaseHeroPainter(
          spec: CaseArtSpec.fromTreatment(treatment, palette: palette),
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}

/// Paints one of six finite motifs from deterministic typed values only.
final class CaseHeroPainter extends CustomPainter {
  const CaseHeroPainter({required this.spec});

  final CaseArtSpec spec;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) {
      return;
    }
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = spec.palette.background,
    );
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    switch (spec.motif) {
      case CaseVisualMotif.institutionalGrid:
        _paintInstitutionalGrid(canvas, size);
        break;
      case CaseVisualMotif.systemsGrid:
        _paintSystemsGrid(canvas, size);
        break;
      case CaseVisualMotif.freightRoutes:
        _paintFreightRoutes(canvas, size);
        break;
      case CaseVisualMotif.industrialHaze:
        _paintIndustrialHaze(canvas, size);
        break;
      case CaseVisualMotif.supplyChain:
        _paintSupplyChain(canvas, size);
        break;
      case CaseVisualMotif.aquiferContours:
        _paintAquiferContours(canvas, size);
        break;
    }
    canvas.restore();
  }

  void _paintInstitutionalGrid(Canvas canvas, Size size) {
    final double stroke = _strokeWidth(size);
    final Paint grid = Paint()
      ..color = spec.palette.surface.withValues(alpha: 0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    for (int column = 1; column < 6; column += 1) {
      final double x = size.width * column / 6;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (int row = 1; row < 4; row += 1) {
      final double y = size.height * row / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final Paint accent = Paint()
      ..color = spec.palette.accent.withValues(alpha: 0.86)
      ..style = PaintingStyle.fill;
    canvas.drawRect(
      Rect.fromLTWH(
        size.width * 0.08,
        size.height * 0.1,
        size.width * 0.32,
        size.height * 0.055,
      ),
      accent,
    );
    final double markerX = size.width * (0.66 + _unit(spec.artSeed, 1) * 0.2);
    canvas.drawCircle(
      Offset(markerX, size.height * 0.74),
      size.shortestSide * 0.025,
      Paint()..color = spec.palette.signal,
    );
  }

  void _paintSystemsGrid(Canvas canvas, Size size) {
    final double stroke = _strokeWidth(size);
    final Paint grid = Paint()
      ..color = spec.palette.surface.withValues(alpha: 0.42)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    for (int column = 0; column <= 7; column += 1) {
      final double x = size.width * column / 7;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (int row = 0; row <= 5; row += 1) {
      final double y = size.height * row / 5;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final Paint link = Paint()
      ..color = spec.palette.accent
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square
      ..strokeWidth = stroke * 1.5;
    final Paint node = Paint()..color = spec.palette.signal;
    for (int lane = 0; lane < 10; lane += 1) {
      final int hash = _hash(spec.artSeed, lane);
      final int column = hash % 7;
      final int row = (hash >> 4) % 5;
      final bool horizontal = (hash & 0x100) == 0;
      final Offset start = Offset(
        size.width * column / 7,
        size.height * row / 5,
      );
      final Offset end = horizontal
          ? Offset(size.width * (column + 1) / 7, start.dy)
          : Offset(start.dx, size.height * (row + 1) / 5);
      final Offset firstEnd = Offset.lerp(start, end, 0.42)!;
      final Offset secondStart = Offset.lerp(start, end, 0.62)!;
      canvas.drawLine(start, firstEnd, link);
      canvas.drawLine(secondStart, end, link);
      canvas.drawCircle(end, stroke * 2.1, node);
    }
  }

  void _paintFreightRoutes(Canvas canvas, Size size) {
    final double stroke = _strokeWidth(size);
    final Paint rain = Paint()
      ..color = spec.palette.surface.withValues(alpha: 0.45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    for (int lane = 0; lane < 14; lane += 1) {
      final double x =
          size.width * (lane + _unit(spec.artSeed, lane) * 0.7) / 14;
      canvas.drawLine(
        Offset(x, -size.height * 0.08),
        Offset(x - size.width * 0.18, size.height * 1.08),
        rain,
      );
    }

    for (int route = 0; route < 3; route += 1) {
      final double startY = size.height * (0.25 + route * 0.24);
      final double jitter = (_unit(spec.artSeed, 40 + route) - 0.5) * 0.12;
      final double endY = size.height * (0.3 + route * 0.18 + jitter);
      final Path path = Path()
        ..moveTo(-size.width * 0.03, startY)
        ..cubicTo(
          size.width * 0.28,
          startY - size.height * (0.08 + route * 0.02),
          size.width * 0.62,
          endY + size.height * (0.09 - route * 0.02),
          size.width * 1.03,
          endY,
        );
      final Color routeColor =
          route == 1 ? spec.palette.signal : spec.palette.accent;
      canvas.drawPath(
        path,
        Paint()
          ..color = routeColor
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = stroke * (route == 1 ? 1.8 : 1.3),
      );
      canvas.drawCircle(
        Offset(size.width * 0.92, endY),
        stroke * 2.5,
        Paint()..color = routeColor,
      );
    }
  }

  void _paintIndustrialHaze(Canvas canvas, Size size) {
    for (int band = 0; band < 4; band += 1) {
      canvas.drawRect(
        Rect.fromLTWH(
          0,
          size.height * (0.18 + band * 0.17),
          size.width,
          size.height * (0.06 + _unit(spec.artSeed, 60 + band) * 0.04),
        ),
        Paint()
          ..color = spec.palette.surface.withValues(
            alpha: 0.12 + band * 0.035,
          ),
      );
    }

    final double baseY = size.height * 0.91;
    final double columnWidth = size.width / 9;
    for (int column = 0; column < 9; column += 1) {
      final double height =
          size.height * (0.16 + _unit(spec.artSeed, 80 + column) * 0.34);
      final Rect structure = Rect.fromLTWH(
        column * columnWidth + columnWidth * 0.12,
        baseY - height,
        columnWidth * 0.72,
        height,
      );
      canvas.drawRect(
        structure,
        Paint()
          ..color = spec.palette.surface.withValues(alpha: 0.72)
          ..style = PaintingStyle.fill,
      );
      canvas.drawRect(
        structure,
        Paint()
          ..color = spec.palette.accent.withValues(alpha: 0.62)
          ..style = PaintingStyle.stroke
          ..strokeWidth = _strokeWidth(size),
      );
    }
    final int signalColumn = _hash(spec.artSeed, 100) % 9;
    final double signalX = (signalColumn + 0.5) * columnWidth;
    canvas.drawLine(
      Offset(signalX, size.height * 0.18),
      Offset(signalX, size.height * 0.57),
      Paint()
        ..color = spec.palette.signal
        ..strokeWidth = _strokeWidth(size) * 2,
    );
    canvas.drawCircle(
      Offset(signalX, size.height * 0.18),
      _strokeWidth(size) * 3,
      Paint()..color = spec.palette.signal,
    );
  }

  void _paintSupplyChain(Canvas canvas, Size size) {
    final double stroke = _strokeWidth(size);
    final List<Rect> crates = <Rect>[];
    for (int item = 0; item < 5; item += 1) {
      final double x = size.width * (0.07 + item * 0.18);
      final double y = size.height *
          (0.58 - item * 0.075 + (_unit(spec.artSeed, 120 + item) - 0.5) * 0.1);
      crates.add(
        Rect.fromLTWH(x, y, size.width * 0.14, size.height * 0.2),
      );
    }

    final Paint connector = Paint()
      ..color = spec.palette.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke * 1.5;
    for (int item = 0; item < crates.length - 1; item += 1) {
      canvas.drawLine(crates[item].center, crates[item + 1].center, connector);
      canvas.drawCircle(
        Offset.lerp(crates[item].center, crates[item + 1].center, 0.5)!,
        stroke * 1.8,
        Paint()..color = spec.palette.signal,
      );
    }

    for (final Rect crate in crates) {
      canvas.drawRect(
        crate,
        Paint()
          ..color = spec.palette.surface.withValues(alpha: 0.62)
          ..style = PaintingStyle.fill,
      );
      canvas.drawRect(crate, connector);
      canvas.drawLine(crate.topLeft, crate.bottomRight, connector);
      canvas.drawLine(crate.topRight, crate.bottomLeft, connector);
    }
  }

  void _paintAquiferContours(Canvas canvas, Size size) {
    final double stroke = _strokeWidth(size);
    for (int contour = 0; contour < 6; contour += 1) {
      final double baseY = size.height * (0.16 + contour * 0.135);
      final Path path = Path()..moveTo(-size.width * 0.04, baseY);
      double previousY = baseY;
      for (int segment = 0; segment < 4; segment += 1) {
        final double endX = size.width * (segment + 1) / 4;
        final double nextY = baseY +
            size.height *
                (_unit(spec.artSeed, 160 + contour * 4 + segment) - 0.5) *
                0.09;
        final double startX = size.width * segment / 4;
        path.cubicTo(
          startX + size.width * 0.08,
          previousY - size.height * 0.035,
          endX - size.width * 0.08,
          nextY + size.height * 0.035,
          endX,
          nextY,
        );
        previousY = nextY;
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = contour.isEven
              ? spec.palette.accent.withValues(alpha: 0.82)
              : spec.palette.surface.withValues(alpha: 0.7)
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke * (contour.isEven ? 1.4 : 1),
      );
    }
    final double markerX = size.width * (0.25 + _unit(spec.artSeed, 200) * 0.5);
    canvas.drawCircle(
      Offset(markerX, size.height * 0.49),
      stroke * 3,
      Paint()..color = spec.palette.signal,
    );
    canvas.drawCircle(
      Offset(markerX, size.height * 0.49),
      stroke * 6,
      Paint()
        ..color = spec.palette.signal.withValues(alpha: 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
  }

  double _strokeWidth(Size size) {
    return (size.shortestSide / 280).clamp(0.8, 2.2).toDouble();
  }

  @override
  bool shouldRepaint(covariant CaseHeroPainter oldDelegate) {
    return spec != oldDelegate.spec;
  }
}

int _hash(int seed, int lane) {
  int value = ((seed & 0xFFFF) | ((lane + 1) << 16)) & 0xFFFFFFFF;
  value = ((value ^ (value >> 16)) * 0x45D9F3B) & 0xFFFFFFFF;
  value = ((value ^ (value >> 16)) * 0x45D9F3B) & 0xFFFFFFFF;
  return (value ^ (value >> 16)) & 0xFFFFFFFF;
}

double _unit(int seed, int lane) => (_hash(seed, lane) & 0xFFFF) / 65535;
