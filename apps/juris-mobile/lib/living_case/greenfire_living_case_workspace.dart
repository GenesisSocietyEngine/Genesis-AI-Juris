import 'package:flutter/material.dart';

import '../design/juris_design.dart';
import '../models/case_catalog.dart';
import '../models/dossier_projection.dart';
import '../models/game_snapshot.dart';
import '../models/pressure_countermove.dart';
import '../presentation/inbox_presentation.dart';
import '../visual_identity/case_visual_manifest.dart';
import '../widgets/juris_action_dock.dart';
import 'living_case_palette.dart';
import 'living_case_strings.dart';
import 'living_case_view_model.dart';
import 'living_case_visual_manifest.dart';

const double _operationsSplitWidth = 760;
const double _maximumSplitTextScale = 1.3;
const double _representativeBodyFontSize = 16;

/// Presentation-only workspace for the exact GreenFire current case.
///
/// Runtime ownership and every command remain in [HomeShell]. This widget only
/// composes already-projected case and snapshot fields.
class GreenFireLivingCaseWorkspace extends StatelessWidget {
  const GreenFireLivingCaseWorkspace({
    required this.snapshot,
    required this.caseDefinition,
    required this.manifest,
    required this.locale,
    required this.onShowActions,
    required this.onShowDossier,
    required this.onShowTrainingDebrief,
    required this.onShowPressureResponses,
    this.inboxPresentation,
    this.sessionClockLabel,
    super.key,
  });

  final GameSnapshot snapshot;
  final MobileCaseDefinition caseDefinition;
  final LivingCaseVisualManifest manifest;
  final String locale;
  final VoidCallback onShowActions;
  final VoidCallback onShowDossier;
  final VoidCallback onShowTrainingDebrief;
  final ValueChanged<List<String>> onShowPressureResponses;
  final InboxPresentation? inboxPresentation;
  final String? sessionClockLabel;

  @override
  Widget build(BuildContext context) {
    final LivingCaseViewModel viewModel = LivingCaseViewModel(
      caseDefinition: caseDefinition,
      snapshot: snapshot,
      manifest: manifest,
      locale: locale,
    );
    final InboxPresentation inbox =
        inboxPresentation ?? InboxPresentation.from(snapshot.inbox);
    return CaseTreatmentScope(
      treatment: resolveLivingCaseTreatment(context, manifest.caseTreatment),
      child: _LivingCaseDesk(
        key: const ValueKey<String>('greenfire-living-case-workspace'),
        viewModel: viewModel,
        inboxPresentation: inbox,
        locale: locale,
        sessionClockLabel: sessionClockLabel,
        onShowActions: onShowActions,
        onShowDossier: onShowDossier,
        onShowTrainingDebrief: onShowTrainingDebrief,
        onShowPressureResponses: onShowPressureResponses,
      ),
    );
  }
}

class _OperationsHeader extends StatelessWidget {
  const _OperationsHeader({required this.viewModel, required this.locale});

