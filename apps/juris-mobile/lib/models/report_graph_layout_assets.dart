import 'dart:convert';

import 'package:flutter/services.dart';

import 'report_graph_layout.dart';

Future<ReportGraphLayoutEvaluator> loadReportGraphLayoutEvaluator({
  AssetBundle? bundle,
}) async {
  final AssetBundle assets = bundle ?? rootBundle;
  final String encoded = await assets.loadString(reportGraphFontMetricsAsset);
  return ReportGraphLayoutEvaluator(
    ReportGraphFontMetrics.fromJson(jsonDecode(encoded)),
  );
}
