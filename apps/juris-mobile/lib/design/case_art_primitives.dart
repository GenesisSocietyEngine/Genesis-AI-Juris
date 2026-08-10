import 'package:flutter/material.dart';

import 'juris_borders.dart';
import 'juris_radii.dart';
import 'juris_scrims.dart';
import 'juris_spacing.dart';
import 'juris_surfaces.dart';
import 'juris_typography.dart';

/// An institutional border/crop/tab treatment that preserves child semantics.
final class DossierFrame extends StatelessWidget {
  const DossierFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces? surfaces = theme.extension<JurisSurfaces>();
    final JurisBorders? borders = theme.extension<JurisBorders>();
    final JurisRadii? radii = theme.extension<JurisRadii>();
    if (surfaces == null || borders == null || radii == null) {
      throw FlutterError(
        'DossierFrame requires surfaces, borders, and radii theme extensions.',
      );
    }
    return CustomPaint(
      foregroundPainter: DossierFramePainter(
        accent: surfaces.brandGold,
        signal: surfaces.circuitCyan,
        borderWidth: borders.standard,
        radius: radii.panel,
      ),
      child: child,
    );
  }
}

/// Decorative dossier frame painter with value-based repaint decisions.
final class DossierFramePainter extends CustomPainter {
  const DossierFramePainter({
    required this.accent,
    required this.signal,
    required this.borderWidth,
    required this.radius,
  });

  final Color accent;
  final Color signal;
  final double borderWidth;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) {
      return;
    }
    final Rect bounds = Offset.zero & size;
    final RRect frame = RRect.fromRectAndRadius(
      bounds.deflate(borderWidth / 2),
      Radius.circular(radius),
    );
    final Paint borderPaint = Paint()
      ..color = accent.withValues(alpha: 0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;
    canvas.drawRRect(frame, borderPaint);

    final double cropLength = size.shortestSide * 0.08;
    final Paint cropPaint = Paint()
      ..color = signal.withValues(alpha: 0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth * 1.5;
    canvas.drawLine(
      Offset(radius * 0.55, borderWidth),
      Offset(radius * 0.55 + cropLength, borderWidth),
      cropPaint,
    );
    canvas.drawLine(
      Offset(borderWidth, radius * 0.55),
      Offset(borderWidth, radius * 0.55 + cropLength),
      cropPaint,
    );

    final Rect tab = Rect.fromLTWH(
      size.width * 0.72,
      0,
      size.width * 0.16,
      borderWidth * 3,
    );
    canvas.drawRect(
      tab,
      Paint()..color = accent.withValues(alpha: 0.9),
    );
  }

  @override
  bool shouldRepaint(covariant DossierFramePainter oldDelegate) {
    return accent != oldDelegate.accent ||
        signal != oldDelegate.signal ||
        borderWidth != oldDelegate.borderWidth ||
        radius != oldDelegate.radius;
  }
}

/// A neutral sequence/file-reference mark with explicit selected semantics.
final class CaseIndexMark extends StatelessWidget {
  const CaseIndexMark({
    super.key,
    required this.indexLabel,
    this.fileReference,
    required this.selected,
    required this.semanticLabel,
  });

  final String indexLabel;
  final String? fileReference;
  final bool selected;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography? typography = theme.extension<JurisTypography>();
    final JurisSurfaces? surfaces = theme.extension<JurisSurfaces>();
    final JurisSpacing? spacing = theme.extension<JurisSpacing>();
    final JurisBorders? borders = theme.extension<JurisBorders>();
    final JurisRadii? radii = theme.extension<JurisRadii>();
    if (typography == null ||
        surfaces == null ||
        spacing == null ||
        borders == null ||
        radii == null) {
      throw FlutterError(
        'CaseIndexMark requires typography, surfaces, spacing, borders, and '
        'radii theme extensions.',
      );
    }
    final MediaQueryData media =
        MediaQuery.maybeOf(context) ?? const MediaQueryData();
    final Color activeColor =
        media.highContrast ? surfaces.highContrastGold : surfaces.brandGold;

    return Semantics(
      container: true,
      label: semanticLabel,
      selected: selected,
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(
              color: selected
                  ? activeColor
                  : surfaces.evidenceNeutral.withValues(alpha: 0.4),
              width: selected ? borders.emphasis : borders.standard,
            ),
            borderRadius: BorderRadius.circular(radii.small),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.md,
              vertical: spacing.sm,
            ),
            child: Wrap(
              spacing: spacing.sm,
              runSpacing: spacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                Text(
                  indexLabel,
                  style: typography.caseIndex.copyWith(color: activeColor),
                ),
                if (fileReference case final String reference) ...<Widget>[
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      reference,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: typography.metadata.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A fictional text stamp. It deliberately contains no seal or emblem geometry.
final class JurisdictionStamp extends StatelessWidget {
  const JurisdictionStamp({
    super.key,
    required this.label,
    required this.semanticLabel,
  });

  final String label;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography? typography = theme.extension<JurisTypography>();
    final JurisSurfaces? surfaces = theme.extension<JurisSurfaces>();
    final JurisSpacing? spacing = theme.extension<JurisSpacing>();
    final JurisBorders? borders = theme.extension<JurisBorders>();
    final JurisRadii? radii = theme.extension<JurisRadii>();
    if (typography == null ||
        surfaces == null ||
        spacing == null ||
        borders == null ||
        radii == null) {
      throw FlutterError(
        'JurisdictionStamp requires typography, surfaces, spacing, borders, '
        'and radii theme extensions.',
      );
    }
    final MediaQueryData media =
        MediaQuery.maybeOf(context) ?? const MediaQueryData();
    final Color color =
        media.highContrast ? surfaces.highContrastCyan : surfaces.circuitCyan;

    return Semantics(
      container: true,
      label: semanticLabel,
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: color, width: borders.standard),
            borderRadius: BorderRadius.circular(radii.small),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.sm,
              vertical: spacing.xs,
            ),
            child: Text(
              label,
              style: typography.metadata.copyWith(color: color),
            ),
          ),
        ),
      ),
    );
  }
}

enum JurisScrimRole { content, modal, cinematic }

/// Adds a non-interactive solid scrim without masking the child's semantics.
final class CinematicScrim extends StatelessWidget {
  const CinematicScrim({
    super.key,
    required this.child,
    this.role = JurisScrimRole.cinematic,
  });

  final Widget child;
  final JurisScrimRole role;

  @override
  Widget build(BuildContext context) {
    final JurisScrims? scrims = Theme.of(context).extension<JurisScrims>();
    if (scrims == null) {
      throw FlutterError('JurisScrims is not registered on the current theme.');
    }
    final Color color = switch (role) {
      JurisScrimRole.content => scrims.content,
      JurisScrimRole.modal => scrims.modal,
      JurisScrimRole.cinematic => scrims.cinematic,
    };

    return Stack(
      fit: StackFit.passthrough,
      children: <Widget>[
        child,
        Positioned.fill(
          child: IgnorePointer(
            child: ExcludeSemantics(child: ColoredBox(color: color)),
          ),
        ),
      ],
    );
  }
}
