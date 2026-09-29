import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/tax_artifact_store.dart';
import '../data/tax_authoring_repository.dart';

final class TaxEditorScreen extends StatefulWidget {
  const TaxEditorScreen(
      {required this.scenario,
      required this.repository,
      required this.locale,
      this.store,
      super.key});
  final Map<String, dynamic> scenario;
  final TaxAuthoringRepository repository;
  final String locale;
  final TaxArtifactStore? store;
  @override
  State<TaxEditorScreen> createState() => _TaxEditorScreenState();
}

final class _TaxEditorScreenState extends State<TaxEditorScreen> {
  late final TaxArtifactStore _store = widget.store ?? TaxArtifactStore();
  Map<String, dynamic>? _artifact;
  Map<String, dynamic>? _prepared;
  String? _notice;
  bool _loading = true,
      _busy = false,
      _supported = false,
      _dirty = false,
      _validated = false;
  int _generation = 0;
  final GlobalKey _feedbackKey = GlobalKey();
  void _showFeedback() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final BuildContext? target = _feedbackKey.currentContext;
      if (mounted && target != null)
        Scrollable.ensureVisible(target,
            alignment: 1, duration: const Duration(milliseconds: 200));
    });
  }

  String get _caseId =>
      (widget.scenario['metadata'] as Map<String, dynamic>)['id'] as String;
  String _t(String en, String ru) => widget.locale == 'ru' ? ru : en;
  Map<String, dynamic> get _input =>
      (_artifact!['request'] as Map<String, dynamic>)['input']
          as Map<String, dynamic>;
  Map<String, dynamic> get _edit => _artifact!['edit'] as Map<String, dynamic>;
  List<dynamic> get _bindings => _artifact!['bindings'] as List<dynamic>;
  List<dynamic> get _benefits => _artifact!['benefits'] as List<dynamic>;
  bool get _known => _artifact != null && validTaxArtifact(_artifact!);
  bool get _currencyCanChange =>
      _artifact!['legacy'] == null &&
      _bindings.isEmpty &&
      _benefits.isEmpty &&
      _money.every((String field) => ['', '0.00'].contains(_edit[field])) &&
      (_input['override_reason'] == null || _input['override_reason'] == '') &&
      _artifact!['artifact_revision'] == '0';
  bool get _stale =>
      _known &&
      _prepared != null &&
      ((_artifact!['request'] as Map<String, dynamic>)['context']
              as Map<String, dynamic>)['scenario_fingerprint'] !=
          ((_prepared!['request'] as Map<String, dynamic>)['context']
              as Map<String, dynamic>)['scenario_fingerprint'];
  static const List<String> _money = [
    'baseline_annual_tax_cost',
    'optimized_annual_tax_cost',
    'implementation_cost',
    'annual_maintenance_cost',
    'terminal_tax_or_unwind_cost',
    'annual_tax_base_override'
  ];
  static const List<String> _numbers = [
    'baseline_tax_rate_bps',
    'optimized_tax_rate_bps',
    'analysis_horizon_months',
    'annual_discount_rate_bps',
    'benefit_realization_bps'
  ];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Map<String, dynamic> _copy(Map<String, dynamic> value) =>
      jsonDecode(jsonEncode(value)) as Map<String, dynamic>;
  Map<String, dynamic> _edits(Map<String, dynamic> input) => {
        for (final String field in _money)
          field: input[field] == null ? '' : taxAmount(input[field] as String),
        for (final String field in _numbers) field: '${input[field]}',
      };
  Future<void> _load() async {
    try {
      _artifact = await _store.read(_caseId);
      _supported = widget.repository.isSupported();
      if (_supported) {
        _prepared = widget.repository
            .prepare(widget.scenario, 'tax_$_caseId', '0', 'EUR');
        if (_artifact == null) {
          final Map<String, dynamic> request =
              _prepared!['request'] as Map<String, dynamic>;
          _artifact = {
            'schema': 'tax-authoring-artifact-v1',
            'case_id': _caseId,
            'scenario': widget.scenario,
            'artifact_revision': '0',
            'request': request,
            'edit': _edits(request['input'] as Map<String, dynamic>),
            'bindings': <dynamic>[],
            'benefits': <dynamic>[],
            'required_component_ids': <dynamic>[],
            'legacy': null,
            'calculation': null,
            'binding_draft': null
          };
        }
      }
    } on Object catch (error) {
      _notice = error.toString();
    }
    if (!mounted) return;
    if (_known && _supported && !_stale && _artifact!['calculation'] != null)
      _calculate(reopening: true);
    if (mounted) setState(() => _loading = false);
  }

  void _changed(VoidCallback change) {
    if (_busy) return;
    setState(() {
      _validated = false;
      change();
      _artifact!['calculation'] = null;
      _artifact!['binding_draft'] = null;
      _dirty = true;
      _notice = null;
    });
  }

  String _label(String key) => switch (key) {
        'baseline_annual_tax_cost' =>
          _t('Current annual tax', 'Текущий годовой налог'),
        'optimized_annual_tax_cost' =>
          _t('Proposed annual tax', 'Предлагаемый годовой налог'),
        'implementation_cost' =>
          _t('Implementation cost', 'Стоимость внедрения'),
        'annual_maintenance_cost' =>
          _t('Annual maintenance', 'Годовое сопровождение'),
        'terminal_tax_or_unwind_cost' =>
          _t('Cost at the end of the horizon', 'Расход в конце периода'),
        'annual_tax_base_override' =>
          _t('Manual annual tax base', 'Налоговая база вручную'),
        'baseline_tax_rate_bps' =>
          _t('Current rate (basis points)', 'Текущая ставка (базисные пункты)'),
        'optimized_tax_rate_bps' => _t('Proposed rate (basis points)',
            'Предлагаемая ставка (базисные пункты)'),
        'analysis_horizon_months' =>
          _t('Horizon in months', 'Период в месяцах'),
        'annual_discount_rate_bps' => _t('Annual discount (basis points)',
            'Годовой дисконт (базисные пункты)'),
        'benefit_realization_bps' => _t('Savings realization (basis points)',
            'Реализация экономии (базисные пункты)'),
        'override_reason' =>
          _t('Reason for manual base', 'Причина ручной базы'),
        'override_owner' => _t('Confirmed by', 'Кем подтверждено'),
        'override_as_of' => _t('As of (YYYY-MM-DD)', 'Дата (ГГГГ-ММ-ДД)'),
        'assumptions' => _t('Assumptions', 'Допущения'),
        _ => key,
      };
  Widget _field(String id, String label, String value,
          ValueChanged<String> onChanged) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextFormField(
            key: ValueKey<String>('tax-$_generation-$id'),
            initialValue: value,
            enabled: !_busy,
            decoration: InputDecoration(
                labelText: label, border: const OutlineInputBorder()),
            onChanged: (String value) => _changed(() => onChanged(value)),
          ));
  String _optionLabel(String value) => switch (value) {
        'amounts' =>
          _t('Enter annual tax amounts', 'Ввести годовые суммы налога'),
        'rates' =>
          _t('Calculate from base and rates', 'Расчёт по базе и ставкам'),
        'derived' => _t('Confirmed components', 'Подтверждённые компоненты'),
        'manual_override' =>
          _t('Documented manual base', 'Обоснованная ручная база'),
        'recurring_annual' =>
          _t('Recurring annual benefit', 'Ежегодная выгода'),
        'one_off' => _t('One-off benefit', 'Разовая выгода'),
        'taxable_income' => _t('Taxable income', 'Налогооблагаемый доход'),
        'deductible_expense' => _t('Deductible expense', 'Вычитаемый расход'),
        'non_deductible_addback' =>
          _t('Non-deductible addback', 'Невычитаемый расход'),
        'exempt_income' => _t('Exempt income', 'Освобождённый доход'),
        'tax_loss_utilized' =>
          _t('Tax loss utilized', 'Использованный налоговый убыток'),
        'taxable_adjustment' =>
          _t('Taxable adjustment', 'Налогооблагаемая корректировка'),
        'deductible_adjustment' =>
          _t('Deductible adjustment', 'Вычитаемая корректировка'),
        _ => value,
      };
  Widget _choice(String label, String value, List<String> choices,
          ValueChanged<String> changed) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: DropdownButtonFormField<String>(
            key: ValueKey<String>('tax-$_generation-$label-$value'),
            initialValue: value,
            isExpanded: true,
            decoration: InputDecoration(
                labelText: label, border: const OutlineInputBorder()),
            items: choices
                .map((String option) => DropdownMenuItem<String>(
                    value: option, child: Text(_optionLabel(option))))
                .toList(),
            onChanged: _busy
                ? null
                : (String? next) {
                    if (next != null) _changed(() => changed(next));
                  },
          ));
  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final Map<String, dynamic> saving = _copy(_artifact!);
      final String revision =
          (BigInt.parse(saving['artifact_revision'] as String? ?? '0') +
                  BigInt.one)
              .toString();
      saving['artifact_revision'] = revision;
      ((saving['request'] as Map<String, dynamic>)['context']
          as Map<String, dynamic>)['revision'] = revision;
      final dynamic cached = saving['calculation'];
      if (cached != null && cached['context']['revision'] != revision)
        saving['calculation'] = null;
      await _store.write(_caseId, saving);
      if (mounted) _artifact = saving;
      if (mounted)
        setState(() {
          _dirty = false;
          _notice = _t('Saved on this device. Reopen Economics to continue.',
              'Сохранено на устройстве. Откройте «Экономика», чтобы продолжить.');
        });
    } on Object catch (error) {
      if (mounted) setState(() => _notice = error.toString());
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _showFeedback();
      }
    }
  }

  void _calculate({bool reopening = false}) {
    try {
      final dynamic legacyStatus =
          (_artifact!['legacy'] as Map<String, dynamic>?)?['status'];
      final List<dynamic> unknownRates = legacyStatus is Map<String, dynamic> &&
              legacyStatus['status'] == 'converted'
          ? ((legacyStatus['draft']
                      as Map<String, dynamic>)['unavailable_legacy_fields']
                  as List<dynamic>? ??
              [])
          : [];
      if (_input['tax_input_basis'] == 'rates' &&
          unknownRates
              .any((dynamic field) => field.toString().contains('Rate')) &&
          _artifact!['rates_confirmed'] != true)
        throw FormatException(_t(
            'Review and explicitly confirm both tax rates before using imported amounts in rates mode.',
            'Проверьте и явно подтвердите обе ставки перед расчётом импортированных данных по ставкам.'));
      final Map<String, dynamic> request =
          _copy(_artifact!['request'] as Map<String, dynamic>);
      final Map<String, dynamic> input =
          request['input'] as Map<String, dynamic>;
      for (final String field in _money) {
        input[field] = field == 'annual_tax_base_override' &&
                (_edit[field] as String).isEmpty
            ? null
            : taxCents(_edit[field] as String);
      }
      for (final String field in _numbers) {
        input[field] = int.parse(_edit[field] as String);
      }
      final List<dynamic> bindings =
          jsonDecode(jsonEncode(_bindings)) as List<dynamic>;
      bindings.removeWhere((dynamic b) =>
          b['include_in_calculation'] == false &&
          b['confirmed'] == false &&
          !(_artifact!['required_component_ids'] as List<dynamic>)
              .contains(b['component_id']));
      for (final dynamic item in bindings) {
        final Map<String, dynamic> b = item as Map<String, dynamic>;
        b['amount'] = taxCents(b.remove('amount_text') as String);
      }
      final List<dynamic> benefits =
          jsonDecode(jsonEncode(_benefits)) as List<dynamic>;
      benefits.removeWhere((dynamic b) => b['include_in_base_case'] == false);
      for (final dynamic item in benefits) {
        final Map<String, dynamic> b = item as Map<String, dynamic>;
        b['amount'] = taxCents(b.remove('amount_text') as String);
        b['start_month'] = int.parse(b['start_month'] as String);
        b['end_month'] = (b['end_month'] as String).isEmpty
            ? null
            : int.parse(b['end_month'] as String);
      }
      input['benefit_items'] = benefits;
      final Map<String, dynamic> context =
          request['context'] as Map<String, dynamic>;
      if (!reopening)
        context['revision'] =
            (BigInt.parse(_artifact!['artifact_revision'] as String? ?? '0') +
                    BigInt.one)
                .toString();
      final Map<String, dynamic> response = widget.repository.calculate(
          widget.scenario,
          request,
          bindings,
          _artifact!['required_component_ids'] as List<dynamic>);
      setState(() {
        _validated = response['type'] == 'tax_calculated';
        _artifact!['request'] = request;
        _artifact!['binding_draft'] = response['draft'];
        _artifact!['calculation'] = response['type'] == 'tax_calculated'
            ? response['calculation']
            : null;
        _artifact!['source'] = response['source'];
        _notice = response['type'] == 'tax_calculated'
            ? _t('Calculation complete. Save to retain this result.',
                'Расчёт завершён. Сохраните результат.')
            : _errorText(response['detail']);
        _dirty = !reopening;
      });
    } on Object catch (error) {
      setState(() {
        _validated = false;
        _artifact!['calculation'] = null;
        _notice = error.toString();
      });
    }
    if (!reopening) _showFeedback();
  }

  Future<void> _exchange() async {
    final TextEditingController controller = TextEditingController();
    String kind = 'tax-authoring-artifact-v1';
    final bool? accepted = await showDialog<bool>(
        context: context,
        builder: (BuildContext dialogContext) => StatefulBuilder(
            builder: (BuildContext context, StateSetter state) => AlertDialog(
                    title:
                        Text(_t('Import a saved analysis', 'Импорт анализа')),
                    content: SizedBox(
                        width: 520,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              DropdownButtonFormField<String>(
                                  initialValue: kind,
                                  isExpanded: true,
                                  items: [
                                    'tax-authoring-artifact-v1',
                                    'web_amounts_v1',
                                    'web_rates_fx_v1'
                                  ]
                                      .map((String s) => DropdownMenuItem(
                                          value: s, child: Text(s)))
                                      .toList(),
                                  onChanged: (String? v) =>
                                      state(() => kind = v!)),
                              TextField(
                                  controller: controller,
                                  maxLines: 8,
                                  decoration: InputDecoration(
                                      labelText: _t(
                                          'Saved JSON (original retained)',
                                          'JSON (оригинал сохраняется)'))),
                            ]))),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: Text(_t('Cancel', 'Отмена'))),
                      TextButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          child: Text(_t('Import', 'Импорт')))
                    ])));
    final String raw = controller.text;
    controller.dispose();
    if (accepted != true || !mounted) return;
    try {
      if (utf8.encode(raw).length > 262144)
        throw const FormatException('Import exceeds 256 KiB.');
      if (kind == 'tax-authoring-artifact-v1') {
        final Map<String, dynamic> candidate =
            jsonDecode(raw) as Map<String, dynamic>;
        if (candidate['case_id'] != _caseId || !validTaxArtifact(candidate))
          throw const FormatException(
              'Analysis belongs to another case or unsupported format.');
        setState(() {
          candidate['artifact_revision'] = _artifact!['artifact_revision'];
          _validated = false;
          _artifact = candidate;
          _artifact!['calculation'] = null;
          _dirty = true;
          _generation++;
        });
      } else {
        final Map<String, dynamic> response = widget.repository.execute({
          'command': 'tax_import',
          'scenario': widget.scenario,
          'artifact_id': 'tax_$_caseId',
          'revision': '0',
          'schema': kind,
          'original_json': raw
        });
        final Map<String, dynamic> legacy =
            response['legacy'] as Map<String, dynamic>;
        final Map<String, dynamic> status =
            legacy['status'] as Map<String, dynamic>;
        setState(() {
          _validated = false;
          _artifact!['legacy'] = legacy;
          _artifact!['rates_confirmed'] = false;
          _artifact!['calculation'] = null;
          if (status['status'] == 'converted') {
            final Map<String, dynamic> request = (status['draft']
                as Map<String, dynamic>)['request'] as Map<String, dynamic>;
            _artifact!['request'] = request;
            _artifact!['edit'] =
                _edits(request['input'] as Map<String, dynamic>);
            _artifact!['bindings'] = <dynamic>[];
            _artifact!['benefits'] = <dynamic>[];
            _artifact!['required_component_ids'] = <dynamic>[];
          }
          _notice = _t(
              'Original retained. Review amounts and provenance before calculating.',
              'Оригинал сохранён в черновике. Проверьте суммы и происхождение перед расчётом.');
          _dirty = true;
          _generation++;
        });
      }
    } on Object catch (error) {
      setState(() {
        _notice = error.toString();
        if (utf8.encode(raw).length <= 262144) {
          _artifact!['rejected_import_original'] = raw;
          _dirty = true;
        }
      });
    }
  }

  String _errorText(dynamic detail) {
    while (detail is Map<String, dynamic> &&
        detail['detail'] is Map<String, dynamic>) {
      detail = detail['detail'];
    }
    final String code =
        detail is Map<String, dynamic> ? detail['code'] as String? ?? '' : '';
    return switch (code) {
      'missing_tax_base' => _t(
          'Complete and confirm the tax-base components, or enter a documented manual base.',
          'Заполните и подтвердите компоненты базы либо укажите обоснованную ручную базу.'),
      'missing_override_provenance' => _t(
          'Enter the reason, confirming person and valid date for the manual base.',
          'Укажите причину, подтверждающее лицо и корректную дату ручной базы.'),
      'stale_source' => _t(
          'The source changed. Review the current case and reconfirm the amounts.',
          'Источник изменился. Проверьте текущий кейс и подтвердите суммы заново.'),
      'invalid_binding' => _t(
          'Check the component source, confirmation and currency. The draft is preserved.',
          'Проверьте источник, подтверждение и валюту компонента. Черновик сохранён.'),
      _ => _t(
          'Calculation unavailable. Check the entered amounts, dates and supported limits. The draft can still be saved.',
          'Расчёт недоступен. Проверьте суммы, даты и допустимые пределы. Черновик можно сохранить.'),
    };
  }

  String _resultLabel(String field) => switch (field) {
        'annualized_net_benefit' =>
          _t('Annualized net benefit', 'Среднегодовая чистая выгода'),
        'lifecycle_net_benefit' =>
          _t('Net benefit over the horizon', 'Чистая выгода за период'),
        _ => _t('Net present value', 'Чистая приведённая стоимость'),
      };
  void _addBinding() {
    final List<dynamic> facts =
        widget.scenario['facts'] as List<dynamic>? ?? [];
    if (facts.isEmpty) {
      setState(() => _notice = _t(
          'Add a case fact before adding a monetary component.',
          'Сначала добавьте факт кейса.'));
      return;
    }
    _changed(() => _bindings.add({
          'component_id': 'component_${DateTime.now().microsecondsSinceEpoch}',
          'label': '',
          'category': 'taxable_income',
          'amount_text': '',
          'currency': _input['currency'],
          'fact_id': (facts.first as Map<String, dynamic>)['id'],
          'source_field': 'amount',
          'scenario_fingerprint':
              ((_artifact!['request'] as Map<String, dynamic>)['context']
                  as Map<String, dynamic>)['scenario_fingerprint'],
          'period': null,
          'jurisdiction': null,
          'note': '',
          'include_in_calculation': true,
          'confirmed': false,
          'confirmation_owner': null,
          'confirmation_as_of': null
        }));
  }

  Widget _sourcePicker(Map<String, dynamic> b) {
    final List<dynamic> facts =
        widget.scenario['facts'] as List<dynamic>? ?? [];
    final bool found = facts.any((dynamic f) => f['id'] == b['fact_id']);
    return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: DropdownButtonFormField<String>(
          key: ValueKey('${b['component_id']}-${b['fact_id']}'),
          initialValue: found ? b['fact_id'] as String : null,
          isExpanded: true,
          decoration: InputDecoration(
              labelText: _t('Source fact', 'Исходный факт'),
              helperText: found
                  ? null
                  : _t('Previous source is missing; choose a current fact.',
                      'Прежний источник отсутствует; выберите текущий факт.')),
          items: facts
              .map((dynamic f) => DropdownMenuItem<String>(
                  value: f['id'] as String,
                  child: Text(f['statement'] as String? ?? f['id'] as String,
                      maxLines: 2, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: _busy
              ? null
              : (String? v) => _changed(() {
                    b['fact_id'] = v!;
                    b['confirmed'] = false;
                  }),
        ));
  }

  Widget _binding(Map<String, dynamic> b) => ExpansionTile(
          key: ValueKey(b['component_id']),
          title: Text((b['label'] as String).isEmpty
              ? _t('New component', 'Новый компонент')
              : b['label'] as String),
          children: [
            _field(
                '${b['component_id']}-label',
                _t('Component label', 'Название компонента'),
                b['label'] as String,
                (String v) => b['label'] = v),
            _field(
                '${b['component_id']}-amount',
                _t('Annual amount', 'Годовая сумма'),
                b['amount_text'] as String, (String v) {
              b['amount_text'] = v;
              b['confirmed'] = false;
            }),
            _choice(_t('Category', 'Категория'), b['category'] as String, [
              'taxable_income',
              'deductible_expense',
              'non_deductible_addback',
              'exempt_income',
              'tax_loss_utilized',
              'taxable_adjustment',
              'deductible_adjustment'
            ], (String v) {
              b['category'] = v;
              b['confirmed'] = false;
            }),
            _sourcePicker(b),
            _field(
                '${b['component_id']}-field',
                _t('Monetary field', 'Денежное поле'),
                b['source_field'] as String, (String v) {
              b['source_field'] = v;
              b['confirmed'] = false;
            }),
            _field(
                '${b['component_id']}-period',
                _t('Period (blank = unknown)', 'Период (пусто = неизвестно)'),
                b['period'] as String? ?? '',
                (String v) => b['period'] = v.isEmpty ? null : v),
            _field(
                '${b['component_id']}-jurisdiction',
                _t('Jurisdiction (blank = unknown)',
                    'Юрисдикция (пусто = неизвестно)'),
                b['jurisdiction'] as String? ?? '',
                (String v) => b['jurisdiction'] = v.isEmpty ? null : v),
            _field(
                '${b['component_id']}-owner',
                _t('Confirmed by', 'Кем подтверждено'),
                b['confirmation_owner'] as String? ?? '', (String v) {
              b['confirmation_owner'] = v;
              b['confirmed'] = false;
            }),
            _field(
                '${b['component_id']}-date',
                _t('As of (YYYY-MM-DD)', 'Дата (ГГГГ-ММ-ДД)'),
                b['confirmation_as_of'] as String? ?? '', (String v) {
              b['confirmation_as_of'] = v;
              b['confirmed'] = false;
            }),
            _field(
                '${b['component_id']}-note',
                _t('Source note', 'Примечание к источнику'),
                b['note'] as String,
                (String v) => b['note'] = v),
            CheckboxListTile(
                title: Text(_t('Include in base', 'Включить в базу')),
                value: b['include_in_calculation'] as bool,
                onChanged: (bool? v) =>
                    _changed(() => b['include_in_calculation'] = v!)),
            CheckboxListTile(
                title: Text(_t('I confirm this amount and its source',
                    'Подтверждаю сумму и её источник')),
                value: b['confirmed'] as bool,
                onChanged: (bool? v) => _changed(() => b['confirmed'] = v!)),
            TextButton(
                onPressed: () => _changed(() => _bindings.remove(b)),
                child: Text(_t('Remove component', 'Удалить компонент'))),
          ]);
  void _addBenefit() => _changed(() => _benefits.add({
        'id': 'benefit_${DateTime.now().microsecondsSinceEpoch}',
        'label': '',
        'benefit_type': 'operating_cost_saving',
        'timing': 'recurring_annual',
        'amount_text': '',
        'start_month': '1',
        'end_month': '',
        'realization_bps': null,
        'probability_bps': null,
        'source_node_ids': <String>[],
        'note': null,
        'include_in_base_case': true
      }));
  Widget _benefit(Map<String, dynamic> b) => ExpansionTile(
          key: ValueKey(b['id']),
          title: Text((b['label'] as String).isEmpty
              ? _t('New benefit', 'Новая выгода')
              : b['label'] as String),
          children: [
            _field('${b['id']}-label', _t('Benefit label', 'Название выгоды'),
                b['label'] as String, (String v) => b['label'] = v),
            _field('${b['id']}-amount', _t('Amount', 'Сумма'),
                b['amount_text'] as String, (String v) => b['amount_text'] = v),
            _choice(_t('Timing', 'Периодичность'), b['timing'] as String,
                ['recurring_annual', 'one_off'], (String v) => b['timing'] = v),
            _field(
                '${b['id']}-start',
                _t('Start month (1-based)', 'Первый месяц (от 1)'),
                b['start_month'] as String,
                (String v) => b['start_month'] = v),
            _field(
                '${b['id']}-end',
                _t('End month (blank = horizon)',
                    'Последний месяц (пусто = конец периода)'),
                b['end_month'] as String,
                (String v) => b['end_month'] = v),
            CheckboxListTile(
                title: Text(_t('Include benefit', 'Включить выгоду')),
                value: b['include_in_base_case'] as bool,
                onChanged: (bool? v) =>
                    _changed(() => b['include_in_base_case'] = v!)),
            TextButton(
                onPressed: () => _changed(() => _benefits.remove(b)),
                child: Text(_t('Remove benefit', 'Удалить выгоду'))),
          ]);
  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic>? calculation = _known && _supported && _validated
        ? _artifact!['calculation'] as Map<String, dynamic>?
        : null;
    return PopScope(
        canPop: !_dirty && !_busy,
        onPopInvokedWithResult: (bool popped, dynamic result) async {
          if (popped || _busy) return;
          final bool? leave = await showDialog<bool>(
              context: context,
              builder: (BuildContext c) => AlertDialog(
                      title: Text(
                          _t('Leave without saving?', 'Выйти без сохранения?')),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(c, false),
                            child: Text(_t('Keep editing', 'Продолжить'))),
                        TextButton(
                            onPressed: () => Navigator.pop(c, true),
                            child: Text(
                                _t('Discard changes', 'Отменить изменения')))
                      ]));
          if (leave == true && mounted) {
            setState(() => _dirty = false);
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) Navigator.pop(context);
            });
          }
        },
        child: Scaffold(
            appBar:
                AppBar(title: Text(_t('Tax economics', 'Налоговая экономика'))),
            body: _loading
                ? const Center(child: CircularProgressIndicator())
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Center(
                        child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 720),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(_t(
                                      'Amounts are entered in currency units. 100 basis points = 1%. Drafts can be saved without a valid calculation.',
                                      'Суммы вводятся в единицах валюты. 100 базисных пунктов = 1%. Черновик можно сохранить без расчёта.')),
                                  if (!_supported)
                                    Text(_t(
                                        'This native library does not support Tax Economics v2. Saved data is preserved.',
                                        'Эта версия библиотеки не поддерживает расчёт v2. Сохранённые данные не изменены.')),
                                  if (_artifact != null && !_known)
                                    Text(_t(
                                        'Newer saved format. Export it for recovery; editing is disabled.',
                                        'Более новый формат. Экспортируйте для восстановления; редактирование отключено.')),
                                  if (_known && _supported) ...[
                                    const SizedBox(height: 16),
                                    if (_stale)
                                      Text(_t(
                                          'Case source changed. The old draft is preserved; confirm the new source before calculating.',
                                          'Источник кейса изменился. Старый черновик сохранён; подтвердите новый источник.')),
                                    if (_stale)
                                      TextButton(
                                          onPressed: () => _changed(() {
                                                _artifact![
                                                        'previous_source_artifact'] =
                                                    _copy(_artifact!);
                                                final dynamic previousContext =
                                                    (_artifact!['request']
                                                            as Map<String,
                                                                dynamic>)[
                                                        'context'];
                                                final Map<String, dynamic>
                                                    nextContext =
                                                    _copy((_prepared!['request']
                                                                as Map<String,
                                                                    dynamic>)[
                                                            'context']
                                                        as Map<String,
                                                            dynamic>);
                                                nextContext['revision'] =
                                                    previousContext['revision'];
                                                nextContext['artifact_id'] =
                                                    previousContext[
                                                        'artifact_id'];
                                                (_artifact!['request'] as Map<
                                                        String,
                                                        dynamic>)['context'] =
                                                    nextContext;
                                                _artifact!['scenario'] =
                                                    widget.scenario;
                                                for (final dynamic b
                                                    in _bindings) {
                                                  b['confirmed'] = false;
                                                  b['scenario_fingerprint'] =
                                                      ((_prepared!['request']
                                                                      as Map<String,
                                                                          dynamic>)[
                                                                  'context']
                                                              as Map<String,
                                                                  dynamic>)[
                                                          'scenario_fingerprint'];
                                                }
                                              }),
                                          child: Text(_t(
                                              'Use current source; reconfirm components',
                                              'Использовать текущий источник; подтвердить компоненты заново'))),
                                    if (_currencyCanChange)
                                      _choice(
                                          _t('Currency', 'Валюта'),
                                          _input['currency'] as String,
                                          ['EUR', 'GBP', 'USD'], (String v) {
                                        _input['currency'] = v;
                                        for (final dynamic b in _bindings) {
                                          b['confirmed'] = false;
                                        }
                                      }),
                                    if (!_currencyCanChange)
                                      Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 12),
                                          child: Text(
                                              '${_t('Currency fixed to preserve entered amounts', 'Валюта закреплена для сохранения введённых сумм')}: ${_input['currency']}')),
                                    _choice(
                                        _t('Tax input', 'Налоговые данные'),
                                        _input['tax_input_basis'] as String,
                                        ['amounts', 'rates'],
                                        (String v) =>
                                            _input['tax_input_basis'] = v),
                                    if (_input['tax_input_basis'] == 'rates' ||
                                        _input['tax_base_mode'] ==
                                            'manual_override')
                                      _choice(
                                          _t('Tax base', 'Налоговая база'),
                                          _input['tax_base_mode'] as String,
                                          ['derived', 'manual_override'],
                                          (String v) =>
                                              _input['tax_base_mode'] = v),
                                    for (final String field in _money)
                                      if (field != 'annual_tax_base_override' ||
                                          _input['tax_base_mode'] ==
                                              'manual_override')
                                        _field(
                                            field,
                                            _label(field),
                                            _edit[field] as String,
                                            (String v) => _edit[field] = v),
                                    for (final String field in _numbers)
                                      if (![
                                            'baseline_tax_rate_bps',
                                            'optimized_tax_rate_bps'
                                          ].contains(field) ||
                                          _input['tax_input_basis'] == 'rates')
                                        _field(
                                            field,
                                            _label(field),
                                            _edit[field] as String,
                                            (String v) => _edit[field] = v),
                                    if (_input['tax_base_mode'] ==
                                        'manual_override')
                                      for (final String field in [
                                        'override_reason',
                                        'override_owner',
                                        'override_as_of'
                                      ])
                                        _field(
                                            field,
                                            _label(field),
                                            _input[field] as String? ?? '',
                                            (String v) => _input[field] = v),
                                    if (_artifact!['legacy'] != null &&
                                        _input['tax_input_basis'] == 'rates')
                                      CheckboxListTile(
                                          title: Text(_t(
                                              'I reviewed and confirm both entered tax rates',
                                              'Я проверил(а) и подтверждаю обе введённые ставки')),
                                          value:
                                              _artifact!['rates_confirmed'] ==
                                                  true,
                                          onChanged: _busy
                                              ? null
                                              : (bool? v) => _changed(() =>
                                                  _artifact![
                                                      'rates_confirmed'] = v!)),
                                    _field(
                                        'assumptions',
                                        _label('assumptions'),
                                        _input['assumptions'] as String,
                                        (String v) =>
                                            _input['assumptions'] = v),
                                    for (final dynamic b in _bindings)
                                      _binding(b as Map<String, dynamic>),
                                    OutlinedButton(
                                        onPressed: _busy ? null : _addBinding,
                                        child: Text(_t('Add monetary component',
                                            'Добавить денежный компонент'))),
                                    for (final dynamic b in _benefits)
                                      _benefit(b as Map<String, dynamic>),
                                    OutlinedButton(
                                        onPressed: _busy ? null : _addBenefit,
                                        child: Text(_t('Add dated benefit',
                                            'Добавить выгоду с периодом'))),
                                    if (_artifact!['legacy'] != null)
                                      ExpansionTile(
                                          title: Text(_t(
                                              'Retained legacy source and inactive values',
                                              'Сохранённый оригинал и неактивные значения')),
                                          children: [
                                            SelectableText(const JsonEncoder
                                                    .withIndent('  ')
                                                .convert(_artifact!['legacy']))
                                          ]),
                                    const SizedBox(height: 16),
                                    FilledButton(
                                        key: const ValueKey('tax-calculate'),
                                        onPressed: _busy || _stale
                                            ? null
                                            : () => _calculate(),
                                        child: Text(
                                            _t('Calculate', 'Рассчитать'))),
                                    const SizedBox(height: 8),
                                    FilledButton.tonal(
                                        key: const ValueKey('tax-save'),
                                        onPressed: _busy ? null : _save,
                                        child: Text(_busy
                                            ? _t('Saving…', 'Сохранение…')
                                            : _t('Save analysis',
                                                'Сохранить анализ'))),
                                    TextButton(
                                        onPressed: _busy ? null : _exchange,
                                        child: Text(_t(
                                            'Import analysis / legacy input',
                                            'Импорт анализа / старых данных'))),
                                  ],
                                  if (_notice != null)
                                    Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 12),
                                        child: Semantics(
                                            liveRegion: true,
                                            child: Text(_notice!))),
                                  if (calculation != null &&
                                      !_stale &&
                                      _supported &&
                                      _validated) ...[
                                    const SizedBox(height: 16),
                                    Text(
                                        _t('Calculated result',
                                            'Результат расчёта'),
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleLarge),
                                    for (final String field in [
                                      'annualized_net_benefit',
                                      'lifecycle_net_benefit',
                                      'npv'
                                    ])
                                      Text(
                                          '${_resultLabel(field)}: ${taxAmount((calculation['result'] as Map<String, dynamic>)[field] as String)} ${_input['currency']}'),
                                    Text(
                                        'ROI (bps): ${(calculation['result'] as Map<String, dynamic>)['lifecycle_roi_bps'] ?? _t('Unavailable', 'Недоступно')}'),
                                    Text(
                                        'Payback (months): ${(calculation['result'] as Map<String, dynamic>)['payback_months'] ?? _t('Unavailable', 'Недоступно')}'),
                                  ],
                                  SizedBox(key: _feedbackKey, height: 1),
                                  if (_artifact != null)
                                    TextButton(
                                        onPressed: () async {
                                          try {
                                            final String path =
                                                await _store.export(_artifact!);
                                            await Clipboard.setData(
                                                ClipboardData(
                                                    text:
                                                        jsonEncode(_artifact)));
                                            if (mounted)
                                              setState(() => _notice = _t(
                                                      'Exported and copied: ',
                                                      'Экспортировано и скопировано: ') +
                                                  path);
                                          } on Object catch (e) {
                                            if (mounted)
                                              setState(
                                                  () => _notice = e.toString());
                                          }
                                        },
                                        child: Text(_t(
                                            'Export analysis with source',
                                            'Экспорт анализа с источником'))),
                                ]))))));
  }
}
