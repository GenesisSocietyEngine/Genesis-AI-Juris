import 'package:flutter/material.dart';

import 'app/juris_app.dart';
import 'data/demo_game_repository.dart';

/// Starts the v0.5 mobile shell with a deterministic local demonstration.
///
/// The Flutter UI does not yet call the Rust simulation. That integration is
/// deliberately reserved for v0.5.1, where a narrow snapshot/action bridge
/// will replace [DemoGameRepository] without changing the screen hierarchy.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(JurisApp(repository: DemoGameRepository(seed: 20260724)));
}
