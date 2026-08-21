import 'package:flutter/material.dart';

import '../design/juris_design.dart';
import '../models/dossier_projection.dart';
import '../visual_identity/case_visual_manifest.dart';
import 'living_case_palette.dart';
import 'living_case_strings.dart';

const double _dossierSplitWidth = 700;
const double _maximumSplitTextScale = 1.3;
const double _representativeBodyFontSize = 16;

/// Read-only GreenFire dossier composed exclusively from the Rust projection.
class GreenFireLivingCaseDossierScreen extends StatefulWidget {
  const GreenFireLivingCaseDossierScreen({
    required this.dossier,
    required this.matterTitle,
    required this.treatment,
    required this.locale,
    super.key,
  });

  final DossierProjectionView dossier;
  final String matterTitle;
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
      treatment: resolveLivingCaseTreatment(context, widget.treatment),
      child: Scaffold(
        key: const ValueKey<String>('greenfire-dossier-screen'),
        appBar: AppBar(title: Text(_text('Dossier', 'Досье'))),
        body: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final double effectiveTextScale = MediaQuery.textScalerOf(context)
                    .scale(_representativeBodyFontSize) /
                _representativeBodyFontSize;
            final bool split = constraints.maxWidth >= _dossierSplitWidth &&
                effectiveTextScale <= _maximumSplitTextScale;
            final Widget file = _DossierFile(
              dossier: widget.dossier,
              matterTitle: widget.matterTitle,
              locale: widget.locale,
              includeCompactIndex: !split,
              selectedEvidenceId: _selectedEvidenceId,
              onEvidenceSelected: (String evidenceId) {
                setState(() {
                  _selectedEvidenceId =
                      _selectedEvidenceId == evidenceId ? null : evidenceId;
                });
              },
              onRemedySelected: (String actionId) {
                Navigator.of(context).pop(actionId);
              },
            );
            if (!split) {
              return KeyedSubtree(
                key: const ValueKey<String>(
                  'greenfire-dossier-layout-compact',
                ),
                child: file,
              );
            }
            return Row(
              key: const ValueKey<String>('greenfire-dossier-layout-wide'),
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                SizedBox(
                  width: 228,
                  child: _DossierIndex(wide: true, locale: widget.locale),
                ),
                const VerticalDivider(width: 1),
                Expanded(child: file),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DossierFile extends StatelessWidget {
  const _DossierFile({
    required this.dossier,
    required this.matterTitle,
    required this.locale,
    required this.includeCompactIndex,
    required this.selectedEvidenceId,
    required this.onEvidenceSelected,
    required this.onRemedySelected,
  });

  final DossierProjectionView dossier;
  final String matterTitle;
  final String locale;
  final bool includeCompactIndex;
  final String? selectedEvidenceId;
  final ValueChanged<String> onEvidenceSelected;
  final ValueChanged<String> onRemedySelected;

  String _text(String english, String russian) =>
      LivingCaseStrings.text(locale, english, russian);

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final Map<String, DossierFactView> factsById = <String, DossierFactView>{
      for (final DossierFactView fact in dossier.facts) fact.id: fact,
    };
    final EdgeInsets sectionPadding = EdgeInsets.symmetric(
      horizontal:
          includeCompactIndex ? spacing.compactGutter : spacing.wideGutter,
    );

    return ColoredBox(
      color: surfaces.baseSurface,
      child: CustomScrollView(
        key: const PageStorageKey<String>('greenfire-dossier-scroll'),
        slivers: <Widget>[
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              sectionPadding.left,
              spacing.lg,
              sectionPadding.right,
              spacing.lg,
            ),
            sliver: SliverToBoxAdapter(
              child: _DossierHeader(
                dossier: dossier,
                matterTitle: matterTitle,
                locale: locale,
              ),
            ),
          ),
          if (includeCompactIndex)
            SliverPadding(
              padding: EdgeInsets.fromLTRB(
                sectionPadding.left,
                0,
                sectionPadding.right,
                spacing.xl,
              ),
              sliver: SliverToBoxAdapter(
                child: _DossierIndex(wide: false, locale: locale),
              ),
            ),
          _sectionHeading(
            context,
            key: const ValueKey<String>(
              'greenfire-dossier-section-procedure',
            ),
            index: '01',
            title: _text('Procedure', 'Процедура'),
            padding: sectionPadding,
          ),
          SliverPadding(
            padding: sectionPadding,
            sliver: SliverToBoxAdapter(
              child: _ProcedureRecord(dossier: dossier, locale: locale),
            ),
          ),
          _sectionHeading(
            context,
            key: const ValueKey<String>('greenfire-dossier-section-facts'),
            index: '02',
            title: _text('Visible facts', 'Видимые факты'),
            padding: sectionPadding,
          ),
          if (dossier.facts.isEmpty)
            _emptyState(
              context,
              _text(
                'No facts are visible in this projection.',
                'В этой проекции факты не отображаются.',
              ),
              sectionPadding,
            )
          else
            SliverPadding(
              padding: sectionPadding,
              sliver: SliverList.builder(
                itemCount: dossier.facts.length,
                itemBuilder: (BuildContext context, int index) => _FactItem(
                  fact: dossier.facts[index],
                  locale: locale,
                ),
              ),
            ),
          _sectionHeading(
            context,
            key: const ValueKey<String>('greenfire-dossier-section-evidence'),
            index: '03',
            title: _text('Visible evidence', 'Видимые доказательства'),
            padding: sectionPadding,
          ),
          if (dossier.evidence.isEmpty)
            _emptyState(
              context,
              _text(
                'No evidence is visible in this projection.',
                'В этой проекции доказательства не отображаются.',
              ),
              sectionPadding,
            )
          else
            SliverPadding(
              padding: sectionPadding,
              sliver: SliverList.builder(
                itemCount: dossier.evidence.length,
                itemBuilder: (BuildContext context, int index) {
                  final DossierEvidenceView evidence = dossier.evidence[index];
                  return _EvidenceItem(
                    evidence: evidence,
                    factsById: factsById,
                    selected: selectedEvidenceId == evidence.id,
                    locale: locale,
                    onSelected: () => onEvidenceSelected(evidence.id),
                  );
                },
              ),
            ),
          _sectionHeading(
            context,
            key: const ValueKey<String>('greenfire-dossier-section-deadlines'),
            index: '04',
            title: _text('Deadlines and remedies', 'Сроки и меры'),
            padding: sectionPadding,
          ),
          if (dossier.deadlines.isEmpty)
            _emptyState(
              context,
              _text(
                'No deadlines are visible in this projection.',
                'В этой проекции сроки не отображаются.',
              ),
              sectionPadding,
            )
          else
            SliverPadding(
              padding: sectionPadding,
              sliver: SliverList.builder(
                itemCount: dossier.deadlines.length,
                itemBuilder: (BuildContext context, int index) {
                  return _DeadlineItem(
                    deadline: dossier.deadlines[index],
                    locale: locale,
                    onRemedySelected: onRemedySelected,
                  );
                },
              ),
            ),
          _sectionHeading(
            context,
            key: const ValueKey<String>(
              'greenfire-dossier-section-disposition',
            ),
            index: '05',
            title: _text('Projected disposition', 'Проекция результата'),
            padding: sectionPadding,
          ),
          SliverPadding(
            padding: sectionPadding,
            sliver: SliverToBoxAdapter(
              child: _DispositionRecord(dossier: dossier, locale: locale),
            ),
          ),
          SliverToBoxAdapter(child: SizedBox(height: spacing.xxl)),
        ],
      ),
    );
  }

