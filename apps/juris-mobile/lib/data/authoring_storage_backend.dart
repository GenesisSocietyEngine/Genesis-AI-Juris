import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'aggregate_json_guard.dart';
import 'authoring_storage_coordinator.dart';
import 'studio_workspace_codec.dart';
import 'tax_authoring_repository.dart';

/// A verified immutable pair; construction is restricted to journal completion.
final class AuthoringImportCommit {
  const AuthoringImportCommit._(this.rootPath, this.transactionId, this.caseId,
      this.workspaceJson, this.taxJson, this.completedPath);
  final String rootPath,
      transactionId,
      caseId,
      workspaceJson,
      taxJson,
      completedPath;
}

final class AuthoringRecoveryException implements Exception {
  const AuthoringRecoveryException(this.message,
      {this.code = 'authoring_recovery_required'});
  final String message;
  final String code;
  @override
  String toString() => '$code: $message';
}

/// Shared authoritative gate. Exports of held snapshots intentionally use the
/// coordinator directly: preserving an export does not authorize target writes.
final class AuthoringStorageBackend {
  static Future<T> run<T>(Future<Directory> Function() directoryProvider,
          Future<T> Function(AuthoringStorageLease) action) =>
      AuthoringStorageCoordinator.run(directoryProvider, (lease) async {
        await _ImportJournal.recover(lease);
        return action(lease);
      });

  /// Internal service boundary; expected identities come from loaded snapshots.
  /// All caller text is frozen and validated before the provider is awaited.
  static Future<AuthoringImportCommit> importPair(
      Future<Directory> Function() directoryProvider,
      {required String caseId,
      required String expectedWorkspaceTarget,
      required String? expectedWorkspaceSha256,
      required String expectedTaxTarget,
      required String? expectedTaxSha256,
      required String workspaceAfter,
      required String taxAfter,
      required String originalJson}) {
    final _ImportInput input =
        _ImportInput(caseId, workspaceAfter, taxAfter, originalJson);
    input.validate();
    return AuthoringStorageCoordinator.run(directoryProvider, (lease) async {
      await _ImportJournal.recover(lease);
      return _ImportJournal.commit(lease, input, expectedWorkspaceTarget,
          expectedWorkspaceSha256, expectedTaxTarget, expectedTaxSha256);
    });
  }
}

final class _ImportInput {
  _ImportInput(this.caseId, String workspace, String tax, String original)
      : afterWorkspace = _freeze(workspace),
        afterTax = _freeze(tax),
        original = _freeze(original);
  static List<int> _freeze(String source) {
    // Validate caller text before UTF-8 encoding can replace a lone surrogate.
    decodeAggregateJson(source);
    return List<int>.unmodifiable(utf8.encode(source));
  }

  final String caseId;
  final List<int> afterWorkspace, afterTax, original;
  void validate() {
    _ImportJournal.caseIdentity(caseId);
    _ImportJournal.validatePair(caseId, afterWorkspace, afterTax, original);
  }
}

final class _ImportJournal {
  static const int payloadLimit = 4 * 1024 * 1024;
  static const int packageLimit = 64 * 1024 * 1024;
  static const List<String> roles = [
    'original',
    'workspace_before',
    'workspace_after',
    'tax_before',
    'tax_after'
  ];
  static const List<String> auxiliaries = [
    'workspace_bak',
    'workspace_tmp',
    'tax_bak',
    'tax_tmp'
  ];
  static const String schema = 'authoring-import-intent-v1';
  static final RegExp hex = RegExp(r'^[0-9a-f]{64}$');
  static final RegExp idPattern = RegExp(r'^[0-9a-f]{32}$');
  static int sequence = 0;

  static String digest(List<int> bytes) => sha256.convert(bytes).toString();
  static String identity(String path) =>
      Platform.isWindows ? path.toLowerCase() : path;
  static Never refuse(String reason,
          {String code = 'authoring_recovery_required'}) =>
      throw AuthoringRecoveryException(
          '$reason Existing workspace, analysis and transaction files are retained.',
          code: code);

  static void caseIdentity(String caseId) {
    if (caseId.isEmpty ||
        utf8.encode(caseId).length > 128 ||
        utf8.decode([0x20, ...utf8.encode(caseId)]).substring(1) != caseId ||
        caseId.contains('\u0000')) {
      throw const FormatException(
          'Aggregate case ID must contain 1–128 UTF-8 bytes and no NUL.');
    }
  }

  static Map<String, dynamic> object(List<int> bytes) {
    if (bytes.length > payloadLimit)
      throw const FormatException('Aggregate payload exceeds 4 MiB.');
    return decodeAggregateJson(utf8.decode(bytes));
  }

