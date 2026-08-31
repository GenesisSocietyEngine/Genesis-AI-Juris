import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/case_type_registry.dart';

void main() {
  test('Flutter registry exactly matches the versioned product contract', () {
    final Map<String, dynamic> root = jsonDecode(
      File('../../contracts/case-type-registry.v1.json').readAsStringSync(),
    ) as Map<String, dynamic>;
    final Map<String, dynamic> asset = jsonDecode(
      File('assets/case_types/case_type_registry.v1.json').readAsStringSync(),
    ) as Map<String, dynamic>;
    expect(asset, root);
    expect(root['format'], 'genesis-juris-case-type-registry');
    expect(root['schemaVersion'], 1);
    expect(root['registry'], caseTypeRegistryId);
    expect(caseTypeRegistrySignature(), root['types']);
  });

  test('case-type references reject unknown IDs and versions', () {
    expect(
      () => CaseTypeReference.fromJson(<String, dynamic>{
        'registry': caseTypeRegistryId,
        'id': 'unknown_type',
        'version': caseTypeVersion,
      }),
      throwsFormatException,
    );
    expect(
      () => CaseTypeReference.fromJson(<String, dynamic>{
        'registry': caseTypeRegistryId,
        'id': 'erp_incident',
        'version': '2.0.0',
      }),
      throwsFormatException,
    );
  });
}
