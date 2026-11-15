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

1. **Voiceover = the owner's own cloned voice** (Chatterbox, runs locally; settings "B": `exaggeration=0.8`, `cfg_weight=0.35`).
   One clip per line with `vo_lines.py` (see `stop-boosting-posts/`), then lay the lines out and fit the timeline to them.
   The voice reference clip is private (owner's Google Drive). **Never commit it, or any recording of the owner, to this public repo.**
   Older reels used Kokoro "Eric" (`am_eric`, en-us, speed 1.05); use Eric only if the owner asks.
2. **Mix:** duck the music under the voice; finish at **-14 LUFS** integrated, peaks under -1 dBFS.
3. **Deliver both versions:** captioned (`<slug>.mp4`) and clean (`<slug>-no-captions.mp4`), with audio.
4. **Add it to `reels/ready.json`** so the posting bots pick it up:
   - new entry at the **top** of `items`, with a unique `id` (`YYYY-MM-DD-<slug>`), `title`, `file` (the captioned MP4), `duration_seconds`, `format`, and a written `post_caption`;
   - `status: "ready"`, or `"hold"` with a `hold_reason` if anything on screen still needs the owner to verify it (quotes, stats, claims about real companies);
   - bump `updated`; validate with `python3 -m json.tool reels/ready.json`.
5. Commit and push the reel's source, both MP4s and the `ready.json` change.

## Posting bots

`reels/GROK_PROMPT.md` holds the prompt for the Grok bots that post from `reels/ready.json`. They post only `status: "ready"` items, captioned file only, one per run, oldest first, never the same `id` twice.