  static Map<String, dynamic> tax(List<int> bytes, String caseId) {
    final Map<String, dynamic> value = object(bytes);
    if (!validTaxArtifact(value) || value['case_id'] != caseId) {
      throw const FormatException(
          'Unsupported or wrong-case aggregate analysis.');
    }
    return value;
  }

  static Map<String, dynamic> workspace(List<int> bytes) {
    final Map<String, dynamic> value = object(bytes);
    StudioWorkspaceCodec.decode(utf8.decode(bytes));
    return value;
  }

  static void validatePair(String caseId, List<int> workspaceBytes,
      List<int> taxBytes, List<int> originalBytes) {
    final Map<String, dynamic> w = workspace(workspaceBytes);
    final Map<String, dynamic> t = tax(taxBytes, caseId);
    final Map<String, dynamic> original = tax(originalBytes, caseId);
    StudioWorkspaceCodec.decodeScenario(original['scenario']);
    if (w['active_stage'] != 'describe' ||
        w['completed_stages'] is! List ||
        (w['completed_stages'] as List).isNotEmpty ||
        !_equal(w['scenario'], original['scenario']) ||
        (w['scenario'] as Map)['metadata']['id'] != caseId) {
      throw const FormatException(
          'Imported workspace must preserve its source and restart at Describe.');
    }
    final String revision = t['artifact_revision'] as String;
    _revision(revision);
    original['artifact_revision'] = revision;
    original['request']['context']['revision'] = revision;
    original['calculation'] = null;
    if (!_equal(original, t)) {
      throw const FormatException(
          'Import changes retained source, context or original analysis fields.');
    }
  }

  static BigInt _revision(String value) {
    if (value.length > 128 || !RegExp(r'^[0-9]+$').hasMatch(value)) {
      throw const FormatException(
          'Aggregate revision must contain at most 128 decimal digits.');
    }
    final BigInt revision = BigInt.parse(value);
    if (revision > BigInt.parse('18446744073709551615')) {
      throw const FormatException(
          'Aggregate revision exceeds the native u64 range.');
    }
    return revision;
  }

  static bool _equal(dynamic left, dynamic right) {
    if (left is Map && right is Map) {
      return left.length == right.length &&
          left.keys.every(
              (key) => right.containsKey(key) && _equal(left[key], right[key]));
    }
    if (left is List && right is List) {
      return left.length == right.length &&
          List.generate(left.length, (i) => i)
              .every((i) => _equal(left[i], right[i]));
    }
    return left == right;
  }

  static Future<List<int>?> read(File file, {int limit = payloadLimit}) async {
    final FileSystemEntityType type =
        await FileSystemEntity.type(file.path, followLinks: false);
    if (type == FileSystemEntityType.notFound) return null;
    if (type != FileSystemEntityType.file)
      refuse('Non-regular authoring entry: ${file.path}.');
    if (await file.length() > limit)
      refuse('Authoring entry exceeds its bound: ${file.path}.');
    final List<int> bytes = await file.readAsBytes();
    if (bytes.length > limit)
      refuse('Authoring entry grew beyond its bound: ${file.path}.');
    return bytes;
  }

  static Map<String, Object>? descriptor(List<int>? bytes) =>
      bytes == null ? null : {'bytes': bytes.length, 'sha256': digest(bytes)};
  static bool matches(List<int>? bytes, dynamic expected) =>
      _equal(descriptor(bytes), expected);
  static void exactKeys(Map value, Iterable<String> keys) {
    if (value.length != keys.length ||
        keys.any((key) => !value.containsKey(key)))
      refuse('Unsupported transaction fields.');
  }

  static Future<Map<String, File>> files(
      AuthoringStorageLease lease, String caseId) async {
    final File w = await lease.file('guided_studio_v1', 'workspace.json');
    final File t = await lease.file(
        'tax_authoring_v1', '${digest(utf8.encode(caseId))}.json');
    return {
      'workspace': w,
      'tax': t,
      'workspace_bak': File('${w.path}.bak'),
      'workspace_tmp': File('${w.path}.tmp'),
      'tax_bak': File('${t.path}.bak'),
      'tax_tmp': File('${t.path}.tmp')
    };
  }

  static Future<Directory?> journalRoot(AuthoringStorageLease lease,
      {bool create = false}) async {
    final Directory folder = Directory('${lease.rootPath}/authoring_import_v1');
    final FileSystemEntityType type =
        await FileSystemEntity.type(folder.path, followLinks: false);
    if (type == FileSystemEntityType.notFound) {
      return create ? await folder.create() : null;
    }
    if (type != FileSystemEntityType.directory)
      refuse('The authoring transaction directory is not a regular directory.');
    return folder;
  }

