import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/studio_authoring_repository.dart';
import '../data/studio_draft_store.dart';
import '../models/case_type_playbook.dart';
import '../models/case_type_registry.dart';
import '../models/studio_scenario_draft.dart';
import '../widgets/section_card.dart';
import '../widgets/studio_case_views.dart';

final class StudioWizardScreen extends StatefulWidget {
  const StudioWizardScreen({
    required this.repository,
    required this.store,
    required this.locale,
    required this.onExit,
    super.key,
  });

  final StudioAuthoringRepository repository;
  final StudioDraftStore store;
  final String locale;
  final VoidCallback onExit;

  @override
  State<StudioWizardScreen> createState() => _StudioWizardScreenState();
}

final class _StudioWizardScreenState extends State<StudioWizardScreen> {
  StudioScenarioDraft _draft = StudioScenarioDraft.blank();
  StudioWorkflowStage _activeStage = StudioWorkflowStage.describe;
  final Set<StudioWorkflowStage> _completed = <StudioWorkflowStage>{};
  final List<TextEditingController> _factControllers =
      <TextEditingController>[];
  late final TextEditingController _titleController;
  late final TextEditingController _jurisdictionController;
  late final TextEditingController _roleController;
  late final TextEditingController _premiseController;
  StudioValidationResult? _validation;
  StudioRouteTestResult? _routeResult;
  CaseTypePlaybookRegistry? _playbookRegistry;
  bool _loading = true;
  bool _busy = false;
  String? _notice;
  String? _exportPath;

