import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/juris_design.dart';
import '../../models/case_catalog.dart';
import '../../visual_identity/cinematic_catalogue_strings.dart';

/// Editorial case selector. Focus is navigation-only; activation selects.
final class CaseIndex extends StatelessWidget {
  const CaseIndex({
    super.key,
    required this.bundle,
    required this.locale,
    required this.cases,
    required this.selectedCaseId,
    required this.vertical,
    required this.onSelected,
  });

  final CaseCatalogBundle bundle;
  final String locale;
  final List<MobileCaseDefinition> cases;
  final String? selectedCaseId;
  final bool vertical;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final JurisSpacing? spacing = Theme.of(context).extension<JurisSpacing>();
    final JurisTypography? typography =
        Theme.of(context).extension<JurisTypography>();
    if (spacing == null || typography == null) {
      throw FlutterError('CaseIndex requires spacing and typography.');
    }
    final CinematicCatalogueStrings chrome =
        CinematicCatalogueStrings.of(locale);
    final List<Widget> items = List<Widget>.generate(cases.length, (int index) {
      final MobileCaseDefinition definition = cases[index];
      return _CaseIndexItem(
        semanticsKey: ValueKey<String>(
          'case-index-item-${definition.caseId}',
        ),
        definition: definition,
        localizedText: definition.localized(locale, bundle.defaultLocale),
        position: chrome.casePosition(index + 1, cases.length),
        selected: definition.caseId == selectedCaseId,
        semanticsLabel: chrome.selectCaseLabel(
          definition.localized(locale, bundle.defaultLocale).shortTitle,
        ),
        onSelected: () => onSelected(definition.caseId),
      );
    });

    return FocusTraversalGroup(
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
          if (vertical)
            ..._separate(items, SizedBox(height: spacing.sm))
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.only(bottom: spacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _separate(items, SizedBox(width: spacing.sm)),
              ),
            ),
        ],
      ),
    );
  }
}

List<Widget> _separate(List<Widget> items, Widget separator) {
  if (items.length < 2) {
    return items;
  }
  return <Widget>[
    for (int index = 0; index < items.length; index += 1) ...<Widget>[
      if (index > 0) separator,
      items[index],
    ],
  ];
}

final class _CaseIndexItem extends StatefulWidget {
  const _CaseIndexItem({
    required this.semanticsKey,
    required this.definition,
    required this.localizedText,
    required this.position,
    required this.selected,
    required this.semanticsLabel,
    required this.onSelected,
  });

  final Key semanticsKey;
  final MobileCaseDefinition definition;
  final LocalizedCaseText localizedText;
  final String position;
  final bool selected;
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
    final JurisMotion motion = JurisMotionPolicy.of(context);
    if (spacing == null || radii == null) {
      throw FlutterError('Case index items require spacing and radii.');
    }

    return Semantics(
      key: widget.semanticsKey,
      button: true,
      selected: widget.selected,
      label: widget.semanticsLabel,
      onTap: widget.onSelected,
      child: ExcludeSemantics(
        child: FocusTraversalOrder(
          order: NumericFocusOrder(widget.definition.sortOrder.toDouble()),
          child: FocusableActionDetector(
            mouseCursor: SystemMouseCursors.click,
            onFocusChange: (bool focused) {
              if (_focused != focused) {
                setState(() => _focused = focused);
              }
            },
            shortcuts: const <ShortcutActivator, Intent>{
              SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
              SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
              SingleActivator(LogicalKeyboardKey.arrowLeft):
                  DirectionalFocusIntent(TraversalDirection.left),
              SingleActivator(LogicalKeyboardKey.arrowRight):
                  DirectionalFocusIntent(TraversalDirection.right),
              SingleActivator(LogicalKeyboardKey.arrowUp):
                  DirectionalFocusIntent(TraversalDirection.up),
              SingleActivator(LogicalKeyboardKey.arrowDown):
                  DirectionalFocusIntent(TraversalDirection.down),
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
                  width: 248,
                  duration: motion.selection,
                  curve: motion.selectionCurve,
                  decoration: BoxDecoration(
                    color: widget.selected
                        ? theme.colorScheme.surfaceContainerHigh
                        : theme.colorScheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(radii.medium),
                  ),
                  child: InkWell(
                    canRequestFocus: false,
                    excludeFromSemantics: true,
                    borderRadius: BorderRadius.circular(radii.medium),
                    onTap: widget.onSelected,
                    child: Padding(
                      padding: EdgeInsets.all(spacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          CaseIndexMark(
                            indexLabel: widget.position,
                            fileReference: widget.definition.jurisdiction,
                            selected: widget.selected,
                            semanticLabel: widget.semanticsLabel,
                          ),
                          SizedBox(height: spacing.sm),
                          Text(
                            widget.localizedText.shortTitle,
                            style: theme.textTheme.titleMedium,
                          ),
                          SizedBox(height: spacing.xs),
                          Text(
                            widget.localizedText.topic,
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
    );
  }
}
