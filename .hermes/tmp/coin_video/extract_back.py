"""Extract the BACK face artwork the user wants from vyronx_coin_wan30.mp4.

Numeric approach:
- sample frames; find coin via bright-pixel bbox in center region
- face-on candidates: bbox near-square, width 300-560 (video is 960px)
- score = correlation with FRONT plate (lower = more rotated away)
- best face-on frame most dissimilar to front => the back reveal
"""
import math
from PIL import Image, ImageChops
import subprocess, os

VID = "vyronx_coin_wan30.mp4"
os.makedirs("extract", exist_ok=True)

# dump every 5th frame (6fps sampling)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", VID,
                "-vf", "select='not(mod(n\\,5))'", "-vsync", "vfr",
                "extract/s_%03d.png"], check=True)

def load_face_small(path, size=64):
    coin = Image.open(path).convert("RGBA")
    bbox = coin.getchannel("A").getbbox()
    coin = coin.crop(bbox)
    side = max(coin.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(coin, ((side - coin.size[0]) // 2, (side - coin.size[1]) // 2), coin)
    return sq.convert("RGB").resize((size, size), Image.LANCZOS)

front_s = load_face_small("front.png")
back_s = load_face_small("back.png")

def corr(a, b):
    pa, pb = a.load(), b.load()
    n = a.size[0] * a.size[1]
    sa = sb = sab = 0
    va = [pa[x, y][0] for y in range(a.size[1]) for x in range(a.size[0])]
    vb = [pb[x, y][0] for y in range(b.size[1]) for x in range(b.size[0])]
    ma = sum(va) / n; mb = sum(vb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(va, vb))
    na_ = math.sqrt(sum((x - ma) ** 2 for x in va))
    nb_ = math.sqrt(sum((y - mb) ** 2 for y in vb))
    return cov / max(1e-9, na_ * nb_)

def coin_bbox(img):
    """Bright blob bbox near center (coin is gold on dark bg)."""
    g = img.convert("L")
    px = g.load()
    w, h = g.size
    xs, ys = [], []
    for y in range(120, h - 60, 3):
        for x in range(60, w - 60, 3):
            if px[x, y] > 70:
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)

frames = sorted(os.listdir("extract"))
best = []
for fn in frames:
    img = Image.open(os.path.join("extract", fn))
    bb = coin_bbox(img)
    if not bb:
        continue
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    if not (300 <= w <= 580 and 300 <= h <= 580):
        continue
    if not (0.8 <= w / h <= 1.25):
        continue
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = max(w, h) // 2
    crop = img.crop((cx - half, cy - half, cx + half, cy + half)).convert("RGB").resize((64, 64), Image.LANCZOS)
    cf = corr(crop, front_s)
    cb = corr(crop, back_s)
    best.append((cf, cb, fn, (cx, cy, half)))

best.sort(key=lambda t: t[0])  # most dissimilar to front first
print("top candidates (corr_front, corr_oldback, frame, center):")
for cf, cb, fn, c in best[:6]:
    print(f"  {cf:+.3f}  {cb:+.3f}  {fn}  {c}")

if not best:
    print("NO face-on candidate found")
else:
    cf, cb, fn, (cx, cy, half) = best[0]
    img = Image.open(os.path.join("extract", fn))
    # pad to square with black, then circular alpha mask
    side = half * 2
    sq = Image.new("RGB", (side, side), (0, 0, 0))
    px0, py0 = cx - half, cy - half
    sq.paste(img.crop((px0, py0, px0 + side, py0 + side)), (0, 0))
    mask = Image.new("L", (side, side), 0)
    from PIL import ImageDraw
    md = ImageDraw.Draw(mask)
    md.ellipse([2, 2, side - 3, side - 3], fill=255)
    out = sq.convert("RGBA")
    out.putalpha(mask)
    out.save("back_from_wan.png")
    print("SAVED back_from_wan.png from", fn, "size", out.size)
