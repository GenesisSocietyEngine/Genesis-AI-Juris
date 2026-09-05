import 'package:flutter/material.dart';

/// Stable product-level destinations shared by Templates, Studio, and Matter
/// surfaces. These are deliberately separate from local gameplay tabs.
enum JurisProductDestination {
  myCases,
  templates,
  studio,
  account,
  organizations,
}

@immutable
final class JurisProductNavigationController {
  const JurisProductNavigationController({
    required this.openMyCases,
    required this.openTemplates,
    required this.openStudio,
    required this.openAccount,
    this.openOrganizations,
  });

  final VoidCallback openMyCases;
  final VoidCallback openTemplates;
  final VoidCallback openStudio;
  final VoidCallback openAccount;
  final VoidCallback? openOrganizations;

  void open(JurisProductDestination destination) {
    switch (destination) {
      case JurisProductDestination.myCases:
        openMyCases();
      case JurisProductDestination.templates:
        openTemplates();
      case JurisProductDestination.studio:
        openStudio();
      case JurisProductDestination.account:
        openAccount();
      case JurisProductDestination.organizations:
        openOrganizations?.call();
    }
  }
}

/// Supplies one navigation controller to every production surface without
/// threading private-workspace concerns through scenario widgets.
final class JurisProductNavigationScope extends InheritedWidget {
  const JurisProductNavigationScope({
    required this.controller,
    required super.child,
    super.key,
  });

  final JurisProductNavigationController controller;

  static JurisProductNavigationController? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<JurisProductNavigationScope>()
        ?.controller;
  }

  @override
  bool updateShouldNotify(JurisProductNavigationScope oldWidget) {
    return controller != oldWidget.controller;
  }
}

/// Responsive, fully labelled primary product navigation.
///
/// Large windows show every destination directly. Compact and tablet layouts
/// retain the same destinations in one accessible popup menu.
final class ScopedJurisProductNavigation extends StatelessWidget {
  const ScopedJurisProductNavigation({
    required this.locale,
    this.current,
    super.key,
  });

  static const double wideBreakpoint = 1180;

  final String locale;
  final JurisProductDestination? current;

  bool get _russian => locale == 'ru';

  @override
  Widget build(BuildContext context) {
    final JurisProductNavigationController? controller =
        JurisProductNavigationScope.maybeOf(context);
    if (controller == null) {
      return const SizedBox.shrink();
    }

    final List<_ProductNavigationItem> items = <_ProductNavigationItem>[
      _ProductNavigationItem(
        destination: JurisProductDestination.myCases,
        label: _text('My cases', 'Мои дела'),
        icon: Icons.work_outline,
      ),
      _ProductNavigationItem(
        destination: JurisProductDestination.templates,
        label: _text('Templates', 'Шаблоны'),
        icon: Icons.library_books_outlined,
      ),
      _ProductNavigationItem(
        destination: JurisProductDestination.studio,
        label: _text('Studio', 'Студия'),
        icon: Icons.auto_awesome_outlined,
      ),
      _ProductNavigationItem(
        destination: JurisProductDestination.account,
        label: _text('Account', 'Аккаунт'),
        icon: Icons.account_circle_outlined,
      ),
      if (controller.openOrganizations != null)
        _ProductNavigationItem(
          destination: JurisProductDestination.organizations,
          label: _text('Organizations', 'Организации'),
          icon: Icons.groups_outlined,
        ),
    ];

    if (MediaQuery.sizeOf(context).width < wideBreakpoint) {
      return PopupMenuButton<JurisProductDestination>(
        key: const ValueKey<String>('product-navigation-menu'),
        tooltip: _text('Product navigation', 'Навигация по продукту'),
        initialValue: current,
        onSelected: controller.open,
        itemBuilder: (BuildContext context) => items
            .map(
              (_ProductNavigationItem item) =>
                  CheckedPopupMenuItem<JurisProductDestination>(
                key: ValueKey<String>(
                  'product-navigation-menu-${item.destination.name}',
                ),
                value: item.destination,
                checked: item.destination == current,
                child: Row(
                  children: <Widget>[
                    Icon(item.icon, size: 20),
                    const SizedBox(width: 10),
                    Text(item.label),
                  ],
                ),
              ),
            )
            .toList(growable: false),
        icon: Icon(
          Icons.menu,
          semanticLabel: _text('Product navigation', 'Навигация по продукту'),
        ),
      );
    }

    return Semantics(
      container: true,
      label: _text('Product navigation', 'Навигация по продукту'),
      child: Wrap(
        key: const ValueKey<String>('product-navigation-wide'),
        spacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: items
            .map(
              (_ProductNavigationItem item) => Semantics(
                button: true,
                selected: item.destination == current,
                label: item.label,
                onTap: () => controller.open(item.destination),
                child: ExcludeSemantics(
                  child: TextButton.icon(
                    key: ValueKey<String>(
                      'product-navigation-${item.destination.name}',
                    ),
                    onPressed: () => controller.open(item.destination),
                    style: item.destination == current
                        ? TextButton.styleFrom(
                            backgroundColor: Theme.of(
                              context,
                            ).colorScheme.secondaryContainer,
                            foregroundColor: Theme.of(
                              context,
                            ).colorScheme.onSecondaryContainer,
                          )
                        : null,
                    icon: Icon(item.icon, size: 19),
                    label: Text(item.label),
                  ),
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }

  String _text(String english, String russian) => _russian ? russian : english;
}

@immutable
final class _ProductNavigationItem {
  const _ProductNavigationItem({
    required this.destination,
    required this.label,
    required this.icon,
  });

  final JurisProductDestination destination;
  final String label;
  final IconData icon;
}
