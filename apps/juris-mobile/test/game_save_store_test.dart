import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/game_save_store.dart';

void main() {
  late Directory temporaryRoot;
  late ApplicationSupportGameSaveStore store;

  setUp(() async {
    temporaryRoot = await Directory.systemTemp.createTemp(
      'juris-save-store-test-',
    );
    store = ApplicationSupportGameSaveStore(
      directoryProvider: () async => temporaryRoot,
    );
  });

  tearDown(() async {
    if (await temporaryRoot.exists()) {
      await temporaryRoot.delete(recursive: true);
    }
  });

  test('writes, reads, and replaces one opaque scenario save', () async {
    expect(await store.exists('greenfire_first_72_hours'), isFalse);

    await store.write('greenfire_first_72_hours', '{"version":1}');
    expect(await store.exists('greenfire_first_72_hours'), isTrue);
    expect(
      await store.read('greenfire_first_72_hours'),
      '{"version":1}',
    );

    await store.write('greenfire_first_72_hours', '{"version":1,"step":2}');
    expect(
      await store.read('greenfire_first_72_hours'),
      '{"version":1,"step":2}',
    );
    final Directory saves = Directory(
      '${temporaryRoot.path}${Platform.pathSeparator}scenario_saves_v1',
    );
    expect(
      saves.listSync().whereType<File>().map((File file) => file.path).where(
          (String path) => path.endsWith('.tmp') || path.endsWith('.bak')),
      isEmpty,
    );
  });

  test('missing and invalid slots fail with controlled codes', () async {
    await expectLater(
      store.read('missing'),
      throwsA(
        isA<GameSaveStorageException>().having(
          (GameSaveStorageException error) => error.code,
          'code',
          'save_not_found',
        ),
      ),
    );
    await expectLater(
      store.write('../escape', '{}'),
      throwsA(
        isA<GameSaveStorageException>().having(
          (GameSaveStorageException error) => error.code,
          'code',
          'invalid_save_slot',
        ),
      ),
    );
  });
}
