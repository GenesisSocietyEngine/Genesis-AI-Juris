import 'dart:convert';

import 'package:path_provider/path_provider.dart';

import 'aggregate_json_guard.dart';
import 'authoring_storage_backend.dart';
import 'studio_draft_store.dart';
import 'studio_workspace_codec.dart';
import 'tax_artifact_store.dart';
import 'tax_authoring_repository.dart';

/// Explicit matched storage. A legacy custom workspace alone never authorizes
/// writes to an implicit application-support tax store.
final class StudioAuthoringServices {
  StudioAuthoringServices._(
      this._directoryProvider, this.workspace, this.taxArtifacts);

  factory StudioAuthoringServices.applicationSupport({
    StudioDirectoryProvider? directoryProvider,
    ConditionalStudioDraftStore Function(ConditionalStudioDraftStore)?
        observeWorkspace,
  }) {
    final StudioDirectoryProvider provider =
        directoryProvider ?? getApplicationSupportDirectory;
    final ConditionalStudioDraftStore workspace =
        ApplicationSupportStudioDraftStore(directoryProvider: provider);
    return StudioAuthoringServices._(
        provider,
        observeWorkspace?.call(workspace) ?? workspace,
        TaxArtifactStore(directoryProvider: provider));
  }

  final StudioDirectoryProvider _directoryProvider;
  final ConditionalStudioDraftStore workspace;
  final TaxArtifactStore taxArtifacts;

  Future<StudioAggregateImportResult> importTaxWorkspace({
    required StudioWorkspaceSnapshot expectedWorkspace,
    required TaxArtifactSnapshot expectedTax,
    required String originalJson,
  }) async {
    // Caller strings are immutable; validate before encoding or any await.
    final Map<String, dynamic> imported = decodeAggregateJson(originalJson);
    if (!validTaxArtifact(imported)) {
      throw const FormatException(
          'Unsupported analysis workspace. Original input is unchanged.');
    }
    final String caseId = imported['case_id'] as String;
    if (StudioWorkspaceCodec.decodeScenario(imported['scenario']).caseId !=
            caseId ||
        expectedTax.caseId != caseId) {
      throw const FormatException('Analysis source identity mismatch.');
    }
    if (expectedTax.readOnlyError != null) throw expectedTax.readOnlyError!;
    final String previous =
        expectedTax.artifact?['artifact_revision'] as String? ?? '0';
    if (previous.length > 128 || !RegExp(r'^[0-9]+$').hasMatch(previous)) {
      throw const FormatException('Unsupported saved analysis revision.');
    }
    final BigInt previousRevision = BigInt.parse(previous);
    if (previousRevision >= BigInt.parse('18446744073709551615')) {
      throw const FormatException(
          'The saved analysis revision is exhausted or outside the supported range. Original input and saved work are unchanged.');
    }
    final String revision = (previousRevision + BigInt.one).toString();
    imported['artifact_revision'] = revision;
    imported['request']['context']['revision'] = revision;
    imported['calculation'] = null;
    final String workspaceAfter = jsonEncode({
      'schema_version': 1,
      'scenario': imported['scenario'],
      'active_stage': 'describe',
      'completed_stages': [],
    });
    final String taxAfter = jsonEncode(imported);
    try {
      final AuthoringImportCommit commit =
          await AuthoringStorageBackend.importPair(_directoryProvider,
              caseId: caseId,
              expectedWorkspaceTarget: expectedWorkspace.storageTarget,
              expectedWorkspaceSha256: expectedWorkspace.contentSha256,
              expectedTaxTarget: expectedTax.storageTarget,
              expectedTaxSha256: expectedTax.contentSha256,
              workspaceAfter: workspaceAfter,
              taxAfter: taxAfter,
              originalJson: originalJson);
      return StudioAggregateImportResult._(
          StudioWorkspaceSnapshot.fromImportCommit(commit),
          TaxArtifactSnapshot.fromImportCommit(commit),
          commit.completedPath);
    } on AuthoringRecoveryException catch (error) {
      throw StudioStorageException(code: error.code, message: error.message);
    }
  }
}

final class StudioAggregateImportResult {
  const StudioAggregateImportResult._(
      this.workspace, this.taxArtifact, this.retainedPackagePath);
  final StudioWorkspaceSnapshot workspace;
  final TaxArtifactSnapshot taxArtifact;
  final String retainedPackagePath;
}
