import 'package:flutter/material.dart';

import '../design/case_treatment_scope.dart';
import '../models/dossier_projection.dart';
import '../visual_identity/case_visual_manifest.dart';
import 'living_case_strings.dart';

/// Read-only GreenFire dossier composed exclusively from the Rust projection.
class GreenFireLivingCaseDossierScreen extends StatefulWidget {
  const GreenFireLivingCaseDossierScreen({
    required this.dossier,
    required this.treatment,
    required this.locale,
    super.key,
  });

  final DossierProjectionView dossier;
  final CaseVisualTreatment treatment;
  final String locale;

  @override
  State<GreenFireLivingCaseDossierScreen> createState() =>
      _GreenFireLivingCaseDossierScreenState();
}

class _GreenFireLivingCaseDossierScreenState
    extends State<GreenFireLivingCaseDossierScreen> {
  String? _selectedEvidenceId;

  String _text(String english, String russian) =>
      LivingCaseStrings.text(widget.locale, english, russian);

  @override
  Widget build(BuildContext context) {
    return CaseTreatmentScope(
      treatment: widget.treatment,
      child: Scaffold(
        key: const ValueKey<String>('greenfire-dossier-screen'),
        appBar: AppBar(
          title: Text(_text('GreenFire dossier', 'Досье GreenFire')),
        ),
        body: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final Widget record = _recordColumn(context);
            final Widget control = _controlColumn(context);
            return SingleChildScrollView(
              key: const PageStorageKey<String>('greenfire-dossier-scroll'),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              child: constraints.maxWidth >= 700
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Expanded(flex: 3, child: record),
                        const SizedBox(width: 16),
                        Expanded(flex: 2, child: control),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        record,
                        const SizedBox(height: 16),
                        control,
                      ],
                    ),
            );
          },
        ),
      ),
    );
  }

  Widget _recordColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _DossierHeader(dossier: widget.dossier, locale: widget.locale),
        const SizedBox(height: 16),
        _MaterialSection(
          title: _text('VISIBLE FACTS', 'ВИДИМЫЕ ФАКТЫ'),
          icon: Icons.fact_check_outlined,
          emptyLabel: _text(
            'No facts are visible in this projection.',
            'В этой проекции факты не отображаются.',
          ),
          children: widget.dossier.facts
              .map(
                (DossierFactView fact) => ListTile(
                  key: ValueKey<String>('greenfire-fact-${fact.id}'),
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.article_outlined),
                  title: Text(fact.statement),
                  subtitle: Text(_factStatus(fact.status)),
                ),
              )
              .toList(growable: false),
        ),
        const SizedBox(height: 16),
        _MaterialSection(
          title: _text('VISIBLE EVIDENCE', 'ВИДИМЫЕ ДОКАЗАТЕЛЬСТВА'),
          icon: Icons.inventory_2_outlined,
          emptyLabel: _text(
            'No evidence is visible in this projection.',
            'В этой проекции доказательства не отображаются.',
          ),
          children: widget.dossier.evidence
              .map(
                (DossierEvidenceView evidence) => _EvidenceItem(
                  evidence: evidence,
                  selected: _selectedEvidenceId == evidence.id,
                  locale: widget.locale,
                  onSelected: () => setState(
                    () => _selectedEvidenceId =
                        _selectedEvidenceId == evidence.id ? null : evidence.id,
                  ),
                ),
              )
              .toList(growable: false),
        ),
      ],
    );
  }

  Widget _controlColumn(BuildContext context) {
    return _MaterialSection(
      title: _text('DEADLINES & REMEDIES', 'СРОКИ И МЕРЫ'),
      icon: Icons.schedule_outlined,
      emptyLabel: _text(
        'No deadlines are visible in this projection.',
        'В этой проекции сроки не отображаются.',
      ),
      children: widget.dossier.deadlines
          .map(
            (DossierDeadlineView deadline) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      deadline.status == DossierDeadlineStatus.missed
                          ? Icons.warning_amber_outlined
                          : Icons.event_available_outlined,
                    ),
                    title: Text(deadline.title),
                    subtitle: Text(
                      '${_deadlineStatus(deadline.status)} · '
                      '${_absoluteMoment(deadline.dueAtMinutes)}',
                    ),
                  ),
                  ...deadline.remedies.map(
                    (DossierRemedyView remedy) => OutlinedButton.icon(
                      key: ValueKey<String>(
                        'greenfire-dossier-remedy-${remedy.actionId}',
                      ),
                      onPressed: () =>
                          Navigator.of(context).pop(remedy.actionId),
                      icon: const Icon(Icons.open_in_new),
                      label: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(remedy.title),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(growable: false),
    );
  }

  String _factStatus(DossierFactStatus status) => switch (status) {
        DossierFactStatus.alleged => _text('Alleged', 'Заявлено'),
        DossierFactStatus.admitted => _text('Admitted', 'Признано'),
        DossierFactStatus.disputed => _text('Disputed', 'Оспаривается'),
        DossierFactStatus.proven => _text('Proven', 'Доказано'),
        DossierFactStatus.inferred => _text('Inferred', 'Выведено'),
        DossierFactStatus.unknown => _text('Unknown', 'Неизвестно'),
      };

  String _deadlineStatus(DossierDeadlineStatus status) => switch (status) {
        DossierDeadlineStatus.open => _text('Open', 'Открыт'),
        DossierDeadlineStatus.completed => _text('Completed', 'Завершён'),
        DossierDeadlineStatus.missed => _text('Missed', 'Пропущен'),
        DossierDeadlineStatus.unknown => _text('Unknown', 'Неизвестен'),
      };

  String _absoluteMoment(int elapsedMinutes) {
    final int absolute = 8 * 60 + elapsedMinutes;
    final int day = absolute ~/ 1440 + 1;
    final int minute = absolute % 1440;
    return '${_text('Day', 'День')} $day · '
        '${(minute ~/ 60).toString().padLeft(2, '0')}:'
        '${(minute % 60).toString().padLeft(2, '0')}';
  }
}