  Widget _sectionHeading(
    BuildContext context, {
    required Key key,
    required String index,
    required String title,
    required EdgeInsets padding,
  }) {
    final JurisSpacing spacing = Theme.of(context).extension<JurisSpacing>()!;
    return SliverPadding(
      padding: EdgeInsets.fromLTRB(
        padding.left,
        spacing.xl,
        padding.right,
        spacing.md,
      ),
      sliver: SliverToBoxAdapter(
        child: _SectionHeading(key: key, index: index, title: title),
      ),
    );
  }

  Widget _emptyState(
    BuildContext context,
    String label,
    EdgeInsets padding,
  ) {
    return SliverPadding(
      padding: padding,
      sliver: SliverToBoxAdapter(child: _EmptyState(label: label)),
    );
  }
}

class _DossierIndex extends StatelessWidget {
  const _DossierIndex({required this.wide, required this.locale});

  final bool wide;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final List<(String, String, String)> entries = <(String, String, String)>[
      ('01', 'Procedure', 'Процедура'),
      ('02', 'Facts', 'Факты'),
      ('03', 'Evidence', 'Доказательства'),
      ('04', 'Deadlines', 'Сроки'),
      ('05', 'Disposition', 'Результат'),
    ];
    final Widget content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          LivingCaseStrings.text(locale, 'FILE INDEX', 'ИНДЕКС ДЕЛА'),
          style: typography.statusStamp.copyWith(color: surfaces.brass),
        ),
        SizedBox(height: spacing.md),
        ...entries.map(
          ((String, String, String) entry) => Padding(
            padding: EdgeInsets.only(bottom: spacing.sm),
            child: _IndexMark(
              index: entry.$1,
              label: LivingCaseStrings.text(locale, entry.$2, entry.$3),
            ),
          ),
        ),
      ],
    );
    if (!wide) {
      return DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(color: surfaces.rule),
            bottom: BorderSide(color: surfaces.rule),
          ),
        ),
        child: Padding(padding: EdgeInsets.all(spacing.md), child: content),
      );
    }
    return ColoredBox(
      color: surfaces.surfaceLow,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            spacing.wideGutter,
            spacing.xl,
            spacing.lg,
            spacing.xl,
          ),
          child: content,
        ),
      ),
    );
  }
}

