import 'package:flutter/material.dart';

/// Overlay roles for readable content, modals, and cinematic case art.
@immutable
final class JurisScrims extends ThemeExtension<JurisScrims> {
  const JurisScrims({
    required this.content,
    required this.modal,
    required this.cinematic,
  });

  static const JurisScrims dark = JurisScrims(
    content: Color(0x9907111F),
    modal: Color(0xB807111F),
    cinematic: Color(0xD907111F),
  );

  final Color content;
  final Color modal;
  final Color cinematic;

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
