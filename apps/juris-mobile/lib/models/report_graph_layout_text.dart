part of 'report_graph_layout.dart';

const int _nodePaddingX = 3500;
const int _nodePaddingY = 3500;
const int _badgeTitleGap = 1800;
const int _titleDetailGap = 2000;
const int _maxDetailVisualLines = (_maxGraphFrameHeight -
        _nodePaddingY * 2 -
        3000 -
        _badgeTitleGap -
        4000 -
        _titleDetailGap) ~/
    3300;

enum _FontKey { regular, medium }

extension on _FontKey {
  String get wireName => switch (this) {
        _FontKey.regular => 'regular',
        _FontKey.medium => 'medium',
      };
}

final class _TextStyle {
  const _TextStyle({
    required this.font,
    required this.lineHeight,
    required this.sizeMilliPoints,
  });

  final _FontKey font;
  final int lineHeight;
  final int sizeMilliPoints;

  Map<String, Object?> toJson(ReportGraphFontMetrics metrics) {
    final ReportGraphFont metricFont = switch (font) {
      _FontKey.regular => metrics.regular,
      _FontKey.medium => metrics.medium,
    };
    return <String, Object?>{
      'font': font.wireName,
      'inkLeft': _fontUnitsToMicrometres(
        metricFont.maximumInkLeft,
        metricFont,
        sizeMilliPoints,
      ),
      'inkRight': _fontUnitsToMicrometres(
        metricFont.maximumInkRight,
        metricFont,
        sizeMilliPoints,
      ),
      'lineHeight': lineHeight,
      'sizeMilliPoints': sizeMilliPoints,
    };
  }
}

const Map<String, _TextStyle> _typographyStyles = <String, _TextStyle>{
  'badge': _TextStyle(
    font: _FontKey.medium,
    lineHeight: 3000,
    sizeMilliPoints: 6800,
  ),
  'detail': _TextStyle(
    font: _FontKey.regular,
    lineHeight: 3300,
    sizeMilliPoints: 7200,
  ),
  'detailReference': _TextStyle(
    font: _FontKey.medium,
    lineHeight: 3200,
    sizeMilliPoints: 7000,
  ),
  'footer': _TextStyle(
    font: _FontKey.regular,
    lineHeight: 2800,
    sizeMilliPoints: 6200,
  ),
  'header': _TextStyle(
    font: _FontKey.medium,
    lineHeight: 3500,
    sizeMilliPoints: 7600,
  ),
  'title': _TextStyle(
    font: _FontKey.medium,
    lineHeight: 4000,
    sizeMilliPoints: 9000,
  ),
};

const Map<String, Map<String, String>> _nodeTypeLabels =
    <String, Map<String, String>>{
  'en': <String, String>{
    'actor': 'ACTOR',
    'cash_flow': 'CASH FLOW',
    'deadline': 'DEADLINE',
    'decision': 'DECISION',
    'entity': 'ENTITY',
    'evidence': 'EVIDENCE',
    'fact': 'FACT',
    'outcome': 'OUTCOME',
    'tax_rule': 'TAX RULE',
    'trigger': 'TRIGGER',
  },
  'ru': <String, String>{
    'actor': 'УЧАСТНИК',
    'cash_flow': 'ДЕНЕЖНЫЙ ПОТОК',
    'deadline': 'СРОК',
    'decision': 'РЕШЕНИЕ',
    'entity': 'ОРГАНИЗАЦИЯ',
    'evidence': 'ДОКАЗАТЕЛЬСТВО',
    'fact': 'ФАКТ',
    'outcome': 'РЕЗУЛЬТАТ',
    'tax_rule': 'НАЛОГОВАЯ НОРМА',
    'trigger': 'СОБЫТИЕ',
  },
};

final class _TextLine {
  const _TextLine({required this.text, required this.width});

  final String text;
  final int width;

  Map<String, Object?> toJson() => <String, Object?>{
        'text': text,
        'width': width,
      };
}

final class _MeasuredNode {
  _MeasuredNode({
    required this.fullHeight,
    required this.height,
    required this.id,
    required this.ref,
    required Map<String, Object?> text,
    required this.width,
  }) : text = _freezeMap(text);

  final int fullHeight;
  final int height;
  final String id;
  final String ref;
  final Map<String, Object?> text;
  final int width;
}