class _IndexMark extends StatelessWidget {
  const _IndexMark({required this.index, required this.label});

  final String index;
  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(index, style: typography.metadata.copyWith(color: surfaces.cyan)),
        SizedBox(width: spacing.sm),
        Expanded(child: Text(label, style: typography.bodyCompact)),
      ],
    );
  }
}

class _DossierHeader extends StatelessWidget {
  const _DossierHeader({
    required this.dossier,
    required this.matterTitle,
    required this.locale,
  });

  final DossierProjectionView dossier;
  final String matterTitle;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final CaseVisualTreatment treatment = CaseTreatmentScope.of(context);
    return Material(
      key: const ValueKey<String>('greenfire-dossier-header'),
      color: surfaces.elevatedSurface,
      elevation: surfaces.raisedElevation,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: BorderDirectional(
            start: BorderSide(
              color: treatment.palette.accent,
              width: borders.emphasis,
            ),
            bottom: BorderSide(color: surfaces.rule, width: borders.hairline),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(spacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                LivingCaseStrings.text(
                  locale,
                  'LIVING DOSSIER · PLAYER-VISIBLE PROJECTION',
                  'ЖИВОЕ ДОСЬЕ · ВИДИМАЯ ПРОЕКЦИЯ',
                ),
                style: typography.statusStamp.copyWith(
                  color: treatment.palette.accent,
                ),
              ),
              SizedBox(height: spacing.sm),
              Semantics(
                header: true,
                child: Text(matterTitle, style: typography.screenDisplay),
              ),
              SizedBox(height: spacing.sm),
              Text(
                '${LivingCaseStrings.text(locale, 'Projected phase', 'Проекция этапа')}: '
                '${dossier.procedure.stageTitle}',
                style: typography.documentTitle,
              ),
              SizedBox(height: spacing.lg),
              Wrap(
                spacing: spacing.sm,
                runSpacing: spacing.sm,
                children: <Widget>[
                  _StatusStamp(
                    label:
                        _matterStatus(locale, dossier.procedure.matterStatus),
                    icon: Icons.folder_open_outlined,
                  ),
                  _StatusStamp(
                    label:
                        _lifecycle(locale, dossier.procedure.matterLifecycle),
                    icon: Icons.account_tree_outlined,
                  ),
                  _StatusStamp(
                    label: dossier.procedure.isClosed
                        ? LivingCaseStrings.text(
                            locale,
                            'Closed file',
                            'Закрытое дело',
                          )
                        : LivingCaseStrings.text(
                            locale,
                            'Open file',
                            'Открытое дело',
                          ),
                    icon: dossier.procedure.isClosed
                        ? Icons.lock_outline
                        : Icons.lock_open_outlined,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusStamp extends StatelessWidget {
  const _StatusStamp({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisRadii radii = theme.extension<JurisRadii>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.md,
        vertical: spacing.sm,
      ),
      decoration: BoxDecoration(
        border: Border.all(color: surfaces.rule, width: borders.standard),
        borderRadius: BorderRadius.circular(radii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 16, color: surfaces.cyan),
          SizedBox(width: spacing.sm),
          Flexible(child: Text(label, style: typography.statusStamp)),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({super.key, required this.index, required this.title});

  final String index;
  final String title;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    return Semantics(
      header: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: surfaces.rule)),
        ),
        child: Padding(
          padding: EdgeInsets.only(bottom: spacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                index,
                style: typography.metadata.copyWith(color: surfaces.cyan),
              ),
              SizedBox(width: spacing.md),
              Expanded(child: Text(title, style: typography.sectionTitle)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProcedureRecord extends StatelessWidget {
  const _ProcedureRecord({required this.dossier, required this.locale});

  final DossierProjectionView dossier;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final DossierProcedureView procedure = dossier.procedure;
    return _RuledRecord(
      key: const ValueKey<String>('greenfire-dossier-procedure'),
      children: <Widget>[
        _MetadataLine(
          label: LivingCaseStrings.text(locale, 'Projected phase', 'Этап'),
          value: procedure.stageTitle,
        ),
        _MetadataLine(
          label: LivingCaseStrings.text(
            locale,
            'Matter status',
            'Статус дела',
          ),
          value: _matterStatus(locale, procedure.matterStatus),
        ),
        _MetadataLine(
          label: LivingCaseStrings.text(locale, 'Lifecycle', 'Жизненный цикл'),
          value: _lifecycle(locale, procedure.matterLifecycle),
        ),
        _MetadataLine(
          label: LivingCaseStrings.text(locale, 'File state', 'Состояние дела'),
          value: procedure.isClosed
              ? LivingCaseStrings.text(locale, 'Closed', 'Закрыто')
              : LivingCaseStrings.text(locale, 'Open', 'Открыто'),
        ),
        _MetadataLine(
          label: LivingCaseStrings.text(
            locale,
            'Elapsed scenario time',
            'Прошедшее время сценария',
          ),
          value: LivingCaseStrings.text(
            locale,
            '${procedure.clockMinutes} min',
            '${procedure.clockMinutes} мин',
          ),
        ),
      ],
    );
  }
}

class _MetadataLine extends StatelessWidget {
  const _MetadataLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: spacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: typography.metadata.copyWith(color: surfaces.mutedInk),
            ),
          ),
          SizedBox(width: spacing.md),
          Expanded(flex: 3, child: Text(value, style: typography.bodyCompact)),
        ],
      ),
    );
  }
}

class _FactItem extends StatelessWidget {
  const _FactItem({required this.fact, required this.locale});

  final DossierFactView fact;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    return _RuledRecord(
      key: ValueKey<String>('greenfire-fact-${fact.id}'),
      children: <Widget>[
        Text(fact.statement, style: typography.bodyReading),
        SizedBox(height: spacing.sm),
        Text(
          _factStatus(locale, fact.status),
          style: typography.statusStamp.copyWith(color: surfaces.brass),
        ),
      ],
    );
  }
}

class _EvidenceItem extends StatefulWidget {
  const _EvidenceItem({
    required this.evidence,
    required this.factsById,
    required this.selected,
    required this.locale,
    required this.onSelected,
  });

