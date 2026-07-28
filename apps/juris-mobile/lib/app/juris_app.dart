import 'package:flutter/material.dart';

import '../data/demo_game_repository.dart';
import 'app_theme.dart';
import 'home_shell.dart';

/// Root application widget.
///
/// The repository is injected instead of created inside a screen. This keeps
/// the presentation replaceable and enables widget tests to supply a fresh,
/// deterministic game session without global state.
class JurisApp extends StatelessWidget {
  const JurisApp({required this.repository, super.key});

  final DemoGameRepository repository;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'GENESIS: AI Juris',
      theme: JurisTheme.dark(),
      home: HomeShell(repository: repository),
    );
  }
}
