# CaseVant training asset source

This is a 600-second narrated illustrated tutorial, not an end-to-end browser recording.

- One actual opening application screenshot, supplied by the browser capture.
- Sixteen explicitly labeled workflow illustrations using controls and case values in the reviewed script.
- Three explicit account-instruction segments; authenticated completion was not recorded.
- Twenty chapters of exactly 30 seconds; complete speech, no hard-trimmed narration.
- English synthetic narration (`ffmpeg` flite voice `slt`), sentence-aligned captions, readable transcript.

## Rebuild

Requirements: Python 3 with Pillow; ffmpeg/ffprobe with libflite and libx264; DejaVu Sans fonts.

```sh
python render_training.py
```

`training-script.json` is the content source. `illustrations.py` draws visibly illustrative educational cards and diagrams. `screen-map.json` points to the real screenshot. Generated caches are disposable; `output/` contains delivery files.

The renderer measures every sentence's actual WAV duration. It pads each scene to 30 seconds, never truncates speech, checks output duration and requires the MP4 to remain below 24 MiB. Each sentence appears in the teaching rail; WebVTT provides the same narration as a separate track.

Refreshed 5 October 2026. Opening capture: https://casevant.pro/studio. Current professional workspace and Personal/Team paths verified against live UI and source. No authenticated write is represented as recorded.
