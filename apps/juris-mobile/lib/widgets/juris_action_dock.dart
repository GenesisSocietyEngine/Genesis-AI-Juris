import 'package:flutter/material.dart';

import '../design/juris_design.dart';

const double _representativeBodyFontSize = 16;
const double _largeTextLayoutThreshold = 1.3;

/// An in-flow review entry for projected decisions or scoped responses.
///
/// The dock only opens an existing review callback. It never dispatches an
/// action and never derives a count beyond the exact value supplied by its
/// projection owner.
class JurisActionDock extends StatelessWidget {
  const JurisActionDock({
    required this.eyebrow,
    required this.label,
    required this.count,
    required this.onPressed,
    required this.semanticLabel,
    this.controlKey,
    this.secondaryLabel,
    this.onSecondaryPressed,
    this.secondaryControlKey,
    this.accent,
    super.key,
  }) : assert(
          (secondaryLabel == null && onSecondaryPressed == null) ||
              (secondaryLabel != null && onSecondaryPressed != null),
        );

  final String eyebrow;
  final String label;
  final int count;
  final VoidCallback onPressed;
  final String semanticLabel;
  final Key? controlKey;
  final String? secondaryLabel;
  final VoidCallback? onSecondaryPressed;
  final Key? secondaryControlKey;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces =
        theme.extension<JurisSurfaces>() ?? JurisSurfaces.dark;
    final JurisSpacing spacing =
        theme.extension<JurisSpacing>() ?? JurisSpacing.standard;
    final JurisBorders borders =
        theme.extension<JurisBorders>() ?? JurisBorders.standardWeights;
    final JurisTypography typography =
        theme.extension<JurisTypography>() ?? JurisTypography.standard;
    final JurisMotion motion = JurisMotionPolicy.of(context);
    final Color dockAccent = accent ?? surfaces.brass;

    final Widget primary = Focus(
      canRequestFocus: false,
      child: Builder(
        builder: (BuildContext focusContext) {
          final bool focused = Focus.of(focusContext).hasFocus;
          return Semantics(
            button: true,
            label: semanticLabel,
            child: ExcludeSemantics(
              child: AnimatedContainer(
                duration: motion.selection,
                curve: motion.selectionCurve,
                decoration: BoxDecoration(
                  color:
                      focused ? surfaces.elevatedSurface : surfaces.surfaceLow,
                  border: Border(
                    left: BorderSide(
                      color: dockAccent,
                      width: borders.emphasis,
                    ),
                    top: BorderSide(
                      color: focused ? surfaces.focus : surfaces.rule,
                      width: focused ? borders.focus : borders.standard,
                    ),
                    right: BorderSide(
                      color: focused ? surfaces.focus : surfaces.rule,
                      width: focused ? borders.focus : borders.standard,
                    ),
                    bottom: BorderSide(
                      color: focused ? surfaces.focus : surfaces.rule,
                      width: focused ? borders.focus : borders.standard,
                    ),
                  ),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    key: controlKey,
                    onTap: onPressed,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 56),
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: spacing.md,
                          vertical: spacing.sm,
                        ),
                        child: LayoutBuilder(
                          builder: (
                            BuildContext context,
                            BoxConstraints constraints,
                          ) {
                            final double textScale = MediaQuery.textScalerOf(
                                  context,
                                ).scale(_representativeBodyFontSize) /
                                _representativeBodyFontSize;
                            final Widget identity = Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                Text(
                                  eyebrow,
                                  style: typography.statusStamp.copyWith(
                                    color: dockAccent,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                SizedBox(height: spacing.xs),
                                Text(
                                  label,
                                  style: typography.controlLabel.copyWith(
                                    color: surfaces.ink,
                                  ),
                                ),
                              ],
                            );
                            final Widget countAndArrow = Row(
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                Text(
                                  '$count',
                                  style: typography.documentTitle.copyWith(
                                    color: dockAccent,
                                  ),
                                ),
                                SizedBox(width: spacing.sm),
                                Icon(
                                  Icons.arrow_forward,
                                  color: dockAccent,
                                  size: 20,
                                ),
                              ],
                            );
                            if (textScale > _largeTextLayoutThreshold ||
                                constraints.maxWidth < 320) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: <Widget>[
                                  identity,
                                  SizedBox(height: spacing.sm),
                                  Align(
                                    alignment: AlignmentDirectional.centerEnd,
                                    child: countAndArrow,
                                  ),
                                ],
                              );
                            }
                            return Row(
                              children: <Widget>[
                                Expanded(child: identity),
                                SizedBox(width: spacing.md),
                                countAndArrow,
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
    if (secondaryLabel == null) {
      return primary;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        primary,
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: TextButton.icon(
            key: secondaryControlKey,
            onPressed: onSecondaryPressed,
            icon: const Icon(Icons.list_alt_outlined),
            label: Text(secondaryLabel!),
          ),
        ),
      ],
    );
  }
}
