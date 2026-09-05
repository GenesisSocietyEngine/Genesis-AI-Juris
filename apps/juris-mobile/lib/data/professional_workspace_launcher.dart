import 'package:url_launcher/url_launcher.dart';

/// Private professional destinations that Flutter may hand to the trusted web
/// workspace.
///
/// The enum is intentionally closed. Callers cannot supply arbitrary URLs,
/// dossier identifiers, authentication material, or private case metadata.
enum ProfessionalWorkspaceDestination { myCases, account }

/// Browser handoff boundary for the authenticated professional workspace.
abstract interface class ProfessionalWorkspaceLauncher {
  Future<void> open(ProfessionalWorkspaceDestination destination);
}

typedef ProfessionalWorkspaceUriOpener = Future<bool> Function(Uri uri);

/// Opens only the two public entry routes on the production workspace origin.
///
/// Authentication and private dossier access remain in the platform browser.
/// Flutter neither receives nor persists cookies, tokens, or case records.
final class AllowlistedProfessionalWorkspaceLauncher
    implements ProfessionalWorkspaceLauncher {
  const AllowlistedProfessionalWorkspaceLauncher({
    ProfessionalWorkspaceUriOpener? opener,
  }) : _opener = opener;

  static final Uri myCasesUri = Uri.https(
    'studio.falcon-merlin.com',
    '/matters',
  );
  static final Uri accountUri = Uri.https(
    'studio.falcon-merlin.com',
    '/account',
  );

  final ProfessionalWorkspaceUriOpener? _opener;

  static Uri uriFor(ProfessionalWorkspaceDestination destination) {
    return switch (destination) {
      ProfessionalWorkspaceDestination.myCases => myCasesUri,
      ProfessionalWorkspaceDestination.account => accountUri,
    };
  }

  static bool isAllowed(Uri uri) {
    return uri.scheme == 'https' &&
        uri.host == 'studio.falcon-merlin.com' &&
        !uri.hasPort &&
        uri.userInfo.isEmpty &&
        !uri.hasQuery &&
        !uri.hasFragment &&
        (uri.path == '/matters' || uri.path == '/account');
  }

  @override
  Future<void> open(ProfessionalWorkspaceDestination destination) async {
    final Uri uri = uriFor(destination);
    if (!isAllowed(uri)) {
      throw ProfessionalWorkspaceLaunchException(
        destination: destination,
        message: 'The professional workspace destination is not allowlisted.',
      );
    }

    final ProfessionalWorkspaceUriOpener opener =
        _opener ?? _openInPlatformBrowser;
    try {
      if (!await opener(uri)) {
        throw ProfessionalWorkspaceLaunchException(
          destination: destination,
          message: 'The platform browser did not accept the destination.',
        );
      }
    } on ProfessionalWorkspaceLaunchException {
      rethrow;
    } on Object {
      throw ProfessionalWorkspaceLaunchException(
        destination: destination,
        message:
            'The platform browser could not open the professional workspace.',
      );
    }
  }

  static Future<bool> _openInPlatformBrowser(Uri uri) {
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

final class ProfessionalWorkspaceLaunchException implements Exception {
  const ProfessionalWorkspaceLaunchException({
    required this.destination,
    required this.message,
  });

  final ProfessionalWorkspaceDestination destination;
  final String message;

  @override
  String toString() => message;
}