class _DossierHeader extends StatelessWidget {
  const _DossierHeader({required this.dossier, required this.locale});

  final DossierProjectionView dossier;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final palette = CaseTreatmentScope.of(context).palette;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: palette.background,
        border: Border(left: BorderSide(color: palette.signal, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            LivingCaseStrings.text(
              locale,
              'AUTHORITATIVE PLAYER-VISIBLE PROJECTION',
              'АВТОРИТЕТНАЯ ВИДИМАЯ ПРОЕКЦИЯ',
            ),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: palette.accent,
                  letterSpacing: 1.2,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            dossier.procedure.stageTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ],
      ),
    );
  }
}

class _MaterialSection extends StatelessWidget {
  const _MaterialSection({
    required this.title,
    required this.icon,
    required this.emptyLabel,
    required this.children,
  });

  final String title;
  final IconData icon;
  final String emptyLabel;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(icon),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            if (children.isEmpty) Text(emptyLabel) else ...children,
          ],
        ),
      ),
    );
  }
}

class _EvidenceItem extends StatelessWidget {
  const _EvidenceItem({
    required this.evidence,
    required this.selected,
    required this.locale,
    required this.onSelected,
  });

  final DossierEvidenceView evidence;
  final bool selected;
  final String locale;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: Card(
        key: ValueKey<String>('greenfire-evidence-${evidence.id}'),
        color: selected
            ? Theme.of(context).colorScheme.surfaceContainerHigh
            : Theme.of(context).colorScheme.surfaceContainer,
        child: InkWell(
          onTap: onSelected,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(evidence.title,
                    style: Theme.of(context).textTheme.titleMedium),
                Text(evidence.kind),
                if (selected && evidence.description != null) ...<Widget>[
                  const SizedBox(height: 10),
                  Text(evidence.description!),
                ],
                if (selected) ...<Widget>[
                  const SizedBox(height: 8),
                  Text(
                    LivingCaseStrings.text(
                      locale,
                      'Selected visible document',
                      'Выбранный видимый документ',
                    ),
                    style: Theme.of(context).textTheme.labelSmall,
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
