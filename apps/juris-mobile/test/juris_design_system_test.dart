import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/app/app_theme.dart';
import 'package:juris_mobile/design/juris_design.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('dark theme preserves Material 3 roles and registers typed tokens', () {
    final ThemeData theme = JurisTheme.dark();

    expect(theme.useMaterial3, isTrue);
    expect(theme.brightness, Brightness.dark);
    expect(theme.colorScheme.primary, const Color(0xFFC7A35B));
    expect(theme.colorScheme.secondary, const Color(0xFF9FB7D1));
    expect(theme.colorScheme.surface, const Color(0xFF0B1726));
    expect(theme.scaffoldBackgroundColor, const Color(0xFF07111F));
    expect(theme.textTheme.bodyMedium?.fontFamily, JurisFontFamilies.plexSans);
    expect(theme.focusColor, JurisSurfaces.dark.focusRing);

    expect(theme.extension<JurisSurfaces>(), JurisSurfaces.dark);
    expect(theme.extension<JurisSpacing>(), JurisSpacing.standard);
    expect(theme.extension<JurisDensity>(), JurisDensity.standard);
    expect(theme.extension<JurisRadii>(), JurisRadii.standard);
    expect(theme.extension<JurisBorders>(), JurisBorders.standardWeights);
    expect(theme.extension<JurisScrims>(), JurisScrims.dark);
    expect(theme.extension<JurisMotion>(), JurisMotion.standard);
    expect(theme.extension<JurisTargets>(), JurisTargets.accessible);
    expect(theme.extension<JurisTypography>(), JurisTypography.standard);

    final Size? buttonMinimum =
        theme.filledButtonTheme.style?.minimumSize?.resolve(<WidgetState>{});
    expect(buttonMinimum, const Size.square(48));
  });

  test('projected clock resolves strict deterministic semantic modes', () {
    for (final String officeTime in <String>[
      '08:00',
      '08:01',
      '12:30',
      '17:59',
    ]) {
      expect(
        JurisVisualModeResolver.fromProjectedTimeLabel(officeTime),
        JurisVisualMode.office,
        reason: officeTime,
      );
    }
    for (final String? afterHoursTime in <String?>[
      null,
      '',
      '00:00',
      '07:59',
      '18:00',
      '23:59',
      '8:00',
      '08:0',
      '24:00',
      '12:60',
      ' 08:00',
      '08:00 ',
      '08.00',
      '٠٨:٠٠',
    ]) {
      expect(
        JurisVisualModeResolver.fromProjectedTimeLabel(afterHoursTime),
        JurisVisualMode.afterHours,
        reason: '$afterHoursTime',
      );
    }
    expect(
      JurisVisualModeResolver.resolve(
        selection: JurisVisualModeSelection.office,
        projectedTimeLabel: '23:59',
      ),
      JurisVisualMode.office,
    );
    expect(
      JurisVisualModeResolver.resolve(
        injectedMode: JurisVisualMode.afterHours,
        selection: JurisVisualModeSelection.office,
        projectedTimeLabel: '09:00',
      ),
      JurisVisualMode.afterHours,
    );
  });

  test('visual-mode controller notifies only for effective presentation', () {
    final JurisVisualModeController controller = JurisVisualModeController(
      projectedTimeLabel: '08:00',
    );
    int notifications = 0;
    controller.addListener(() => notifications += 1);

    expect(controller.selection, JurisVisualModeSelection.automatic);
    expect(controller.resolvedMode, JurisVisualMode.office);
    controller.updateProjectedTimeLabel('12:00');
    expect(notifications, 0);
    controller.updateProjectedTimeLabel('18:00');
    expect(controller.resolvedMode, JurisVisualMode.afterHours);
    expect(notifications, 1);

    controller.selection = JurisVisualModeSelection.office;
    expect(controller.resolvedMode, JurisVisualMode.office);
    expect(notifications, 2);
    controller.updateProjectedTimeLabel('09:00');
    expect(notifications, 2);
    controller.selection = JurisVisualModeSelection.afterHours;
    expect(controller.resolvedMode, JurisVisualMode.afterHours);
    expect(notifications, 3);
    controller.clearProjectedTime();
    expect(controller.projectedTimeLabel, isNull);
    expect(notifications, 3);
    controller.selection = JurisVisualModeSelection.automatic;
    expect(notifications, 4);
    controller.updateProjectedTimeLabel('09:00');
    expect(controller.resolvedMode, JurisVisualMode.office);
    expect(notifications, 5);
    controller.clearProjectedTime();
    expect(controller.resolvedMode, JurisVisualMode.afterHours);
    expect(notifications, 6);
    controller.dispose();

    final JurisVisualModeController fixed =
        JurisVisualModeController.fixed(JurisVisualMode.office);
    expect(fixed.selection, JurisVisualModeSelection.office);
    expect(fixed.resolvedMode, JurisVisualMode.office);
    fixed.dispose();
  });

  test('OFFICE and AFTER HOURS themes expose one semantic token model', () {
    final ThemeData office = JurisTheme.office();
    final ThemeData afterHours = JurisTheme.afterHours();
    final ThemeData highContrastOffice = JurisTheme.office(highContrast: true);

    expect(JurisTheme.office(), same(office));
    expect(JurisTheme.afterHours(), same(afterHours));
    expect(JurisTheme.office(highContrast: true), same(highContrastOffice));
    expect(office.brightness, Brightness.light);
    expect(office.scaffoldBackgroundColor, JurisSurfaces.office.canvas);
    expect(office.colorScheme.surface, JurisSurfaces.office.baseSurface);
    expect(office.colorScheme.onSurface, JurisSurfaces.office.ink);
    expect(office.colorScheme.error, JurisSurfaces.office.danger);
    expect(office.colorScheme.tertiary, JurisSurfaces.office.success);
    expect(
      office.focusColor,
      JurisSurfaces.office.focus.withValues(alpha: 0.12),
    );
    expect(office.extension<JurisSurfaces>(), same(JurisSurfaces.office));
    expect(office.extension<JurisScrims>(), same(JurisScrims.office));

    expect(afterHours.brightness, Brightness.dark);
    expect(
      afterHours.scaffoldBackgroundColor,
      JurisSurfaces.afterHours.canvas,
    );
    expect(
      afterHours.colorScheme.surface,
      JurisSurfaces.afterHours.baseSurface,
    );
    expect(afterHours.colorScheme.onSurface, JurisSurfaces.afterHours.ink);
    expect(afterHours.colorScheme.error, JurisSurfaces.afterHours.danger);
    expect(afterHours.colorScheme.tertiary, JurisSurfaces.afterHours.success);
    expect(
      afterHours.focusColor,
      JurisSurfaces.afterHours.focus.withValues(alpha: 0.12),
    );
    expect(
      afterHours.extension<JurisSurfaces>(),
      same(JurisSurfaces.afterHours),
    );
    expect(
      afterHours.extension<JurisScrims>(),
      same(JurisScrims.afterHours),
    );

    final JurisSurfaces highContrast =
        highContrastOffice.extension<JurisSurfaces>()!;
    expect(highContrast.brass, JurisSurfaces.office.highContrastBrass);
    expect(highContrast.cyan, JurisSurfaces.office.highContrastCyan);
    expect(highContrast.focus, JurisSurfaces.office.highContrastFocus);
    expect(highContrast.rule, JurisSurfaces.office.highContrastFocus);
    expect(highContrast.mutedInk, JurisSurfaces.office.highContrastInk);
    expect(
      highContrastOffice.focusColor,
      JurisSurfaces.office.highContrastFocus.withValues(alpha: 0.18),
    );
    final RoundedRectangleBorder highContrastCardShape =
        highContrastOffice.cardTheme.shape! as RoundedRectangleBorder;
    expect(highContrastCardShape.side.color.a, 1);
    expect(
      JurisContrast.meetsUiBoundary(
        highContrastCardShape.side.color,
        highContrastOffice.cardTheme.color!,
      ),
      isTrue,
    );
    expect(
      JurisTheme.forMode(JurisVisualMode.office).colorScheme.surface,
      office.colorScheme.surface,
    );
    expect(
      JurisTheme.forMode(JurisVisualMode.afterHours).colorScheme.surface,
      afterHours.colorScheme.surface,
    );
  });

  test('semantic type roles use only the four bundled font faces', () {
    const JurisTypography type = JurisTypography.standard;

    expect(
      <String?>[
        type.caseDisplay.fontFamily,
        type.screenDisplay.fontFamily,
        type.sectionTitle.fontFamily,
        type.documentTitle.fontFamily,
      ],
      everyElement(JurisFontFamilies.literata),
    );
    expect(
      <String?>[
        type.bodyReading.fontFamily,
        type.bodyCompact.fontFamily,
        type.controlLabel.fontFamily,
        type.caption.fontFamily,
      ],
      everyElement(JurisFontFamilies.plexSans),
    );
    expect(
      <String?>[
        type.caseIndex.fontFamily,
        type.metadata.fontFamily,
        type.timestamp.fontFamily,
        type.statusStamp.fontFamily,
      ],
      everyElement(JurisFontFamilies.plexMono),
    );
    expect(type.caseDisplay.fontWeight, FontWeight.w600);
    expect(type.screenDisplay.fontWeight, FontWeight.w600);
    expect(type.sectionTitle.fontWeight, FontWeight.w600);
    expect(type.documentTitle.fontWeight, FontWeight.w600);
    expect(type.bodyReading.fontWeight, FontWeight.w400);
    expect(type.bodyCompact.fontWeight, FontWeight.w400);
    expect(type.controlLabel.fontWeight, FontWeight.w600);
    expect(type.caseIndex.fontWeight, FontWeight.w500);
    expect(type.metadata.fontWeight, FontWeight.w500);
    expect(type.timestamp.fontWeight, FontWeight.w500);
    expect(type.statusStamp.fontWeight, FontWeight.w500);
    expect(type.caption.fontWeight, FontWeight.w400);
    expect(type.resolveCaseDisplay(wide: false).fontSize, 36);
    expect(type.resolveCaseDisplay(wide: true).fontSize, 48);
    expect(type.screenDisplay.fontSize, 32);
    expect(type.documentTitle.fontSize, 20);
  });

  test('layout, motion, and interaction values remain centralized', () {
    expect(JurisSpacing.standard.compactGutter, 16);
    expect(JurisSpacing.standard.wideGutter, 32);
    expect(
      JurisDensity.standard.resolve(JurisDensityMode.compact).contentInset,
      12,
    );
    expect(
      JurisDensity.standard.resolve(JurisDensityMode.compact).sectionRhythm,
      8,
    );
    expect(
      JurisDensity.standard.resolve(JurisDensityMode.comfortable).contentInset,
      16,
    );
    expect(
      JurisDensity.standard.resolve(JurisDensityMode.comfortable).sectionRhythm,
      12,
    );
    expect(JurisRadii.standard.panel, 20);
    expect(JurisBorders.standardWeights.focus, 2);
    expect(JurisTargets.accessible.minimumInteractiveExtent, 48);
    expect(JurisMotion.standard.immediate, const Duration(milliseconds: 120));
    expect(JurisMotion.standard.selection, const Duration(milliseconds: 220));
    expect(JurisMotion.standard.reveal, const Duration(milliseconds: 340));
    expect(JurisMotion.standard.immediateCurve, Curves.easeOutCubic);
    expect(JurisMotion.standard.selectionCurve, Curves.easeInOutCubic);
    expect(JurisMotion.standard.revealCurve, Curves.easeOutQuart);
  });

  test('typed extensions copy and interpolate every token family', () {
    final JurisSpacing spacing =
        JurisSpacing.standard.copyWith(xs: 12, wideGutter: 48);
    expect(spacing.xs, 12);
    expect(spacing.sm, JurisSpacing.standard.sm);
    expect(JurisSpacing.standard.lerp(spacing, 0.5).xs, 8);

    final JurisDensity density = JurisDensity.standard.copyWith(
      compact: JurisDensity.standard.compact.copyWith(contentInset: 16),
    );
    expect(density.compact.contentInset, 16);
    expect(density.comfortable, same(JurisDensity.standard.comfortable));
    expect(
      JurisDensity.standard.lerp(density, 0.5).compact.contentInset,
      14,
    );

    final JurisRadii radii = JurisRadii.standard.copyWith(panel: 28);
    expect(radii.panel, 28);
    expect(JurisRadii.standard.lerp(radii, 0.5).panel, 24);

    final JurisBorders borders =
        JurisBorders.standardWeights.copyWith(focus: 4);
    expect(borders.focus, 4);
    expect(JurisBorders.standardWeights.lerp(borders, 0.5).focus, 3);

    final JurisTargets targets =
        JurisTargets.accessible.copyWith(minimumInteractiveExtent: 56);
    expect(targets.minimumInteractiveSize, const Size.square(56));
    expect(
      JurisTargets.accessible.lerp(targets, 0.5).minimumInteractiveExtent,
      52,
    );

    final JurisMotion motion = JurisMotion.standard.copyWith(
      selection: const Duration(milliseconds: 320),
      selectionCurve: Curves.linear,
    );
    expect(motion.immediate, JurisMotion.standard.immediate);
    expect(motion.selectionCurve, Curves.linear);
    expect(
      JurisMotion.standard.lerp(motion, 0.5).selection,
      const Duration(milliseconds: 270),
    );
    expect(
      JurisMotion.standard.lerp(motion, 0.49).selectionCurve,
      Curves.easeInOutCubic,
    );
    expect(
      JurisMotion.standard.lerp(motion, 0.5).selectionCurve,
      Curves.linear,
    );

    final JurisScrims scrims =
        JurisScrims.dark.copyWith(content: const Color(0xFF000000));
    expect(scrims.modal, JurisScrims.dark.modal);
    expect(
      JurisScrims.dark.lerp(scrims, 0.5).content,
      Color.lerp(
        JurisScrims.dark.content,
        const Color(0xFF000000),
        0.5,
      ),
    );

    final JurisSurfaces surfaces =
        JurisSurfaces.dark.copyWith(overlayElevation: 10);
    expect(surfaces.brandGold, JurisSurfaces.dark.brandGold);
    expect(JurisSurfaces.dark.lerp(surfaces, 0.5).overlayElevation, 8);
    expect(JurisSurfaces.dark.brandGold, JurisSurfaces.dark.brass);
    expect(JurisSurfaces.dark.brandNavy, JurisSurfaces.dark.canvas);
    expect(JurisSurfaces.dark.circuitCyan, JurisSurfaces.dark.cyan);
    expect(
      JurisSurfaces.dark.evidenceNeutral,
      JurisSurfaces.dark.highContrastInk,
    );
    expect(
      JurisSurfaces.forMode(JurisVisualMode.office),
      same(JurisSurfaces.office),
    );
    expect(
      JurisSurfaces.forMode(JurisVisualMode.afterHours),
      same(JurisSurfaces.afterHours),
    );
    expect(
      JurisScrims.forMode(JurisVisualMode.office),
      same(JurisScrims.office),
    );

    final JurisTypography typography = JurisTypography.standard.copyWith(
      caption: JurisTypography.standard.caption.copyWith(fontSize: 14),
    );
    expect(typography.bodyReading, JurisTypography.standard.bodyReading);
    expect(
      JurisTypography.standard.lerp(typography, 0.5).caption.fontSize,
      13,
    );
  });

  test('bundled font assets contain the complete required EN and RU set',
      () async {
    const Map<String, int> fontAssets = <String, int>{
      'assets/fonts/Literata-SemiBold.ttf': 329068,
      'assets/fonts/IBMPlexSans-Regular.ttf': 200500,
      'assets/fonts/IBMPlexSans-SemiBold.ttf': 202632,
      'assets/fonts/IBMPlexMono-Medium.ttf': 174008,
    };
    final Set<int> requiredCodePoints = <int>{
      for (int codePoint = 0x20; codePoint <= 0x7e; codePoint += 1) codePoint,
      for (int codePoint = 0x410; codePoint <= 0x44f; codePoint += 1) codePoint,
      0x401,
      0x451,
      0x00a0,
      0x00ab,
      0x00bb,
      0x2018,
      0x2019,
      0x201c,
      0x201d,
      0x2013,
      0x2014,
      0x2022,
      0x2026,
      0x2116,
    };
    expect(requiredCodePoints, hasLength(173));

    for (final MapEntry<String, int> font in fontAssets.entries) {
      final ByteData data = await rootBundle.load(font.key);
      expect(data.lengthInBytes, font.value, reason: font.key);
      final List<int> missing = requiredCodePoints
          .where((int codePoint) => !_format4CmapContains(data, codePoint))
          .toList(growable: false);
      expect(missing, isEmpty, reason: '${font.key} misses $missing');
    }
  });

  testWidgets(
      'global type hierarchy renders representative English and Russian',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: JurisTheme.dark(),
        home: const Scaffold(
          body: Text('GENESIS case file — Дело № 17: Ёж и юрист'),
        ),
      ),
    );

    expect(
      find.text('GENESIS case file — Дело № 17: Ёж и юрист'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}

bool _format4CmapContains(ByteData font, int codePoint) {
  final int tableCount = font.getUint16(4, Endian.big);
  int? cmapOffset;
  for (int index = 0; index < tableCount; index += 1) {
    final int recordOffset = 12 + index * 16;
    final String tag = String.fromCharCodes(<int>[
      font.getUint8(recordOffset),
      font.getUint8(recordOffset + 1),
      font.getUint8(recordOffset + 2),
      font.getUint8(recordOffset + 3),
    ]);
    if (tag == 'cmap') {
      cmapOffset = font.getUint32(recordOffset + 8, Endian.big);
      break;
    }
  }
  if (cmapOffset == null) {
    return false;
  }

  final int encodingCount = font.getUint16(cmapOffset + 2, Endian.big);
  int? subtableOffset;
  for (int index = 0; index < encodingCount; index += 1) {
    final int recordOffset = cmapOffset + 4 + index * 8;
    final int candidate =
        cmapOffset + font.getUint32(recordOffset + 4, Endian.big);
    if (font.getUint16(candidate, Endian.big) == 4) {
      subtableOffset = candidate;
      break;
    }
  }
  if (subtableOffset == null) {
    return false;
  }

  final int subtableLength = font.getUint16(subtableOffset + 2, Endian.big);
  final int segmentCount = font.getUint16(subtableOffset + 6, Endian.big) ~/ 2;
  final int endCodesOffset = subtableOffset + 14;
  final int startCodesOffset = endCodesOffset + segmentCount * 2 + 2;
  final int deltasOffset = startCodesOffset + segmentCount * 2;
  final int rangeOffsetsOffset = deltasOffset + segmentCount * 2;

  for (int index = 0; index < segmentCount; index += 1) {
    final int endCode = font.getUint16(endCodesOffset + index * 2, Endian.big);
    final int startCode =
        font.getUint16(startCodesOffset + index * 2, Endian.big);
    if (codePoint < startCode || codePoint > endCode) {
      continue;
    }
    final int delta = font.getInt16(deltasOffset + index * 2, Endian.big);
    final int rangeEntryOffset = rangeOffsetsOffset + index * 2;
    final int rangeOffset = font.getUint16(rangeEntryOffset, Endian.big);
    if (rangeOffset == 0) {
      return ((codePoint + delta) & 0xffff) != 0;
    }
    final int glyphOffset =
        rangeEntryOffset + rangeOffset + (codePoint - startCode) * 2;
    if (glyphOffset + 2 > subtableOffset + subtableLength) {
      return false;
    }
    final int glyph = font.getUint16(glyphOffset, Endian.big);
    return glyph != 0 && ((glyph + delta) & 0xffff) != 0;
  }
  return false;
}