  static Future<void> recover(AuthoringStorageLease lease) async {
    final Directory? root = await journalRoot(lease);
    if (root == null) return;
    Directory? pending;
    await for (final FileSystemEntity entry in root.list(followLinks: false)) {
      final String name =
          entry.uri.pathSegments.where((v) => v.isNotEmpty).last;
      if (!name.startsWith('pending-'))
        continue; // Staging/completed are inert.
      if (entry is! Directory ||
          !idPattern.hasMatch(name.substring(8)) ||
          pending != null) {
        refuse(
            'Invalid or multiple pending authoring transactions at ${root.path}.');
      }
      pending = entry;
    }
    if (pending != null) {
      try {
        await finish(lease, pending);
      } on AuthoringRecoveryException {
        rethrow;
      } on Object catch (error) {
        refuse(
            'Pending import could not be recovered at ${pending.path}: $error.');
      }
    }
  }

  static Future<void> packageBudget(Directory folder,
      {int extraBytes = 0, int extraFiles = 0}) async {
    int bytes = extraBytes, count = extraFiles;
    await for (final FileSystemEntity entry
        in folder.list(followLinks: false)) {
      if (entry is! File)
        refuse('Transaction contains a non-regular entry at ${entry.path}.');
      final String name = entry.uri.pathSegments.last;
      if (name != 'manifest.json' &&
          !roles.any((role) => name == '$role.json') &&
          !RegExp(r'^(?:retired-(?:tax|workspace)|promotion-(?:tax|workspace)(?:\.partial-[0-9]+)?)$')
              .hasMatch(name)) {
        refuse('Transaction contains an unsupported entry at ${entry.path}.');
      }
      final int length = await entry.length();
      if (length > (name == 'manifest.json' ? 64 * 1024 : payloadLimit))
        refuse('Transaction entry exceeds its bound at ${entry.path}.');
      count++;
      bytes += length;
      if (count > 32 || bytes > packageLimit)
        refuse(
            'Retained transaction exceeds its recovery bound at ${folder.path}.');
    }
  }

  static Future<void> writeVerified(File file, List<int> bytes) async {
    if (await FileSystemEntity.type(file.path, followLinks: false) !=
        FileSystemEntityType.notFound)
      refuse('Transaction file already exists: ${file.path}.');
    await packageBudget(file.parent, extraBytes: bytes.length, extraFiles: 1);
    await file.writeAsBytes(bytes, flush: true);
    if (!matches(await read(file), descriptor(bytes)))
      refuse('Transaction write verification failed: ${file.path}.');
  }

  static Future<void> validateAuxiliary(
      File file, List<int>? bytes, String caseId) async {
    if (bytes == null) return;
    Map<String, dynamic> parsed;
    try {
      parsed = object(bytes);
    } on FormatException {
      // Never bypass the resource/numeric guard with an unbounded second parse.
      // New aggregate import is conservative; ordinary per-file recovery keeps
      // its existing compatibility policy for malformed auxiliary generations.
      refuse('Unresolved auxiliary authoring data at ${file.path}.');
    }
    if (file.path.contains('guided_studio_v1')) {
      try {
        StudioWorkspaceCodec.decode(utf8.decode(bytes));
      } on UnsupportedStudioData {
        refuse('Future auxiliary workspace at ${file.path}.');
      } on FormatException {
        refuse('Unresolved auxiliary workspace at ${file.path}.');
      }
    } else if (!validTaxArtifact(parsed) || parsed['case_id'] != caseId) {
      refuse('Opaque or wrong-case auxiliary analysis at ${file.path}.');
    }
  }

