"""Extract back face from wan30 video — rim-span method.
Dark coin + bright gold rim: per row, first bright pixel from left and right = rim edges.
Widest rows give diameter + center. Rows must have dark middle (coin interior).
"""
import math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw

# sample every 2nd frame for precision
os.makedirs("extract2", exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "vyronx_coin_wan30.mp4",
                "-vf", "select='not(mod(n\\,2))'", "-vsync", "vfr",
                "extract2/s_%03d.png"], check=True)

def find_disc_rim(img):
    g = np.asarray(img.convert("L"), float)
    rec = []
    for y in range(240, 640, 4):
        row = g[y, 160:800]
        bright = np.flatnonzero(row > 72)
        if len(bright) < 20:
            continue
        left, right = bright[0], bright[-1]
        span = right - left
        if span < 200:
            continue
        mid = row[left + 50:right - 50]
        if mid.size and mid.mean() > 100:   # middle should be darkish coin field
            continue
        rec.append((span, 160 + (left + right) / 2, y))
    if len(rec) < 12:
        return None
    spans = np.array([r[0] for r in rec])
    k = spans >= spans.max() * 0.88
    dia = float(np.median(spans[k]))
    cx = float(np.median([r[1] for i, r in enumerate(rec) if k[i]]))
    cy = float(np.mean([r[2] for i, r in enumerate(rec) if k[i]]))
    return cx, cy, dia / 2

def ncorr(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / math.sqrt((a * a).sum() * (b * b).sum() + 1e-9))

def disc_gray(path, det, s=96):
    im = Image.open(path).convert("RGB")
    cx, cy, r = det
    x0, y0, side = int(cx - r), int(cy - r), int(2 * r)
    if x0 < 0 or y0 < 0 or x0 + side > im.size[0] or y0 + side > im.size[1]:
        return None
    return np.asarray(im.crop((x0, y0, x0 + side, y0 + side)).resize((s, s), Image.LANCZOS).convert("L"), float)

frames = sorted(os.listdir("extract2"))
dets = {}
for fn in frames:
    img = Image.open(os.path.join("extract2", fn))
    det = find_disc_rim(img)
    if det:
        dets[fn] = det

print(f"disc found in {len(dets)}/{len(frames)} frames")
if dets:
    sample = list(dets.items())
    for fn, det in sample[:: max(1, len(sample) // 12)]:
        print(f"  {fn}: cx={det[0]:.0f} cy={det[1]:.0f} r={det[2]:.0f}")

# front reference = first detected frame's disc
f0 = frames[0]
if f0 not in dets:
    f0 = next(fn for fn in frames if fn in dets)
front_ref = disc_gray(os.path.join("extract2", f0), dets[f0])

rows = []
for fn, det in dets.items():
    d = disc_gray(os.path.join("extract2", fn), det)
    if d is None:
        continue
    rows.append((ncorr(d, front_ref), fn, det))

rows.sort()
print("\nmost dissimilar to front (= back reveal):")
for c, fn, det in rows[:6]:
    print(f"  corr={c:+.3f} {fn} r={det[2]:.0f}")

if rows:
    c, fn, det = rows[0]
    i = int(fn.split("_")[1].split(".")[0])
    n = (i - 1) * 2
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "vyronx_coin_wan30.mp4",
                    "-vf", f"select='eq(n\\,{n})'", "-vsync", "vfr", "-frames:v", "1",
                    "back_frame.png"], check=True)
    img = Image.open("back_frame.png").convert("RGB")
    det2 = find_disc_rim(img) or det
    cx, cy, r = det2
    x0, y0, side = int(cx - r), int(cy - r), int(2 * r)
    disc = img.crop((x0, y0, x0 + side, y0 + side))
    mask = Image.new("L", disc.size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([1, 1, side - 2, side - 2], fill=255)
    out = disc.convert("RGBA")
    out.putalpha(mask)
    out.save("back_from_wan.png")
    print("\nSAVED back_from_wan.png", out.size, "from source frame", n)
