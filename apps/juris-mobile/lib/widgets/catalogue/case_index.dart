import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/case_runtime_factory.dart';
import '../../design/juris_design.dart';
import '../../models/case_catalog.dart';
import '../../visual_identity/cinematic_catalogue_strings.dart';

const double _minimumTargetExtent = 48;
const double _compactBaseItemExtent = 196;
const double _wideBaseItemExtent = 146;
const double _wideViewportCap = 560;
const double _wideFallbackWidth = 248;
// Separately measured text and RenderWrap widths can meet on a fractional
// logical-pixel boundary. Reserve half a pixel only when deciding run parity.
const double _caseIndexMarkWrapRoundingAllowance = 0.5;

/// Responsive editorial case selector backed by one stable selected case ID.
///
/// Compact layouts expose one complete snapping page plus explicit previous,
/// next, and direct-browse controls. Wide layouts expose a bounded scrollable
/// list. Neither route can launch a case.
final class CaseIndex extends StatefulWidget {
  const CaseIndex({
    super.key,
    required this.bundle,
    required this.locale,
    required this.cases,
    required this.selectedCaseId,
    required this.vertical,
    required this.onSelected,
    required this.onBrowseAll,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final List<MobileCaseDefinition> cases;
  final String? selectedCaseId;
  final bool vertical;
  final ValueChanged<String> onSelected;
  final VoidCallback onBrowseAll;

  @override
  State<CaseIndex> createState() => _CaseIndexState();
}

final class _CaseIndexState extends State<CaseIndex> {
  late final PageController _pageController;
  final ScrollController _wideScrollController = ScrollController();
  final Map<String, FocusNode> _focusNodes = <String, FocusNode>{};
  String? _directPageSyncCaseId;
  String? _pendingKeyboardFocusCaseId;
  int _directPageSyncGeneration = 0;
  int _selectionSyncGeneration = 0;
  double _wideItemExtent = _wideBaseItemExtent;
  double _wideSeparatorExtent = 0;

  int get _selectedIndex {
    final int index = widget.cases.indexWhere(
      (MobileCaseDefinition item) => item.caseId == widget.selectedCaseId,
    );
    return index < 0 ? 0 : index;
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _selectedIndex);
    _reconcileFocusNodes();
  }

  @override
  void didUpdateWidget(CaseIndex oldWidget) {
    super.didUpdateWidget(oldWidget);
    _reconcileFocusNodes();
    if (oldWidget.selectedCaseId != widget.selectedCaseId ||
        oldWidget.vertical != widget.vertical ||
        !_sameCaseIds(oldWidget.cases, widget.cases)) {
      _scheduleSelectionSync();
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _wideScrollController.dispose();
    for (final FocusNode node in _focusNodes.values) {
      node.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final JurisSpacing? spacing = Theme.of(context).extension<JurisSpacing>();
    final JurisTypography? typography =
        Theme.of(context).extension<JurisTypography>();
    if (spacing == null || typography == null) {
      throw FlutterError('CaseIndex requires spacing and typography.');
    }
    final CinematicCatalogueStrings chrome =
        CinematicCatalogueStrings.of(widget.locale);

    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onKeyEvent: widget.vertical ? _handleWideKey : _handleCompactKey,
      child: FocusTraversalGroup(
        policy: OrderedTraversalPolicy(),
        child: Column(
          key: const ValueKey<String>('case-index'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              chrome.caseIndex.toUpperCase(),
              style: typography.caseIndex,
            ),
            SizedBox(height: spacing.sm),
            if (widget.vertical)
              _buildWide(context, chrome, spacing)
            else
              _buildCompact(context, chrome, spacing),
          ],
        ),
      ),
    );
  }

  Widget _buildCompact(
    BuildContext context,
    CinematicCatalogueStrings chrome,
    JurisSpacing spacing,
  ) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final int selectedIndex = _selectedIndex;
        final double availableWidth = constraints.hasBoundedWidth
            ? constraints.maxWidth
            : _compactBaseItemExtent;
        final double cardWidth = math.max(
          _minimumTargetExtent,
          availableWidth - (2 * _minimumTargetExtent) - (4 * spacing.xs),
        );
        final double itemExtent = _measureItemExtent(
          context,
          chrome: chrome,
          spacing: spacing,
          cardWidth: cardWidth,
          baseExtent: _compactBaseItemExtent,
        );

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            SizedBox(
              height: itemExtent,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  _BoundaryButton(
                    key: const ValueKey<String>('case-index-previous'),
                    icon: Icons.chevron_left,
                    label: chrome.previousCase,
                    enabled: selectedIndex > 0,
                    onPressed: () => _selectIndex(selectedIndex - 1),
                  ),
                  SizedBox(width: spacing.xs),
                  Expanded(
                    child: PageView.builder(
                      key: const ValueKey<String>('compact-case-pages'),
                      controller: _pageController,
                      itemCount: widget.cases.length,
                      onPageChanged: _handlePageChanged,
                      itemBuilder: (BuildContext context, int index) {
                        return Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: spacing.xs,
                          ),
                          child: _buildItem(
                            context,
                            chrome,
                            widget.cases[index],
                            index,
                            compact: true,
                            itemExtent: itemExtent,
                          ),
                        );
                      },
                    ),
                  ),
                  SizedBox(width: spacing.xs),
                  _BoundaryButton(
                    key: const ValueKey<String>('case-index-next'),
                    icon: Icons.chevron_right,
                    label: chrome.nextCase,
                    enabled: selectedIndex < widget.cases.length - 1,
                    onPressed: () => _selectIndex(selectedIndex + 1),
                  ),
                ],
              ),
            ),
            SizedBox(height: spacing.sm),
            Semantics(
              label: chrome.casePosition(
                selectedIndex + 1,
                widget.cases.length,
              ),
              child: ExcludeSemantics(
                child: Row(
                  children: <Widget>[
                    Text(
                      chrome.casePosition(
                        selectedIndex + 1,
                        widget.cases.length,
                      ),
                      key: const ValueKey<String>('case-index-position'),
                    ),
                    SizedBox(width: spacing.sm),
                    Expanded(
                      child: LinearProgressIndicator(
                        key: const ValueKey<String>('case-index-progress'),
                        value: (selectedIndex + 1) / widget.cases.length,
                        minHeight: 3,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: spacing.sm),
            OutlinedButton.icon(
              key: const ValueKey<String>('browse-all-cases'),
              onPressed: widget.onBrowseAll,
              icon: const Icon(Icons.view_list_outlined),
              label: Text(chrome.browseAllCases),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(_minimumTargetExtent),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildWide(
    BuildContext context,
    CinematicCatalogueStrings chrome,
    JurisSpacing spacing,
  ) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double cardWidth = constraints.hasBoundedWidth
            ? constraints.maxWidth
            : _wideFallbackWidth;
        final double itemExtent = _measureItemExtent(
          context,
          chrome: chrome,
          spacing: spacing,
          cardWidth: cardWidth,
          baseExtent: _wideBaseItemExtent,
        );
        final double totalExtent = (widget.cases.length * itemExtent) +
            (math.max(0, widget.cases.length - 1) * spacing.sm);
        final double viewportExtent = math.min(
          totalExtent,
          math.max(_wideViewportCap, itemExtent),
        );
        final bool extentChanged =
            _wideItemExtent != itemExtent || _wideSeparatorExtent != spacing.sm;
        _wideItemExtent = itemExtent;
        _wideSeparatorExtent = spacing.sm;
        if (extentChanged) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && widget.vertical) {
              _scrollWideTo(_selectedIndex);
            }
          });
        }

        return SizedBox(
          height: viewportExtent,
          child: Scrollbar(
            controller: _wideScrollController,
            thumbVisibility: totalExtent > viewportExtent,
            child: ListView.separated(
              key: const ValueKey<String>('wide-case-list'),
              controller: _wideScrollController,
              primary: false,
              itemCount: widget.cases.length,
              separatorBuilder: (BuildContext context, int index) =>
                  SizedBox(height: spacing.sm),
              itemBuilder: (BuildContext context, int index) => _buildItem(
                context,
                chrome,
                widget.cases[index],
                index,
                compact: false,
                itemExtent: itemExtent,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildItem(
    BuildContext context,
    CinematicCatalogueStrings chrome,
    MobileCaseDefinition definition,
    int index, {
    required bool compact,
    required double itemExtent,
  }) {
    final LocalizedCaseText text = definition.localized(
      widget.locale,
      widget.bundle.defaultLocale,
    );
    final bool selected = definition.caseId == widget.selectedCaseId;
    final bool playable = CaseRuntimeFactory.supports(definition);
    return _CaseIndexItem(
      semanticsKey: ValueKey<String>('case-index-item-${definition.caseId}'),
      focusNode: _focusNodes[definition.caseId]!,
      definition: definition,
      localizedText: text,
      position: chrome.casePosition(index + 1, widget.cases.length),
      selected: selected,
      compact: compact,
      itemExtent: itemExtent,
      semanticsLabel: chrome.caseSemanticsLabel(
        index: index + 1,
        total: widget.cases.length,
        title: text.shortTitle,
        jurisdiction: definition.jurisdiction,
        playable: playable,
        selected: selected,
      ),
      onSelected: () => widget.onSelected(definition.caseId),
    );
  }

  void _handlePageChanged(int index) {
    if (index < 0 || index >= widget.cases.length) {
      return;
    }
    final String caseId = widget.cases[index].caseId;
    final String? expectedDirectSync = _directPageSyncCaseId;
    if (expectedDirectSync != null) {
      _clearDirectPageSync();
      if (caseId == expectedDirectSync) {
        return;
      }
    }
    if (caseId != widget.selectedCaseId) {
      widget.onSelected(caseId);
    }
    final String? pendingFocus = _pendingKeyboardFocusCaseId;
    _pendingKeyboardFocusCaseId = null;
    if (pendingFocus == caseId) {
      _focusNodes[caseId]?.requestFocus();
    }
  }

  void _selectIndex(
    int index, {
    bool requestFocus = false,
    bool jump = false,
  }) {
    if (index < 0 || index >= widget.cases.length) {
      return;
    }
    final String caseId = widget.cases[index].caseId;
    _selectionSyncGeneration += 1;
    _clearDirectPageSync();
    _pendingKeyboardFocusCaseId = requestFocus ? caseId : null;
    if (!_pageController.hasClients) {
      if (caseId != widget.selectedCaseId) {
        widget.onSelected(caseId);
      }
      if (requestFocus) {
        _focusNodes[caseId]?.requestFocus();
        _pendingKeyboardFocusCaseId = null;
      }
      return;
    }
    final int current =
        (_pageController.page?.round() ?? _pageController.initialPage);
    if (current == index) {
      if (caseId != widget.selectedCaseId) {
        widget.onSelected(caseId);
      }
      if (requestFocus) {
        _focusNodes[caseId]?.requestFocus();
      }
      _pendingKeyboardFocusCaseId = null;
      return;
    }
    final JurisMotion motion = JurisMotionPolicy.of(context);
    if (jump || motion.selection == Duration.zero) {
      _pageController.jumpToPage(index);
    } else {
      _pageController.animateToPage(
        index,
        duration: motion.selection,
        curve: motion.selectionCurve,
      );
    }
  }

  KeyEventResult _handleCompactKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent || widget.vertical || widget.cases.isEmpty) {
      return KeyEventResult.ignored;
    }
    final int current = _selectedIndex;
    final (int, bool)? destination = switch (event.logicalKey) {
      LogicalKeyboardKey.arrowLeft => (current - 1, false),
      LogicalKeyboardKey.arrowRight => (current + 1, false),
      LogicalKeyboardKey.home => (0, true),
      LogicalKeyboardKey.end => (widget.cases.length - 1, true),
      _ => null,
    };
    if (destination == null) {
      return KeyEventResult.ignored;
    }
    final int bounded = destination.$1.clamp(0, widget.cases.length - 1);
    if (bounded == current) {
      _focusNodes[widget.cases[current].caseId]?.requestFocus();
      return KeyEventResult.handled;
    }
    _selectIndex(
      bounded,
      requestFocus: true,
      jump: destination.$2,
    );
    return KeyEventResult.handled;
  }

  KeyEventResult _handleWideKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent || !widget.vertical) {
      return KeyEventResult.ignored;
    }
    final int current = _selectedIndex;
    final int? next = switch (event.logicalKey) {
      LogicalKeyboardKey.arrowUp => current - 1,
      LogicalKeyboardKey.arrowDown => current + 1,
      LogicalKeyboardKey.home => 0,
      LogicalKeyboardKey.end => widget.cases.length - 1,
      _ => null,
    };
    if (next == null) {
      return KeyEventResult.ignored;
    }
    final int bounded = next.clamp(0, widget.cases.length - 1);
    final MobileCaseDefinition definition = widget.cases[bounded];
    _selectionSyncGeneration += 1;
    _clearDirectPageSync();
    _pendingKeyboardFocusCaseId = null;
    if (definition.caseId != widget.selectedCaseId) {
      widget.onSelected(definition.caseId);
    }
    _focusNodes[definition.caseId]?.requestFocus();
    _scrollWideTo(bounded);
    return KeyEventResult.handled;
  }

  void _scheduleSelectionSync() {
    final int generation = ++_selectionSyncGeneration;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted ||
          generation != _selectionSyncGeneration ||
          widget.cases.isEmpty) {
        return;
      }
      if (widget.vertical) {
        _clearDirectPageSync();
        _pendingKeyboardFocusCaseId = null;
        _scrollWideTo(_selectedIndex);
      } else {
        _syncCompactPageDirectly(
          _selectedIndex,
          widget.cases[_selectedIndex].caseId,
        );
      }
    });
  }

  void _syncCompactPageDirectly(int index, String caseId) {
    if (!_pageController.hasClients ||
        (_pageController.page?.round() ?? _pageController.initialPage) ==
            index) {
      _clearDirectPageSync();
      return;
    }
    _pendingKeyboardFocusCaseId = null;
    final int directGeneration = ++_directPageSyncGeneration;
    _directPageSyncCaseId = caseId;
    _pageController.jumpToPage(index);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted &&
          directGeneration == _directPageSyncGeneration &&
          _directPageSyncCaseId == caseId) {
        _clearDirectPageSync();
      }
    });
  }

  void _clearDirectPageSync() {
    _directPageSyncGeneration += 1;
    _directPageSyncCaseId = null;
  }

  void _scrollWideTo(int index) {
    if (!_wideScrollController.hasClients) {
      return;
    }
    final double target =
        (index * (_wideItemExtent + _wideSeparatorExtent)).clamp(
      0,
      _wideScrollController.position.maxScrollExtent,
    );
    final JurisMotion motion = JurisMotionPolicy.of(context);
    if (motion.selection == Duration.zero) {
      _wideScrollController.jumpTo(target);
    } else {
      _wideScrollController.animateTo(
        target,
        duration: motion.selection,
        curve: motion.selectionCurve,
      );
    }
  }

  double _measureItemExtent(
    BuildContext context, {
    required CinematicCatalogueStrings chrome,
    required JurisSpacing spacing,
    required double cardWidth,
    required double baseExtent,
  }) {
    final ThemeData theme = Theme.of(context);
    final JurisTypography typography = theme.extension<JurisTypography>()!;
    final JurisBorders borders = theme.extension<JurisBorders>()!;
    final TextScaler textScaler = MediaQuery.textScalerOf(context);
    final TextDirection textDirection = Directionality.of(context);
    final Locale? locale = Localizations.maybeLocaleOf(context);
    final TextStyle titleStyle =
        theme.textTheme.titleMedium ?? const TextStyle();
    final TextStyle topicStyle = theme.textTheme.bodySmall ?? const TextStyle();
    // AnimatedContainer includes BoxDecoration.border dimensions in the
    // constraints it gives its child. Measure the uniform selected-state
    // maximum so every row also remains safe throughout border animations.
    final double maximumBorderInset = borders.focus + borders.emphasis;
    final double contentWidth = math.max(
      1,
      cardWidth - (2 * maximumBorderInset) - (2 * spacing.md),
    );
    final double markInnerWidth = math.max(
      1,
      contentWidth - (2 * spacing.md),
    );
    double maximum = baseExtent;

    for (int index = 0; index < widget.cases.length; index += 1) {
      final MobileCaseDefinition definition = widget.cases[index];
      final LocalizedCaseText text = definition.localized(
        widget.locale,
        widget.bundle.defaultLocale,
      );
      final Size positionSize = _measureText(
        chrome.casePosition(index + 1, widget.cases.length),
        typography.caseIndex,
        textScaler: textScaler,
        textDirection: textDirection,
        locale: locale,
        maxWidth: markInnerWidth,
      );
      final Size jurisdictionSize = _measureText(
        definition.jurisdiction,
        typography.metadata,
        textScaler: textScaler,
        textDirection: textDirection,
        locale: locale,
        maxWidth: math.min(180, markInnerWidth),
        maxLines: 1,
        ellipsis: '\u2026',
      );
      final double requiredMarkRunWidth = positionSize.width.ceilToDouble() +
          spacing.sm +
          jurisdictionSize.width.ceilToDouble();
      final double availableMarkRunWidth = math
          .max(
            0,
            markInnerWidth - _caseIndexMarkWrapRoundingAllowance,
          )
          .floorToDouble();
      final bool markWraps = requiredMarkRunWidth > availableMarkRunWidth;
      final double markTextHeight = markWraps
          ? positionSize.height + spacing.xs + jurisdictionSize.height
          : math.max(positionSize.height, jurisdictionSize.height);
      final double markHeight = (2 * spacing.sm) + markTextHeight;
      final Size titleSize = _measureText(
        text.shortTitle,
        titleStyle,
        textScaler: textScaler,
        textDirection: textDirection,
        locale: locale,
        maxWidth: contentWidth,
      );
      final Size topicSize = _measureText(
        text.topic,
        topicStyle,
        textScaler: textScaler,
        textDirection: textDirection,
        locale: locale,
        maxWidth: contentWidth,
      );
      final double measured = (2 * maximumBorderInset) +
          (2 * spacing.md) +
          markHeight +
          spacing.sm +
          titleSize.height +
          spacing.xs +
          topicSize.height;
      maximum = math.max(maximum, measured);
    }
    return maximum.ceilToDouble();
  }

  Size _measureText(
    String value,
    TextStyle style, {
    required TextScaler textScaler,
    required TextDirection textDirection,
    required Locale? locale,
    required double maxWidth,
    int? maxLines,
    String? ellipsis,
  }) {
    final TextPainter painter = TextPainter(
      text: TextSpan(text: value, style: style),
      textDirection: textDirection,
      textScaler: textScaler,
      locale: locale,
      maxLines: maxLines,
      ellipsis: ellipsis,
    )..layout(maxWidth: math.max(1, maxWidth));
    final Size size = painter.size;
    painter.dispose();
    return size;
  }

  void _reconcileFocusNodes() {
    final Set<String> activeIds =
        widget.cases.map((MobileCaseDefinition item) => item.caseId).toSet();
    final List<String> removed = _focusNodes.keys
        .where((String caseId) => !activeIds.contains(caseId))
        .toList(growable: false);
    for (final String caseId in removed) {
      _focusNodes.remove(caseId)?.dispose();
    }
    for (final String caseId in activeIds) {
      _focusNodes.putIfAbsent(
        caseId,
        () => FocusNode(debugLabel: 'case-index-$caseId'),
      );
    }
  }

  bool _sameCaseIds(
    List<MobileCaseDefinition> left,
    List<MobileCaseDefinition> right,
  ) {
    if (left.length != right.length) {
      return false;
    }
    for (int index = 0; index < left.length; index += 1) {
      if (left[index].caseId != right[index].caseId) {
        return false;
      }
    }
    return true;
  }
}

