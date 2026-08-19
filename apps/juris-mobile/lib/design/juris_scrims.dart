import 'package:flutter/material.dart';

import 'juris_visual_mode.dart';

/// Overlay roles for readable content, modals, and cinematic case art.
@immutable
final class JurisScrims extends ThemeExtension<JurisScrims> {
  const JurisScrims({
    required this.content,
    required this.modal,
    required this.cinematic,
  });

  static const JurisScrims office = JurisScrims(
    content: Color(0x8F17202B),
    modal: Color(0x9917202B),
    cinematic: Color(0xCC17202B),
  );

  static const JurisScrims afterHours = JurisScrims(
    content: Color(0x99091321),
    modal: Color(0xB8091321),
    cinematic: Color(0xD9091321),
  );

  /// Exact compatibility tokens for the accepted pre-pilot dark treatment.
  static const JurisScrims dark = JurisScrims(
    content: Color(0x9907111F),
    modal: Color(0xB807111F),
    cinematic: Color(0xD907111F),
  );

  final Color content;
  final Color modal;
  final Color cinematic;

  static JurisScrims forMode(JurisVisualMode mode) {
    return switch (mode) {
      JurisVisualMode.office => office,
      JurisVisualMode.afterHours => afterHours,
    };
  }

  @override
  JurisScrims copyWith({
    Color? content,
    Color? modal,
    Color? cinematic,
  }) {
    return JurisScrims(
      content: content ?? this.content,
      modal: modal ?? this.modal,
      cinematic: cinematic ?? this.cinematic,
    );
  }

  @override
  JurisScrims lerp(covariant JurisScrims? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisScrims(
      content: Color.lerp(content, other.content, t)!,
      modal: Color.lerp(modal, other.modal, t)!,
      cinematic: Color.lerp(cinematic, other.cinematic, t)!,
    );
  }
}
