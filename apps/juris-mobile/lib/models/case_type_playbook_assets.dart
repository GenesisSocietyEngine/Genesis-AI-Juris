import 'dart:convert';

import 'package:flutter/services.dart';

import 'case_type_playbook.dart';

Future<CaseTypePlaybookRegistry> loadCaseTypePlaybookRegistry({
  AssetBundle? bundle,
}) async {
  final String encoded =
      await (bundle ?? rootBundle).loadString(caseTypePlaybookAsset);
  return CaseTypePlaybookRegistry.fromJson(jsonDecode(encoded));
}
