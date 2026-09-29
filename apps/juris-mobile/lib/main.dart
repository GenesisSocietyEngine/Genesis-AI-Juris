import 'package:flutter/material.dart';

import 'app/juris_app.dart';

/// Starts the mobile template catalogue.
///
/// The catalog and localized case metadata are generated from repository
/// content. Selecting the Failed ERP matter opens the current deterministic
/// demo runtime; additional validated scenarios can appear in Templates
/// without changing the case-selector UI.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const JurisApp.catalog());
}
