import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/professional_workspace_launcher.dart';

void main() {
  group('AllowlistedProfessionalWorkspaceLauncher', () {
    test('maps the closed destination enum to exact secure entry routes', () {
      expect(
        AllowlistedProfessionalWorkspaceLauncher.uriFor(
          ProfessionalWorkspaceDestination.myCases,
        ),
        Uri.parse('https://studio.falcon-merlin.com/matters'),
      );
      expect(
        AllowlistedProfessionalWorkspaceLauncher.uriFor(
          ProfessionalWorkspaceDestination.account,
        ),
        Uri.parse('https://studio.falcon-merlin.com/account'),
      );
      expect(
        AllowlistedProfessionalWorkspaceLauncher.uriFor(
          ProfessionalWorkspaceDestination.organizations,
        ),
        Uri.parse('https://studio.falcon-merlin.com/organizations'),
      );
    });

    test('accepts only the exact HTTPS origin and entry paths', () {
      expect(
        AllowlistedProfessionalWorkspaceLauncher.isAllowed(
          Uri.parse('https://studio.falcon-merlin.com/matters'),
        ),
        isTrue,
      );
      expect(
        AllowlistedProfessionalWorkspaceLauncher.isAllowed(
          Uri.parse('https://studio.falcon-merlin.com/account'),
        ),
        isTrue,
      );

      for (final String unsafe in <String>[
        'http://studio.falcon-merlin.com/matters',
        'https://studio.falcon-merlin.com.evil.test/matters',
        'https://studio.falcon-merlin.com:444/matters',
        'https://user@studio.falcon-merlin.com/matters',
        'https://studio.falcon-merlin.com/matters/',
        'https://studio.falcon-merlin.com/matters?source=mobile',
        'https://studio.falcon-merlin.com/matters?',
        'https://studio.falcon-merlin.com/matters#case',
        'https://studio.falcon-merlin.com/matters#',
        'https://studio.falcon-merlin.com/documents',
      ]) {
        expect(
          AllowlistedProfessionalWorkspaceLauncher.isAllowed(Uri.parse(unsafe)),
          isFalse,
          reason: unsafe,
        );
      }
    });

    test('passes no case data to the injected platform opener', () async {
      final List<Uri> opened = <Uri>[];
      final AllowlistedProfessionalWorkspaceLauncher launcher =
          AllowlistedProfessionalWorkspaceLauncher(
        opener: (Uri uri) async {
          opened.add(uri);
          return true;
        },
      );

      await launcher.open(ProfessionalWorkspaceDestination.myCases);
      await launcher.open(ProfessionalWorkspaceDestination.account);
      await launcher.open(ProfessionalWorkspaceDestination.organizations);

      expect(opened, <Uri>[
        Uri.parse('https://studio.falcon-merlin.com/matters'),
        Uri.parse('https://studio.falcon-merlin.com/account'),
        Uri.parse('https://studio.falcon-merlin.com/organizations'),
      ]);
      for (final Uri uri in opened) {
        expect(uri.hasQuery, isFalse);
        expect(uri.hasFragment, isFalse);
        expect(uri.userInfo, isEmpty);
      }
    });

    test('reports an explicit failure when the platform declines launch', () {
      final AllowlistedProfessionalWorkspaceLauncher launcher =
          AllowlistedProfessionalWorkspaceLauncher(opener: (_) async => false);

      expect(
        launcher.open(ProfessionalWorkspaceDestination.myCases),
        throwsA(
          isA<ProfessionalWorkspaceLaunchException>()
              .having(
                (ProfessionalWorkspaceLaunchException error) =>
                    error.destination,
                'destination',
                ProfessionalWorkspaceDestination.myCases,
              )
              .having(
                (ProfessionalWorkspaceLaunchException error) => error.message,
                'message',
                contains('did not accept'),
              ),
        ),
      );
    });

    test('wraps platform errors at the browser-handoff boundary', () {
      final AllowlistedProfessionalWorkspaceLauncher launcher =
          AllowlistedProfessionalWorkspaceLauncher(
        opener: (_) async => throw StateError('browser unavailable'),
      );

      expect(
        launcher.open(ProfessionalWorkspaceDestination.account),
        throwsA(
          isA<ProfessionalWorkspaceLaunchException>()
              .having(
                (ProfessionalWorkspaceLaunchException error) =>
                    error.destination,
                'destination',
                ProfessionalWorkspaceDestination.account,
              )
              .having(
                (ProfessionalWorkspaceLaunchException error) => error.message,
                'message',
                'The platform browser could not open the professional workspace.',
              ),
        ),
      );
    });
  });
}
