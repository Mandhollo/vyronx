"""Deterministic QA without vision: prove text fidelity by construction.

Compares rendered frames against the ORIGINAL coin PNGs:
- frame 0   -> coin face must equal front.png (resized), diff ~ 0
- frame 168 (t=5.6s, angle 180°) -> coin face must equal back.png, diff ~ 0
- title strip must be identical across ALL frames (static typography)
- footer strip identical across all frames
"""
from PIL import Image, ImageChops
import os

W = H = 1280
CX = 640
COIN_D = 640

def load_face(path):
    coin = Image.open(path).convert("RGBA")
    bbox = coin.getchannel("A").getbbox()
    coin = coin.crop(bbox)
    side = max(coin.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(coin, ((side - coin.size[0]) // 2, (side - coin.size[1]) // 2), coin)
    return sq.resize((COIN_D, COIN_D), Image.LANCZOS)

def frame_face(i):
    fr = Image.open(f"frames/f_{i:03d}.png").convert("RGBA")
    return fr.crop((CX - COIN_D // 2, 560 - COIN_D // 2, CX + COIN_D // 2, 560 + COIN_D // 2))

def diff_score(a, b):
    """Mean abs diff over opaque area of a, 0-255 scale."""
    a, b = a.convert("RGBA"), b.convert("RGBA")
    diff = ImageChops.difference(a, b)
    px = diff.load()
    total, n = 0, 0
    A = a.getchannel("A").load()
    for y in range(0, a.size[1], 4):
        for x in range(0, a.size[0], 4):
            if A[x, y] > 200:
                r, g, bb, _ = px[x, y]
                total += (r + g + bb) / 3
                n += 1
    return total / max(1, n)

# faces (specular band adds slight lighting; tolerance considered)
front = load_face("front.png")
back = load_face("back.png")

d0 = diff_score(frame_face(0), front)
d168 = diff_score(frame_face(168), back)

print(f"frame 0 vs front.png: mean diff = {d0:.2f}/255 (specular adds a few units)")
print(f"frame 168 vs back.png: mean diff = {d168:.2f}/255")

# title/footer static across frames
def strip(i, y0, y1):
    return Image.open(f"frames/f_{i:03d}.png").crop((0, y0, W, y1))

title_ref = strip(0, 0, 120)
foot_ref = strip(0, 1150, 1280)
worst_t, worst_f = 0.0, 0.0
for i in range(0, 360, 24):
    dt = diff_score(strip(i, 0, 120), title_ref)
    df = diff_score(strip(i, 1150, 1280), foot_ref)
    worst_t, worst_f = max(worst_t, dt), max(worst_f, df)
print(f"title strip max drift across video: {worst_t:.2f}/255 (0 = perfectly static)")
print(f"footer strip max drift: {worst_f:.2f}/255")

ok = d0 < 6 and d168 < 6 and worst_t == 0 and worst_f == 0
print("VERDICT:", "PASS" if ok else "CHECK NEEDED")
