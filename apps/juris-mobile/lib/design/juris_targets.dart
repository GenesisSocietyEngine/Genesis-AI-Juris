import 'package:flutter/material.dart';

/// Interactive sizing tokens shared by pointer, keyboard, and d-pad controls.
@immutable
final class JurisTargets extends ThemeExtension<JurisTargets> {
  const JurisTargets({required this.minimumInteractiveExtent});

  static const JurisTargets accessible = JurisTargets(
    minimumInteractiveExtent: 48,
  );

  final double minimumInteractiveExtent;

  Size get minimumInteractiveSize => Size.square(minimumInteractiveExtent);

  @override
  JurisTargets copyWith({double? minimumInteractiveExtent}) {
    return JurisTargets(
      minimumInteractiveExtent:
          minimumInteractiveExtent ?? this.minimumInteractiveExtent,
    );
  }

  @override
  JurisTargets lerp(covariant JurisTargets? other, double t) {
    if (other == null) {
      return this;
    }
    return JurisTargets(
      minimumInteractiveExtent: minimumInteractiveExtent +
          (other.minimumInteractiveExtent - minimumInteractiveExtent) * t,
    );
  }
}
