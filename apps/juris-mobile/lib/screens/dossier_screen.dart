import 'package:flutter/material.dart';

import '../models/dossier_projection.dart';
import '../widgets/section_card.dart';

/// Full-screen, read-only dossier projected by the authoritative Rust runtime.
///
/// The screen presents only records included in [dossier]. It does not inspect
/// the broader Flutter game snapshot and therefore cannot reconstruct hidden
/// facts, unavailable evidence, future events, or unavailable remedies.
class DossierScreen extends StatelessWidget {
  const DossierScreen({
    required this.dossier,
    required this.locale,
    super.key,
  });

  final DossierProjectionView dossier;
  final String locale;

  bool get _isRussian => locale == 'ru';

  String _text(String english, String russian) =>
      _isRussian ? russian : english;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey<String>('dossier-screen'),
      appBar: AppBar(
        title: Text(_text('Matter dossier', 'Досье дела')),
      ),
      body: SingleChildScrollView(
        key: const PageStorageKey<String>('dossier-scroll'),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        child: Column(
          children: <Widget>[
            _procedureSection(context),
            const SizedBox(height: 12),
            _factsSection(context),
            const SizedBox(height: 12),
            _evidenceSection(context),
            const SizedBox(height: 12),
            _deadlinesSection(context),
          ],
        ),
      ),
    );
  }

  Widget _procedureSection(BuildContext context) {
    final DossierProcedureView procedure = dossier.procedure;
    final ({IconData icon, String label}) matterStatus =
        _matterStatusView(procedure.matterStatus);
    return SectionCard(
      key: const ValueKey<String>('dossier-procedure-section'),
      title: _text('Procedure', 'Процедура'),
      subtitle: _text(
        'Current authoritative procedural position',
        'Текущее авторитетное процессуальное положение',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Semantics(
            label: '${_text('Matter status', 'Статус дела')}: '
                '${matterStatus.label}',
            child: Chip(
              avatar: Icon(matterStatus.icon, size: 18),
              label: Text(matterStatus.label),
            ),
          ),
          const SizedBox(height: 12),
          _labelValue(
            context,
            _text('Stage', 'Стадия'),
            procedure.stageTitle,
            Icons.account_balance_outlined,
          ),
          _labelValue(
            context,
            _text('Lifecycle', 'Жизненный цикл'),
            _lifecycleLabel(procedure.matterLifecycle),
            Icons.route_outlined,
          ),
          _labelValue(
            context,
            _text('Current time', 'Текущее время'),
            _absoluteMoment(procedure.clockMinutes),
            Icons.schedule_outlined,
          ),
          if (dossier.judicialResult != null)
            _labelValue(
              context,
              _text('Judicial result', 'Судебный результат'),
              _judicialResultLabel(dossier.judicialResult!),
              Icons.gavel_outlined,
            ),
          if (dossier.judicialDecisionInstance != null)
            _labelValue(
              context,
              _text('Decision instance', 'Инстанция решения'),
              _decisionInstanceLabel(dossier.judicialDecisionInstance!),
              Icons.apartment_outlined,
            ),
          if (dossier.outcome
              case final DossierOutcomeView outcome) ...<Widget>[
            const Divider(height: 24),
            Text(
              _text('Closure', 'Завершение'),
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 4),
            Text(
              outcome.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(outcome.summary),
          ],
        ],
      ),
    );
  }

  Widget _factsSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('dossier-facts-section'),
      title: _text('Facts', 'Факты'),
      subtitle: _text(
        'Facts currently disclosed by the runtime',
        'Факты, раскрытые движком на текущий момент',
      ),
      child: dossier.facts.isEmpty
          ? _emptyText(
              context,
              _text(
                'No facts are currently disclosed.',
                'В настоящее время факты не раскрыты.',
              ),
            )
          : Column(
              children: dossier.facts
                  .map(
                    (DossierFactView fact) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.fact_check_outlined),
                      title: Text(fact.statement),
                      subtitle: Text(
                        '${_text('Status', 'Статус')}: '
                        '${_factStatusLabel(fact.status)}',
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Widget _evidenceSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('dossier-evidence-section'),
      title: _text('Evidence', 'Доказательства'),
      subtitle: _text(
        'Evidence currently available to the player',
        'Доказательства, доступные игроку на текущий момент',
      ),
      child: dossier.evidence.isEmpty
          ? _emptyText(
              context,
              _text(
                'No evidence is currently available.',
                'В настоящее время доказательства недоступны.',
              ),
            )
          : Column(
              children: dossier.evidence
                  .map(
                    (DossierEvidenceView evidence) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.description_outlined),
                      title: Text(evidence.title),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(_evidenceKindLabel(evidence.kind)),
                          if (evidence.description case final String detail)
                            Text(detail),
                        ],
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Widget _deadlinesSection(BuildContext context) {
    return SectionCard(
      key: const ValueKey<String>('dossier-deadlines-section'),
      title: _text('Deadlines and remedies', 'Сроки и средства защиты'),
      subtitle: _text(
        'Only active authoritative deadlines and currently available remedies',
        'Только активные авторитетные сроки и доступные сейчас средства защиты',
      ),
      child: dossier.deadlines.isEmpty
          ? _emptyText(
              context,
              _text(
                'No active deadlines are currently recorded.',
                'В настоящее время активные сроки не зафиксированы.',
              ),
            )
          : Column(
              children: dossier.deadlines
                  .map(
                    (DossierDeadlineView deadline) => Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(
                              _deadlineStatusIcon(deadline.status),
                            ),
                            title: Text(deadline.title),
                            subtitle: Text(
                              key: ValueKey<String>(
                                'dossier-deadline-status-${deadline.id}',
                              ),
                              '${_deadlineStatusLabel(deadline.status)} · '
                              '${_text('Due', 'Срок')} '
                              '${_absoluteMoment(deadline.dueAtMinutes)}',
                            ),
                          ),
                          if (deadline.remedies.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(left: 40),
                              child: Text(
                                _text(
                                  'No remedy is currently available.',
                                  'В настоящее время средство защиты недоступно.',
                                ),
                              ),
                            )
                          else
                            ...deadline.remedies.map(
                              (DossierRemedyView remedy) => Padding(
                                padding: const EdgeInsets.fromLTRB(40, 4, 0, 4),
                                child: OutlinedButton.icon(
                                  key: ValueKey<String>(
                                    'dossier-remedy-${remedy.actionId}',
                                  ),
                                  onPressed: () => Navigator.of(context).pop(
                                    remedy.actionId,
                                  ),
                                  icon: const Icon(Icons.open_in_new),
                                  label: Align(
                                    alignment: Alignment.centerLeft,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: <Widget>[
                                        Text(remedy.title),
                                        Text(
                                          '${_durationLabel(remedy.timeCostMinutes)} · '
                                          '${_moneyLabel(remedy.costEur)}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
    );
  }

  Widget _labelValue(
    BuildContext context,
    String label,
    String value,
    IconData icon,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(label, style: Theme.of(context).textTheme.labelMedium),
                Text(value),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyText(BuildContext context, String text) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
    );
  }

  ({IconData icon, String label}) _matterStatusView(
    DossierMatterStatus status,
  ) {
    return switch (status) {
      DossierMatterStatus.open => (
          icon: Icons.lock_open_outlined,
          label: _text('Open matter', 'Дело открыто'),
        ),
      DossierMatterStatus.recoverable => (
          icon: Icons.replay_circle_filled_outlined,
          label: _text(
            'Recoverable — remedy available',
            'Можно исправить — средство защиты доступно',
          ),
        ),
      DossierMatterStatus.closed => (
          icon: Icons.lock_outline,
          label: _text('Closed matter', 'Дело закрыто'),
        ),
      DossierMatterStatus.unknown => (
          icon: Icons.help_outline,
          label: _text('Unknown matter status', 'Неизвестный статус дела'),
        ),
    };
  }

  String _lifecycleLabel(DossierLifecycleStatus status) {
    return switch (status) {
      DossierLifecycleStatus.active => _text('Active', 'Активно'),
      DossierLifecycleStatus.postJudgment =>
        _text('Post-judgment', 'После решения'),
      DossierLifecycleStatus.appeal => _text('Appeal', 'Апелляция'),
      DossierLifecycleStatus.cassation => _text('Cassation', 'Кассация'),
      DossierLifecycleStatus.enforcement => _text('Enforcement', 'Исполнение'),
      DossierLifecycleStatus.closed => _text('Closed', 'Закрыто'),
      DossierLifecycleStatus.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  String _judicialResultLabel(DossierJudicialResult result) {
    return switch (result) {
      DossierJudicialResult.won => _text('Won', 'Победа'),
      DossierJudicialResult.lost => _text('Lost', 'Поражение'),
      DossierJudicialResult.partiallyWon =>
        _text('Partially won', 'Частичная победа'),
      DossierJudicialResult.dismissed =>
        _text('Dismissed', 'Требования отклонены'),
      DossierJudicialResult.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  String _decisionInstanceLabel(DossierJudicialDecisionInstance instance) {
    return switch (instance) {
      DossierJudicialDecisionInstance.firstInstance =>
        _text('First instance', 'Первая инстанция'),
      DossierJudicialDecisionInstance.appeal => _text('Appeal', 'Апелляция'),
      DossierJudicialDecisionInstance.cassation =>
        _text('Cassation', 'Кассация'),
      DossierJudicialDecisionInstance.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  String _factStatusLabel(DossierFactStatus status) {
    return switch (status) {
      DossierFactStatus.alleged => _text('Alleged', 'Заявлен'),
      DossierFactStatus.admitted => _text('Admitted', 'Признан'),
      DossierFactStatus.disputed => _text('Disputed', 'Оспаривается'),
      DossierFactStatus.proven => _text('Proven', 'Доказан'),
      DossierFactStatus.inferred => _text('Inferred', 'Предполагается'),
      DossierFactStatus.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  String _deadlineStatusLabel(DossierDeadlineStatus status) {
    return switch (status) {
      DossierDeadlineStatus.open => _text('Open', 'Открыт'),
      DossierDeadlineStatus.completed => _text('Completed', 'Выполнен'),
      DossierDeadlineStatus.missed => _text('Missed', 'Пропущен'),
      DossierDeadlineStatus.unknown => _text('Unknown', 'Неизвестно'),
    };
  }

  IconData _deadlineStatusIcon(DossierDeadlineStatus status) {
    return switch (status) {
      DossierDeadlineStatus.open => Icons.schedule_outlined,
      DossierDeadlineStatus.completed => Icons.check_circle_outline,
      DossierDeadlineStatus.missed => Icons.error_outline,
      DossierDeadlineStatus.unknown => Icons.help_outline,
    };
  }

  String _evidenceKindLabel(String kind) {
    if (!_isRussian) {
      return kind.replaceAll('_', ' ');
    }
    return switch (kind) {
      'document' => 'Документ',
      'email' => 'Электронное письмо',
      'contract' => 'Договор',
      'invoice' => 'Счёт',
      'expert_report' => 'Заключение эксперта',
      'witness_statement' => 'Показания свидетеля',
      'system_record' => 'Системная запись',
      'other' => 'Иной материал',
      _ => kind.replaceAll('_', ' '),
    };
  }

  String _durationLabel(int minutes) {
    if (minutes == 0) {
      return _text('Immediate', 'Сразу');
    }
    final int hours = minutes ~/ 60;
    final int remainder = minutes % 60;
    if (hours == 0) {
      return '$remainder ${_text('min', 'мин')}';
    }
    if (remainder == 0) {
      return '$hours ${_text('h', 'ч')}';
    }
    return '$hours ${_text('h', 'ч')} $remainder ${_text('min', 'мин')}';
  }

  String _moneyLabel(int value) {
    final String digits = value.toString();
    return value == 0 ? _text('No cost', 'Без затрат') : 'EUR $digits';
  }

  String _absoluteMoment(int elapsedMinutes) {
    final int absoluteMinutes = 8 * 60 + elapsedMinutes;
    final int day = absoluteMinutes ~/ 1440 + 1;
    final int minuteOfDay = absoluteMinutes % 1440;
    final String hour = (minuteOfDay ~/ 60).toString().padLeft(2, '0');
    final String minute = (minuteOfDay % 60).toString().padLeft(2, '0');
    return '${_text('Day', 'День')} $day · $hour:$minute';
  }
}
