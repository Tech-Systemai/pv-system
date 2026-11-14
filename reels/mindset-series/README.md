# Mindset series (10 reels + full compilation)

One engine, ten concepts. `series.html?r=<0-9>` renders one reel; `all.html` renders all ten back to back with a single CTA.

- `vo.py` - Eric voiceover per line (Kokoro `am_eric`, en-us, 1.05); writes `reels.json` (line timings, CTA time, length).
- `render.js` - `node render.js series.html "&r=0" out.mp4` (add `&nocap` for the clean version). Video only, 1080x1920 60fps.
- `score.py` - music + sound effects from the reel's event list, then duck under the voice and loudnorm to -14 LUFS.

Fonts: Inter / Inter Display and DejaVu Sans Mono from the system.
