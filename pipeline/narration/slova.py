# Word timings of a scene's narration, so that captions and effects land exactly on their word.
# Before this the scene estimated a word's time from its share of letters in the phrase (wordAt) and labels were
# 1-1.5 s late (some voices say words earlier than the letter share predicts).
#
#   python slova.py <scene dir> [--audio narration.mp3] [--beats beats.json] [--out words.json]
#                   [--model large-v3] [--device cuda|cpu]
#
# For every phrase of beats.json the narration is cut (with 0.15 s margins), transcribed by faster-whisper with
# word timestamps (the phrase text is the initial prompt) and written as
#   {"<phrase id>": [["word", start, end], ...]}   times in seconds from the start of the track.
# Optional: CUDA_DLL_DIR=<folder with cuDNN/cuBLAS DLLs> when ctranslate2 cannot find them on Windows.
# Set HF_HUB_OFFLINE=1 to make sure no model is downloaded (the model must already be in the HF cache).
import argparse
import json
import os
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding='utf-8')
if os.environ.get('CUDA_DLL_DIR'):
    os.environ['PATH'] = os.environ['CUDA_DLL_DIR'] + os.pathsep + os.environ['PATH']
from faster_whisper import WhisperModel  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('scene')
ap.add_argument('--audio', default='narration.mp3')
ap.add_argument('--beats', default='beats.json')
ap.add_argument('--out', default='words.json')
ap.add_argument('--model', default='large-v3')
ap.add_argument('--device', default='cuda')
a = ap.parse_args()

m = WhisperModel(a.model, device=a.device, compute_type='float16' if a.device == 'cuda' else 'int8')
beats = json.load(open(os.path.join(a.scene, a.beats), encoding='utf8'))['beats']
audio = a.audio if os.path.isabs(a.audio) else os.path.join(a.scene, a.audio)
out = {}
for b in beats:
    s0 = max(0, b['start'] - .15)
    with tempfile.TemporaryDirectory() as t:
        wav = os.path.join(t, 'x.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s0), '-to', str(b['end'] + .15), '-i', audio,
                        '-ac', '1', '-ar', '16000', wav], check=True)
        segs, _ = m.transcribe(wav, language='ru', word_timestamps=True, beam_size=5, initial_prompt=b['show'])
        out[b['id']] = [[w.word.strip(), round(s0 + w.start, 3), round(s0 + w.end, 3)] for s in segs for w in s.words]
    print(b['id'], ' '.join(w[0] for w in out[b['id']]))
json.dump(out, open(os.path.join(a.scene, a.out), 'w', encoding='utf8'), ensure_ascii=False)
print('->', a.out)
