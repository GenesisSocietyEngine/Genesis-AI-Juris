# Current scenario recordings — 2 November 2026

Two bounded, silent walkthroughs: Canopy source inspection/return (48 seconds) and synthetic local review/edit/apply/Undo/Redo (56 seconds).

These are **actual browser step captures edited into video**, not continuous screen footage or a recording of authenticated save/reopen, AI execution, report delivery or all CaseVant workflows. They were captured using supported Chrome controls against the isolated local Vite/Worker preview on port4187. The UI source is commit a8b919a03ebdfff32297f881f316aab0b9a377ca. Only public fictional Canopy and a labelled local synthetic case appear; no account, real cases, credentials or unrelated browser chrome is included.

`captures.json` retains exact raw capture hashes, timestamps, source and observed UI state. Captures are JPEG bytes returned by the browser; their extensions match that actual format. `scenarios.json` supplies the ordered steps and descriptive EN/RU captions. The renderer verifies every input hash, preserves capture bytes, adds at most one right/bottom pixel for H264 encoding, produces fast-start silent MP4s and posters, writes captions/transcripts, fully decodes both videos and checks duration and the24MiB per-file ceiling. It generates public assets/provenance and `app/scenario-recordings.json`.

```text
python scripts/training/scenarios-20261102/render_scenarios.py --ffmpeg /absolute/path/to/ffmpeg
```

Python standard library and FFmpeg with libx264 are required. No dependency or source-body migration and no provider call is needed. The current isolated encoder was supplied by PyPI imageio-ffmpeg0.6.0; it is a local tool, not an application dependency. Rerender only from verified captures. Changed workflows need new captures/versioned assets, not edited screenshots that pretend an action occurred.

The optional archive action after the source-return recording emitted Download prepared, but the browser event wait stalled and returned no file path. It is not in the video or counted as successful file delivery. A source-view narrow screenshot initially caught a preceding paint; DOM focus/geometry and separately settled visual checks are recorded in the implementation review. The dated October illustrated course remains available as older background material in Help.
