import 'package:flutter/material.dart';

import 'juris_motion.dart';

/// Resolves finite design motion against Flutter's accessibility signals.
abstract final class JurisMotionPolicy {
  static bool reducesMotion(MediaQueryData media) {
    return media.disableAnimations || media.accessibleNavigation;
  }

  static Duration resolveDuration(
    Duration intended,
    MediaQueryData media,
  ) {
    return reducesMotion(media) ? Duration.zero : intended;
  }

  static JurisMotion resolve({
    required JurisMotion motion,
    required MediaQueryData media,
  }) {
    if (!reducesMotion(media)) {
      return motion;
    }
    return motion.copyWith(
      immediate: Duration.zero,
      selection: Duration.zero,
      reveal: Duration.zero,
    );
  }

  static JurisMotion of(BuildContext context) {
    final JurisMotion? motion = Theme.of(context).extension<JurisMotion>();
    if (motion == null) {
      throw FlutterError('JurisMotion is not registered on the current theme.');
    }
    return resolve(
      motion: motion,
      media: MediaQuery.maybeOf(context) ?? const MediaQueryData(),
    );
  }
}
