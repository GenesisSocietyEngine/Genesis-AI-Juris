import 'package:flutter/material.dart';

import '../design/case_treatment_scope.dart';
import '../design/juris_accessibility.dart';
import '../design/juris_surfaces.dart';
import '../models/case_catalog.dart';
import '../models/game_snapshot.dart';
import 'living_case_strings.dart';
import 'living_case_view_model.dart';
import 'living_case_visual_manifest.dart';

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

  @override
  Widget build(BuildContext context) {
    final LocalizedCaseText caseText = caseDefinition.localized(locale, 'en');
    final LivingCaseViewModel viewModel = LivingCaseViewModel(
      caseDefinition: caseDefinition,
      snapshot: snapshot,
      manifest: manifest,
      locale: locale,
    );
    return CaseTreatmentScope(
      treatment: manifest.caseTreatment,
      child: _FiniteOpening(
        locale: locale,
        title: caseText.shortTitle,
        child: Column(
          key: const ValueKey<String>('greenfire-living-case-workspace'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _CaseSpine(
              title: caseText.shortTitle,
              topic: caseText.topic,
              jurisdiction: caseDefinition.jurisdiction,
              role: caseText.playerClientRole,
              locale: locale,
            ),
            Expanded(
              child: _LivingCaseDesk(
                viewModel: viewModel,
                locale: locale,
                onShowActions: onShowActions,
                onShowDossier: onShowDossier,
                onShowTrainingDebrief: onShowTrainingDebrief,
                onShowPressureResponses: onShowPressureResponses,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LivingCaseDesk extends StatelessWidget {
  const _LivingCaseDesk({
    required this.viewModel,
    required this.locale,
    required this.onShowActions,
    required this.onShowDossier,
    required this.onShowTrainingDebrief,
    required this.onShowPressureResponses,
  });

  final LivingCaseViewModel viewModel;
  final String locale;
  final VoidCallback onShowActions;
  final VoidCallback onShowDossier;
  final VoidCallback onShowTrainingDebrief;
  final ValueChanged<List<String>> onShowPressureResponses;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final bool wide = constraints.maxWidth >= 700;
        final Widget pressure = _PressurePanel(
          viewModel: viewModel,
          locale: locale,
          onShowPressureResponses: onShowPressureResponses,
        );
        final Widget contextPanel = _VisibleMaterialPanel(
          viewModel: viewModel,
          locale: locale,
          onShowActions: onShowActions,
          onShowDossier: onShowDossier,
          onShowTrainingDebrief: onShowTrainingDebrief,
        );
        return SingleChildScrollView(
          key: const PageStorageKey<String>('greenfire-living-case-scroll'),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          child: wide
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(flex: 3, child: pressure),
                    const SizedBox(width: 16),
                    Expanded(flex: 2, child: contextPanel),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    pressure,
                    const SizedBox(height: 16),
                    contextPanel,
                  ],
                ),
        );
      },
    );
  }
}

class _PressurePanel extends StatelessWidget {
  const _PressurePanel({
    required this.viewModel,
    required this.locale,
    required this.onShowPressureResponses,
  });

  final LivingCaseViewModel viewModel;
  final String locale;
  final ValueChanged<List<String>> onShowPressureResponses;

  @override
  Widget build(BuildContext context) {
    final pressure = viewModel.activePressure;
    final treatment = CaseTreatmentScope.of(context);
    final JurisSurfaces surfaces =
        Theme.of(context).extension<JurisSurfaces>() ?? JurisSurfaces.dark;
    final palette = JurisCasePaletteResolver.resolve(
      palette: treatment.palette,
      surfaces: surfaces,
      highContrast: MediaQuery.highContrastOf(context),
    );
    final LivingCaseDeadlineProjection deadline = viewModel.deadline;
    final String stateLabel = _stateLabel(deadline.state);
    return Semantics(
      container: true,
      label: pressure == null
          ? LivingCaseStrings.quietDesk(locale)
          : '${LivingCaseStrings.activePressure(locale)}. '
              '${LivingCaseStrings.source(locale)}: ${pressure.sourceActorName}. '
              '${pressure.remainingMinutes} ${LivingCaseStrings.remaining(locale)}.',
      child: Container(
        key: const ValueKey<String>('greenfire-pressure-panel'),
        constraints: const BoxConstraints(minHeight: 360),
        decoration: BoxDecoration(
          color: palette.background,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: palette.accent),
        ),
        child: Stack(
          children: <Widget>[
            Positioned.fill(
              child: ExcludeSemantics(
                child: CustomPaint(
                  painter: _PressureFieldPainter(
                    surface: palette.surface,
                    accent: palette.accent,
                    signal: palette.signal,
                    progress: viewModel.deadlineProgress,
                    alert: deadline.state == LivingCaseDeadlineState.missed,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    pressure == null
                        ? LivingCaseStrings.operationalRecord(locale)
                        : LivingCaseStrings.activePressure(locale),
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: palette.accent,
                          letterSpacing: 1.5,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    pressure?.sourceActorName ??
                        LivingCaseStrings.quietDesk(locale),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const Spacer(),
                  if (pressure != null) ...<Widget>[
                    Text(
                      '${pressure.remainingMinutes}',
                      style:
                          Theme.of(context).textTheme.displayMedium?.copyWith(
                        color: palette.signal,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                    Text(LivingCaseStrings.remaining(locale)),
                    const SizedBox(height: 12),
                  ],
                  Row(
                    children: <Widget>[
                      Icon(Icons.schedule_outlined, color: palette.accent),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          deadline.title.isEmpty
                              ? stateLabel
                              : '${deadline.title} · $stateLabel',
                        ),
                      ),
                    ],
                  ),
                  if (viewModel.responseActions.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 18),
                    Text(
                      LivingCaseStrings.responseWindow(locale),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    ...viewModel.responseActions.map(
                      (GameActionView action) => _ResponseButton(
                        action: action,
                        treatment: viewModel.responseTreatment(action)!,
                        locale: locale,
                        onPressed: () =>
                            onShowPressureResponses(<String>[action.id]),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _stateLabel(LivingCaseDeadlineState state) => switch (state) {
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
}

class _ResponseButton extends StatelessWidget {
  const _ResponseButton({
    required this.action,
    required this.treatment,
    required this.locale,
    required this.onPressed,
  });

  final GameActionView action;
  final LivingCaseResponseTreatment treatment;
  final String locale;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = CaseTreatmentScope.of(context).palette;
    final bool controlled = treatment == LivingCaseResponseTreatment.controlled;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: OutlinedButton(
        key: ValueKey<String>('greenfire-response-${action.id}'),
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          alignment: Alignment.centerLeft,
          side: BorderSide(
            color: controlled ? palette.accent : palette.signal,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              controlled
                  ? LivingCaseStrings.controlled(locale)
                  : LivingCaseStrings.disclosedRisk(locale),
              style: Theme.of(context).textTheme.labelSmall,
            ),
            Text(action.title),
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
    required this.onShowActions,
    required this.onShowDossier,
    required this.onShowTrainingDebrief,
  });

  final LivingCaseViewModel viewModel;
  final String locale;
  final VoidCallback onShowActions;
  final VoidCallback onShowDossier;
  final VoidCallback onShowTrainingDebrief;

  @override
  Widget build(BuildContext context) {
    final InboxItemView? request = viewModel.visibleRequest;
    return Card(
      key: const ValueKey<String>('greenfire-visible-material-panel'),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              LivingCaseStrings.visibleMaterial(locale),
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 12),
            if (request != null) ...<Widget>[
              Row(
                children: <Widget>[
                  const Icon(Icons.account_balance_outlined),
                  const SizedBox(width: 8),
                  Expanded(child: Text(request.sender)),
                ],
              ),
              const SizedBox(height: 12),
              Text(request.subject,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(request.body),
              const Divider(height: 28),
            ],
            if (viewModel.snapshot.dossier != null)
              OutlinedButton.icon(
                key: const ValueKey<String>('greenfire-open-dossier'),
                onPressed: onShowDossier,
                icon: const Icon(Icons.folder_open_outlined),
                label: Text(LivingCaseStrings.openDossier(locale)),
              ),
            if (viewModel.snapshot.trainingDebrief != null)
              FilledButton.tonalIcon(
                key: const ValueKey<String>('greenfire-open-outcome-dossier'),
                onPressed: onShowTrainingDebrief,
                icon: const Icon(Icons.school_outlined),
                label: Text(LivingCaseStrings.text(
                  locale,
                  'Open outcome dossier',
                  'Открыть итоговое досье',
                )),
              ),
            if (viewModel.snapshot.actions.isNotEmpty)
              TextButton.icon(
                onPressed: onShowActions,
                icon: const Icon(Icons.playlist_add_check_circle_outlined),
                label: Text(LivingCaseStrings.text(
                  locale,
                  'Review all available actions',
                  'Все доступные действия',
                )),
              ),
          ],
        ),
      ),
    );
  }
}

class _PressureFieldPainter extends CustomPainter {
  const _PressureFieldPainter({
    required this.surface,
    required this.accent,
    required this.signal,
    required this.progress,
    required this.alert,
  });

  final Color surface;
  final Color accent;
  final Color signal;
  final double? progress;
  final bool alert;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint grid = Paint()
      ..color = surface.withValues(alpha: 0.45)
      ..strokeWidth = 1;
    for (double x = 24; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (double y = 24; y < size.height; y += 32) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final Rect arcBounds = Rect.fromCircle(
      center: Offset(size.width - 72, 72),
      radius: 42,
    );
    canvas.drawArc(
      arcBounds,
      -1.5708,
      6.2832,
      false,
      Paint()
        ..color = accent.withValues(alpha: 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8,
    );
    final double? resolvedProgress = progress;
    if (resolvedProgress != null) {
      canvas.drawArc(
        arcBounds,
        -1.5708,
        6.2832 * resolvedProgress.clamp(0, 1),
        false,
        Paint()
          ..color = alert ? signal : accent
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.square
          ..strokeWidth = 8,
      );
    }
  }

  @override
  bool shouldRepaint(_PressureFieldPainter oldDelegate) =>
      surface != oldDelegate.surface ||
      accent != oldDelegate.accent ||
      signal != oldDelegate.signal ||
      progress != oldDelegate.progress ||
      alert != oldDelegate.alert;
}

class _CaseSpine extends StatelessWidget {
  const _CaseSpine({
    required this.title,
    required this.topic,
    required this.jurisdiction,
    required this.role,
    required this.locale,
  });

  final String title;
  final String topic;
  final String jurisdiction;
  final String role;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final treatment = CaseTreatmentScope.of(context);
    return Semantics(
      header: true,
      label: '$title. $topic. $jurisdiction. $role.',
      child: Container(
        key: const ValueKey<String>('greenfire-case-spine'),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: treatment.palette.background,
          border: Border(
            bottom: BorderSide(color: treatment.palette.accent, width: 1),
          ),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 4,
              height: 48,
              color: treatment.palette.signal,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    LivingCaseStrings.desk(locale),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: treatment.palette.accent,
                          letterSpacing: 1.6,
                        ),
                  ),
                  Text(title, style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    '$topic · $jurisdiction · $role',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
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

class _FiniteOpening extends StatefulWidget {
  const _FiniteOpening({
    required this.locale,
    required this.title,
    required this.child,
  });

  final String locale;
  final String title;
  final Widget child;

  @override
  State<_FiniteOpening> createState() => _FiniteOpeningState();
}

class _FiniteOpeningState extends State<_FiniteOpening>
    with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  bool _dismissed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller != null || _dismissed) {
      return;
    }
    if (MediaQuery.disableAnimationsOf(context)) {
      _dismissed = true;
      return;
    }
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )
      ..addStatusListener((AnimationStatus status) {
        if (status == AnimationStatus.completed && mounted) {
          setState(() => _dismissed = true);
        }
      })
      ..forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed) {
      return widget.child;
    }
    final treatment = CaseTreatmentScope.of(context);
    return ColoredBox(
      key: const ValueKey<String>('greenfire-opening'),
      color: treatment.palette.background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.local_fire_department_outlined,
                  size: 52, color: treatment.palette.signal),
              const SizedBox(height: 16),
              Text(
                LivingCaseStrings.openingEyebrow(widget.locale),
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: treatment.palette.accent,
                      letterSpacing: 2,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 20),
              TextButton(
                key: const ValueKey<String>('greenfire-opening-enter'),
                onPressed: () => setState(() => _dismissed = true),
                child: Text(LivingCaseStrings.enterCase(widget.locale)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