final class _BoundaryButton extends StatelessWidget {
  const _BoundaryButton({
    super.key,
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: IconButton.outlined(
        tooltip: label,
        onPressed: enabled ? onPressed : null,
        icon: Icon(icon),
        constraints: const BoxConstraints.tightFor(
          width: _minimumTargetExtent,
          height: _minimumTargetExtent,
        ),
      ),
    );
  }
}

final class _CaseIndexItem extends StatefulWidget {
  const _CaseIndexItem({
    required this.semanticsKey,
    required this.focusNode,
    required this.definition,
    required this.localizedText,
    required this.position,
    required this.selected,
    required this.compact,
    required this.itemExtent,
    required this.semanticsLabel,
    required this.onSelected,
  });

  final Key semanticsKey;
  final FocusNode focusNode;
  final MobileCaseDefinition definition;
  final LocalizedCaseText localizedText;
  final String position;
  final bool selected;
  final bool compact;
  final double itemExtent;
  final String semanticsLabel;
  final VoidCallback onSelected;

  @override
  State<_CaseIndexItem> createState() => _CaseIndexItemState();
}

final class _CaseIndexItemState extends State<_CaseIndexItem> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final JurisSpacing? spacing = theme.extension<JurisSpacing>();
    final JurisRadii? radii = theme.extension<JurisRadii>();
    final JurisBorders? borders = theme.extension<JurisBorders>();
    final JurisMotion motion = JurisMotionPolicy.of(context);
    if (spacing == null || radii == null || borders == null) {
      throw FlutterError(
        'Case index items require spacing, radii, and borders.',
      );
    }

    return SizedBox(
      height: widget.itemExtent,
      child: Semantics(
        key: widget.semanticsKey,
        button: true,
        selected: widget.selected,
        label: widget.semanticsLabel,
        onTap: widget.onSelected,
        child: ExcludeSemantics(
          child: FocusTraversalOrder(
            order: NumericFocusOrder(widget.definition.sortOrder.toDouble()),
            child: FocusableActionDetector(
              focusNode: widget.focusNode,
              mouseCursor: SystemMouseCursors.click,
              onFocusChange: (bool focused) {
                if (_focused != focused) {
                  setState(() => _focused = focused);
                }
              },
              shortcuts: const <ShortcutActivator, Intent>{
                SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
                SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
              },
              actions: <Type, Action<Intent>>{
                ActivateIntent: CallbackAction<ActivateIntent>(
                  onInvoke: (ActivateIntent intent) {
                    widget.onSelected();
                    return null;
                  },
                ),
              },
              child: JurisFocusOutline(
                focused: _focused,
                child: JurisMinimumTarget(
                  child: AnimatedContainer(
                    width: widget.compact ? null : _wideFallbackWidth,
                    duration: motion.selection,
                    curve: motion.selectionCurve,
                    decoration: BoxDecoration(
                      color: widget.selected
                          ? theme.colorScheme.surfaceContainerHigh
                          : theme.colorScheme.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(radii.medium),
                      border: Border.all(
                        color: widget.selected
                            ? theme.colorScheme.primary
                            : theme.colorScheme.outlineVariant,
                        width: widget.selected
                            ? borders.emphasis
                            : borders.standard,
                      ),
                    ),
                    child: InkWell(
                      canRequestFocus: false,
                      excludeFromSemantics: true,
                      borderRadius: BorderRadius.circular(radii.medium),
                      onTap: widget.onSelected,
                      child: Padding(
                        padding: EdgeInsets.all(spacing.md),
                        child: Column(
                          key: ValueKey<String>(
                            'case-index-content-${widget.definition.caseId}',
                          ),
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            CaseIndexMark(
                              key: ValueKey<String>(
                                'case-index-mark-${widget.definition.caseId}',
                              ),
                              indexLabel: widget.position,
                              fileReference: widget.definition.jurisdiction,
                              selected: widget.selected,
                              semanticLabel: widget.semanticsLabel,
                            ),
                            SizedBox(height: spacing.sm),
                            Text(
                              widget.localizedText.shortTitle,
                              key: ValueKey<String>(
                                'case-index-title-${widget.definition.caseId}',
                              ),
                              style: theme.textTheme.titleMedium,
                            ),
                            SizedBox(height: spacing.xs),
                            Text(
                              widget.localizedText.topic,
                              key: ValueKey<String>(
                                'case-index-topic-${widget.definition.caseId}',
                              ),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
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
          ),
        ),
      ),
    );
  }
}
