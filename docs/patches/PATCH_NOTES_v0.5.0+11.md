# Patch notes — v0.5.0+11

- adds an authoritative generic scenario runtime inside `juris-engine`;
- validates scenario content before session creation;
- returns immutable, serializable mobile snapshots;
- supports stable action dispatch, deterministic events, and explicit outcomes;
- isolates concurrent scenario sessions behind opaque session IDs;
- adds the transport-neutral `juris-mobile-bridge` JSON protocol;
- makes Flutter screens depend on a shared runtime repository contract;
- adds Dart builders and parsers for the bridge protocol;
- reports Logistics engine readiness separately from mobile transport readiness;
- keeps Logistics non-launchable until Android/iOS native transport exists.