  static Future<AuthoringImportCommit> commit(
      AuthoringStorageLease lease,
      _ImportInput input,
      String expectedW,
      String? hashW,
      String expectedT,
      String? hashT) async {
    final Map<String, File> targets = await files(lease, input.caseId);
    if (identity(targets['workspace']!.path) != identity(expectedW) ||
        identity(targets['tax']!.path) != identity(expectedT))
      refuse('Import snapshots belong to another storage root.',
          code: 'workspace_conflict');
    final List<int>? beforeW = await read(targets['workspace']!),
        beforeT = await read(targets['tax']!);
    if ((beforeW == null ? null : digest(beforeW)) != hashW ||
        (beforeT == null ? null : digest(beforeT)) != hashT)
      refuse('Another saved generation changed before import.',
          code: 'workspace_conflict');
    if (beforeW != null) workspace(beforeW);
    final Map<String, dynamic>? priorTax =
        beforeT == null ? null : tax(beforeT, input.caseId);
    final String revision =
        (_revision(priorTax?['artifact_revision'] as String? ?? '0') +
                BigInt.one)
            .toString();
    if (tax(input.afterTax, input.caseId)['artifact_revision'] != revision)
      refuse(
          'The import revision does not follow the observed saved generation.');
    final Map<String, dynamic> aux = {};
    for (final String role in auxiliaries) {
      final List<int>? bytes = await read(targets[role]!);
      await validateAuxiliary(targets[role]!, bytes, input.caseId);
      aux[role] = descriptor(bytes);
    }
    final Directory root = (await journalRoot(lease, create: true))!;
    final Random random = Random.secure();
    String id;
    Directory staging;
    do {
      id = List.generate(
              16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'))
          .join();
      staging = Directory('${root.path}/staging-$id');
    } while (await FileSystemEntity.type(staging.path, followLinks: false) !=
        FileSystemEntityType.notFound);
    await staging.create();
    final Map<String, List<int>?> payloads = {
      'original': input.original,
      'workspace_before': beforeW,
      'workspace_after': input.afterWorkspace,
      'tax_before': beforeT,
      'tax_after': input.afterTax
    };
    for (final String role in roles) {
      if (payloads[role] != null)
        await writeVerified(
            File('${staging.path}/$role.json'), payloads[role]!);
    }
    final Map<String, dynamic> manifest = {
      'schema': schema,
      'transaction_id': id,
      'case_id': input.caseId,
      'payloads': {
        for (final String role in roles) role: descriptor(payloads[role])
      },
      'auxiliary': aux
    };
    await writeVerified(File('${staging.path}/manifest.json'),
        utf8.encode(jsonEncode(manifest)));
    final Directory pending = await staging.rename('${root.path}/pending-$id');
    try {
      return await finish(lease, pending);
    } on AuthoringRecoveryException {
      rethrow;
    } on Object catch (error) {
      refuse(
          'Published import $id remains pending at ${pending.path}: $error.');
    }
  }

  static Future<AuthoringImportCommit> finish(
      AuthoringStorageLease lease, Directory pending) async {
    await packageBudget(pending);
    final List<int>? raw =
        await read(File('${pending.path}/manifest.json'), limit: 64 * 1024);
    if (raw == null) refuse('Pending transaction manifest is absent.');
    final Map<String, dynamic> manifest = object(raw);
    exactKeys(manifest,
        ['schema', 'transaction_id', 'case_id', 'payloads', 'auxiliary']);
    final String id = manifest['transaction_id'] as String,
        caseId = manifest['case_id'] as String;
    if (manifest['schema'] != schema ||
        !idPattern.hasMatch(id) ||
        pending.uri.pathSegments.where((part) => part.isNotEmpty).last !=
            'pending-$id') refuse('Unsupported pending transaction identity.');
    caseIdentity(caseId);
    final Map<String, dynamic> descriptors =
        manifest['payloads'] as Map<String, dynamic>;
    final Map<String, dynamic> aux =
        manifest['auxiliary'] as Map<String, dynamic>;
    exactKeys(descriptors, roles);
    exactKeys(aux, auxiliaries);
    final Map<String, List<int>?> payloads = {};
    for (final String role in roles) {
      final dynamic descriptor = descriptors[role];
      if (descriptor != null) {
        if (descriptor is! Map) refuse('Invalid payload descriptor.');
        exactKeys(descriptor, ['bytes', 'sha256']);
        if (descriptor['bytes'] is! int ||
            descriptor['bytes'] < 0 ||
            descriptor['bytes'] > payloadLimit ||
            descriptor['sha256'] is! String ||
            !hex.hasMatch(descriptor['sha256']))
          refuse('Invalid payload bounds/hash.');
      } else if (role != 'workspace_before' && role != 'tax_before') {
        refuse('Required transaction payload is absent.');
      }
      payloads[role] = await read(File('${pending.path}/$role.json'));
      if (!matches(payloads[role], descriptor))
        refuse('Immutable transaction payload changed: $role.');
    }
    validatePair(caseId, payloads['workspace_after']!, payloads['tax_after']!,
        payloads['original']!);
    if (payloads['workspace_before'] != null)
      workspace(payloads['workspace_before']!);
    final Map<String, dynamic>? beforeT = payloads['tax_before'] == null
        ? null
        : tax(payloads['tax_before']!, caseId);
    final String revision =
        (_revision(beforeT?['artifact_revision'] as String? ?? '0') +
                BigInt.one)
            .toString();
    if (tax(payloads['tax_after']!, caseId)['artifact_revision'] != revision)
      refuse(
          'Pending revision does not match its immutable before generation.');
    final Map<String, File> targets = await files(lease, caseId);
    // Complete preflight of both domains and every auxiliary before any mutation.
    for (final String role in auxiliaries) {
      final List<int>? bytes = await read(targets[role]!);
      if (!matches(bytes, aux[role]))
        refuse('Auxiliary generation changed during pending import: $role.');
      await validateAuxiliary(targets[role]!, bytes, caseId);
    }
    for (final String role in ['tax', 'workspace']) {
      await checkTarget(pending, role, targets[role]!,
          payloads['${role}_before'], payloads['${role}_after']!);
    }
    final String completed = '${pending.parent.path}/completed-$id';
    if (await FileSystemEntity.type(completed, followLinks: false) !=
        FileSystemEntityType.notFound)
      refuse('Completed transaction name already exists.');
    // Reserve conservative headroom for both domains before changing either.
    // Retiring a primary adds retained bytes; rebuilding a partial adds a copy.
    int extraBytes = 0, extraFiles = 0;
    for (final String role in ['tax', 'workspace']) {
      final List<int>? current = await read(targets[role]!);
      final List<int> after = payloads['${role}_after']!;
      if (matches(current, descriptor(after))) continue;
      final List<int>? promotion =
          await read(File('${pending.path}/promotion-$role'));
      if (!matches(promotion, descriptor(after))) {
        extraBytes += after.length;
        extraFiles++;
      }
      if (current != null) {
        extraBytes += current.length;
        extraFiles++;
      }
    }
    await packageBudget(pending,
        extraBytes: extraBytes, extraFiles: extraFiles);
    for (final String role in ['tax', 'workspace']) {
      await promote(pending, role, targets[role]!, payloads['${role}_before'],
          payloads['${role}_after']!);
    }
    for (final String role in ['tax', 'workspace']) {
      if (!matches(await read(targets[role]!), descriptors['${role}_after']))
        refuse('Completed target differs from transaction intent.');
    }
    await pending.rename(completed);
    return AuthoringImportCommit._(
        lease.rootPath,
        id,
        caseId,
        utf8.decode([0x20, ...payloads['workspace_after']!]).substring(1),
        utf8.decode([0x20, ...payloads['tax_after']!]).substring(1),
        completed);
  }

  static Future<void> checkTarget(Directory pending, String role, File target,
      List<int>? before, List<int> after) async {
    final List<int>? current = await read(target);
    final List<int>? retired =
        await read(File('${pending.path}/retired-$role'));
    await read(File('${pending.path}/promotion-$role'));
    if (retired != null &&
        (before == null || !matches(retired, descriptor(before))))
      refuse('Retired target conflicts with transaction intent: $role.');
    if (current != null &&
        retired != null &&
        !matches(current, descriptor(after)))
      refuse('Target and retired original coexist unexpectedly: $role.');
    if (current == null && before != null && retired == null)
      refuse(
          'Missing target has no transaction-owned retirement proof: $role.');
    if (current != null &&
        !matches(current, descriptor(before)) &&
        !matches(current, descriptor(after)))
      refuse('Another saved generation conflicts with pending import: $role.');
  }

  static Future<void> promote(Directory pending, String role, File target,
      List<int>? before, List<int> after) async {
    await checkTarget(pending, role, target, before, after);
    if (matches(await read(target), descriptor(after))) return;
    final File promotion = File('${pending.path}/promotion-$role');
    final List<int>? interrupted = await read(promotion);
    if (interrupted != null && !matches(interrupted, descriptor(after))) {
      File retained;
      do {
        retained =
            File('${pending.path}/promotion-$role.partial-${sequence++}');
      } while (await FileSystemEntity.type(retained.path, followLinks: false) !=
          FileSystemEntityType.notFound);
      await promotion.rename(retained.path);
    }
    if (!await promotion.exists()) await writeVerified(promotion, after);
    final List<int>? current = await read(target);
    if (current != null) {
      final File retired = File('${pending.path}/retired-$role');
      if (await FileSystemEntity.type(retired.path, followLinks: false) !=
          FileSystemEntityType.notFound)
        refuse('Target and retired original coexist unexpectedly: $role.');
      await target.rename(retired.path);
    }
    await promotion.rename(target.path);
    if (!matches(await read(target), descriptor(after)))
      refuse('Promoted target verification failed: $role.');
  }
}