Map<String, Object?> _typographyJson(ReportGraphFontMetrics metrics) =>
    <String, Object?>{
      'advanceNormalization': metrics.advanceNormalization,
      'advanceSemantics': metrics.advanceSemantics,
      'fontFamily': 'Roboto',
      'fontMetricSchemaVersion': metrics.schemaVersion,
      'fontSourceHashes': <String, Object?>{
        'medium': metrics.medium.sourceSha256,
        'regular': metrics.regular.sourceSha256,
      },
      'graphemeBreak': <String, Object?>{
        'rules': <String>[
          'GB6',
          'GB7',
          'GB8',
          'Extend',
          'ZWJ',
          'Virama',
          'Regional_Indicator_pair',
        ],
        'scope': 'Governed-font deterministic subset; not a complete UAX #29 '
            'extended-grapheme implementation',
        'unicodeVersion': '17.0.0',
        'uax29Revision': 47,
      },
      'metricUnitsPerEm': metrics.unitPerEm,
      'styles': <String, Object?>{
        for (final MapEntry<String, _TextStyle> entry
            in _typographyStyles.entries)
          entry.key: entry.value.toJson(metrics),
      },
    };

int _fontUnitsToMicrometres(
  int fontUnits,
  ReportGraphFont font,
  int sizeMilliPoints,
) {
  final int numerator = fontUnits * sizeMilliPoints * 25400;
  final int denominator = font.unitsPerEm * 72000;
  return (numerator + denominator - 1) ~/ denominator;
}

int _textWidth(
  ReportGraphFontMetrics metrics,
  String text,
  _FontKey fontKey,
  int sizeMilliPoints, [
  bool includeInkOverhang = true,
]) {
  final ReportGraphFont font = switch (fontKey) {
    _FontKey.regular => metrics.regular,
    _FontKey.medium => metrics.medium,
  };
  int advance = 0;
  for (final int codePoint in text.runes) {
    advance += font.advanceFor(codePoint);
  }
  if (text.isNotEmpty && includeInkOverhang) {
    advance += font.maximumInkLeft + font.maximumInkRight;
  }
  return _fontUnitsToMicrometres(advance, font, sizeMilliPoints);
}

bool _isCombining(int codePoint) =>
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x0483 && codePoint <= 0x0489) ||
    (codePoint >= 0x0591 && codePoint <= 0x05bd) ||
    codePoint == 0x05bf ||
    (codePoint >= 0x05c1 && codePoint <= 0x05c2) ||
    (codePoint >= 0x0610 && codePoint <= 0x061a) ||
    (codePoint >= 0x064b && codePoint <= 0x065f) ||
    (codePoint >= 0x0900 && codePoint <= 0x0903) ||
    (codePoint >= 0x093a && codePoint <= 0x094f) ||
    (codePoint >= 0x0951 && codePoint <= 0x0957) ||
    (codePoint >= 0x0962 && codePoint <= 0x0963) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef);

const Set<int> _viramaCodePoints = <int>{
  0x094d,
  0x09cd,
  0x0a4d,
  0x0acd,
  0x0b4d,
  0x0bcd,
  0x0c4d,
  0x0ccd,
  0x0d3b,
  0x0d3c,
  0x0d4d,
  0x0dca,
  0x0e3a,
  0x0f84,
  0x1039,
  0x103a,
  0x1714,
  0x1734,
  0x17d2,
  0x1a60,
  0x1b44,
  0x1baa,
  0x1bab,
  0xa806,
  0xa8c4,
  0xa953,
  0xa9c0,
  0xaaf6,
  0xabed,
  0x10a3f,
  0x11046,
  0x11070,
  0x11133,
  0x111c0,
  0x11235,
  0x112ea,
  0x1134d,
  0x11442,
  0x114c2,
  0x115bf,
  0x1163f,
  0x116b6,
  0x1172b,
  0x11839,
  0x1193d,
  0x119e0,
  0x11a34,
  0x11a47,
  0x11a99,
  0x11c3f,
  0x11d44,
  0x11d45,
  0x11d97,
  0x11f41,
  0x11f42,
};

bool _isRegionalIndicator(int codePoint) =>
    codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;

List<String> _graphemeClusters(String text) {
  final List<String> clusters = <String>[];
  for (final int codePoint in text.runes) {
    final String scalar = String.fromCharCode(codePoint);
    final String previous = clusters.isEmpty ? '' : clusters.last;
    final List<int> previousScalars = previous.runes.toList(growable: false);
    final int previousCodePoint =
        previousScalars.isEmpty ? -1 : previousScalars.last;
    final bool regionalPair = _isRegionalIndicator(codePoint) &&
        previousScalars.length == 1 &&
        _isRegionalIndicator(previousCodePoint);
    if (clusters.isNotEmpty &&
        (_isCombining(codePoint) ||
            codePoint == 0x200c ||
            codePoint == 0x200d ||
            previousCodePoint == 0x200c ||
            previousCodePoint == 0x200d ||
            _viramaCodePoints.contains(previousCodePoint) ||
            regionalPair)) {
      clusters[clusters.length - 1] += scalar;
    } else {
      clusters.add(scalar);
    }
  }
  return clusters;
}

