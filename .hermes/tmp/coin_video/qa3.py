"""QA3: correct face comparison.
frame coin area (640x640 at paste position) vs front/back plates directly.
frame 0   -> expect FRONT
frame 168 -> expect BACK (angle ~182°, squeeze ~identity, cy offset accounted)
"""
import math
from PIL import Image, ImageChops

CX, COIN_D = 640, 640
FPS = 30

def load_face(path):
    coin = Image.open(path).convert("RGBA")
    bbox = coin.getchannel("A").getbbox()
    coin = coin.crop(bbox)
    side = max(coin.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(coin, ((side - coin.size[0]) // 2, (side - coin.size[1]) // 2), coin)
    return sq.resize((COIN_D, COIN_D), Image.LANCZOS)

front, back = load_face("front.png"), load_face("back.png")

def cy_at(t):
    return 560 + 7 * math.sin(2 * math.pi * t / 6.0)

def coin_crop(i):
    t = i / FPS
    cy = int(cy_at(t))
    fr = Image.open(f"frames/f_{i:03d}.png").convert("RGBA")
    return fr.crop((CX - COIN_D // 2, cy - COIN_D // 2, CX + COIN_D // 2, cy + COIN_D // 2))

def diff(a, b):
    d = ImageChops.difference(a.convert("RGBA"), b.convert("RGBA"))
    px, A = d.load(), a.convert("RGBA").getchannel("A").load()
    tot = n = 0
    for y in range(0, a.size[1], 3):
        for x in range(0, a.size[0], 3):
            if A[x, y] > 200:
                r, g, bb, _ = px[x, y]
                tot += (r + g + bb) / 3
                n += 1
    return tot / max(1, n)

for i, expect in ((0, "FRONT"), (90, "FRONT(rot)"), (168, "BACK"), (250, "BACK(rot)"), (330, "FRONT")):
    c = coin_crop(i)
    df, db = diff(c, front), diff(c, back)
    shows = "FRONT" if df < db else "BACK"
    print(f"frame {i:3d}: diff-front {df:6.2f}  diff-back {db:6.2f}  -> shows {shows:5s} (expected {expect})")
print("DONE")
