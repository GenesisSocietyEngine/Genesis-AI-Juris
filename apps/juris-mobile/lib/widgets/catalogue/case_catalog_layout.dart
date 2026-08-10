import 'package:flutter/material.dart';

import '../../design/juris_spacing.dart';

typedef CatalogueResponsiveBuilder = Widget Function(
  BuildContext context,
  bool wide,
);

/// Owns the catalogue's single documented responsive breakpoint.
///
/// Below 700 logical pixels the case index is horizontal and precedes the
/// selected panel. At and above 700 it becomes a bounded editorial rail.
final class CaseCatalogLayout extends StatelessWidget {
  const CaseCatalogLayout({
    super.key,
    required this.masthead,
    required this.indexBuilder,
    required this.panelBuilder,
  });

  static const double wideBreakpoint = 700;
  static const double maximumContentWidth = 1240;
  // Keep the exact 700px boundary viable after wide gutters and the editorial
  // column gap; 248px is also the index item's bounded intrinsic width.
  static const double wideIndexWidth = 248;

  final Widget masthead;
  final CatalogueResponsiveBuilder indexBuilder;
  final CatalogueResponsiveBuilder panelBuilder;

  @override
  Widget build(BuildContext context) {
    final JurisSpacing? spacing = Theme.of(context).extension<JurisSpacing>();
    if (spacing == null) {
      throw FlutterError('CaseCatalogLayout requires JurisSpacing.');
    }

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final bool wide = constraints.maxWidth >= wideBreakpoint;
        final double gutter = wide ? spacing.wideGutter : spacing.compactGutter;

        return CustomScrollView(
          key: const PageStorageKey<String>('case-catalog'),
          slivers: <Widget>[
            SliverSafeArea(
              bottom: false,
              sliver: SliverPadding(
                padding: EdgeInsets.fromLTRB(gutter, spacing.lg, gutter, 0),
                sliver: SliverToBoxAdapter(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        maxWidth: maximumContentWidth,
                      ),
                      child: masthead,
                    ),
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(
                gutter,
                spacing.xl,
                gutter,
                spacing.display,
              ),
              sliver: SliverToBoxAdapter(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: maximumContentWidth,
                    ),
                    child: wide
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              SizedBox(
                                width: wideIndexWidth,
                                child: indexBuilder(context, true),
                              ),
                              SizedBox(width: spacing.xl),
                              Expanded(child: panelBuilder(context, true)),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              indexBuilder(context, false),
                              SizedBox(height: spacing.lg),
                              panelBuilder(context, false),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
