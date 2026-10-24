// Shared only by acceptance instrumentation and its host driver, never product
// code. Historical v2 artifacts remain supported by the independent verifier.
const String taxApplicationReceiptSchema =
    'tax-mobile-application-acceptance-v3';
const String taxImportProbePolicy = 'cold-first-isolated-cancel-v1';

bool validTaxImportProbe(Map<String, dynamic> receipt, String phase) {
  if (receipt['schema'] != taxApplicationReceiptSchema ||
      receipt['import_probe_policy'] != taxImportProbePolicy) {
    return false;
  }
  if (phase == 'incomplete-read') {
    const Map<String, Object> expected = <String, Object>{
      'rounds': 3,
      'imports': 0,
      'calculations': 0,
      'workspace_writes': 0,
      'saved_workspace_unchanged': true,
      'saved_tax_unchanged': true,
    };
    final dynamic probe = receipt['cancel_probe'];
    if (probe is! Map<String, dynamic> || probe.length != expected.length) {
      return false;
    }
    for (final MapEntry<String, Object> entry in expected.entries) {
      if (probe[entry.key].runtimeType != entry.value.runtimeType ||
          probe[entry.key] != entry.value) {
        return false;
      }
    }
  } else if (receipt.containsKey('cancel_probe')) {
    return false;
  }
  if (phase == 'legacy-write') {
    return receipt['legacy_dialog_opens_before_import'] is int &&
        receipt['legacy_dialog_opens_before_import'] == 1;
  }
  return !receipt.containsKey('legacy_dialog_opens_before_import');
}
