import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> _edges(dynamic value) => {
      'left': value.left,
      'top': value.top,
      'right': value.right,
      'bottom': value.bottom,
    };

/// Raw view metrics do not depend on an active route's inherited widgets.
/// Preserve invalid values; the collector handles JSON serialization only.
Map<String, Object?> captureViewGeometry(WidgetTester tester) {
  final view = tester.view;
  return {
    'device_pixel_ratio': view.devicePixelRatio,
    'physical_width': view.physicalSize.width,
    'physical_height': view.physicalSize.height,
    'view_insets': _edges(view.viewInsets),
    'view_padding': _edges(view.viewPadding),
  };
}

/// Inspect the actual Dialog elements, rather than the first AlertDialog's
/// possibly deactivated ancestor. Optional lookup failures must not erase raw
/// view metrics or the original framework exception.
Map<String, Object?> captureDialogGeometry(WidgetTester tester) {
  final List<Map<String, Object?>> dialogs = [];
  for (final Element element
      in find.byType(Dialog, skipOffstage: false).evaluate().take(4)) {
    final Dialog widget = element.widget as Dialog;
    final Map<String, Object?> metrics = {
      'mounted': element.mounted,
      if (widget.insetPadding != null)
        'widget_inset_padding': _edges(widget.insetPadding),
    };
    try {
      final MediaQueryData? media = MediaQuery.maybeOf(element);
      final EdgeInsets? themed = DialogTheme.of(element).insetPadding;
      // Flutter 3.44.8 Dialog.build's pinned fallback. This is labelled derived
      // diagnostic data, not a replacement value supplied to the application.
      const EdgeInsets fallback = EdgeInsets.symmetric(
        horizontal: 40,
        vertical: 24,
      );
      final EdgeInsets padding = widget.insetPadding ?? themed ?? fallback;
      metrics.addAll({
        if (themed != null) 'theme_inset_padding': _edges(themed),
        'padding_origin': widget.insetPadding != null
            ? 'widget'
            : themed != null
                ? 'theme'
                : 'flutter_3.44.8_default',
        'resolved_inset_padding': _edges(padding),
        if (media != null) ...{
          'dialog_view_insets': _edges(media.viewInsets),
          'dialog_view_padding': _edges(media.viewPadding),
          'derived_effective_padding': _edges(media.viewInsets + padding),
        },
      });
    } on Object catch (error) {
      metrics['lookup_error_type'] = '${error.runtimeType}';
    }
    dialogs.add(metrics);
  }
  final Map<String, Object?> result = {'dialogs': dialogs};
  try {
    result['focused_widget_type'] =
        '${FocusManager.instance.primaryFocus?.context?.widget.runtimeType}';
  } on Object catch (error) {
    result['focus_lookup_error_type'] = '${error.runtimeType}';
  }
  return result;
}
