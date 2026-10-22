import 'package:flutter_test/flutter_test.dart';

import '../integration_test/support/tax_application_evidence.dart';

void main() {
  const Map<String, dynamic> base = <String, dynamic>{
    'schema': taxApplicationReceiptSchema,
    'import_probe_policy': taxImportProbePolicy,
  };
  const Map<String, dynamic> cancel = <String, dynamic>{
    'rounds': 3,
    'imports': 0,
    'calculations': 0,
    'workspace_writes': 0,
    'saved_workspace_unchanged': true,
    'saved_tax_unchanged': true,
  };

  test('application and driver use the same current receipt contract', () {
    expect(validTaxImportProbe(base, 'write'), isTrue);
    expect(validTaxImportProbe(base, 'read'), isTrue);
    expect(validTaxImportProbe(<String, dynamic>{
      ...base,
      'schema': 'tax-mobile-application-acceptance-v2',
    }, 'write'), isFalse);
  });

  test('cold Import and zero-write Cancel need distinct phase proofs', () {
    final Map<String, dynamic> cancelled = <String, dynamic>{
      ...base,
      'cancel_probe': cancel,
    };
    final Map<String, dynamic> cold = <String, dynamic>{
      ...base,
      'legacy_dialog_opens_before_import': 1,
    };
    expect(validTaxImportProbe(cancelled, 'incomplete-read'), isTrue);
    expect(validTaxImportProbe(cold, 'legacy-write'), isTrue);
    expect(validTaxImportProbe(cancelled, 'legacy-write'), isFalse);
    expect(validTaxImportProbe(cold, 'incomplete-read'), isFalse);
    expect(validTaxImportProbe(base, 'incomplete-read'), isFalse);
    expect(validTaxImportProbe(base, 'legacy-write'), isFalse);
    expect(validTaxImportProbe(<String, dynamic>{
      ...cold,
      'legacy_dialog_opens_before_import': true,
    }, 'legacy-write'), isFalse);
  });

  test('driver rejects mutated cancellation data and numeric coercion', () {
    for (final Map<String, dynamic> change in <Map<String, dynamic>>[
      <String, dynamic>{'workspace_writes': 1},
      <String, dynamic>{'imports': false},
      <String, dynamic>{'calculations': 0.0},
      <String, dynamic>{'saved_tax_unchanged': false},
      <String, dynamic>{'unverified': true},
    ]) {
      expect(validTaxImportProbe(<String, dynamic>{
        ...base,
        'cancel_probe': <String, dynamic>{...cancel, ...change},
      }, 'incomplete-read'), isFalse);
    }
  });
}