bool _isLayoutWhitespace(String cluster) => cluster.runes.every(
      (int codePoint) =>
          (codePoint >= 0x0009 && codePoint <= 0x000d) ||
          codePoint == 0x0020 ||
          codePoint == 0x0085 ||
          codePoint == 0x00a0 ||
          codePoint == 0x1680 ||
          (codePoint >= 0x2000 && codePoint <= 0x200a) ||
          codePoint == 0x2028 ||
          codePoint == 0x2029 ||
          codePoint == 0x202f ||
          codePoint == 0x205f ||
          codePoint == 0x3000,
    );

List<String> _splitLongToken(
  ReportGraphFontMetrics metrics,
  String token,
  int maximumWidth,
  _FontKey font,
  int sizeMilliPoints,
) {
  final List<String> pieces = <String>[];
  String current = '';
  for (final String cluster in _graphemeClusters(token)) {
    final String candidate = current + cluster;
    if (current.isNotEmpty &&
        _textWidth(metrics, candidate, font, sizeMilliPoints) > maximumWidth) {
      pieces.add(current);
      current = cluster;
    } else {
      current = candidate;
    }
    final int requiredWidth = _textWidth(
      metrics,
      current,
      font,
      sizeMilliPoints,
    );
    if (requiredWidth > maximumWidth) {
      _fail(
        ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
        'A Unicode grapheme cluster is wider than the available text box',
        <String, Object>{
          'availableWidth': maximumWidth,
          'requiredWidth': requiredWidth,
        },
      );
    }
  }
  if (current.isNotEmpty || pieces.isEmpty) {
    pieces.add(current);
  }
  return pieces;
}

List<_TextLine> _wrapParagraph(
  ReportGraphFontMetrics metrics,
  String paragraph,
  int maximumWidth,
  _FontKey font,
  int sizeMilliPoints,
) {
  final List<String> words = <String>[];
  String word = '';
  for (final String cluster in _graphemeClusters(paragraph)) {
    if (_isLayoutWhitespace(cluster)) {
      if (word.isNotEmpty) {
        words.add(word);
      }
      word = '';
    } else {
      word += cluster;
    }
  }
  if (word.isNotEmpty) {
    words.add(word);
  }
  if (words.isEmpty) {
    return const <_TextLine>[_TextLine(text: '', width: 0)];
  }

  final List<_TextLine> lines = <_TextLine>[];
  String current = '';
  for (final String item in words) {
    final String candidate = current.isNotEmpty ? '$current $item' : item;
    if (_textWidth(metrics, candidate, font, sizeMilliPoints) <= maximumWidth) {
      current = candidate;
      continue;
    }
    if (current.isNotEmpty) {
      lines.add(
        _TextLine(
          text: current,
          width: _textWidth(metrics, current, font, sizeMilliPoints),
        ),
      );
      current = '';
    }
    if (_textWidth(metrics, item, font, sizeMilliPoints) <= maximumWidth) {
      current = item;
    } else {
      final List<String> pieces = _splitLongToken(
        metrics,
        item,
        maximumWidth,
        font,
        sizeMilliPoints,
      );
      for (final String piece in pieces.take(pieces.length - 1)) {
        lines.add(
          _TextLine(
            text: piece,
            width: _textWidth(metrics, piece, font, sizeMilliPoints),
          ),
        );
      }
      current = pieces.last;
    }
  }
  if (current.isNotEmpty) {
    lines.add(
      _TextLine(
        text: current,
        width: _textWidth(metrics, current, font, sizeMilliPoints),
      ),
    );
  }
  return lines;
}

List<_TextLine> _wrapText(
  ReportGraphFontMetrics metrics,
  String text,
  int maximumWidth,
  _FontKey font,
  int sizeMilliPoints,
) {
  if (text.isEmpty) {
    return const <_TextLine>[];
  }
  return text
      .replaceAll(RegExp(r'\r\n?'), '\n')
      .split('\n')
      .expand(
        (String paragraph) => _wrapParagraph(
          metrics,
          paragraph,
          maximumWidth,
          font,
          sizeMilliPoints,
        ),
      )
      .toList(growable: false);
}

