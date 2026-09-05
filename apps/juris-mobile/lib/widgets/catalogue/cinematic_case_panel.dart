import 'package:flutter/material.dart';

import '../../data/case_runtime_factory.dart';
import '../../design/juris_design.dart';
import '../../models/case_catalog.dart';
import '../../visual_identity/case_visual_manifest.dart';
import '../../visual_identity/cinematic_catalogue_strings.dart';

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

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
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
              padding: EdgeInsets.all(wide ? spacing.xl : spacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  RepaintBoundary(
                    child: AspectRatio(
                      aspectRatio: wide ? 16 / 7 : 16 / 9,
                      child: CinematicScrim(
                        child: CaseHeroArt(treatment: treatment),
                      ),
                    ),
                  ),
                  SizedBox(height: spacing.lg),
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
                        semanticLabel: chrome.selectedCaseLabel(text.topic),
                      ),
                      JurisdictionStamp(
                        label:
                            '${caseDefinition.jurisdiction} · ${chrome.fictionalMark}',
                        semanticLabel: chrome.jurisdictionLabel(
                          caseDefinition.jurisdiction,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: spacing.xl),
                  Text(
                    text.topic,
                    style: typography.resolveCaseDisplay(wide: wide),
                  ),
                  SizedBox(height: spacing.sm),
                  Text(
                    text.caption,
                    style: typography.sectionTitle.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  SizedBox(height: spacing.lg),
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
                            : bundle.text(locale, caseDefinition.status.name),
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
                  SizedBox(height: spacing.xl),
                  Wrap(
                    spacing: spacing.md,
                    runSpacing: spacing.md,
                    children: <Widget>[
                      Semantics(
                        button: true,
                        enabled: launchable,
                        onTap: launchable ? onStart : null,
                        label: chrome.startCaseLabel(
                          bundle.text(locale, 'start_case'),
                          text.topic,
                        ),
                        child: ExcludeSemantics(
                          child: JurisMinimumTarget(
                            child: FilledButton.icon(
                              key: const ValueKey<String>(
                                'start-case-action',
                              ),
                              onPressed: launchable ? onStart : null,
                              icon: const Icon(Icons.play_arrow),
                              label: Text(bundle.text(locale, 'start_case')),
                            ),
                          ),
                        ),
                      ),
                      Semantics(
                        button: true,
                        onTap: onDetails,
                        label: chrome.detailsLabel(text.topic),
                        child: ExcludeSemantics(
                          child: JurisMinimumTarget(
                            child: OutlinedButton.icon(
                              key: const ValueKey<String>(
                                'case-details-action',
                              ),
                              onPressed: onDetails,
                              icon: const Icon(Icons.description_outlined),
                              label: Text(chrome.details),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
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
