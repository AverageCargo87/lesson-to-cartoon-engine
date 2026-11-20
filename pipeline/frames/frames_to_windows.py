"""Turn rendered frames (Blender, 1920x1080 PNG) into window backgrounds for the engine.

The engine expects every window picture as a 2000x1116 WebP (16:8.93, the frame of an 800x450-unit window
with a small bleed). This script scales, centre-crops, strips all metadata and writes WebP.

    python frames_to_windows.py <render_root> <frames.json> <out_dir> [--quality 80]

frames.json: {"<out name>": "<shot>/<frame>.png", ...}, paths relative to <render_root>/kadry.
"""
import argparse
import json
import os

from PIL import Image

W, H = 2000, 1116


def convert(src, dst, quality):
    im = Image.open(src).convert('RGB')
    k = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x0, y0 = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x0, y0, x0 + W, y0 + H))
    # a fresh image object carries no EXIF/XMP/ICC from the source
    clean = Image.new('RGB', im.size)
    clean.paste(im)
    clean.save(dst, 'WEBP', quality=quality, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root')
    ap.add_argument('frames')
    ap.add_argument('out')
    ap.add_argument('--quality', type=int, default=80)
    a = ap.parse_args()
    spec = json.load(open(a.frames, encoding='utf-8'))
    os.makedirs(a.out, exist_ok=True)
    for name, rel in spec.items():
        dst = os.path.join(a.out, name + '.webp')
        convert(os.path.join(a.root, 'kadry', rel), dst, a.quality)
        print(f'{name:14s} <- {rel:16s} {os.path.getsize(dst) // 1024} KB')


if __name__ == '__main__':
    main()
