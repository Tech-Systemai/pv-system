"""Generates one voice clip per line in the owner's cloned voice (Chatterbox, local).

  /opt/chatterbox/bin/python vo_lines.py lines.json <out_dir> [only=3,7] [seed]
The voice reference (VOICE_REF, default /root/.claude/voice/my_voice_reference.flac) is private:
it lives in the owner's Google Drive and must never be committed to this public repo.
"""
import os, sys, json; os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
import torch, torchaudio; torch.set_num_threads(os.cpu_count())
from chatterbox.tts import ChatterboxTTS
REF = os.environ.get("VOICE_REF", "/root/.claude/voice/my_voice_reference.flac")
lines = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
only = {int(i) for i in sys.argv[3].split(",")} if len(sys.argv) > 3 and sys.argv[3] else None
seed = int(sys.argv[4]) if len(sys.argv) > 4 else 7
m = ChatterboxTTS.from_pretrained(device="cpu")
for i, text in enumerate(lines):
    if only and i not in only: continue
    torch.manual_seed(seed)
    w = m.generate(text, audio_prompt_path=REF, exaggeration=0.8, cfg_weight=0.35)   # "B" settings
    torchaudio.save(f"{out}/l{i:02d}.wav", w, m.sr); print(i, round(w.shape[-1] / m.sr, 2), text, flush=True)
