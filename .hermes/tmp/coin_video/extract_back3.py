"""Locate the coin disc per-frame via run-length projections (numpy only),
find the frame where the visible face differs most from the FRONT (frame 0),
then extract that disc as the back artwork the user wants.
"""
import math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw

os.makedirs("extract", exist_ok=True)

# full-rate sample: every 3rd frame
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "vyronx_coin_wan30.mp4",
                "-vf", "select='not(mod(n\\,3))'", "-vsync", "vfr",
                "extract/s_%03d.png"], check=True)

def find_disc(np_img):
    """Return (cx, cy, r) of the big bright disc, or None."""
    g = np_img.mean(axis=2)
    h, w = g.shape
    # central search band
    ys, xs = np.mgrid[0:h, 0:w]
    band = (xs > 120) & (xs < w - 120) & (ys > 200) & (ys < 860)
    m = (g > 85) & band
    if m.sum() < 5000:
        return None
    best = None  # (run_len, cx, cy)
    # row runs
    row_info = []
    for y in range(220, 850, 4):
        row = m[y]
        idx = np.flatnonzero(row)
        if len(idx) < 260:
            continue
        # longest consecutive run
        splits = np.flatnonzero(np.diff(idx) > 6)
        starts = np.concatenate(([0], splits + 1))
        ends = np.concatenate((splits, [len(idx) - 1]))
        lengths = ends - starts + 1
        k = int(np.argmax(lengths))
        if lengths[k] >= 260:
            row_info.append((lengths[k], (idx[starts[k]] + idx[ends[k]]) / 2, y))
    if len(row_info) < 15:
        return None
    lens = np.array([r[0] for r in row_info], float)
    cxs = np.array([r[1] for r in row_info], float)
    cys = np.array([r[2] for r in row_info], float)
    keep = lens >= np.percentile(lens, 40)
    d = float(np.median(lens[keep]))
    cx = float(np.median(cxs[keep]))
    cy = float(np.median(cys[lens >= d * 0.9])) if (lens >= d * 0.9).any() else float(np.median(cys))
    return cx, cy, d / 2

def disc_arr(path, s=96):
    im = np.asarray(Image.open(path).convert("RGB"))
    det = find_disc(im)
    if det is None:
        return None, None
    cx, cy, r = det
    x0, y0 = int(cx - r), int(cy - r)
    side = int(2 * r)
    if x0 < 0 or y0 < 0 or x0 + side > im.shape[1] or y0 + side > im.shape[0]:
        return None, None
    disc = im[y0:y0 + side, x0:x0 + side]
    img = Image.fromarray(disc).resize((s, s), Image.LANCZOS)
    return np.asarray(img.convert("L"), float), det

frames = sorted(os.listdir("extract"))
front_ref, det0 = disc_arr(os.path.join("extract", frames[0]))
print("front disc:", det0)

def ncorr(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / math.sqrt((a * a).sum() * (b * b).sum() + 1e-9))

rows = []
for fn in frames:
    d, det = disc_arr(os.path.join("extract", fn))
    if d is None:
        continue
    rows.append((ncorr(d, front_ref), fn, det))

rows.sort()
print("\nframes most dissimilar to front:")
for c, fn, det in rows[:8]:
    print(f"  corr={c:+.3f} {fn} disc={tuple(round(v,1) for v in det)}")

# choose the most dissimilar frame with a well-centered big disc
c, fn, det = rows[0]
print("\nEXTRACT FROM", fn, "corr", round(c, 3))

# dump that exact frame at full quality: index i -> source frame n=(i-1)*3
i = int(fn.split("_")[1].split(".")[0])
n = (i - 1) * 3
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "vyronx_coin_wan30.mp4",
                "-vf", f"select='eq(n\\,{n})'", "-vsync", "vfr", "-frames:v", "1",
                "back_frame.png"], check=True)

im = np.asarray(Image.open("back_frame.png").convert("RGB"))
det = find_disc(im)
cx, cy, r = det
print("disc at full res:", tuple(round(v, 1) for v in det))
x0, y0, side = int(cx - r), int(cy - r), int(2 * r)
disc = Image.fromarray(im[y0:y0 + side, x0:x0 + side])
mask = Image.new("L", disc.size, 0)
md = ImageDraw.Draw(mask)
md.ellipse([1, 1, side - 2, side - 2], fill=255)
out = disc.convert("RGBA")
out.putalpha(mask)
out.save("back_from_wan.png")
print("SAVED back_from_wan.png", out.size)
