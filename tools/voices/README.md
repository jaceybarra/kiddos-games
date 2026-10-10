# Voices

Every line Wonderwood says is a recording made ahead of time. Nothing is generated while playing.

- `lines.ts` collects every spoken line and who says it: Line objects in `src/content/`, plain text
  listed in `SPEAKERS`, spoken literals and choice labels in game code, and `captured.json` (lines heard
  during the browser test journeys).
- `generate.py` records each line with **Kokoro** (open-source text-to-speech, Kokoro-82M weights under
  Apache-2.0), checks it with **Parakeet** speech recognition, retries with small changes if the words
  were misheard, trims silence, evens out loudness and writes a small MP3 to `public/voice/`. `CASTING`
  says which voice each character uses.
- `extract.mjs index` writes `src/generated/voiceIndex.json` (line → file) and deletes clips nothing
  uses any more.
- `results.json` keeps what speech recognition heard for each clip (`score` below 0.9 is worth a listen).

## After changing or adding lines

```bash
tools/voices/record.sh
```

Only new or changed lines are recorded. To catch lines that are put together while playing, run the
browser journeys (`npm run e2e`), then `node tools/voices/merge-captured.mjs`, then `record.sh` again.
`VOICE_STRICT=1 npm run e2e` fails any journey that hears a line without a recording.
