#!/bin/bash
# Full build: voice -> timings -> bed -> frames -> mix (-14 LUFS, bed ducked under voice) -> MP4s
# Needs: pip install kokoro-onnx soundfile numpy; Playwright + Chromium; ffmpeg; Inter, JetBrains Mono, Noto Color Emoji fonts.
set -e
cd "$(dirname "$0")"
python3 vo.py                      # vo.wav, vo.js   (KOKORO_DIR=folder with the two model files)
node render.js stills 0            # sfx.json
python3 audio.py                   # sfx.wav
node render.js frames              # frames/
NOCAP=1 node render.js frames      # frames_nc/
FC="[0:a]aresample=48000:resampler=soxr,highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=80:makeup=2,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];[1:a]volume=-5dB[bed];[bed][sc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[duck];[v][duck]amix=inputs=2:normalize=0:weights='1.6 1'[mix]"
ffmpeg -hide_banner -y -i vo.wav -i sfx.wav -filter_complex "$FC;[mix]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]" -map "[o]" -f null - 2> ln.txt
LN=$(python3 -c "
import json;t=open('ln.txt').read();j=json.loads(t[t.rindex('{'):t.rindex('}')+1])
print(f\"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true\")")
ffmpeg -v error -y -i vo.wav -i sfx.wav -filter_complex "$FC;[mix]$LN,aresample=48000[o]" -map "[o]" mix.wav
enc(){ ffmpeg -v error -y -framerate 30 -i "$1/f%05d.jpg" -i mix.wav -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -vf "scale=out_color_matrix=bt709:out_range=tv" -c:a aac -b:a 256k -movflags +faststart "$2"; }
enc frames seo-companies-lie.mp4
enc frames_nc seo-companies-lie-no-captions.mp4
