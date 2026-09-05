import 'dart:convert';

import 'package:flutter/services.dart';

import 'case_type_playbook.dart';
import 'report_contract.dart';

Future<ReportContract> loadReportContract({AssetBundle? bundle}) async {
  final AssetBundle assets = bundle ?? rootBundle;
  final List<String> encoded = await Future.wait(<Future<String>>[
    assets.loadString(reportProfileAsset),
    assets.loadString(reportManifestAsset),
    assets.loadString(caseTypePlaybookAsset),
  ]);
  return ReportContract.fromJson(
    profileRegistry: jsonDecode(encoded[0]),
    manifest: jsonDecode(encoded[1]),
    playbookRegistry: jsonDecode(encoded[2]),
  );
}
