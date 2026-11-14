# Reels

Instagram Reels for @octopusengines (Florida kitchen & bath remodeler leads). Each reel lives in its own folder:

```
reels/<slug>/
  index.html        animation (HTML/JS, seek(t) driven); open in a browser to preview
  render.mjs        node render.mjs [--sub=4] [--nocap]  -> 1080x1920 30fps MP4 (length = window.DUR)
  audio.py          voiceover + music + mix -> mix.wav
  <slug>.mp4                 final, captions burned in   <- the one that gets posted
  <slug>-no-captions.mp4     final, clean
```

## Standing rules for every new reel

1. **Voiceover = "Eric".** Kokoro TTS, voice `am_eric`, `lang="en-us"`, `speed=1.05`.
   ```
   pip install kokoro-onnx soundfile pyloudnorm
   # model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
   #   kokoro-v1.0.onnx, voices-v1.0.bin
   from kokoro_onnx import Kokoro
   k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
   audio, sr = k.create("Line", voice="am_eric", speed=1.05, lang="en-us")
   ```
   Generate each line separately and fit it to its timing slot (measure the lines first, then set the timeline).
2. **Mix:** duck the music under the voice; finish at **-14 LUFS** integrated, peaks under -1 dBFS.
3. **Deliver both versions:** captioned (`<slug>.mp4`) and clean (`<slug>-no-captions.mp4`), with audio.
4. **Add it to `reels/ready.json`** so the posting bots pick it up:
   - new entry at the **top** of `items`, with a unique `id` (`YYYY-MM-DD-<slug>`), `title`, `file` (the captioned MP4), `duration_seconds`, `format`, and a written `post_caption`;
   - `status: "ready"`, or `"hold"` with a `hold_reason` if anything on screen still needs the owner to verify it (quotes, stats, claims about real companies);
   - bump `updated`; validate with `python3 -m json.tool reels/ready.json`.
5. Commit and push the reel's source, both MP4s and the `ready.json` change.

## Posting bots

`reels/GROK_PROMPT.md` holds the prompt for the Grok bots that post from `reels/ready.json`. They post only `status: "ready"` items, captioned file only, one per run, oldest first, never the same `id` twice.
