import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  if (args.length != 2 || args[0] != '--manifest' || !File(args[1]).existsSync()) {
    stderr.writeln('Git Bash native Dart argument conversion probe failed.');
    exitCode = 1;
    return;
  }
  stdout.writeln(jsonEncode({'manifestArgument': args[1], 'exists': true}));
}
