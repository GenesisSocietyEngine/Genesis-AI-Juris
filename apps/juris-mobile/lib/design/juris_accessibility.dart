import 'package:flutter/material.dart';

import '../visual_identity/case_visual_manifest.dart';
import 'juris_borders.dart';
import 'juris_motion.dart';
import 'juris_motion_policy.dart';
import 'juris_radii.dart';
import 'juris_surfaces.dart';
import 'juris_targets.dart';

/// Testable WCAG contrast calculations for opaque token backgrounds.
abstract final class JurisContrast {
  static const double normalTextMinimum = 4.5;
  static const double largeTextMinimum = 3;
  static const double uiBoundaryMinimum = 3;

  static double ratio(Color foreground, Color background) {
    if (!_isOpaque(background)) {
      throw ArgumentError.value(
        background,
        'background',
        'Contrast needs an opaque resolved background.',
      );
    }
    final Color resolvedForeground = Color.alphaBlend(foreground, background);
    final double foregroundLuminance = resolvedForeground.computeLuminance();
    final double backgroundLuminance = background.computeLuminance();
    final double lighter = foregroundLuminance > backgroundLuminance
        ? foregroundLuminance
        : backgroundLuminance;
    final double darker = foregroundLuminance > backgroundLuminance
        ? backgroundLuminance
        : foregroundLuminance;
    return (lighter + 0.05) / (darker + 0.05);
  }

  static bool meetsNormalText(Color foreground, Color background) {
    return ratio(foreground, background) >= normalTextMinimum;
  }

  static bool meetsLargeText(Color foreground, Color background) {
    return ratio(foreground, background) >= largeTextMinimum;
  }

  static bool meetsUiBoundary(Color foreground, Color background) {
    return ratio(foreground, background) >= uiBoundaryMinimum;
  }

  static bool _isOpaque(Color color) {
    return (color.toARGB32() & 0xFF000000) == 0xFF000000;
  }
}

/// Resolves decorative case colours without changing manifest authority.
abstract final class JurisCasePaletteResolver {
  static CaseVisualPalette resolve({
    required CaseVisualPalette palette,
    required JurisSurfaces surfaces,
    required bool highContrast,
  }) {
    if (!highContrast) {
      return palette;
    }
    return CaseVisualPalette(
      background: surfaces.brandNavy,
      surface: surfaces.evidenceNeutral,
      accent: surfaces.highContrastGold,
      signal: surfaces.highContrastCyan,
    );
  }
}

/// Gives a child the design system's minimum interactive layout extent.
final class JurisMinimumTarget extends StatelessWidget {
  const JurisMinimumTarget({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final JurisTargets? targets = Theme.of(context).extension<JurisTargets>();
    if (targets == null) {
      throw FlutterError(
          'JurisTargets is not registered on the current theme.');
    }
    return ConstrainedBox(
      constraints: BoxConstraints(
        minWidth: targets.minimumInteractiveExtent,
        minHeight: targets.minimumInteractiveExtent,
      ),
      child: child,
    );
  }
}

/// Paints a stable visible keyboard/d-pad focus outline around its child.
///
/// Focus ownership remains with the caller so this wrapper cannot alter traversal.
final class JurisFocusOutline extends StatelessWidget {
  const JurisFocusOutline({
    super.key,
    required this.focused,
    required this.child,
  });

  final bool focused;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces? surfaces = theme.extension<JurisSurfaces>();
    final JurisBorders? borders = theme.extension<JurisBorders>();
    final JurisRadii? radii = theme.extension<JurisRadii>();
    final JurisMotion? motion = theme.extension<JurisMotion>();
    if (surfaces == null ||
        borders == null ||
        radii == null ||
        motion == null) {
      throw FlutterError(
        'JurisFocusOutline requires surfaces, borders, radii, and motion '
        'theme extensions.',
      );
    }
    final MediaQueryData media =
        MediaQuery.maybeOf(context) ?? const MediaQueryData();
    final Color focusColor =
        media.highContrast ? surfaces.highContrastCyan : surfaces.focusRing;
    final Duration duration =
        JurisMotionPolicy.resolveDuration(motion.immediate, media);

    return AnimatedContainer(
      duration: duration,
      curve: motion.immediateCurve,
      decoration: BoxDecoration(
        border: Border.all(
          color: focused ? focusColor : Colors.transparent,
          width: borders.focus,
        ),
        borderRadius: BorderRadius.circular(radii.medium),
      ),
      child: child,
    );
  }
}
