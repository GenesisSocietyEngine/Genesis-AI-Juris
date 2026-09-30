import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/scenario_bridge_client.dart';
import 'package:juris_mobile/data/tax_artifact_store.dart';
import 'package:juris_mobile/data/tax_authoring_repository.dart';
import 'support/tax_artifact_fixture.dart';

class OldBridge implements ScenarioBridgeClient {
  @override
  String execute(String request) =>
      '{"type":"error","code":"invalid_request","message":"old library"}';
}

void main() {
  test('exact signed units and invalid precision', () {
    expect(taxCents('250000'), '25000000');
    expect(taxAmount('25000000'), '250000.00');
    expect(taxCents('-0.01'), '-1');
    expect(() => taxCents('1.005'), throwsFormatException);
    expect(() => taxCents('1,25'), throwsFormatException);
    expect(TaxAuthoringRepository(OldBridge()).isSupported(), false);
  });
  test('disk roundtrip retains incomplete inputs, originals and unknown fields',
      () async {
    final Directory dir = await Directory.systemTemp.createTemp('tax-store-');
    addTearDown(() => dir.delete(recursive: true));
    TaxArtifactStore store() =>
        TaxArtifactStore(directoryProvider: () async => dir);
    final Map<String, dynamic> value = taxArtifactFixture();
    await store().write('case1', value);
    expect(await store().read('case1'), value);
    final Map<String, dynamic> newer = taxArtifactFixture('2');
    await store().write('case1', newer);
    final File target =
        (await Directory('${dir.path}/tax_authoring_v1').list().toList())
            .whereType<File>()
            .singleWhere((File f) => f.path.endsWith('.json'));
    await target
        .delete(); // Termination between moving old target and installing new one.
    expect(await store().read('case1'), value);
    await target.writeAsString(
        jsonEncode({...value, 'schema': 'tax-authoring-artifact-v99'}));
    await expectLater(
        store().write('case1', value),
        throwsA(isA<TaxStorageException>()
            .having((error) => error.code, 'code', 'tax_unsupported')));
    expect(jsonDecode(await target.readAsString())['schema'],
        'tax-authoring-artifact-v99');
  });
}
