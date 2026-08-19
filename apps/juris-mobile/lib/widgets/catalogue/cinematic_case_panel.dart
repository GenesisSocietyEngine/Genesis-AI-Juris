import 'package:flutter/material.dart';

import '../../data/case_runtime_factory.dart';
import '../../design/juris_design.dart';
import '../../models/case_catalog.dart';
import '../../visual_identity/case_visual_manifest.dart';
import '../../visual_identity/cinematic_catalogue_strings.dart';

const double _expansivePanelWidth = 620;
const double _maximumSplitArtworkTextScale = 1.3;
const double _representativeBodyFontSize = 16;

/// The single selected matter shown by the cinematic catalogue.
///
/// All narrative and launchability data comes from [caseDefinition] and
/// [bundle]. The visual treatment is already resolved by the catalogue and is
/// decorative only.
final class CinematicCasePanel extends StatelessWidget {
  const CinematicCasePanel({
    super.key,
    required this.bundle,
    required this.locale,
    required this.caseDefinition,
    required this.treatment,
    required this.index,
    required this.total,
    required this.wide,
    required this.onStart,
    required this.onDetails,
    this.headingFocusNode,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final MobileCaseDefinition caseDefinition;
  final CaseVisualTreatment treatment;
  final int index;
  final int total;
  final bool wide;
  final VoidCallback onStart;
  final VoidCallback onDetails;
  final FocusNode? headingFocusNode;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisDensity density = theme.extension<JurisDensity>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final CinematicCatalogueStrings chrome =
        CinematicCatalogueStrings.of(locale);
    final LocalizedCaseText text = caseDefinition.localized(
      locale,
      bundle.defaultLocale,
    );
    final bool launchable = CaseRuntimeFactory.supports(caseDefinition);
    final String position = chrome.casePosition(index + 1, total);

    return Semantics(
      container: true,
      label: chrome.selectedCaseLabel(text.topic),
      child: CaseTreatmentScope(
        treatment: treatment,
        child: DossierFrame(
          child: ColoredBox(
            color: theme.colorScheme.surfaceContainerLow,
            child: Padding(
              padding: EdgeInsets.all(
                density.resolve(JurisDensityMode.comfortable).contentInset,
              ),
              child: LayoutBuilder(
                builder: (BuildContext context, BoxConstraints constraints) {
                  final double effectiveTextScale =
                      MediaQuery.textScalerOf(context)
                              .scale(_representativeBodyFontSize) /
                          _representativeBodyFontSize;
                  final bool splitArtwork = wide &&
                      constraints.maxWidth >= _expansivePanelWidth &&
                      effectiveTextScale <= _maximumSplitArtworkTextScale;
                  final Widget artwork = ExcludeSemantics(
                    child: RepaintBoundary(
                      key: const ValueKey<String>('selected-case-art'),
                      child: AspectRatio(
                        aspectRatio: splitArtwork ? 4 / 3 : 16 / 7,
                        child: CinematicScrim(
                          child: CaseHeroArt(treatment: treatment),
                        ),
                      ),
                    ),
                  );
                  final Widget actions = _CaseActions(
                    launchable: launchable,
                    startLabel: bundle.text(locale, 'start_case'),
                    startSemanticLabel: chrome.startCaseLabel(
                      bundle.text(locale, 'start_case'),
                      text.topic,
                    ),
                    detailsLabel: chrome.details,
                    detailsSemanticLabel: chrome.detailsLabel(text.topic),
                    onStart: onStart,
                    onDetails: onDetails,
                  );
                  final Widget details = Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Text(text.synopsis, style: typography.bodyReading),
                      SizedBox(height: spacing.xl),
                      Wrap(
                        spacing: spacing.sm,
                        runSpacing: spacing.sm,
                        children: <Widget>[
                          _CaseFact(
                            icon: launchable
                                ? Icons.play_circle_outline
                                : Icons.construction_outlined,
                            label: launchable
                                ? bundle.text(locale, 'playable')
                                : bundle.text(
                                    locale,
                                    caseDefinition.status.name,
                                  ),
                          ),
                          _CaseFact(
                            icon: Icons.signal_cellular_alt,
                            label: bundle.text(
                              locale,
                              caseDefinition.difficulty.name,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: spacing.lg),
                      Divider(color: theme.colorScheme.outlineVariant),
                      SizedBox(height: spacing.md),
                      _MetadataLine(
                        icon: Icons.business_outlined,
                        label: bundle.text(locale, 'player_client'),
                        value: text.playerClientName,
                      ),
                      SizedBox(height: spacing.sm),
                      _MetadataLine(
                        icon: Icons.balance_outlined,
                        label: bundle.text(locale, 'player_role'),
                        value: bundle.text(locale, caseDefinition.playerRole),
                      ),
                    ],
                  );

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Wrap(
                        spacing: spacing.sm,
                        runSpacing: spacing.sm,
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          CaseIndexMark(
                            indexLabel: position,
                            fileReference: caseDefinition.caseId,
                            selected: true,
                            semanticLabel:
                                '$position. ${caseDefinition.caseId}',
                          ),
                          JurisdictionStamp(
                            label: '${caseDefinition.jurisdiction} · '
                                '${chrome.fictionalMark}',
                            semanticLabel: chrome.jurisdictionLabel(
                              caseDefinition.jurisdiction,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: spacing.xl),
                      Focus(
                        focusNode: headingFocusNode,
                        skipTraversal: true,
                        child: Builder(
                          builder: (BuildContext focusContext) =>
                              JurisFocusOutline(
                            key: const ValueKey<String>(
                              'selected-case-heading-focus',
                            ),
                            focused: Focus.of(focusContext).hasFocus,
                            child: Semantics(
                              key: const ValueKey<String>(
                                'selected-case-heading',
                              ),
                              header: true,
                              child: Text(
                                text.topic,
                                style: typography.resolveCaseDisplay(
                                  wide: constraints.maxWidth >=
                                      _expansivePanelWidth,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: spacing.sm),
                      Text(
                        text.caption,
                        style: typography.sectionTitle.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      SizedBox(height: spacing.xl),
                      if (splitArtwork)
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Expanded(flex: 7, child: details),
                            SizedBox(width: spacing.xl),
                            Expanded(
                              flex: 4,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: <Widget>[
                                  artwork,
                                  SizedBox(height: spacing.lg),
                                  actions,
                                ],
                              ),
                            ),
                          ],
                        )
                      else ...<Widget>[
                        artwork,
                        SizedBox(height: spacing.xl),
                        details,
                        SizedBox(height: spacing.xl),
                        actions,
                      ],
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final class _CaseActions extends StatelessWidget {
  const _CaseActions({
    required this.launchable,
    required this.startLabel,
    required this.startSemanticLabel,
    required this.detailsLabel,
    required this.detailsSemanticLabel,
    required this.onStart,
    required this.onDetails,
  });

  final bool launchable;
  final String startLabel;
  final String startSemanticLabel;
  final String detailsLabel;
  final String detailsSemanticLabel;
  final VoidCallback onStart;
  final VoidCallback onDetails;

  @override
  Widget build(BuildContext context) {
    final JurisSpacing spacing = Theme.of(context).extension<JurisSpacing>()!;
    final Widget start = Semantics(
      button: true,
      enabled: launchable,
      onTap: launchable ? onStart : null,
      label: startSemanticLabel,
      child: ExcludeSemantics(
        child: JurisMinimumTarget(
          child: FilledButton.icon(
            key: const ValueKey<String>('start-case-action'),
            onPressed: launchable ? onStart : null,
            icon: const Icon(Icons.play_arrow),
            label: Text(startLabel),
          ),
        ),
      ),
    );
    final Widget details = Semantics(
      button: true,
      onTap: onDetails,
      label: detailsSemanticLabel,
      child: ExcludeSemantics(
        child: JurisMinimumTarget(
          child: OutlinedButton.icon(
            key: const ValueKey<String>('case-details-action'),
            onPressed: onDetails,
            icon: const Icon(Icons.description_outlined),
            label: Text(detailsLabel),
          ),
        ),
      ),
    );

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double effectiveTextScale = MediaQuery.textScalerOf(context)
                .scale(_representativeBodyFontSize) /
            _representativeBodyFontSize;
        final bool stacked = constraints.maxWidth < 440 ||
            effectiveTextScale > _maximumSplitArtworkTextScale;
        if (stacked) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              start,
              SizedBox(height: spacing.sm),
              details,
            ],
          );
        }
        return Wrap(
          spacing: spacing.md,
          runSpacing: spacing.md,
          children: <Widget>[start, details],
        );
      },
    );
  }
}

final class _CaseFact extends StatelessWidget {
  const _CaseFact({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(
          theme.extension<JurisRadii>()!.pill,
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.md,
          vertical: spacing.sm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 18),
            SizedBox(width: spacing.sm),
            Flexible(
              child: Text(label, style: typography.controlLabel),
            ),
          ],
        ),
      ),
    );
  }
}

final class _MetadataLine extends StatelessWidget {
  const _MetadataLine({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(icon, size: 20),
        SizedBox(width: spacing.sm),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: <InlineSpan>[
                TextSpan(
                  text: '$label: ',
                  style: typography.controlLabel,
                ),
                TextSpan(text: value, style: typography.bodyCompact),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
