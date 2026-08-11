import 'package:flutter/material.dart';

import '../design/case_treatment_scope.dart';
import '../models/training_debrief.dart';
import '../screens/training_debrief_screen.dart';
import '../visual_identity/case_visual_manifest.dart';
import 'living_case_palette.dart';
import 'living_case_strings.dart';
import 'living_case_visual_manifest.dart';

/// Outcome Dossier for the two exact GreenFire terminal outcome identities.
class GreenFireLivingCaseOutcomeScreen extends StatelessWidget {
  const GreenFireLivingCaseOutcomeScreen({
    required this.debrief,
    required this.treatment,
    required this.outcomeTreatment,
    required this.locale,
    super.key,
  });

  final TrainingDebriefView debrief;
  final CaseVisualTreatment treatment;
  final LivingCaseOutcomeTreatment outcomeTreatment;
  final String locale;

  String _text(String english, String russian) =>
      LivingCaseStrings.text(locale, english, russian);

  bool get _protected =>
      outcomeTreatment == LivingCaseOutcomeTreatment.protected;

  @override
  Widget build(BuildContext context) {
    return CaseTreatmentScope(
      treatment: resolveLivingCaseTreatment(context, treatment),
      child: Scaffold(
        key: const ValueKey<String>('greenfire-outcome-dossier-screen'),
        appBar: AppBar(
          title: Text(_text('Outcome dossier', 'Итоговое досье')),
        ),
        body: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final Widget result = _result(context);
            final Widget record = _record(context);
            return SingleChildScrollView(
              key: const PageStorageKey<String>('greenfire-outcome-scroll'),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  constraints.maxWidth >= 700
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Expanded(flex: 3, child: result),
                            const SizedBox(width: 16),
                            Expanded(flex: 2, child: record),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            result,
                            const SizedBox(height: 16),
                            record,
                          ],
                        ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    key: const ValueKey<String>(
                      'greenfire-outcome-replay-button',
                    ),
                    onPressed: () => Navigator.of(context).pop(
                      TrainingDebriefNavigationAction.replay,
                    ),
                    icon: const Icon(Icons.replay_outlined),
                    label: Text(_text(
                      'Replay this case',
                      'Переиграть это дело',
                    )),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    key: const ValueKey<String>(
                      'greenfire-outcome-back-button',
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                    child: Text(_text(
                      'Back to matter',
                      'Вернуться к делу',
                    )),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _result(BuildContext context) {
    final palette = CaseTreatmentScope.of(context).palette;
    return Semantics(
      header: true,
      label: '${debrief.resolvedOutcomeTitle}. '
          '${_protected ? _text('Position protected', 'Позиция защищена') : _text('Position compromised', 'Позиция ослаблена')}.',
      child: Container(
        key: ValueKey<String>(
          _protected
              ? 'greenfire-outcome-protected'
              : 'greenfire-outcome-compromised',
        ),
        constraints: const BoxConstraints(minHeight: 300),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: palette.background,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _protected ? palette.accent : palette.signal,
            width: 2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              _protected ? Icons.shield_outlined : Icons.crisis_alert_outlined,
              color: _protected ? palette.accent : palette.signal,
              size: 44,
            ),
            const SizedBox(height: 64),
            Text(
              _protected
                  ? _text('POSITION PROTECTED', 'ПОЗИЦИЯ ЗАЩИЩЕНА')
                  : _text('POSITION COMPROMISED', 'ПОЗИЦИЯ ОСЛАБЛЕНА'),
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: _protected ? palette.accent : palette.signal,
                    letterSpacing: 1.6,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              debrief.resolvedOutcomeTitle,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(debrief.scenarioTitle),
            const SizedBox(height: 16),
            Text(
              '${_text('Final scenario minute', 'Итоговая минута')}: '
              '${debrief.finalScenarioMinute}',
            ),
          ],
        ),
      ),
    );
  }

  Widget _record(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              _text('AUTHORITATIVE RECORD', 'АВТОРИТЕТНАЯ СВОДКА'),
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const Divider(height: 24),
            _RecordRow(
              label: _text('Executed actions', 'Выполнено действий'),
              value: '${debrief.executedActions.length}',
            ),
            _RecordRow(
              label: _text('Action time', 'Время действий'),
              value: '${debrief.totalActionTimeMinutes} min',
            ),
            _RecordRow(
              label: _text('Billable time', 'Учтённое время'),
              value: '${debrief.totalBillableMinutes} min',
            ),
            _RecordRow(
              label: _text('Action costs', 'Стоимость действий'),
              value: 'EUR ${debrief.totalActionCostEur}',
            ),
            if (debrief.executedActions.isNotEmpty) ...<Widget>[
              const Divider(height: 24),
              ...debrief.executedActions.map(
                (TrainingDebriefActionView action) => ListTile(
                  key: ValueKey<String>(
                    'greenfire-outcome-action-${action.sequence}',
                  ),
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(child: Text('${action.sequence}')),
                  title: Text(action.title),
                  subtitle: Text(
                    '${_text('Minute', 'Минута')} '
                    '${action.completionMinute}',
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RecordRow extends StatelessWidget {
  const _RecordRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Text(value, style: Theme.of(context).textTheme.labelLarge),
        ],
      ),
    );
  }
}