  final LivingCaseViewModel viewModel;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final LocalizedCaseText caseText = viewModel.caseText;
    final CaseVisualTreatment treatment = CaseTreatmentScope.of(context);
    final Color onCase = theme.brightness == Brightness.light
        ? surfaces.elevatedSurface
        : surfaces.ink;
    return Container(
      key: const ValueKey<String>('greenfire-case-spine'),
      decoration: BoxDecoration(
        color: treatment.palette.background,
        border: Border(
          bottom: BorderSide(color: treatment.palette.accent, width: 2),
        ),
      ),
      child: Stack(
        children: <Widget>[
          Positioned.fill(
            child: Opacity(
              opacity: 0.18,
              child: CaseHeroArt(treatment: treatment),
            ),
          ),
          PositionedDirectional(
            start: 0,
            top: 0,
            bottom: 0,
            width: 10,
            child: ColoredBox(color: treatment.palette.accent),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              spacing.compactGutter + spacing.sm,
              spacing.sm,
              spacing.compactGutter,
              spacing.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  LivingCaseStrings.operations(locale),
                  style: typography.statusStamp.copyWith(
                    color: treatment.palette.accent,
                    letterSpacing: 0.8,
                  ),
                ),
                SizedBox(height: spacing.xs),
                Semantics(
                  header: true,
                  child: Text(
                    '${caseText.shortTitle} — ${caseText.topic}',
                    style: typography.sectionTitle.copyWith(color: onCase),
                  ),
                ),
                SizedBox(height: spacing.sm),
                Text(
                  '${viewModel.caseDefinition.jurisdiction} · '
                  '${caseText.playerClientRole}',
                  style: typography.bodyCompact.copyWith(
                    color: onCase.withValues(alpha: 0.86),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          PositionedDirectional(
            end: spacing.md,
            top: spacing.sm,
            child: ExcludeSemantics(
              child: Icon(
                Icons.grid_4x4,
                color: treatment.palette.signal.withValues(alpha: 0.72),
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LivingCaseDesk extends StatelessWidget {
  const _LivingCaseDesk({
    super.key,
    required this.viewModel,
    required this.inboxPresentation,
    required this.locale,
    required this.sessionClockLabel,
    required this.onShowActions,
    required this.onShowDossier,
    required this.onShowTrainingDebrief,
    required this.onShowPressureResponses,
  });

  final LivingCaseViewModel viewModel;
  final InboxPresentation inboxPresentation;
  final String locale;
  final String? sessionClockLabel;
  final VoidCallback onShowActions;
  final VoidCallback onShowDossier;
  final VoidCallback onShowTrainingDebrief;
  final ValueChanged<List<String>> onShowPressureResponses;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisDensity density = theme.extension<JurisDensity>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final double trailingContentInset =
        spacing.lg + MediaQuery.paddingOf(context).bottom;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double effectiveTextScale = MediaQuery.textScalerOf(context)
                .scale(_representativeBodyFontSize) /
            _representativeBodyFontSize;
        final bool split = constraints.maxWidth >= _operationsSplitWidth &&
            effectiveTextScale <= _maximumSplitTextScale;
        final JurisDensityMetrics metrics = density.resolve(
          split ? JurisDensityMode.comfortable : JurisDensityMode.compact,
        );
        final Widget pressure = _PressurePanel(
          viewModel: viewModel,
          locale: locale,
        );
        final Widget material = _VisibleMaterialPanel(
          viewModel: viewModel,
          locale: locale,
          onShowDossier: onShowDossier,
          onShowTrainingDebrief: onShowTrainingDebrief,
        );
        final List<GameActionView> responses = viewModel.responseActions;
        final bool reviewsPressure =
            viewModel.activePressure != null && responses.isNotEmpty;
        final Widget? actionDock = viewModel.snapshot.actions.isEmpty
            ? null
            : JurisActionDock(
                eyebrow: reviewsPressure
                    ? LivingCaseStrings.pressureResponses(locale)
                    : LivingCaseStrings.decisions(locale),
                label: reviewsPressure
                    ? LivingCaseStrings.reviewResponses(
                        locale,
                        responses.length,
                      )
                    : LivingCaseStrings.reviewAllActions(locale),
                count: reviewsPressure
                    ? responses.length
                    : viewModel.snapshot.actions.length,
                semanticLabel: reviewsPressure
                    ? '${LivingCaseStrings.pressureResponses(locale)}: '
                        '${responses.length}'
                    : '${LivingCaseStrings.decisions(locale)}: '
                        '${viewModel.snapshot.actions.length}',
                controlKey: ValueKey<String>(
                  reviewsPressure
                      ? 'greenfire-review-pressure-responses'
                      : 'greenfire-review-all-actions',
                ),
                onPressed: reviewsPressure
                    ? () => onShowPressureResponses(
                          responses
                              .map((GameActionView action) => action.id)
                              .toList(growable: false),
                        )
                    : onShowActions,
                secondaryLabel: reviewsPressure
                    ? LivingCaseStrings.reviewAllActions(locale)
                    : null,
                onSecondaryPressed: reviewsPressure ? onShowActions : null,
                secondaryControlKey: reviewsPressure
                    ? const ValueKey<String>('greenfire-review-all-actions')
                    : null,
              );
        final Widget situation = _CurrentSituationBrief(
          item: viewModel.visibleRequest,
          locale: locale,
        );
        final Widget statusRail = _OperationalLedger(
          viewModel: viewModel,
          inboxPresentation: inboxPresentation,
          locale: locale,
          sessionClockLabel: sessionClockLabel,
        );
        return SingleChildScrollView(
          key: const PageStorageKey<String>('greenfire-living-case-scroll'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _OperationsHeader(viewModel: viewModel, locale: locale),
              Padding(
                padding: EdgeInsets.fromLTRB(
                  metrics.contentInset,
                  metrics.contentInset,
                  metrics.contentInset,
                  trailingContentInset,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    if (split)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(flex: 3, child: situation),
                          SizedBox(width: spacing.lg),
                          Expanded(flex: 2, child: statusRail),
                        ],
                      )
                    else ...<Widget>[
                      situation,
                      SizedBox(height: metrics.sectionRhythm),
                      statusRail,
                    ],
                    SizedBox(height: metrics.sectionRhythm),
                    pressure,
                    if (actionDock != null) ...<Widget>[
                      SizedBox(height: metrics.sectionRhythm),
                      actionDock,
                    ],
                    SizedBox(height: metrics.sectionRhythm),
                    material,
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CurrentSituationBrief extends StatelessWidget {
  const _CurrentSituationBrief({required this.item, required this.locale});

  final InboxItemView? item;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final JurisRadii radii = theme.extension<JurisRadii>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisMotion motion = JurisMotionPolicy.of(context);
    final CaseVisualTreatment treatment = CaseTreatmentScope.of(context);
    final InboxItemView? visibleItem = item;
    final bool urgent = visibleItem?.status == InboxStatus.actionRequired;
    final double textScale =
        MediaQuery.textScalerOf(context).scale(_representativeBodyFontSize) /
            _representativeBodyFontSize;
    final Color accent = urgent ? surfaces.danger : treatment.palette.accent;

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: motion.selection,
      curve: motion.selectionCurve,
      builder: (BuildContext context, double value, Widget? child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 8),
            child: child,
          ),
        );
      },
      child: Material(
        key: const ValueKey<String>('greenfire-current-situation'),
        color: surfaces.elevatedSurface,
        elevation: surfaces.raisedElevation,
        borderRadius: BorderRadius.circular(radii.large),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: <Widget>[
            Positioned.fill(
              child: Opacity(
                opacity: 0.055,
                child: CaseHeroArt(treatment: treatment),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(color: accent, width: borders.emphasis),
                  top: BorderSide(color: surfaces.rule),
                  right: BorderSide(color: surfaces.rule),
                  bottom: BorderSide(color: surfaces.rule),
                ),
              ),
              child: Padding(
                padding: EdgeInsets.all(spacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            LivingCaseStrings.currentSituation(locale),
                            style: typography.statusStamp.copyWith(
                              color: surfaces.brass,
                              letterSpacing: 0.7,
                            ),
                          ),
                        ),
                        ExcludeSemantics(
                          child: Icon(
                            Icons.control_point_duplicate_outlined,
                            size: 18,
                            color: treatment.palette.accent,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: spacing.sm),
                    if (visibleItem == null)
                      Text(
                        LivingCaseStrings.quietDesk(locale),
                        style: typography.bodyCompact,
                      )
                    else ...<Widget>[
                      Text(
                        LivingCaseStrings.recentCommunication(locale),
                        style: typography.caption.copyWith(
                          color: surfaces.mutedInk,
                        ),
                      ),
                      SizedBox(height: spacing.xs),
                      Text(
                        visibleItem.sender,
                        style: typography.bodyCompact.copyWith(
                          color: surfaces.ink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: spacing.xs),
                      Wrap(
                        spacing: spacing.sm,
                        runSpacing: spacing.xs,
                        children: <Widget>[
                          Text(
                            visibleItem.receivedAt,
                            style: typography.timestamp.copyWith(
                              color: surfaces.mutedInk,
                            ),
                          ),
                          Text(
                            _inboxStatusLabel(visibleItem.status, locale),
                            style: typography.statusStamp.copyWith(
                              color: urgent ? surfaces.danger : surfaces.cyan,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: spacing.md),
                      Text(
                        visibleItem.subject,
                        style: typography.documentTitle.copyWith(
                          color: urgent ? surfaces.danger : surfaces.ink,
                        ),
                      ),
                      SizedBox(height: spacing.xs),
                      Text(
                        visibleItem.body,
                        maxLines: textScale > _maximumSplitTextScale ? 3 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: typography.bodyCompact.copyWith(
                          color: surfaces.mutedInk,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OperationalLedger extends StatelessWidget {
  const _OperationalLedger({
    required this.viewModel,
    required this.inboxPresentation,
    required this.locale,
    required this.sessionClockLabel,
  });

  final LivingCaseViewModel viewModel;
  final InboxPresentation inboxPresentation;
  final String locale;
  final String? sessionClockLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final GameSnapshot snapshot = viewModel.snapshot;
    final DossierMatterStatus? dossierStatus =
        snapshot.dossier?.procedure.matterStatus;
    return Container(
      key: const ValueKey<String>('greenfire-operations-ledger'),
      decoration: BoxDecoration(
        color: surfaces.surfaceLow,
        border: Border(
          left: BorderSide(
            color: surfaces.brass,
            width: borders.emphasis,
          ),
          top: BorderSide(color: surfaces.rule, width: borders.standard),
          bottom: BorderSide(color: surfaces.rule, width: borders.standard),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        spacing.md,
        spacing.sm,
        spacing.sm,
        spacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            LivingCaseStrings.operationalStatus(locale),
            style: typography.statusStamp.copyWith(
              color: surfaces.brass,
              letterSpacing: 0.7,
            ),
          ),
          SizedBox(height: spacing.sm),
          Wrap(
            spacing: spacing.lg,
            runSpacing: spacing.sm,
            children: <Widget>[
              _LedgerDatum(
                label: LivingCaseStrings.currentPhase(locale),
                value: snapshot.stage,
                prominent: true,
              ),
              _LedgerDatum(
                label: LivingCaseStrings.state(
                  locale,
                  'Case time',
                  'Время дела',
                ),
                value: '${snapshot.dayLabel} · ${snapshot.timeLabel}',
                prominent: true,
              ),
              _LedgerDatum(
                key: const ValueKey<String>('greenfire-attention-count'),
                label: LivingCaseStrings.attention(locale),
                value: '${inboxPresentation.attentionRequiredCount}',
                signal: inboxPresentation.attentionRequiredCount > 0,
              ),
              _LedgerDatum(
                key: const ValueKey<String>('greenfire-decision-count'),
                label: LivingCaseStrings.decisions(locale),
                value: '${snapshot.actions.length}',
              ),
            ],
          ),
          SizedBox(height: spacing.sm),
          Divider(color: surfaces.rule, height: 1),
          SizedBox(height: spacing.xs),
          Wrap(
            spacing: spacing.lg,
            runSpacing: spacing.sm,
            children: <Widget>[
              if (dossierStatus != null)
                _LedgerDatum(
                  label: LivingCaseStrings.matterStatus(locale),
                  value: _matterStatusLabel(dossierStatus, locale),
                  prominent: true,
                ),
              _LedgerDatum(
                label: LivingCaseStrings.lifecycle(locale),
                value: _lifecycleLabel(snapshot.matterLifecycle, locale),
                secondary: true,
              ),
              _LedgerDatum(
                label: LivingCaseStrings.matterState(locale),
                value: snapshot.isClosed
                    ? LivingCaseStrings.closedMatter(locale)
                    : LivingCaseStrings.openMatter(locale),
                secondary: true,
              ),
              if (sessionClockLabel != null)
                _LedgerDatum(
                  label: LivingCaseStrings.state(
                    locale,
                    'Session clock',
                    'Часы сеанса',
                  ),
                  value: sessionClockLabel!,
                  secondary: true,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LedgerDatum extends StatelessWidget {
  const _LedgerDatum({
    required this.label,
    required this.value,
    this.signal = false,
    this.prominent = false,
    this.secondary = false,
    super.key,
  });

  final String label;
  final String value;
  final bool signal;
  final bool prominent;
  final bool secondary;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    if (secondary) {
      return Semantics(
        label: '$label: $value',
        child: ExcludeSemantics(
          child: Text(
            '$label · $value',
            style: typography.bodyCompact.copyWith(
              color: surfaces.mutedInk,
            ),
          ),
        ),
      );
    }
    return Semantics(
      label: '$label: $value',
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minWidth: 112,
            maxWidth: prominent ? 280 : 220,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                label.toUpperCase(),
                style: typography.statusStamp.copyWith(
                  color: signal ? surfaces.danger : surfaces.mutedInk,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: (prominent
                        ? typography.controlLabel
                        : typography.documentTitle)
                    .copyWith(
                  color: signal ? surfaces.danger : surfaces.ink,
                  fontWeight: prominent || signal ? FontWeight.w700 : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PressurePanel extends StatelessWidget {
  const _PressurePanel({
    required this.viewModel,
    required this.locale,
  });

  final LivingCaseViewModel viewModel;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ActivePressureView? pressure = viewModel.activePressure;
    final List<GameActionView> responses = viewModel.responseActions;
    final LivingCaseDeadlineProjection deadline = viewModel.deadline;
    final bool missed = deadline.state == LivingCaseDeadlineState.missed;
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final Color accent = missed
        ? surfaces.danger
        : pressure == null
            ? surfaces.rule
            : surfaces.cyan;

    return Container(
      key: const ValueKey<String>('greenfire-pressure-panel'),
      decoration: BoxDecoration(
        color: pressure == null ? Colors.transparent : surfaces.surfaceLow,
        border: Border(
          top: BorderSide(
            color: accent,
            width: pressure == null && !missed
                ? borders.standard
                : borders.emphasis,
          ),
          bottom: BorderSide(
            color: surfaces.rule,
            width: borders.standard,
          ),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.sm,
          vertical: spacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Semantics(
              header: true,
              child: Text(
                pressure == null
                    ? LivingCaseStrings.operationalRecord(locale)
                    : LivingCaseStrings.activePressure(locale),
                style: typography.statusStamp.copyWith(color: accent),
              ),
            ),
            SizedBox(height: spacing.xs),
            if (pressure == null)
              Text(
                LivingCaseStrings.quietDesk(locale),
                style: typography.bodyCompact.copyWith(
                  color: surfaces.mutedInk,
                ),
              )
            else ...<Widget>[
              _StatusLine(
                icon: Icons.account_balance_outlined,
                label: LivingCaseStrings.source(locale),
                value: pressure.sourceActorName,
              ),
            ],
            if (deadline.title.isNotEmpty ||
                deadline.state != LivingCaseDeadlineState.inactive) ...<Widget>[
              SizedBox(height: spacing.md),
              _StatusLine(
                icon: missed ? Icons.error_outline : Icons.schedule_outlined,
                label: LivingCaseStrings.deadline(locale),
                value: deadline.title.isEmpty
                    ? _deadlineStateLabel(deadline.state, locale)
                    : '${deadline.title} · '
                        '${_deadlineStateLabel(deadline.state, locale)}',
                signal: missed,
              ),
            ],
            if (pressure != null) ...<Widget>[
              SizedBox(height: spacing.md),
              Divider(color: surfaces.rule, height: 1),
              SizedBox(height: spacing.sm),
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      LivingCaseStrings.responseWindow(locale),
                      style: typography.controlLabel,
                    ),
                  ),
                  Semantics(
                    label:
                        '${LivingCaseStrings.pressureResponses(locale)}: ${responses.length}',
                    child: ExcludeSemantics(
                      child: Text(
                        '${responses.length}',
                        key: const ValueKey<String>(
                          'greenfire-pressure-response-count',
                        ),
                        style: typography.controlLabel.copyWith(
                          color: surfaces.cyan,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (responses.isEmpty) ...<Widget>[
                SizedBox(height: spacing.sm),
                Text(
                  LivingCaseStrings.noResponses(locale),
                  style: typography.bodyCompact.copyWith(
                    color: surfaces.mutedInk,
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _VisibleMaterialPanel extends StatelessWidget {
  const _VisibleMaterialPanel({
    required this.viewModel,
    required this.locale,
    required this.onShowDossier,
    required this.onShowTrainingDebrief,
  });

  final LivingCaseViewModel viewModel;
  final String locale;
  final VoidCallback onShowDossier;
  final VoidCallback onShowTrainingDebrief;

  @override
  Widget build(BuildContext context) {
    final GameSnapshot snapshot = viewModel.snapshot;
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final bool hasProjectedMaterial =
        snapshot.dossier != null || snapshot.trainingDebrief != null;
    return Container(
      key: const ValueKey<String>('greenfire-visible-material-panel'),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: surfaces.brass, width: borders.emphasis),
          bottom: BorderSide(color: surfaces.rule, width: borders.standard),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.sm,
          vertical: spacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              LivingCaseStrings.visibleMaterial(locale),
              style: typography.statusStamp.copyWith(color: surfaces.brass),
            ),
            if (!hasProjectedMaterial) ...<Widget>[
              SizedBox(height: spacing.md),
              Text(
                LivingCaseStrings.noVisibleMaterial(locale),
                style: typography.bodyCompact.copyWith(
                  color: surfaces.mutedInk,
                ),
              ),
            ],
            if (snapshot.dossier != null) ...<Widget>[
              SizedBox(height: spacing.sm),
              JurisMinimumTarget(
                child: TextButton.icon(
                  key: const ValueKey<String>('greenfire-open-dossier'),
                  onPressed: onShowDossier,
                  icon: const Icon(Icons.folder_open_outlined),
                  label: Text(LivingCaseStrings.openDossier(locale)),
                ),
              ),
            ],
            if (snapshot.trainingDebrief != null) ...<Widget>[
              SizedBox(height: spacing.xs),
              JurisMinimumTarget(
                child: TextButton.icon(
                  key: const ValueKey<String>(
                    'greenfire-open-outcome-dossier',
                  ),
                  onPressed: onShowTrainingDebrief,
                  icon: const Icon(Icons.school_outlined),
                  label: Text(LivingCaseStrings.openOutcomeDossier(locale)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.icon,
    required this.label,
    required this.value,
    this.signal = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool signal;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final Color color = signal ? surfaces.danger : surfaces.mutedInk;
    return Semantics(
      label: '$label: $value',
      child: ExcludeSemantics(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(icon, color: color, size: 20),
            SizedBox(width: spacing.sm),
            Expanded(
              child: Text(
                '$label · $value',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: color,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _deadlineStateLabel(LivingCaseDeadlineState state, String locale) =>
    switch (state) {
      LivingCaseDeadlineState.inactive =>
        LivingCaseStrings.state(locale, 'Inactive', 'Неактивно'),
      LivingCaseDeadlineState.active =>
        LivingCaseStrings.state(locale, 'Active', 'Активно'),
      LivingCaseDeadlineState.completed =>
        LivingCaseStrings.state(locale, 'Completed', 'Завершено'),
      LivingCaseDeadlineState.missed =>
        LivingCaseStrings.state(locale, 'Missed', 'Пропущено'),
      LivingCaseDeadlineState.unknown =>
        LivingCaseStrings.state(locale, 'Unknown', 'Неизвестно'),
    };

String _matterStatusLabel(DossierMatterStatus status, String locale) =>
    switch (status) {
      DossierMatterStatus.open =>
        LivingCaseStrings.state(locale, 'Open', 'Открыто'),
      DossierMatterStatus.recoverable =>
        LivingCaseStrings.state(locale, 'Recoverable', 'Восстановимо'),
      DossierMatterStatus.closed =>
        LivingCaseStrings.state(locale, 'Closed', 'Закрыто'),
      DossierMatterStatus.unknown =>
        LivingCaseStrings.state(locale, 'Unknown', 'Неизвестно'),
    };

String _lifecycleLabel(MatterLifecycleStatus status, String locale) =>
    switch (status) {
      MatterLifecycleStatus.active =>
        LivingCaseStrings.state(locale, 'Active', 'Активно'),
      MatterLifecycleStatus.postJudgment => LivingCaseStrings.state(
          locale,
          'Post-judgment',
          'После решения суда',
        ),
      MatterLifecycleStatus.appeal =>
        LivingCaseStrings.state(locale, 'Appeal', 'Апелляция'),
      MatterLifecycleStatus.cassation =>
        LivingCaseStrings.state(locale, 'Cassation', 'Кассация'),
      MatterLifecycleStatus.enforcement =>
        LivingCaseStrings.state(locale, 'Enforcement', 'Исполнение'),
      MatterLifecycleStatus.closed =>
        LivingCaseStrings.state(locale, 'Closed', 'Закрыто'),
      MatterLifecycleStatus.unknown =>
        LivingCaseStrings.state(locale, 'Unknown', 'Неизвестно'),
    };

String _inboxStatusLabel(InboxStatus status, String locale) => switch (status) {
      InboxStatus.actionRequired => LivingCaseStrings.state(
          locale, 'Action required', 'Требуется действие'),
      InboxStatus.unread =>
        LivingCaseStrings.state(locale, 'Unread', 'Не прочитано'),
      InboxStatus.read => LivingCaseStrings.state(locale, 'Read', 'Прочитано'),
      InboxStatus.resolved =>
        LivingCaseStrings.state(locale, 'Resolved', 'Решено'),
      InboxStatus.archived =>
        LivingCaseStrings.state(locale, 'Archived', 'В архиве'),
    };

/// Deterministic first frame retained for historical visual evidence.
class GreenFireLivingCaseOpeningFrame extends StatelessWidget {
  const GreenFireLivingCaseOpeningFrame({
    required this.locale,
    required this.title,
    this.onEnter,
    super.key,
  });

  final String locale;
  final String title;
  final VoidCallback? onEnter;

  @override
  Widget build(BuildContext context) {
    final CaseVisualTreatment treatment = CaseTreatmentScope.of(context);
    return ColoredBox(
      key: const ValueKey<String>('greenfire-opening'),
      color: treatment.palette.background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                Icons.local_fire_department_outlined,
                size: 52,
                color: treatment.palette.signal,
              ),
              const SizedBox(height: 16),
              Text(
                LivingCaseStrings.openingEyebrow(locale),
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: treatment.palette.accent,
                      letterSpacing: 2,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 20),
              TextButton(
                key: const ValueKey<String>('greenfire-opening-enter'),
                onPressed: onEnter,
                child: Text(LivingCaseStrings.enterCase(locale)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
