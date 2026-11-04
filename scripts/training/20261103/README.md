# Current workflow guide — 3 November 2026

Eight 30-second instructional cards with complete English offline synthetic narration. These are workflow illustrations based on v174 (`c295a1a968611104b40e0923b3d480e77bfb5b20`), not application screenshots, a screen recording, authenticated saves or file-delivery evidence.

No subtitles are generated, muxed, drawn or attached to the players. Full English/Russian transcripts accompany the guide. Frames contain concise task labels; the narration is never painted onto them. Historical course/recording files, including their archived VTTs, retain their original bytes; active Help players no longer attach those tracks.

Source: `app/training-current.json`. Renderer: `render.py`. Local requirements: Python3/Pillow12.0.0, Windows Arial fonts, FFmpeg7.1 with libx264/AAC and installed Microsoft Zira Desktop speech. Tools are outside application dependencies. `narrate.ps1` contains the offline speech commands; where script-file execution is disabled, use the equivalent interactive commands without changing system policy.

Generate eight 24 kHz/16-bit mono WAVs with complete narration. Then run:

```text
python scripts/training/20261103/render.py --ffmpeg /absolute/path/to/ffmpeg --audio /absolute/path/to/audio
```

The renderer refuses speech longer than 29.5 seconds; it never trims or speeds speech. It joins PCM narration with silence to exact 30-second boundaries and encodes one continuous timeline. Concatenating separately encoded AAC/MP4 segments produced a 42 ms initial frame offset in the first QA artifact; Chrome's 2:00 chapter showed card 4. Raw timestamp diagnostics and a screenshot remain in `.artifacts/help-update-20261103`. The corrected video starts at timestamp 0, lasts 240 seconds, fully decodes, has only `vide`/`soun` tracks and is below 8 MiB. Browser chapter-frame acceptance is recorded separately from this encoder validation.

Generated source frames are retained here. Public video/poster/transcripts and their exact hashes are under `public/help/training-20261103`. No case, source-body, factory, carrier, recovery, persistence or report format changes are part of this work.
