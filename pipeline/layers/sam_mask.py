"""Object mask with SAM (a box + points), with polygon clipping and a preview, for cutting an object out of a window
picture into its own moving layer.

    python sam_mask.py <job.json> [name ...]

job: {"src", "out", "items": [{"name", "box": [x0,y0,x1,y1], "pts": [[x,y,1|0], ...], "clip": [[poly]] (keep only inside),
  "minus": [[poly]], "add": [[poly]], "pick": "best|big|0|1|2", "pad": .12, "holes": 500, "open": 0}]}  (picture fractions)
Output: <name>-mask.png and <name>-show.png (checkerboard cut-out + contour) per item. Needs torch, transformers (facebook/sam-vit-large).
"""
#   "minus":[[..]], "add":[[..]], "pick":"best|big|0|1|2", "pad":.12, "holes":500, "open":0}]}
import sys, json, os, re
import numpy as np, cv2, torch
from PIL import Image
from transformers import SamModel, SamProcessor

def LOADFIX(t): return re.sub(r'(?<=[\[,\s:-])\.(\d)', lambda m: '0.' + m.group(1), t)
job = json.loads(LOADFIX(open(sys.argv[1], encoding='utf-8').read())); only = set(sys.argv[2:])
img = np.array(Image.open(job['src']).convert('RGB')); H, W = img.shape[:2]
os.makedirs(job['out'], exist_ok=True)
P = SamProcessor.from_pretrained('facebook/sam-vit-large'); M = SamModel.from_pretrained('facebook/sam-vit-large').cuda().eval()

def pm(polys):
    m = np.zeros((H, W), np.uint8)
    for p in polys:
        pts = np.array([[x * W, y * H] for x, y in p], np.float64)
        cv2.fillPoly(m, [np.round(pts * 16).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=4)
    return m

def sam_obj(box, pts, pad, pick):
    x0, y0, x1, y1 = box; bw, bh = x1 - x0, y1 - y0
    X0, Y0 = int(max(0, x0 - bw * pad) * W), int(max(0, y0 - bh * pad) * H)
    X1, Y1 = int(np.ceil(min(1, x1 + bw * pad) * W)), int(np.ceil(min(1, y1 + bh * pad) * H))
    crop = img[Y0:Y1, X0:X1]; sc = 1024 / max(crop.shape[:2])
    crop_in = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_CUBIC) if sc > 1 else crop
    if sc <= 1: sc = 1.0
    cb = [(x0 * W - X0) * sc, (y0 * H - Y0) * sc, (x1 * W - X0) * sc, (y1 * H - Y0) * sc]
    kw = dict(images=Image.fromarray(crop_in), input_boxes=[[cb]], return_tensors='pt')
    if pts:
        kw['input_points'] = [[[[(x * W - X0) * sc, (y * H - Y0) * sc] for x, y, l in pts]]]
        kw['input_labels'] = [[[l for x, y, l in pts]]]
    inp = P(**kw).to('cuda')
    with torch.no_grad(): out = M(**inp, multimask_output=True)
    ms = P.image_processor.post_process_masks(out.pred_masks.cpu(), inp['original_sizes'].cpu(), inp['reshaped_input_sizes'].cpu(), binarize=False)[0][0]
    s = out.iou_scores[0, 0].cpu().numpy()
    i = int(np.argmax(s)) if pick == 'best' else (int(np.argmax([(ms[j] > 0).sum() for j in range(ms.shape[0])])) if pick == 'big' else int(pick))
    lg = ms[i].numpy()
    if sc != 1.0: lg = cv2.resize(lg, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_LINEAR)
    full = np.zeros((H, W), np.uint8); full[Y0:Y1, X0:X1] = (lg > 0); return full, s

for it in job['items']:
    if only and it['name'] not in only: continue
    m, s = sam_obj(it['box'], [tuple(p) for p in it.get('pts', [])], it.get('pad', .12), it.get('pick', 'best'))
    if it.get('clip'): m &= pm(it['clip'])
    if it.get('minus'): m &= 1 - pm(it['minus'])
    if it.get('add'): m |= pm(it['add'])
    for poly, kk in it.get('close_in', []):
        cl = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kk, kk)))
        z = pm([poly]); m = np.where(z > 0, cl, m).astype(np.uint8)
    if it.get('open'):
        o = it['open']; m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (o, o)))
    n2, l2, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n2 > 1: m = (l2 == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    inv = (m == 0).astype(np.uint8); n3, l3, s3, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n3):
        x, y, bw, bh, a = s3[i]
        if x > 0 and y > 0 and x + bw < W and y + bh < H and a <= it.get('holes', 500): m[l3 == i] = 1
    cv2.imwrite(os.path.join(job['out'], it['name'] + '-mask.png'), m * 255)
    ys, xs = np.nonzero(m); Q = 30
    x0, x1, y0, y1 = max(0, xs.min() - Q), min(W, xs.max() + Q), max(0, ys.min() - Q), min(H, ys.max() + Q)
    sub = img[y0:y1, x0:x1][..., ::-1]; ms_ = m[y0:y1, x0:x1]
    chk = ((np.indices(ms_.shape).sum(0) // 8) % 2 * 60 + 100).astype(np.uint8)
    a = np.dstack([chk] * 3); a[ms_ > 0] = sub[ms_ > 0]
    b = sub.copy(); c, _ = cv2.findContours(ms_, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(b, c, -1, (255, 0, 255), 1)
    show = np.hstack([a, b]); f = min(4, 1300 / show.shape[1])
    show = cv2.resize(show, None, fx=f, fy=f, interpolation=cv2.INTER_NEAREST if f >= 1 else cv2.INTER_AREA)
    cv2.imwrite(os.path.join(job['out'], it['name'] + '-show.png'), show)
    print(it['name'], 'iou', np.round(s, 3), 'px', int(m.sum()), 'bbox', round(xs.min() / W, 4), round(ys.min() / H, 4), round(xs.max() / W, 4), round(ys.max() / H, 4))
