import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/home_shell.dart';
import 'package:juris_mobile/app/juris_app.dart';
import 'package:juris_mobile/app/product_navigation.dart';
import 'package:juris_mobile/data/case_catalog_repository.dart';
import 'package:juris_mobile/data/demo_game_repository.dart';
import 'package:juris_mobile/data/professional_workspace_launcher.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/studio_authoring_repository.dart';
import 'package:juris_mobile/data/studio_draft_store.dart';
import 'package:juris_mobile/models/case_type_playbook.dart';
import 'package:juris_mobile/models/case_type_playbook_assets.dart';
import 'package:juris_mobile/models/studio_scenario_draft.dart';
import 'package:juris_mobile/screens/case_catalog_screen.dart';
import 'package:juris_mobile/screens/studio_wizard_screen.dart';
import 'package:juris_mobile/visual_identity/case_visual_manifest_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late String generatedBundle;
  late String generatedManifest;
  late CaseTypePlaybookRegistry generatedPlaybooks;

  setUpAll(() async {
    generatedBundle = await rootBundle.loadString(
      'assets/case_catalog/mobile_case_bundle.json',
    );
    generatedManifest = await rootBundle.loadString(
      'assets/visual_identity/case_visual_manifest.v1.json',
    );
    generatedPlaybooks = await loadCaseTypePlaybookRegistry();
  });

  testWidgets('compact width keeps every labelled product destination', (
    WidgetTester tester,
  ) async {
    final List<JurisProductDestination> opened = <JurisProductDestination>[];
    await _pumpNavigation(tester, size: const Size(360, 720), opened: opened);

    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Product navigation'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('product-navigation-wide')),
      findsNothing,
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
    );
    await tester.pumpAndSettle();

    expect(find.text('My cases'), findsOneWidget);
    expect(find.text('Templates'), findsOneWidget);
    expect(find.text('Studio'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey<String>('product-navigation-menu-myCases')),
    );
    await tester.pumpAndSettle();
    expect(opened, <JurisProductDestination>[JurisProductDestination.myCases]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('tablet width retains the same separated destinations', (
    WidgetTester tester,
  ) async {
    final List<JurisProductDestination> opened = <JurisProductDestination>[];
    await _pumpNavigation(
      tester,
      size: const Size(800, 1000),
      locale: 'ru',
      opened: opened,
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Мои дела'), findsOneWidget);
    expect(find.text('Шаблоны'), findsOneWidget);
    expect(find.text('Студия'), findsOneWidget);
    expect(find.text('Аккаунт'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey<String>('product-navigation-menu-studio')),
    );
    await tester.pumpAndSettle();
    expect(opened, <JurisProductDestination>[JurisProductDestination.studio]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('desktop width exposes four direct labelled actions', (
    WidgetTester tester,
  ) async {
    final List<JurisProductDestination> opened = <JurisProductDestination>[];
    await _pumpNavigation(tester, size: const Size(1440, 900), opened: opened);

    expect(
      find.byKey(const ValueKey<String>('product-navigation-wide')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsNothing,
    );

    for (final JurisProductDestination destination
        in JurisProductDestination.values) {
      await tester.tap(
        find.byKey(ValueKey<String>('product-navigation-${destination.name}')),
      );
      await tester.pump();
    }

    expect(opened, JurisProductDestination.values);
    expect(find.bySemanticsLabel('My cases'), findsOneWidget);
    expect(find.bySemanticsLabel('Templates'), findsOneWidget);
    expect(find.bySemanticsLabel('Studio'), findsOneWidget);
    expect(find.bySemanticsLabel('Account'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('desktop navigation follows keyboard focus order and activates', (
    WidgetTester tester,
  ) async {
    final List<JurisProductDestination> opened = <JurisProductDestination>[];
    await _pumpNavigation(tester, size: const Size(1440, 900), opened: opened);

    for (final JurisProductDestination destination
        in JurisProductDestination.values) {
      final Finder target = find.byKey(
        ValueKey<String>('product-navigation-${destination.name}'),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(
        _primaryFocusIsWithin(target),
        isTrue,
        reason: '${destination.name} must follow the declared product order.',
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
    }

    expect(opened, JurisProductDestination.values);
    expect(tester.takeException(), isNull);
  });

  testWidgets('catalogue loading and error surfaces retain navigation', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final Completer<String> pendingBundle = Completer<String>();

    await tester.pumpWidget(
      JurisApp.catalog(
        key: UniqueKey(),
        catalogRepository: CaseCatalogRepository(
          assetLoader: (_) => pendingBundle.future,
        ),
        visualManifestRepository: CaseVisualManifestRepository(
          assetLoader: (_) async => generatedManifest,
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Product navigation'), findsOneWidget);

    await tester.pumpWidget(
      JurisApp.catalog(
        key: UniqueKey(),
        catalogRepository: CaseCatalogRepository(
          assetLoader: (_) async => throw StateError('test catalogue failure'),
        ),
        visualManifestRepository: CaseVisualManifestRepository(
          assetLoader: (_) async => generatedManifest,
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('The templates could not be loaded.'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Product navigation'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Studio loading and error surfaces retain navigation', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final Completer<StudioWorkspace?> pendingWorkspace =
        Completer<StudioWorkspace?>();

    await tester.pumpWidget(
      _productSurface(
        StudioWizardScreen(
          key: UniqueKey(),
          repository: StudioAuthoringRepository(_UnusedScenarioBridgeClient()),
          store: _PendingStudioDraftStore(pendingWorkspace.future),
          locale: 'en',
          onExit: () {},
          playbookRegistry: generatedPlaybooks,
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Product navigation'), findsOneWidget);

    await tester.pumpWidget(
      _productSurface(
        StudioWizardScreen(
          key: UniqueKey(),
          repository: StudioAuthoringRepository(_UnusedScenarioBridgeClient()),
          store: _EmptyStudioDraftStore(),
          locale: 'en',
          onExit: () {},
          playbookAssetBundle: _FailingAssetBundle(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(
      find.textContaining('previous Studio draft could not be reopened'),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Product navigation'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ready Russian Studio AppBar fits and navigates at 360px', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 800);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final List<JurisProductDestination> opened = <JurisProductDestination>[];

    await tester.pumpWidget(
      MaterialApp(
        home: JurisProductNavigationScope(
          controller: JurisProductNavigationController(
            openMyCases: () => opened.add(JurisProductDestination.myCases),
            openTemplates: () => opened.add(JurisProductDestination.templates),
            openStudio: () => opened.add(JurisProductDestination.studio),
            openAccount: () => opened.add(JurisProductDestination.account),
          ),
          child: StudioWizardScreen(
            repository: StudioAuthoringRepository(
              _UnusedScenarioBridgeClient(),
            ),
            store: _EmptyStudioDraftStore(),
            locale: 'ru',
            onExit: () {},
            playbookRegistry: generatedPlaybooks,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(
      find
          .byKey(const ValueKey<String>('product-navigation-menu'))
          .hitTestable(),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('studio-save-status')).hitTestable(),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);

    await _selectProductDestination(tester, JurisProductDestination.myCases);

    expect(opened, <JurisProductDestination>[JurisProductDestination.myCases]);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'production HomeShell AppBar fits with product navigation at 360px',
    (WidgetTester tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 800);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
      addTearDown(repository.dispose);

      await tester.pumpWidget(
        MaterialApp(
          home: JurisProductNavigationScope(
            controller: JurisProductNavigationController(
              openMyCases: () {},
              openTemplates: () {},
              openStudio: () {},
              openAccount: () {},
            ),
            child: HomeShell(
              repository: repository,
              locale: 'ru',
              onExitToCaseCatalog: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(HomeShell), findsOneWidget);
      expect(
        find
            .byKey(const ValueKey<String>('product-navigation-menu'))
            .hitTestable(),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('JurisApp hands off only My cases and Account', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    addTearDown(repository.dispose);
    final _RecordingWorkspaceLauncher launcher = _RecordingWorkspaceLauncher();

    await tester.pumpWidget(
      JurisApp(repository: repository, professionalWorkspaceLauncher: launcher),
    );

    await _selectProductDestination(tester, JurisProductDestination.myCases);
    expect(launcher.opened, <ProfessionalWorkspaceDestination>[
      ProfessionalWorkspaceDestination.myCases,
    ]);

    await _selectProductDestination(tester, JurisProductDestination.templates);
    expect(
      find.text('Templates are unavailable in this embedded mode.'),
      findsOneWidget,
    );
    expect(launcher.opened, hasLength(1));

    await _selectProductDestination(tester, JurisProductDestination.account);
    expect(launcher.opened, <ProfessionalWorkspaceDestination>[
      ProfessionalWorkspaceDestination.myCases,
      ProfessionalWorkspaceDestination.account,
    ]);
  });

  testWidgets('JurisApp presents browser-handoff failure explicitly', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    addTearDown(repository.dispose);
    final _RecordingWorkspaceLauncher launcher = _RecordingWorkspaceLauncher(
      failureMessage: 'The browser handoff failed safely.',
    );

    await tester.pumpWidget(
      JurisApp(repository: repository, professionalWorkspaceLauncher: launcher),
    );
    await _selectProductDestination(tester, JurisProductDestination.myCases);

    expect(find.text('The browser handoff failed safely.'), findsOneWidget);
  });

  testWidgets('JurisApp keeps external handoff above pushed routes', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final DemoGameRepository repository = DemoGameRepository(seed: 20260724);
    addTearDown(repository.dispose);
    final _RecordingWorkspaceLauncher launcher = _RecordingWorkspaceLauncher();

    await tester.pumpWidget(
      JurisApp(repository: repository, professionalWorkspaceLauncher: launcher),
    );
    final BuildContext homeContext = tester.element(find.byType(HomeShell));
    Navigator.of(homeContext).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(
            actions: const <Widget>[
              ScopedJurisProductNavigation(
                locale: 'en',
                current: JurisProductDestination.templates,
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey<String>('product-navigation-menu')),
      findsOneWidget,
    );
    await _selectProductDestination(tester, JurisProductDestination.account);
    expect(launcher.opened, <ProfessionalWorkspaceDestination>[
      ProfessionalWorkspaceDestination.account,
    ]);
  });

  testWidgets('JurisApp internal destinations dismiss pushed routes', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      JurisApp.catalog(
        catalogRepository: CaseCatalogRepository(
          assetLoader: (_) async => generatedBundle,
        ),
        visualManifestRepository: CaseVisualManifestRepository(
          assetLoader: (_) async => generatedManifest,
        ),
        scenarioBridgeClient: _UnusedScenarioBridgeClient(),
        studioDraftStore: _EmptyStudioDraftStore(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(CaseCatalogScreen), findsOneWidget);

    await _pushProductRoute(
      tester,
      tester.element(find.byType(CaseCatalogScreen)),
      current: JurisProductDestination.templates,
    );
    await _selectProductDestinationWithFinitePumps(
      tester,
      JurisProductDestination.studio,
    );

    expect(find.byType(StudioWizardScreen).hitTestable(), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('pushed-product-route')).hitTestable(),
      findsNothing,
    );

    await _pushProductRoute(
      tester,
      tester.element(find.byType(StudioWizardScreen)),
      current: JurisProductDestination.studio,
    );
    await _selectProductDestinationWithFinitePumps(
      tester,
      JurisProductDestination.templates,
    );

    expect(
      find.byKey(const ValueKey<String>('pushed-product-route')).hitTestable(),
      findsNothing,
    );
    expect(find.byType(StudioWizardScreen), findsNothing);
    expect(find.byType(CaseCatalogScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _productSurface(Widget child) {
  return MaterialApp(
    home: JurisProductNavigationScope(
      controller: JurisProductNavigationController(
        openMyCases: () {},
        openTemplates: () {},
        openStudio: () {},
        openAccount: () {},
      ),
      child: child,
    ),
  );
}

Future<void> _pumpNavigation(
  WidgetTester tester, {
  required Size size,
  required List<JurisProductDestination> opened,
  String locale = 'en',
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(
    MaterialApp(
      home: JurisProductNavigationScope(
        controller: JurisProductNavigationController(
          openMyCases: () => opened.add(JurisProductDestination.myCases),
          openTemplates: () => opened.add(JurisProductDestination.templates),
          openStudio: () => opened.add(JurisProductDestination.studio),
          openAccount: () => opened.add(JurisProductDestination.account),
        ),
        child: Scaffold(
          appBar: AppBar(
            actions: <Widget>[
              ScopedJurisProductNavigation(
                locale: locale,
                current: JurisProductDestination.templates,
              ),
            ],
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Future<void> _selectProductDestination(
  WidgetTester tester,
  JurisProductDestination destination,
) async {
  await tester.tap(
    find.byKey(const ValueKey<String>('product-navigation-menu')),
  );
  await tester.pumpAndSettle();
  await tester.tap(
    find.byKey(ValueKey<String>('product-navigation-menu-${destination.name}')),
  );
  await tester.pumpAndSettle();
}

Future<void> _selectProductDestinationWithFinitePumps(
  WidgetTester tester,
  JurisProductDestination destination,
) async {
  await tester.tap(
    find.byKey(const ValueKey<String>('product-navigation-menu')).hitTestable(),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(
    find.byKey(ValueKey<String>('product-navigation-menu-${destination.name}')),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump();
}

Future<void> _pushProductRoute(
  WidgetTester tester,
  BuildContext context, {
  required JurisProductDestination current,
}) async {
  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => Scaffold(
        key: const ValueKey<String>('pushed-product-route'),
        appBar: AppBar(
          actions: <Widget>[
            ScopedJurisProductNavigation(locale: 'en', current: current),
          ],
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  expect(
    find.byKey(const ValueKey<String>('pushed-product-route')),
    findsOneWidget,
  );
}

bool _primaryFocusIsWithin(Finder target) {
  final Element targetElement = target.evaluate().single;
  final BuildContext? focusContext =
      FocusManager.instance.primaryFocus?.context;
  if (focusContext == null) {
    return false;
  }
  if (identical(focusContext, targetElement)) {
    return true;
  }
  var found = false;
  focusContext.visitAncestorElements((Element ancestor) {
    if (identical(ancestor, targetElement)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

final class _RecordingWorkspaceLauncher
    implements ProfessionalWorkspaceLauncher {
  _RecordingWorkspaceLauncher({this.failureMessage});

  final String? failureMessage;
  final List<ProfessionalWorkspaceDestination> opened =
      <ProfessionalWorkspaceDestination>[];

  @override
  Future<void> open(ProfessionalWorkspaceDestination destination) async {
    final String? message = failureMessage;
    if (message != null) {
      throw ProfessionalWorkspaceLaunchException(
        destination: destination,
        message: message,
      );
    }
    opened.add(destination);
  }
}

final class _EmptyStudioDraftStore implements StudioDraftStore {
  @override
  Future<String> exportScenario(StudioScenarioDraft draft) async {
    return 'unused.scenario.json';
  }

  @override
  Future<StudioWorkspace?> read() async => null;

  @override
  Future<void> write(StudioWorkspace workspace) async {}
}

final class _PendingStudioDraftStore implements StudioDraftStore {
  const _PendingStudioDraftStore(this._workspace);

  final Future<StudioWorkspace?> _workspace;

  @override
  Future<String> exportScenario(StudioScenarioDraft draft) async {
    return 'unused.scenario.json';
  }

  @override
  Future<StudioWorkspace?> read() => _workspace;

  @override
  Future<void> write(StudioWorkspace workspace) async {}
}

final class _UnusedScenarioBridgeClient implements ScenarioBridgeClient {
  @override
  String execute(String encodedRequest) {
    throw StateError('The route-navigation test must not invoke native FFI.');
  }
}

final class _FailingAssetBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) {
    return Future<ByteData>.error(StateError('test playbook failure'));
  }
}
