"""Locate coin disc via radial brightness profile from expected center,
then find the frame where shown face is most dissimilar to FRONT (= back reveal),
and extract that face as circular artwork.
"""
import math, os
from PIL import Image

def ray_profile(img, cx, cy, max_r=300, steps=180):
    g = img.convert("L")
    px = g.load()
    prof = []
    for a in range(steps):
        ang = 2 * math.pi * a / steps
        vals = []
        for r in range(0, max_r, 2):
            x = int(cx + r * math.cos(ang))
            y = int(cy + r * math.sin(ang))
            if 0 <= x < g.size[0] and 0 <= y < g.size[1]:
                vals.append(px[x, y])
        prof.append(vals)
    return prof

def estimate_radius(img, cx, cy):
    """Coin rim = bright gold ring; radius where many rays see a peak then dark outside."""
    g = img.convert("L")
    px = g.load()
    hits = [0] * 300
    for a in range(120):
        ang = 2 * math.pi * a / 120
        bright_run = []
        for r in range(120, 300):
            x = int(cx + r * math.cos(ang)); y = int(cy + r * math.sin(ang))
            if not (0 <= x < g.size[0] and 0 <= y < g.size[1]):
                continue
            if px[x, y] > 110:
                bright_run.append(r)
        if bright_run:
            # last bright run segment end approximates outer rim
            hits[bright_run[-1]] += 1
    best = max(range(len(hits)), key=lambda r: hits[r] if r > 150 else 0)
    return best, hits[best]

def crop_disc(img, cx, cy, r):
    x0, y0 = int(cx - r), int(cy - r)
    side = int(2 * r)
    sq = Image.new("RGB", (side, side), (0, 0, 0))
    sq.paste(img.crop((x0, y0, x0 + side, y0 + side)), (0, 0))
    return sq

def small(img, s=64):
    return img.convert("RGB").resize((s, s), Image.LANCZOS)

def corr(a, b):
    n = a.size[0] * a.size[1]
    va = list(a.convert("L").getdata()); vb = list(b.convert("L").getdata())
    ma, mb = sum(va) / n, sum(vb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(va, vb))
    na = math.sqrt(sum((x - ma) ** 2 for x in va))
    nb = math.sqrt(sum((y - mb) ** 2 for y in vb))
    return cov / max(1e-9, na * nb)

front = small(crop_disc(Image.open("front.png").convert("RGB"), 250, 250, 240))
back_old = small(crop_disc(Image.open("back.png").convert("RGB"), 250, 250, 240))

frames = sorted(os.listdir("extract"))
# tune center: test a few centers on one mid frame
probe = Image.open(os.path.join("extract", frames[30]))
for (cx, cy) in [(480, 420), (480, 450), (480, 480), (470, 430)]:
    r, votes = estimate_radius(probe, cx, cy)
    print(f"center ({cx},{cy}) -> radius {r} votes {votes}")

CXc, CYc = 480, 430
rows = []
for fn in frames:
    img = Image.open(os.path.join("extract", fn))
    disc = crop_disc(img, CXc, CYc, 200)  # inner disc core, avoid neon case
    d = small(disc)
    rows.append((corr(d, front), corr(d, back_old), fn))

rows.sort(key=lambda t: t[0])
print("\nmost-dissimilar-to-front frames (corr_front, corr_oldback, frame):")
for cf, cb, fn in rows[:8]:
    print(f"  {cf:+.3f}  {cb:+.3f}  {fn}")

# extract best
cf, cb, fn = rows[0]
img = Image.open(os.path.join("extract", fn))
r, votes = estimate_radius(img, CXc, CYc)
print(f"\nextracting from {fn}: radius {r} votes {votes}")
disc = crop_disc(img, CXc, CYc, r)
from PIL import ImageDraw
mask = Image.new("L", disc.size, 0)
md = ImageDraw.Draw(mask)
side = disc.size[0]
md.ellipse([1, 1, side - 2, side - 2], fill=255)
out = disc.convert("RGBA")
out.putalpha(mask)
out.save("back_from_wan.png")
print("SAVED back_from_wan.png", out.size, "corr to old back:", cb)
