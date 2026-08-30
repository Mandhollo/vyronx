"""Validate extracted back: is it stable across neighbor frames? Is it distinct
from front.png and from old back.png (globe)?"""
import math, os
import numpy as np
from PIL import Image, ImageDraw

def disc_from(path, cx, cy, r, s=128):
    im = Image.open(path).convert("RGB")
    x0, y0, side = int(cx - r), int(cy - r), int(2 * r)
    if x0 < 0 or y0 < 0 or x0 + side > im.size[0] or y0 + side > im.size[1]:
        return None
    return np.asarray(im.crop((x0, y0, x0 + side, y0 + side)).resize((s, s), Image.LANCZOS).convert("L"), float)

def ncorr(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / math.sqrt((a * a).sum() * (b * b).sum() + 1e-9))

# neighbor frames around s_045 (source n = 88): n=84..92 -> s_042..s_047
frames = {}
for i in (42, 43, 44, 45, 46, 47):
    n = (i - 1) * 2
    src = f"extract2/s_{i:03d}.png"
    if not os.path.exists(src):
        continue
    from extract_helper import find_disc_rim
    img = Image.open(src)
    det = find_disc_rim(img)
    if det:
        frames[n] = disc_from(src, *det)

ref_n = 88
ref = frames[ref_n] if ref_n in frames else disc_from("back_frame.png", 480, 505, 294)
print("pairwise corr with extracted back (n=88):")
for n, d in sorted(frames.items()):
    print(f"  n={n}: {ncorr(d, ref):+.3f}")

# vs plates
def plate(path, s=128):
    coin = Image.open(path).convert("RGBA")
    bbox = coin.getchannel("A").getbbox()
    coin = coin.crop(bbox)
    side = max(coin.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(coin, ((side - coin.size[0]) // 2, (side - coin.size[1]) // 2), coin)
    return np.asarray(sq.convert("RGB").resize((s, s), Image.LANCZOS).convert("L"), float)

f = plate("front.png")
b = plate("back.png")
print(f"\nextracted vs front.png: {ncorr(ref, f):+.3f}")
print(f"extracted vs back.png (old globe): {ncorr(ref, b):+.3f}")

# center content signature: front has big bright monogram; globe back has dotted map (darker center)
cx0 = ref.shape[0] // 2
c = ref[cx0 - 20:cx0 + 20, cx0 - 20:cx0 + 20]
print(f"center 40x40 mean luminance: {c.mean():.1f} (bright monogram ~>90, dark map <60)")