_MeasuredNode _measureNode(
  ReportGraphFontMetrics metrics,
  ReportGraphInputNode inputNode,
  String ref,
  String language,
  int width, [
  int? maximumHeight,
]) {
  final int contentWidth = width - _nodePaddingX * 2;
  final String badgeText =
      '$ref | ${_nodeTypeLabels[language]![inputNode.type]}';
  final _TextStyle badgeStyle = _typographyStyles['badge']!;
  final _TextLine badge = _TextLine(
    text: badgeText,
    width: _textWidth(
      metrics,
      badgeText,
      badgeStyle.font,
      badgeStyle.sizeMilliPoints,
    ),
  );
  if (badge.width > contentWidth) {
    _fail(
      ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
      'Node badge exceeds the available text box',
      <String, Object>{
        'availableWidth': contentWidth,
        'nodeId': inputNode.id,
        'requiredWidth': badge.width,
      },
    );
  }
  final _TextStyle titleStyle = _typographyStyles['title']!;
  final _TextStyle detailStyle = _typographyStyles['detail']!;
  final _TextStyle referenceStyle = _typographyStyles['detailReference']!;
  final List<_TextLine> titleLines = _wrapText(
    metrics,
    inputNode.title,
    contentWidth,
    titleStyle.font,
    titleStyle.sizeMilliPoints,
  );
  final List<_TextLine> allDetailLines = _wrapText(
    metrics,
    inputNode.detail,
    contentWidth,
    detailStyle.font,
    detailStyle.sizeMilliPoints,
  );
  final int fixedTextHeight = badgeStyle.lineHeight +
      _badgeTitleGap +
      titleLines.length * titleStyle.lineHeight +
      (allDetailLines.isEmpty ? 0 : _titleDetailGap);
  final int fullTextHeight =
      fixedTextHeight + allDetailLines.length * detailStyle.lineHeight;
  final int fullHeight = _nodePaddingY * 2 + fullTextHeight;
  final bool omitted = allDetailLines.isNotEmpty &&
      maximumHeight != null &&
      fullHeight > maximumHeight;
  final String? fullDetailReference = omitted ? 'Full detail: $ref' : null;
  final _TextLine? referenceLine = fullDetailReference == null
      ? null
      : _TextLine(
          text: fullDetailReference,
          width: _textWidth(
            metrics,
            fullDetailReference,
            referenceStyle.font,
            referenceStyle.sizeMilliPoints,
          ),
        );
  if (referenceLine != null && referenceLine.width > contentWidth) {
    _fail(
      ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
      'Full-detail reference exceeds the available text box',
      <String, Object>{
        'availableWidth': contentWidth,
        'nodeId': inputNode.id,
        'requiredWidth': referenceLine.width,
      },
    );
  }
  final int availableDetailHeight = omitted
      ? maximumHeight -
          _nodePaddingY * 2 -
          fixedTextHeight -
          referenceStyle.lineHeight
      : allDetailLines.length * detailStyle.lineHeight;
  final int displayedLineCount = omitted
      ? (availableDetailHeight ~/ detailStyle.lineHeight).clamp(
          0,
          allDetailLines.length,
        )
      : allDetailLines.length;
  final List<_TextLine> displayedLines =
      allDetailLines.take(displayedLineCount).toList(growable: false);
  final int detailVisualLineCount =
      displayedLines.length + (referenceLine == null ? 0 : 1);
  final int textHeight = badgeStyle.lineHeight +
      _badgeTitleGap +
      titleLines.length * titleStyle.lineHeight +
      (detailVisualLineCount == 0 ? 0 : _titleDetailGap) +
      displayedLines.length * detailStyle.lineHeight +
      (referenceLine == null ? 0 : referenceStyle.lineHeight);
  return _MeasuredNode(
    fullHeight: fullHeight,
    height: _nodePaddingY * 2 + textHeight,
    id: inputNode.id,
    ref: ref,
    text: <String, Object?>{
      'badge': badge.toJson(),
      'detail': <String, Object?>{
        'allLineCount': allDetailLines.length,
        'displayedLines': displayedLines
            .map((_TextLine line) => line.toJson())
            .toList(growable: false),
        'fullDetailReference': fullDetailReference,
        'fullText': inputNode.detail,
        'omitted': omitted,
        'referenceLine': referenceLine?.toJson(),
      },
      'textHeight': textHeight,
      'title': <String, Object?>{
        'fullText': inputNode.title,
        'lines': titleLines
            .map((_TextLine line) => line.toJson())
            .toList(growable: false),
      },
    },
    width: width,
  );
}