  bool get _ru => widget.locale == 'ru';
  CaseTypePlaybook get _playbook =>
      _playbookRegistry!.forCaseType(_draft.caseType.id);
  CasePackageEvaluation get _packageEvaluation =>
      evaluateCanonicalCasePackage(_playbook, _draft);

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _jurisdictionController = TextEditingController();
    _roleController = TextEditingController();
    _premiseController = TextEditingController();
    _syncControllers();
    _load();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _jurisdictionController.dispose();
    _roleController.dispose();
    _premiseController.dispose();
    for (final TextEditingController controller in _factControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      _playbookRegistry = await loadCaseTypePlaybookRegistry();
      final StudioWorkspace? workspace = await widget.store.read();
      if (workspace != null && mounted) {
        _draft = workspace.draft;
        _activeStage = workspace.activeStage;
        _completed
          ..clear()
          ..addAll(workspace.completedStages);
        _syncControllers();
      }
    } on Object catch (error) {
      _notice = _t(
        'The previous Studio draft could not be reopened: $error',
        'Не удалось открыть предыдущий черновик Studio: $error',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _syncControllers() {
    _titleController.text = _draft.title;
    _jurisdictionController.text = _draft.jurisdiction;
    _roleController.text = _draft.role;
    _premiseController.text = _draft.premise;
    for (final TextEditingController controller in _factControllers) {
      controller.dispose();
    }
    _factControllers
      ..clear()
      ..addAll(
        _draft.facts.map(
          (String fact) => TextEditingController(text: fact),
        ),
      );
    if (_factControllers.isEmpty) {
      _factControllers.add(TextEditingController());
    }
  }

  String _t(String en, String ru) => _ru ? ru : en;

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_playbookRegistry == null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _notice ?? _t('Case packages could not be loaded.', 'Не удалось загрузить пакеты кейсов.'),
            ),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          key: const ValueKey<String>('studio-exit-action'),
          tooltip: _t('Back to case library', 'Назад к библиотеке кейсов'),
          onPressed: _busy ? null : widget.onExit,
          icon: const Icon(Icons.arrow_back),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(_t('Guided Studio', 'Мастер Studio')),
            Text(
              _draft.title.trim().isEmpty
                  ? _t('New case', 'Новый кейс')
                  : _draft.title,
              style: Theme.of(context).textTheme.labelSmall,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: <Widget>[
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                _busy ? _t('Working…', 'Выполняется…') : _t('Auto-saved', 'Автосохранение'),
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1040),
            child: Column(
              children: <Widget>[
                _ProgressHeader(
                  activeStage: _activeStage,
                  completed: _completed,
                  locale: widget.locale,
                  onSelected: _openStage,
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        _StageIntro(
                          number: _activeStage.index + 1,
                          title: _stageTitle(_activeStage),
                          description: _stageDescription(_activeStage),
                        ),
                        const SizedBox(height: 16),
                        _buildStage(),
                        if (_notice != null) ...<Widget>[
                          const SizedBox(height: 16),
                          Semantics(
                            liveRegion: true,
                            child: Card(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHigh,
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text(_notice!),
                              ),
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
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: _WizardNavigation(
          activeStage: _activeStage,
          canContinue: _canContinue,
          busy: _busy,
          locale: widget.locale,
          onBack: _activeStage.index == 0 ? null : _previous,
          onContinue: _activeStage == StudioWorkflowStage.reportSave
              ? null
              : _continue,
        ),
      ),
    );
  }

  Widget _buildStage() {
    return switch (_activeStage) {
      StudioWorkflowStage.describe => _buildDescribe(),
      StudioWorkflowStage.reviewAiDraft => _buildReview(),
      StudioWorkflowStage.factsAssumptions => _buildFacts(),
      StudioWorkflowStage.caseMap => _buildMap(),
      StudioWorkflowStage.runCompare => _buildTest(),
      StudioWorkflowStage.reportSave => _buildFinish(),
    };
  }

  Widget _buildDescribe() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            _StartChoice(
              key: const ValueKey<String>('studio-guided-example'),
              icon: Icons.auto_awesome_outlined,
              title: _t('Use a guided example', 'Открыть учебный пример'),
              subtitle: _t(
                'Start with a complete, editable legal route.',
                'Начните с готового редактируемого маршрута.',
              ),
              onTap: _applyExample,
            ),
            _StartChoice(
              key: const ValueKey<String>('studio-own-case'),
              icon: Icons.edit_note,
              title: _t('Describe my own case', 'Описать свой кейс'),
              subtitle: _t(
                'Use four plain-language fields; no schema knowledge needed.',
                'Заполните четыре простых поля без знания схемы.',
              ),
              onTap: _startBlank,
            ),
            _StartChoice(
              key: const ValueKey<String>('studio-import-scenario'),
              icon: Icons.content_paste_go_outlined,
              title: _t('Import canonical JSON', 'Импортировать canonical JSON'),
              subtitle: _t(
                'Paste a ScenarioDefinition v1 from web or mobile.',
                'Вставьте ScenarioDefinition v1 из web или mobile.',
              ),
              onTap: _importFromClipboard,
            ),
          ],
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: _t('Case type', 'Тип кейса'),
          subtitle: _t(
            'Choose the versioned package that defines the workflow and result.',
            'Выберите версионируемый пакет, определяющий процесс и результат.',
          ),
          child: Builder(
            builder: (BuildContext context) {
              final CaseTypeDefinition selected =
                  caseTypeDefinition(_draft.caseType.id);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  DropdownButtonFormField<CaseTypeId>(
                    key: ValueKey<String>(
                      'studio-case-type-${_draft.caseType.id.wireName}',
                    ),
                    initialValue: _draft.caseType.id,
                    decoration: InputDecoration(
                      labelText: _t('Professional matter', 'Профессиональная задача'),
                    ),
                    items: caseTypeRegistry
                        .map(
                          (CaseTypeDefinition item) =>
                              DropdownMenuItem<CaseTypeId>(
                            value: item.id,
                            child: Text(_ru ? item.labelRu : item.labelEn),
                          ),
                        )
                        .toList(growable: false),
                    onChanged: _busy
                        ? null
                        : (CaseTypeId? value) {
                            if (value == null || value == _draft.caseType.id) {
                              return;
                            }
                            _replaceDraft(
                              _draft.updateCaseType(value),
                              StudioWorkflowStage.describe,
                            );
                          },
                  ),
                  const SizedBox(height: 12),
                  Text(_ru ? selected.summaryRu : selected.summaryEn),
                  const SizedBox(height: 6),
                  Text(
                    '${_t('Result', 'Результат')}: '
                    '${_ru ? selected.outcomeRu : selected.outcomeEn} · '
                    '${selected.workflowMode} · v$caseTypeVersion',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 8),
                  Text(
                    _t('Package intake', 'Вопросы пакета'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  for (final (int index, CaseIntakeQuestion question)
                      in _playbook.intakeQuestions.indexed)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        radius: 14,
                        child: Text('${index + 1}'),
                      ),
                      title: Text(question.label.forLocale(widget.locale)),
                      subtitle: Text(question.hint.forLocale(widget.locale)),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    '${_t('AI focus', 'Фокус AI')}: '
                    '${_playbook.aiFocus.forLocale(widget.locale)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: _t('Case brief', 'Описание кейса'),
          subtitle: _t(
            'These details anchor every later step.',
            'Эти данные используются на всех следующих шагах.',
          ),
          child: Column(
            children: <Widget>[
              TextField(
                key: const ValueKey<String>('studio-title-field'),
                controller: _titleController,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: _t('Case title', 'Название кейса'),
                ),
                onChanged: (_) => _identityChanged(),
              ),
              const SizedBox(height: 12),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _jurisdictionController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(
                        labelText: _t('Jurisdiction', 'Юрисдикция'),
                        hintText: 'BE',
                      ),
                      onChanged: (_) => _identityChanged(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _roleController,
                      decoration: InputDecoration(
                        labelText: _t('Your role', 'Ваша роль'),
                      ),
                      onChanged: (_) => _identityChanged(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                key: const ValueKey<String>('studio-premise-field'),
                controller: _premiseController,
                minLines: 3,
                maxLines: 6,
                decoration: InputDecoration(
                  labelText: _t('What is happening?', 'Что происходит?'),
                  hintText: _t(
                    'Describe the client, problem, urgency, and desired result.',
                    'Опишите клиента, проблему, срочность и желаемый результат.',
                  ),
                ),
                onChanged: (_) => _identityChanged(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReview() {
    return SectionCard(
      title: _t('Review the draft proposal', 'Проверьте проект'),
      subtitle: _t(
        'Mobile uses a safe starter proposal. Any connected AI revision must '
            'still pass the same Rust gate before it is applied.',
        'Mobile использует безопасный стартовый проект. Любое AI-изменение '
            'также должно пройти ту же проверку Rust.',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _ReviewRow(label: _t('Matter', 'Дело'), value: _draft.title),
          _ReviewRow(
            label: _t('Case type', 'Тип кейса'),
            value: _ru
                ? caseTypeDefinition(_draft.caseType.id).labelRu
                : caseTypeDefinition(_draft.caseType.id).labelEn,
          ),
          _ReviewRow(label: _t('Role', 'Роль'), value: _draft.role),
          _ReviewRow(
            label: _t('Jurisdiction', 'Юрисдикция'),
            value: _draft.jurisdiction,
          ),
          _ReviewRow(label: _t('Premise', 'Суть'), value: _draft.premise),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              const Icon(Icons.verified_user_outlined, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _t(
                    'Proposal is editable and not authoritative until Step 5.',
                    'Проект можно редактировать; он станет подтверждённым '
                        'только после шага 5.',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFacts() {
    final CanonicalCaseRequirements requirements =
        _playbook.canonicalRequirements;
    return SectionCard(
      title: _t('Known facts and assumptions', 'Факты и предположения'),
      subtitle: _t(
        'Add one statement per line. Rust keeps stable fact IDs in the canonical document.',
        'Добавляйте по одному утверждению. Rust проверит стабильные ID фактов.',
      ),
      child: Column(
        children: <Widget>[
          if (requirements.requireLegalAsOfFact ||
              requirements.requireHttpsSourceFact ||
              requirements.requireComplianceFact) ...<Widget>[
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                _t(
                  'For this package, include a YYYY-MM-DD legal as-of date, an authoritative https:// source and the applicable compliance or reporting duty in the fact record.',
                  'Для этого пакета укажите в фактах дату актуальности права YYYY-MM-DD, официальный источник https:// и применимую обязанность compliance или отчётности.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: 16),
          ],
          for (final (int index, TextEditingController controller)
              in _factControllers.indexed) ...<Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: TextField(
                    key: ValueKey<String>('studio-fact-$index'),
                    controller: controller,
                    minLines: 1,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: '${_t('Fact', 'Факт')} ${index + 1}',
                    ),
                    onChanged: (_) => _factsChanged(),
                  ),
                ),
                if (_factControllers.length > 1)
                  IconButton(
                    tooltip: _t('Remove fact', 'Удалить факт'),
                    onPressed: () => _removeFact(index),
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              key: const ValueKey<String>('studio-add-fact'),
              onPressed: _addFact,
              icon: const Icon(Icons.add),
              label: Text(_t('Add fact', 'Добавить факт')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMap() {
    return Column(
      children: <Widget>[
        StudioCaseViews(
          key: ValueKey<String>(
            'studio-case-views-${_draft.caseType.id.wireName}',
          ),
          draft: _draft,
          locale: widget.locale,
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: _t('Stages', 'Этапы дела'),
          subtitle: _t(
            'Edit human-facing labels; stable IDs and transitions stay visible.',
            'Редактируйте названия; стабильные ID и переходы остаются видимыми.',
          ),
          child: Column(
            children: <Widget>[
              for (final (int index, Map<String, dynamic> stage)
                  in _draft.stages.indexed) ...<Widget>[
                TextFormField(
                  key: ValueKey<String>('studio-stage-${stage['id']}'),
                  initialValue: stage['title'] as String? ?? '',
                  decoration: InputDecoration(
                    labelText: stage['id'] as String? ?? 'stage',
                    suffixIcon: stage['terminal'] == true
                        ? const Icon(Icons.flag_outlined)
                        : null,
                  ),
                  onChanged: (String value) {
                    _replaceDraft(_draft.updateStageTitle(index, value),
                        StudioWorkflowStage.caseMap);
                  },
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: _playbook.test.requiresPlayableRoute
              ? _t('Decision route', 'Маршрут решений')
              : _t('Action and review plan', 'План действий и проверки'),
          subtitle: _playbook.test.requiresPlayableRoute
              ? _t(
                  'Each action is executed by the authoritative Rust runtime in Step 5.',
                  'Каждое действие будет выполнено авторитетным Rust runtime на шаге 5.',
                )
              : _t(
                  'These canonical actions organize professional review; Step 5 validates them without pretending the matter is a game.',
                  'Эти canonical-действия организуют профессиональную проверку; шаг 5 проверяет их без имитации игры.',
                ),
          child: Column(
            children: <Widget>[
              for (final (int index, Map<String, dynamic> action)
                  in _draft.actions.indexed) ...<Widget>[
                TextFormField(
                  key: ValueKey<String>('studio-action-${action['id']}'),
                  initialValue: action['title'] as String? ?? '',
                  decoration: InputDecoration(
                    labelText: action['id'] as String? ?? 'action',
                    prefixIcon: const Icon(Icons.route_outlined),
                  ),
                  onChanged: (String value) {
                    _replaceDraft(_draft.updateActionTitle(index, value),
                        StudioWorkflowStage.caseMap);
                  },
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTest() {
    final StudioValidationResult? validation = _validation;
    final CaseTypePlaybook playbook = _playbook;
    final CasePackageEvaluation evaluation = _packageEvaluation;
    final bool routeRequired = playbook.test.requiresPlayableRoute;
    final bool passed = validation?.valid == true &&
        evaluation.complete &&
        (!routeRequired || _routeResult != null);
    return SectionCard(
      title: playbook.test.label.forLocale(widget.locale),
      subtitle: routeRequired
          ? _t(
              'Rust validates the canonical schema and executes the authored route. Flutter cannot approve its own draft.',
              'Rust проверяет canonical schema и выполняет созданный маршрут. Flutter не подтверждает свой черновик.',
            )
          : _t(
              'Rust validates the canonical schema; the package then checks matter-specific completeness without inventing a playable route.',
              'Rust проверяет canonical schema, затем пакет проверяет полноту кейса без искусственного игрового маршрута.',
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          FilledButton.icon(
            key: const ValueKey<String>('studio-rust-gate'),
            onPressed: _busy ? null : _validateAndRun,
            icon: Icon(routeRequired
                ? Icons.play_circle_outline
                : Icons.fact_check_outlined),
            label: Text(routeRequired
                ? _t('Validate and play in Rust', 'Проверить и запустить в Rust')
                : _t('Validate package through Rust', 'Проверить пакет через Rust')),
          ),
          if (validation != null) ...<Widget>[
            const SizedBox(height: 16),
            _GateStatus(
              passed: passed,
              title: passed
                  ? _t('Package ready', 'Пакет готов')
                  : _t('Changes required', 'Нужны изменения'),
              detail: !validation.valid
                  ? _t(
                      '${validation.diagnostics.length} Rust diagnostic(s)',
                      'Диагностик Rust: ${validation.diagnostics.length}',
                    )
                  : !evaluation.complete
                      ? _t(
                          'Missing package evidence: ${evaluation.missing.join(', ')}',
                          'Не хватает данных пакета: ${evaluation.missing.join(', ')}',
                        )
                      : routeRequired
                          ? _t(
                      '${_routeResult!.executedActionIds.length} actions → ${_routeResult!.outcomeId}',
                      '${_routeResult!.executedActionIds.length} действий → ${_routeResult!.outcomeId}',
                            )
                          : _t(
                              'Rust schema valid · ${playbook.test.mode} checks passed',
                              'Rust schema корректна · проверка ${playbook.test.mode} пройдена',
                            ),
            ),
            for (final StudioDiagnostic diagnostic in validation.diagnostics)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.error_outline),
                title: Text('${diagnostic.code} · ${diagnostic.path}'),
                subtitle: Text(diagnostic.message),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildFinish() {
    final CaseTypePlaybook playbook = _playbook;
    return Column(
      children: <Widget>[
        _GateStatus(
          passed: _canFinish,
          title: _t('Ready to save', 'Готово к сохранению'),
          detail: playbook.test.requiresPlayableRoute
              ? _t(
                  'Canonical schema and executable route passed Rust.',
                  'Canonical schema и исполняемый маршрут прошли Rust.',
                )
              : _t(
                  'Canonical schema passed Rust and package completeness checks passed.',
                  'Canonical schema прошла Rust и проверки полноты пакета.',
                ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: _t('Package outputs', 'Результаты пакета'),
          subtitle: _t(
            'The primary result is selected automatically; supporting outputs remain reusable.',
            'Основной результат выбран автоматически; дополнительные результаты остаются повторно используемыми.',
          ),
          child: Column(
            children: <Widget>[
              for (final CaseOutputProfile output in playbook.outputs)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(output.primary
                      ? Icons.description_outlined
                      : Icons.article_outlined),
                  title: Text(output.label.forLocale(widget.locale)),
                  subtitle: Text(output.description.forLocale(widget.locale)),
                  trailing: output.primary
                      ? Chip(label: Text(_t('Primary', 'Основной')))
                      : null,
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: _t('Finish', 'Завершение'),
          subtitle: _t(
            'Save progress and export the exact ScenarioDefinition validated above.',
            'Сохраните прогресс и экспортируйте проверенный ScenarioDefinition.',
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              FilledButton.icon(
                key: const ValueKey<String>('studio-save-export'),
                onPressed: _busy || !_canFinish ? null : _saveAndExport,
                icon: const Icon(Icons.save_alt_outlined),
                label: Text(_t('Save and export JSON', 'Сохранить и экспортировать JSON')),
              ),
              if (_exportPath != null) ...<Widget>[
                const SizedBox(height: 12),
                SelectableText(
                  _t('Saved to $_exportPath', 'Сохранено: $_exportPath'),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  bool get _canFinish => _validation?.valid == true &&
      _packageEvaluation.complete &&
      (!_playbook.test.requiresPlayableRoute || _routeResult != null);

  bool get _canContinue => switch (_activeStage) {
        StudioWorkflowStage.describe => _draft.identityReady,
        StudioWorkflowStage.reviewAiDraft => true,
        StudioWorkflowStage.factsAssumptions => _draft.factsReady,
        StudioWorkflowStage.caseMap => _draft.mapReady,
        StudioWorkflowStage.runCompare => _canFinish,
        StudioWorkflowStage.reportSave => _canFinish,
      };

  void _identityChanged() {
    _replaceDraft(
      _draft.updateIdentity(
        title: _titleController.text,
        jurisdiction: _jurisdictionController.text,
        role: _roleController.text,
        premise: _premiseController.text,
      ),
      StudioWorkflowStage.describe,
    );
  }

  void _factsChanged() {
    _replaceDraft(
      _draft.updateFacts(
        _factControllers
            .map((TextEditingController controller) => controller.text)
            .toList(growable: false),
      ),
      StudioWorkflowStage.factsAssumptions,
    );
  }

  void _replaceDraft(StudioScenarioDraft next, StudioWorkflowStage changedAt) {
    setState(() {
      _draft = next;
      _invalidateFrom(changedAt);
      _notice = null;
    });
    _persist();
  }

  void _invalidateFrom(StudioWorkflowStage stage) {
    _completed.removeWhere(
      (StudioWorkflowStage item) => item.index >= stage.index,
    );
    if (stage.index <= StudioWorkflowStage.runCompare.index) {
      _validation = null;
      _routeResult = null;
      _exportPath = null;
    }
  }

  void _applyExample() {
    setState(() {
      _draft = StudioScenarioDraft.guidedExample();
      _completed.clear();
      _activeStage = StudioWorkflowStage.describe;
      _validation = null;
      _routeResult = null;
      _notice = _t(
        'Guided example loaded. Every field remains editable.',
        'Учебный пример загружен. Все поля можно изменить.',
      );
      _syncControllers();
    });
    _persist();
  }

  void _startBlank() {
    setState(() {
      _draft = StudioScenarioDraft.blank();
      _completed.clear();
      _activeStage = StudioWorkflowStage.describe;
      _validation = null;
      _routeResult = null;
      _notice = null;
      _syncControllers();
    });
    _persist();
  }

  Future<void> _importFromClipboard() async {
    try {
      final ClipboardData? data = await Clipboard.getData(Clipboard.kTextPlain);
      final dynamic decoded = jsonDecode(data?.text ?? '');
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Clipboard JSON must be an object.');
      }
      final StudioScenarioDraft imported = StudioScenarioDraft.fromJson(decoded);
      if (!mounted) return;
      setState(() {
        _draft = imported;
        _completed.clear();
        _validation = null;
        _routeResult = null;
        _notice = _t(
          'Canonical scenario imported. Rust validation is still required.',
          'Canonical scenario импортирован. Проверка Rust всё ещё обязательна.',
        );
        _syncControllers();
      });
      await _persist();
    } on Object catch (error) {
      if (mounted) {
        setState(() => _notice = _t(
              'Import failed: $error',
              'Ошибка импорта: $error',
            ));
      }
    }
  }

  void _addFact() {
    setState(() => _factControllers.add(TextEditingController()));
  }

  void _removeFact(int index) {
    setState(() {
      _factControllers.removeAt(index).dispose();
    });
    _factsChanged();
  }

  void _openStage(StudioWorkflowStage stage) {
    final int furthest = _completed.isEmpty
        ? 0
        : _completed
                .map((StudioWorkflowStage item) => item.index)
                .reduce((int left, int right) => left > right ? left : right) +
            1;
    if (stage.index > furthest.clamp(0, 5)) {
      return;
    }
    setState(() => _activeStage = stage);
    _persist();
  }

  void _previous() {
    _openStage(StudioWorkflowStage.values[_activeStage.index - 1]);
  }

  void _continue() {
    if (!_canContinue || _busy) return;
    setState(() {
      _completed.add(_activeStage);
      _activeStage = StudioWorkflowStage.values[_activeStage.index + 1];
      _notice = null;
    });
    _persist();
  }

  Future<void> _validateAndRun() async {
    setState(() {
      _busy = true;
      _notice = null;
      _validation = null;
      _routeResult = null;
    });
    try {
      final StudioValidationResult validation = widget.repository.validate(_draft);
      final CasePackageEvaluation evaluation = _packageEvaluation;
      final bool routeRequired = _playbook.test.requiresPlayableRoute;
      StudioRouteTestResult? route;
      if (validation.valid && evaluation.complete && routeRequired) {
        route = widget.repository.runFirstAvailableRoute(_draft);
      }
      if (!mounted) return;
      setState(() {
        _validation = validation;
        _routeResult = route;
        if (validation.valid &&
            evaluation.complete &&
            (!routeRequired || route != null)) {
          _completed.add(StudioWorkflowStage.runCompare);
          _notice = _t(
            routeRequired
                ? 'Rust validation and route execution passed. Finish is unlocked.'
                : 'Rust validation and package checks passed. Finish is unlocked.',
            routeRequired
                ? 'Проверка Rust и маршрут пройдены. Завершение разблокировано.'
                : 'Проверка Rust и пакета пройдена. Завершение разблокировано.',
          );
        } else if (validation.valid && !evaluation.complete) {
          _notice = _t(
            'Add the missing package evidence before Finish: ${evaluation.missing.join(', ')}.',
            'Добавьте недостающие данные пакета: ${evaluation.missing.join(', ')}.',
          );
        }
      });
      await _persist();
    } on Object catch (error) {
      if (mounted) {
        setState(() => _notice = _t(
              'Rust gate failed: $error',
              'Проверка Rust не пройдена: $error',
            ));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _saveAndExport() async {
    if (!_canFinish) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      _completed.add(StudioWorkflowStage.reportSave);
      await _persist();
      final String path = await widget.store.exportScenario(_draft);
      if (!mounted) return;
      setState(() {
        _exportPath = path;
        _notice = _t(
          'Saved. The exported file is the exact Rust-validated scenario.',
          'Сохранено. Экспортированный файл — точный сценарий, проверенный Rust.',
        );
      });
    } on Object catch (error) {
      if (mounted) {
        setState(() => _notice = _t(
              'Save failed: $error',
              'Ошибка сохранения: $error',
            ));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _persist() async {
    try {
      await widget.store.write(
        StudioWorkspace(
          draft: _draft,
          activeStage: _activeStage,
          completedStages: Set<StudioWorkflowStage>.of(_completed),
        ),
      );
    } on Object catch (error) {
      if (mounted) {
        setState(() => _notice = _t(
              'Auto-save failed: $error',
              'Ошибка автосохранения: $error',
            ));
      }
    }
  }

  String _stageTitle(StudioWorkflowStage stage) {
    return switch (stage) {
      StudioWorkflowStage.describe => _t('Describe', 'Описание'),
      StudioWorkflowStage.reviewAiDraft =>
        _t('Review AI draft', 'Проверка AI-проекта'),
      StudioWorkflowStage.factsAssumptions => _t('Facts', 'Факты'),
      StudioWorkflowStage.caseMap => _t('Views & map', 'Виды и карта'),
      StudioWorkflowStage.runCompare => _t('Test', 'Тест'),
      StudioWorkflowStage.reportSave => _t('Finish', 'Завершение'),
    };
  }

  String _stageDescription(StudioWorkflowStage stage) {
    return switch (stage) {
      StudioWorkflowStage.describe => _t(
          'Choose the professional matter package and describe the result you need.',
          'Выберите пакет профессиональной задачи и опишите требуемый результат.',
        ),
      StudioWorkflowStage.reviewAiDraft => _t(
          'Review the safe proposal before adding detail.',
          'Проверьте безопасный проект перед детализацией.',
        ),
      StudioWorkflowStage.factsAssumptions => _t(
          'Capture the facts that drive professional judgment.',
          'Зафиксируйте факты, определяющие профессиональное решение.',
        ),
      StudioWorkflowStage.caseMap => _t(
          'Review the matter through package-defined views, then refine its actions.',
          'Проверьте задачу в представлениях пакета, затем уточните действия.',
        ),
      StudioWorkflowStage.runCompare => _t(
          _playbook.test.requiresPlayableRoute
              ? 'Let Rust validate and execute the authored route.'
              : 'Let Rust validate the canonical draft and run package-specific checks.',
          _playbook.test.requiresPlayableRoute
              ? 'Пусть Rust проверит и выполнит созданный маршрут.'
              : 'Пусть Rust проверит canonical draft и правила выбранного пакета.',
        ),
      StudioWorkflowStage.reportSave => _t(
          'Save a canonical artifact that both platforms understand.',
          'Сохраните canonical artifact, понятный обеим платформам.',
        ),
    };
  }
}

final class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.activeStage,
    required this.completed,
    required this.locale,
    required this.onSelected,
  });

  final StudioWorkflowStage activeStage;
  final Set<StudioWorkflowStage> completed;
  final String locale;
  final ValueChanged<StudioWorkflowStage> onSelected;

  @override
  Widget build(BuildContext context) {
    final bool ru = locale == 'ru';
    final List<String> labels = ru
        ? const <String>['Описание', 'AI-проект', 'Факты', 'Виды', 'Тест', 'Готово']
        : const <String>['Describe', 'AI draft', 'Facts', 'Views', 'Test', 'Finish'];
    final int furthest = completed.isEmpty
        ? 0
        : completed.map((StudioWorkflowStage item) => item.index).fold<int>(
                  0,
                  (int prior, int next) => next > prior ? next : prior,
                ) +
            1;
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: <Widget>[
            for (final StudioWorkflowStage stage in StudioWorkflowStage.values)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ActionChip(
                  key: ValueKey<String>('studio-step-${stage.index + 1}'),
                  avatar: CircleAvatar(
                    child: completed.contains(stage)
                        ? const Icon(Icons.check, size: 16)
                        : Text('${stage.index + 1}'),
                  ),
                  label: Text(labels[stage.index]),
                  backgroundColor: stage == activeStage
                      ? Theme.of(context).colorScheme.primaryContainer
                      : null,
                  onPressed: stage.index <= furthest.clamp(0, 5)
                      ? () => onSelected(stage)
                      : null,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

final class _StageIntro extends StatelessWidget {
  const _StageIntro({
    required this.number,
    required this.title,
    required this.description,
  });

  final int number;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          CircleAvatar(child: Text('$number')),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _StartChoice extends StatelessWidget {
  const _StartChoice({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 300,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(icon, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 12),
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                Text(subtitle),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

final class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 3),
          Text(value),
        ],
      ),
    );
  }
}

final class _GateStatus extends StatelessWidget {
  const _GateStatus({
    required this.passed,
    required this.title,
    required this.detail,
  });

  final bool passed;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: <Widget>[
            Icon(
              passed ? Icons.verified_outlined : Icons.pending_outlined,
              color: passed
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 3),
                  Text(detail),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _WizardNavigation extends StatelessWidget {
  const _WizardNavigation({
    required this.activeStage,
    required this.canContinue,
    required this.busy,
    required this.locale,
    required this.onBack,
    required this.onContinue,
  });

  final StudioWorkflowStage activeStage;
  final bool canContinue;
  final bool busy;
  final String locale;
  final VoidCallback? onBack;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) {
    final bool ru = locale == 'ru';
    return Material(
      elevation: 8,
      color: Theme.of(context).colorScheme.surfaceContainer,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: <Widget>[
            if (onBack != null)
              OutlinedButton.icon(
                onPressed: busy ? null : onBack,
                icon: const Icon(Icons.arrow_back),
                label: Text(ru ? 'Назад' : 'Back'),
              ),
            const Spacer(),
            Text('${activeStage.index + 1} / 6'),
            const SizedBox(width: 16),
            if (onContinue != null)
              FilledButton.icon(
                key: const ValueKey<String>('studio-continue'),
                onPressed: canContinue && !busy ? onContinue : null,
                iconAlignment: IconAlignment.end,
                icon: const Icon(Icons.arrow_forward),
                label: Text(ru ? 'Продолжить' : 'Continue'),
              ),
          ],
        ),
      ),
    );
  }
}