  final DossierEvidenceView evidence;
  final Map<String, DossierFactView> factsById;
  final bool selected;
  final String locale;
  final VoidCallback onSelected;

  @override
  State<_EvidenceItem> createState() => _EvidenceItemState();
}

class _EvidenceItemState extends State<_EvidenceItem> {
  bool _focused = false;

  String _text(String english, String russian) =>
      LivingCaseStrings.text(widget.locale, english, russian);

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisRadii radii = theme.extension<JurisRadii>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final String actionLabel = widget.selected
        ? _text('Hide document details', 'Скрыть сведения о документе')
        : _text('Show document details', 'Показать сведения о документе');
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.md),
      child: Semantics(
        selected: widget.selected,
        button: true,
        label:
            '${widget.evidence.title}. ${widget.evidence.kind}. $actionLabel',
        child: JurisFocusOutline(
          focused: _focused,
          child: Material(
            color:
                widget.selected ? surfaces.surfaceHigh : surfaces.baseSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(radii.small),
              side: BorderSide(
                color: widget.selected ? surfaces.brass : surfaces.rule,
                width: widget.selected ? borders.emphasis : borders.hairline,
              ),
            ),
            child: JurisMinimumTarget(
              child: InkWell(
                key: ValueKey<String>(
                  'greenfire-evidence-${widget.evidence.id}',
                ),
                borderRadius: BorderRadius.circular(radii.small),
                onFocusChange: (bool focused) {
                  if (_focused != focused) {
                    setState(() => _focused = focused);
                  }
                },
                onTap: widget.onSelected,
                child: Padding(
                  padding: EdgeInsets.all(spacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              widget.evidence.title,
                              style: typography.documentTitle,
                            ),
                          ),
                          SizedBox(width: spacing.sm),
                          Icon(
                            widget.selected
                                ? Icons.visibility_outlined
                                : Icons.description_outlined,
                            color: widget.selected
                                ? surfaces.brass
                                : surfaces.cyan,
                          ),
                        ],
                      ),
                      SizedBox(height: spacing.xs),
                      Text(
                        widget.evidence.kind.isEmpty
                            ? _text('Type unavailable', 'Тип не указан')
                            : widget.evidence.kind,
                        style: typography.metadata.copyWith(
                          color: surfaces.mutedInk,
                        ),
                      ),
                      SizedBox(height: spacing.md),
                      Text(
                        widget.evidence.description ??
                            _text(
                              'No evidence description is projected.',
                              'Описание доказательства не отображается.',
                            ),
                        style: typography.bodyReading,
                      ),
                      SizedBox(height: spacing.md),
                      _FactLinks(
                        label: _text(
                          'Supports visible facts',
                          'Подтверждает факты',
                        ),
                        factIds: widget.evidence.supportsFactIds,
                        factsById: widget.factsById,
                        emptyLabel: _text(
                          'No supporting fact links are projected.',
                          'Подтверждающие связи с фактами не отображаются.',
                        ),
                        unavailableLabel: _text(
                          'Referenced visible fact is unavailable.',
                          'Связанный видимый факт недоступен.',
                        ),
                      ),
                      SizedBox(height: spacing.sm),
                      _FactLinks(
                        label: _text(
                          'Contradicts visible facts',
                          'Противоречит фактам',
                        ),
                        factIds: widget.evidence.contradictsFactIds,
                        factsById: widget.factsById,
                        emptyLabel: _text(
                          'No contradicting fact links are projected.',
                          'Противоречащие связи с фактами не отображаются.',
                        ),
                        unavailableLabel: _text(
                          'Referenced visible fact is unavailable.',
                          'Связанный видимый факт недоступен.',
                        ),
                      ),
                      SizedBox(height: spacing.md),
                      Text(
                        widget.selected
                            ? _text(
                                'Selected visible document',
                                'Выбранный видимый документ',
                              )
                            : actionLabel,
                        style: typography.statusStamp.copyWith(
                          color:
                              widget.selected ? surfaces.brass : surfaces.cyan,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FactLinks extends StatelessWidget {
  const _FactLinks({
    required this.label,
    required this.factIds,
    required this.factsById,
    required this.emptyLabel,
    required this.unavailableLabel,
  });

  final String label;
  final List<String> factIds;
  final Map<String, DossierFactView> factsById;
  final String emptyLabel;
  final String unavailableLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final List<String> statements = factIds
        .map((String id) => factsById[id]?.statement ?? unavailableLabel)
        .toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: typography.metadata.copyWith(color: surfaces.brass),
        ),
        SizedBox(height: spacing.xs),
        if (statements.isEmpty)
          Text(emptyLabel, style: typography.caption)
        else
          ...statements.map(
            (String statement) => Padding(
              padding: EdgeInsets.only(bottom: spacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(
                    Icons.subdirectory_arrow_right,
                    size: 16,
                    color: surfaces.cyan,
                  ),
                  SizedBox(width: spacing.sm),
                  Expanded(
                    child: Text(statement, style: typography.bodyCompact),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DeadlineItem extends StatelessWidget {
  const _DeadlineItem({
    required this.deadline,
    required this.locale,
    required this.onRemedySelected,
  });

  final DossierDeadlineView deadline;
  final String locale;
  final ValueChanged<String> onRemedySelected;

  String _text(String english, String russian) =>
      LivingCaseStrings.text(locale, english, russian);

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    return _RuledRecord(
      key: ValueKey<String>('greenfire-deadline-${deadline.id}'),
      children: <Widget>[
        Text(deadline.title, style: typography.documentTitle),
        SizedBox(height: spacing.sm),
        Wrap(
          spacing: spacing.md,
          runSpacing: spacing.xs,
          children: <Widget>[
            Text(
              _deadlineStatus(locale, deadline.status),
              style: typography.statusStamp.copyWith(
                color: deadline.status == DossierDeadlineStatus.missed
                    ? surfaces.danger
                    : surfaces.brass,
              ),
            ),
            Text(
              _text(
                'Due at elapsed minute ${deadline.dueAtMinutes}',
                'Срок на минуте сценария ${deadline.dueAtMinutes}',
              ),
              style: typography.timestamp.copyWith(color: surfaces.mutedInk),
            ),
          ],
        ),
        SizedBox(height: spacing.lg),
        Text(
          _text('PROJECTED REMEDIES', 'ПРОЕКЦИЯ МЕР'),
          style: typography.statusStamp.copyWith(color: surfaces.cyan),
        ),
        SizedBox(height: spacing.sm),
        if (deadline.remedies.isEmpty)
          Text(
            _text(
              'No remedies are visible for this deadline.',
              'Для этого срока меры не отображаются.',
            ),
            style: typography.caption,
          )
        else
          ...deadline.remedies.map(
            (DossierRemedyView remedy) => Padding(
              padding: EdgeInsets.only(bottom: spacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    remedy.description ??
                        _text(
                          'No remedy description is projected.',
                          'Описание меры не отображается.',
                        ),
                    style: typography.bodyCompact,
                  ),
                  SizedBox(height: spacing.sm),
                  Text(
                    _text(
                      '${remedy.timeCostMinutes} min · EUR ${remedy.costEur}',
                      '${remedy.timeCostMinutes} мин · EUR ${remedy.costEur}',
                    ),
                    style: typography.metadata.copyWith(
                      color: surfaces.mutedInk,
                    ),
                  ),
                  SizedBox(height: spacing.sm),
                  JurisMinimumTarget(
                    child: OutlinedButton.icon(
                      key: ValueKey<String>(
                        'greenfire-dossier-remedy-${remedy.actionId}',
                      ),
                      onPressed: () => onRemedySelected(remedy.actionId),
                      icon: const Icon(Icons.open_in_new),
                      label: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(remedy.title),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DispositionRecord extends StatelessWidget {
  const _DispositionRecord({required this.dossier, required this.locale});

  final DossierProjectionView dossier;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final DossierOutcomeView? outcome = dossier.outcome;
    final List<Widget> children = <Widget>[];
    if (dossier.judicialResult != null) {
      children.add(
        _MetadataLine(
          label: LivingCaseStrings.text(
            locale,
            'Judicial result',
            'Судебный результат',
          ),
          value: _judicialResult(locale, dossier.judicialResult!),
        ),
      );
    }
    if (dossier.judicialDecisionInstance != null) {
      children.add(
        _MetadataLine(
          label: LivingCaseStrings.text(
            locale,
            'Decision instance',
            'Судебная инстанция',
          ),
          value: _judicialInstance(
            locale,
            dossier.judicialDecisionInstance!,
          ),
        ),
      );
    }
    if (outcome != null) {
      final ThemeData theme = Theme.of(context);
      final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
      final JurisTypography typography = theme.extension<JurisTypography>()!;
      children.addAll(<Widget>[
        Text(outcome.title, style: typography.documentTitle),
        SizedBox(height: spacing.sm),
        Text(outcome.summary, style: typography.bodyReading),
      ]);
    }
    if (children.isEmpty) {
      return _EmptyState(
        label: LivingCaseStrings.text(
          locale,
          'No judicial result or outcome is visible in this projection.',
          'В этой проекции судебный результат или итог не отображается.',
        ),
      );
    }
    return _RuledRecord(
      key: const ValueKey<String>('greenfire-dossier-disposition'),
      children: children,
    );
  }
}

class _RuledRecord extends StatelessWidget {
  const _RuledRecord({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: surfaces.rule, width: borders.hairline),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSurfaces surfaces = theme.extension<JurisSurfaces>()!;
    final JurisSpacing spacing = theme.extension<JurisSpacing>()!;
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surfaces.surfaceLow,
        border: Border.all(color: surfaces.rule, width: borders.hairline),
      ),
      child: Padding(
        padding: EdgeInsets.all(spacing.lg),
        child: Text(label, style: typography.caption),
      ),
    );
  }
}

String _matterStatus(String locale, DossierMatterStatus status) =>
    switch (status) {
      DossierMatterStatus.open =>
        LivingCaseStrings.text(locale, 'Matter open', 'Дело открыто'),
      DossierMatterStatus.recoverable => LivingCaseStrings.text(
          locale,
          'Matter recoverable',
          'Дело подлежит восстановлению',
        ),
      DossierMatterStatus.closed =>
        LivingCaseStrings.text(locale, 'Matter closed', 'Дело закрыто'),
      DossierMatterStatus.unknown => LivingCaseStrings.text(
          locale,
          'Matter status unknown',
          'Статус дела неизвестен',
        ),
    };

String _lifecycle(String locale, DossierLifecycleStatus status) =>
    switch (status) {
      DossierLifecycleStatus.active =>
        LivingCaseStrings.text(locale, 'Active', 'Активно'),
      DossierLifecycleStatus.postJudgment =>
        LivingCaseStrings.text(locale, 'Post-judgment', 'После решения суда'),
      DossierLifecycleStatus.appeal =>
        LivingCaseStrings.text(locale, 'Appeal', 'Апелляция'),
      DossierLifecycleStatus.cassation =>
        LivingCaseStrings.text(locale, 'Cassation', 'Кассация'),
      DossierLifecycleStatus.enforcement =>
        LivingCaseStrings.text(locale, 'Enforcement', 'Исполнение'),
      DossierLifecycleStatus.closed =>
        LivingCaseStrings.text(locale, 'Closed', 'Закрыто'),
      DossierLifecycleStatus.unknown =>
        LivingCaseStrings.text(locale, 'Unknown', 'Неизвестно'),
    };

String _factStatus(String locale, DossierFactStatus status) => switch (status) {
      DossierFactStatus.alleged =>
        LivingCaseStrings.text(locale, 'Alleged', 'Заявлено'),
      DossierFactStatus.admitted =>
        LivingCaseStrings.text(locale, 'Admitted', 'Признано'),
      DossierFactStatus.disputed =>
        LivingCaseStrings.text(locale, 'Disputed', 'Оспаривается'),
      DossierFactStatus.proven =>
        LivingCaseStrings.text(locale, 'Proven', 'Доказано'),
      DossierFactStatus.inferred =>
        LivingCaseStrings.text(locale, 'Inferred', 'Выведено'),
      DossierFactStatus.unknown =>
        LivingCaseStrings.text(locale, 'Unknown', 'Неизвестно'),
    };

String _deadlineStatus(String locale, DossierDeadlineStatus status) =>
    switch (status) {
      DossierDeadlineStatus.open =>
        LivingCaseStrings.text(locale, 'Open', 'Открыт'),
      DossierDeadlineStatus.completed =>
        LivingCaseStrings.text(locale, 'Completed', 'Завершён'),
      DossierDeadlineStatus.missed =>
        LivingCaseStrings.text(locale, 'Missed', 'Пропущен'),
      DossierDeadlineStatus.unknown =>
        LivingCaseStrings.text(locale, 'Unknown', 'Неизвестен'),
    };

String _judicialResult(String locale, DossierJudicialResult result) =>
    switch (result) {
      DossierJudicialResult.won =>
        LivingCaseStrings.text(locale, 'Won', 'Выиграно'),
      DossierJudicialResult.lost =>
        LivingCaseStrings.text(locale, 'Lost', 'Проиграно'),
      DossierJudicialResult.partiallyWon =>
        LivingCaseStrings.text(locale, 'Partially won', 'Частично выиграно'),
      DossierJudicialResult.dismissed =>
        LivingCaseStrings.text(locale, 'Dismissed', 'Отклонено'),
      DossierJudicialResult.unknown =>
        LivingCaseStrings.text(locale, 'Unknown', 'Неизвестно'),
    };

String _judicialInstance(
  String locale,
  DossierJudicialDecisionInstance instance,
) =>
    switch (instance) {
      DossierJudicialDecisionInstance.firstInstance => LivingCaseStrings.text(
          locale,
          'First instance',
          'Первая инстанция',
        ),
      DossierJudicialDecisionInstance.appeal =>
        LivingCaseStrings.text(locale, 'Appeal', 'Апелляция'),
      DossierJudicialDecisionInstance.cassation =>
        LivingCaseStrings.text(locale, 'Cassation', 'Кассация'),
      DossierJudicialDecisionInstance.unknown =>
        LivingCaseStrings.text(locale, 'Unknown', 'Неизвестно'),
    };
