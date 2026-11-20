"""Build the scene's audio and timeline from a laid-out voice track and a music bed.

Inputs
  voice.wav   the narration already laid out on the clip timeline (mono or stereo, any rate)
  music.wav   the music bed (music_fire.py)
  phrases.json  {"<id>": {"start": s, "konec": e, "txt": "..."}}  phrase starts/ends on that timeline
Outputs (in <scene dir>)
  text.json        [{"id","show","say"}]            the script (show = subtitle text, say = what was read)
  beats.json       {"total", "beats":[{id,start,end,show}]}   what the player and the windows key on
  narration.mp3    voice + music; the music sits MUSIC_UNDER dB under the voice while someone speaks
                   and MUSIC_PAUSE_LIFT dB higher in pauses (0.25 s ramps), loudness-normalised
  mix-report.json  measured voice-to-music ratio per phrase (intelligibility)

    python mix_narration.py <voice.wav> <music.wav> <phrases.json> <scene dir> [--total 80]
"""
import argparse
import json
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d
from scipy.signal import resample_poly

SR = 48000
MUSIC_UNDER = 24.0       # dB: music RMS under the voice RMS while a phrase plays
MUSIC_PAUSE_LIFT = 8.0   # dB: how much the bed comes up in the pauses between phrases
RAMP = .25               # s


def load(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float32)
    if x.dtype != np.float32 or np.abs(x).max() > 2:
        x = x / 32768.0
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    if sr != SR:
        g = np.gcd(sr, SR)
        x = np.stack([resample_poly(x[:, c], SR // g, sr // g) for c in (0, 1)], 1).astype(np.float32)
    return x


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x.astype(np.float64) ** 2)) + 1e-12)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('voice')
    ap.add_argument('music')
    ap.add_argument('phrases')
    ap.add_argument('scene')
    ap.add_argument('--total', type=float, default=80.0)
    a = ap.parse_args()

    ph = json.load(open(a.phrases, encoding='utf-8'))
    beats = [{'id': k, 'start': round(v['start'], 3), 'end': round(v['konec'], 3), 'show': v['txt']} for k, v in ph.items()]
    beats.sort(key=lambda b: b['start'])

    n = int(a.total * SR)
    voice = np.zeros((n, 2), np.float32)
    v = load(a.voice)[:n]
    voice[:len(v)] = v
    music = np.zeros((n, 2), np.float32)
    m = load(a.music)[:n]
    music[:len(m)] = m

    speech = np.zeros(n, bool)
    for b in beats:
        speech[int(b['start'] * SR):int(b['end'] * SR)] = True
    v_db = rms_db(voice[speech])
    m_db = rms_db(music[speech])
    g_under = 10 ** ((v_db - MUSIC_UNDER - m_db) / 20)
    # gain curve: under speech g_under, in pauses g_under * lift, with RAMP-second smoothing
    target = np.where(speech, 1.0, 10 ** (MUSIC_PAUSE_LIFT / 20)).astype(np.float32)
    k = int(RAMP * SR)
    # widen every phrase by RAMP on both sides (the bed is already down on the first syllable), then smooth the steps
    duck = minimum_filter1d(target, 2 * k + 1, mode='nearest')
    duck = np.convolve(duck, np.ones(k, np.float32) / k, 'same')
    gain = g_under * np.clip(duck, 1.0, None)
    mus = music * gain[:, None]
    mix = voice + mus

    report = []
    for b in beats:
        i0, i1 = int(b['start'] * SR), int(b['end'] * SR)
        report.append({'id': b['id'], 'voice_minus_music_db': round(rms_db(voice[i0:i1]) - rms_db(mus[i0:i1]), 1)})
    med = float(np.median([r['voice_minus_music_db'] for r in report]))
    worst = min(report, key=lambda r: r['voice_minus_music_db'])

    os.makedirs(a.scene, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, 'mix.wav')
        wavfile.write(wav, SR, (mix / max(1.0, float(np.abs(mix).max()) / .98)).astype(np.float32))
        out = os.path.join(a.scene, 'narration.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                        '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '112k', '-map_metadata', '-1', out], check=True)

    json.dump({'total': a.total, 'beats': beats}, open(os.path.join(a.scene, 'beats.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    json.dump([{'id': b['id'], 'show': b['show'], 'say': b['show']} for b in beats],
              open(os.path.join(a.scene, 'text.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'music_under_voice_db': MUSIC_UNDER, 'music_pause_lift_db': MUSIC_PAUSE_LIFT,
               'voice_minus_music_median_db': round(med, 1), 'worst_phrase': worst, 'phrases': report},
              open(os.path.join(a.scene, 'mix-report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'beats: {len(beats)}, total {a.total} s; voice-music median {med:.1f} dB, worst {worst}')


if __name__ == '__main__':
    main()
