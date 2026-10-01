import 'dart:async';
import 'dart:io';

import '../../test_driver/tax_driver_guard.dart';

Future<void> main(List<String> arguments) async {
  final File proof = File(arguments.single);
  // A live event source models an underlying driver request which timeout does
  // not cancel. The executable must exit after bounded failure cleanup.
  Timer.periodic(const Duration(seconds: 1), (_) {});
  try {
    await runTaxDriverPhase<void>(
      operation: () => Completer<void>().future,
      timeout: const Duration(milliseconds: 30),
      onFailure: (_, __) => Completer<void>().future,
      diagnosticsTimeout: const Duration(milliseconds: 30),
      close: () => Completer<void>().future,
      closeTimeout: const Duration(milliseconds: 30),
    );
    await proof.writeAsString('unexpected completed proof');
    stdout.writeln('All tests passed.');
    exit(0);
  } on TimeoutException {
    stderr.writeln('bounded phase timeout; no acceptance');
    exit(1);
  }
}
