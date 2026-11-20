"""Cut quiz panels (art/paneli/<id>.webp) from the window pictures, so the quiz shows exactly what the cartoon showed.
Re-run it after any picture is changed, otherwise the quiz keeps the old picture.

    python make_panels.py <scene dir> <panels.json> [--width 960]

panels.json: {"<panel id>": "<picture name in art/>" | ["<picture>", x0, y0, x1, y1]}  (crop in picture fractions)
"""
import argparse
import json
import os

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scene')
    ap.add_argument('panels')
    ap.add_argument('--width', type=int, default=960)
    a = ap.parse_args()
    spec = json.load(open(a.panels, encoding='utf-8'))
    out = os.path.join(a.scene, 'art', 'paneli')
    os.makedirs(out, exist_ok=True)
    for pid, src in spec.items():
        name, box = (src, (0, 0, 1, 1)) if isinstance(src, str) else (src[0], tuple(src[1:5]))
        im = Image.open(os.path.join(a.scene, 'art', name + '.webp')).convert('RGB')
        w, h = im.size
        im = im.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))
        im = im.resize((a.width, round(a.width * im.height / im.width)), Image.LANCZOS)
        im.save(os.path.join(out, pid + '.webp'), 'WEBP', quality=76, method=6)
        print(pid, '<-', name, box)


if __name__ == '__main__':
    main()
