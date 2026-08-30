"""Debug: coin bbox stats per sampled frame of wan30 video."""
import os
from PIL import Image

def coin_bbox(img, thr=70):
    g = img.convert("L")
    px = g.load()
    w, h = g.size
    xs, ys = [], []
    for y in range(100, h - 40, 3):
        for x in range(40, w - 40, 3):
            if px[x, y] > thr:
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)

frames = sorted(os.listdir("extract"))
print(f"{len(frames)} sampled frames")
for fn in frames[::4]:  # every 4th sample = ~1.5s apart
    img = Image.open(os.path.join("extract", fn))
    bb = coin_bbox(img)
    if bb:
        x0, y0, x1, y1 = bb
        print(f"{fn}: bbox=({x0},{y0})-({x1},{y1}) w={x1-x0} h={y1-y0} ratio={(x1-x0)/max(1,y1-y0):.2f}")
    else:
        print(f"{fn}: none")
