# Visual Identity Golden Baselines

These PNGs are review artifacts for the presentation-only visual foundation.
They do not encode case authority, gameplay state, scenario content, or runtime
outcomes.

## Canonical profile

The committed foundation baselines were generated on 2026-08-10 with:

- host: Microsoft Windows `10.0.22631`, x64;
- PowerShell: `5.1.22621.4391`;
- Flutter stable: `3.44.8`;
- Flutter framework revision:
  `058e0af2c2b57e369d905a03ac9748b0ebf543c6`;
- Dart: `3.12.2`;
- Flutter engine revision:
  `0cd610717bde95fd88343c64f81c11ba4e5c0010`;
- engine content hash: `13ffd72b2f9a5ca4db2a74ea52d5353ec2e8f939`;
- exact bundled Literata and IBM Plex font files registered in `pubspec.yaml`;
- dark theme, Windows target platform, device-pixel ratio `1.0`, and the
  locale, viewport, text scale, high-contrast, and reduced-motion state encoded
  in each filename;
- Flutter's automated test binding with shadows disabled.

Flutter documents that custom-font goldens can differ across operating systems
and Flutter versions. The default `LocalFileComparator` remains unchanged and
performs an exact decoded-pixel comparison. No tolerance is permitted. These
Windows PNGs are not treated as Linux or macOS evidence, and the pixel tests
report an explicit skip on non-Windows hosts. Cross-host structural tests still
run normally.

## Baseline contract

The profile directory contains exactly six PNGs:

1. English semantic typography and representative controls;
2. long representative Russian typography;
3. all six generic motifs at identical geometry and seed;
4. the standard accessibility probe at a controlled 110 ms frame;
5. the same probe in high contrast;
6. the same probe with reduced motion, which resolves immediately.

## Compare

From `apps/juris-mobile`, run:

```powershell
flutter test test\visual_identity_foundation_golden_test.dart
```

Or use the guarded verifier, which also prints exact sizes and SHA-256 hashes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tool\verify_visual_goldens_windows.ps1
```

## Regenerate and prove repeatability

Do not invoke `--update-goldens` casually. The guarded command rejects any host
or Flutter/Dart/engine identity other than the canonical profile. It starts two
separate test processes, requires the exact six-file path set after each run,
and compares every PNG's byte length and SHA-256 hash. A mismatch is a stop; the
first-run PNGs are preserved in the reported temporary directory.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tool\verify_visual_goldens_windows.ps1 -Regenerate
```

Byte-identical repeat generation is necessary but not sufficient. Inspect all
six images before staging them. A changed baseline needs an explained visual
review; never hide instability with a permissive comparator.

## Inspect images and failures

Codex should open each baseline with the local image viewer. On Windows, file
identities can be listed without another dependency:

```powershell
Get-ChildItem .\test\goldens\visual_identity\foundation -Recurse -Filter *.png |
  Sort-Object FullName |
  Select-Object FullName, Length,
    @{Name='SHA256';Expression={(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}
```

To list pixel dimensions using the Windows runtime:

```powershell
Add-Type -AssemblyName System.Drawing
Get-ChildItem .\test\goldens\visual_identity\foundation -Recurse -Filter *.png | ForEach-Object {
  $visualImage = [System.Drawing.Image]::FromFile($_.FullName)
  try { "$($_.Name)`t$($visualImage.Width)x$($visualImage.Height)`t$($_.Length)" }
  finally { $visualImage.Dispose() }
}
```

On a comparison failure, Flutter writes `masterImage`, `testImage`,
`isolatedDiff`, and `maskedDiff` PNGs in a `failures` directory beside the
baseline key. Inspect the test image and masked diff together, then either fix
the rendering or perform the guarded two-run regeneration and review.
