import 'package:flutter/material.dart';

import '../design/case_treatment_scope.dart';
import '../models/case_catalog.dart';
import '../models/game_snapshot.dart';
import '../screens/matter_screen.dart';
import 'living_case_strings.dart';
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
              child: MatterScreen(
                snapshot: snapshot,
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
