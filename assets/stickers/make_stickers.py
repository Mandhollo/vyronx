from PIL import Image, ImageDraw, ImageFont
import math, os, subprocess

OUT = r'C:\Users\Mandhollo\vyronx\assets\stickers\frames'
FINAL = r'C:\Users\Mandhollo\vyronx\assets\stickers'
os.makedirs(OUT, exist_ok=True)
os.makedirs(FINAL, exist_ok=True)
SIZE = (512, 512)

def clear_out():
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))

def draw_coin(size, rot, scale=1.0, ox=0):
    img = Image.new('RGBA', size, (0,0,0,0))
    draw = ImageDraw.Draw(img)
    cx, cy = size[0]//2 + ox, size[1]//2
    R = int(170*scale)
    r = max(8, min(R, int(R*(abs(math.sin(rot))+0.05))))
    # shadow
    s = Image.new('RGBA', size, (0,0,0,0))
    ImageDraw.Draw(s).ellipse([cx-R//2+6, cy-R//2+12, cx+R//2+6, cy+R//2+12], fill=(0,0,0,40))
    img = Image.alpha_composite(img, s)
    # rim
    draw.ellipse([cx-R, cy-R, cx+R, cy+R], fill=(20,18,12,255))
    draw.ellipse([cx-R+12, cy-R+12, cx+R-12, cy+R-12], fill=(210,175,55,255))
    if r>20:
        i = Image.new('RGBA', size, (0,0,0,0))
        ImageDraw.Draw(i).ellipse([cx-r, cy-r, cx+r, cy+r], fill=(15,13,9,255))
        img = Image.alpha_composite(img, i)
        if r>35:
            l = Image.new('RGBA', size, (0,0,0,0))
            ld = ImageDraw.Draw(l)
            lr = int(r*0.52)
            ld.ellipse([cx-lr, cy-lr, cx+lr, cy+lr], fill=(0,0,0,180))
            # V mark only
            vw = int(lr*0.9); vh = int(lr*0.8)
            vx = cx - vw//2; vy = cy - vh//2
            ld.polygon([(vx,vy+vh),(vx+vw//2,vy),(vx+vw,vy+vh)], fill=(212,175,55,255))
            ld.polygon([(cx,vy),(cx-vw//3,vy+vh//2),(cx,vy+vh)], fill=(20,18,12,255))
            ld.polygon([(cx,vy),(cx+vw//3,vy+vh//2),(cx,vy+vh)], fill=(20,18,12,255))
            txt = Image.new('RGBA', size, (0,0,0,0))
            tdraw = ImageDraw.Draw(txt)
            try: font = ImageFont.truetype("arial.ttf", max(12, int(lr*0.28)))
            except: font = ImageFont.load_default()
            tdraw.text((cx, cy-lr-int(lr*0.25)), 'VYRONX', fill=(220,190,80,255), font=font, anchor='mm')
            img = Image.alpha_composite(img, l)
            img = Image.alpha_composite(img, txt)
    shine = Image.new('RGBA', size, (0,0,0,0))
    ImageDraw.Draw(shine).ellipse([cx-R+20, cy-R+20, cx-R+50, cy-R+28], fill=(255,255,220,35))
    img = Image.alpha_composite(img, shine)
    return img

def vx_pulse(glow):
    img = Image.new('RGBA', SIZE, (0,0,0,0))
    cx,cy=SIZE[0]//2,SIZE[1]//2
    for g in range(glow,0,-1):
        alpha=max(0,60-g*8); R=130+g*8
        ImageDraw.Draw(img).ellipse([cx-R,cy-R,cx+R,cy+R], outline=(212,175,55,alpha), width=2)
    R=130
    ImageDraw.Draw(img).ellipse([cx-R,cy-R,cx+R,cy+R], fill=(18,16,10,255))
    ImageDraw.Draw(img).ellipse([cx-R+10,cy-R+10,cx+R-10,cy+R-10], fill=(212,175,55,255))
    i=Image.new('RGBA', SIZE, (0,0,0,0)); ImageDraw.Draw(i).ellipse([cx-R+20,cy-R+20,cx+R-20,cy+R-20], fill=(10,9,6,255))
    try: font=ImageFont.truetype("arialbd.ttf",90)
    except: font=ImageFont.load_default()
    ImageDraw.Draw(i).text((cx,cy), 'VX', fill=(240,215,120,255), font=font, anchor='mm')
    return Image.alpha_composite(img, i)

def text_sticker(text, sub=''):
    img = Image.new('RGBA', SIZE, (0,0,0,0))
    cx,cy=SIZE[0]//2,SIZE[1]//2
    try: font=ImageFont.truetype("arialbd.ttf",110); subfont=ImageFont.truetype("arial.ttf",30)
    except: font=ImageFont.load_default(); subfont=ImageFont.load_default()
    # fast metallic plate: gradient via 4 rects
    plate = Image.new('RGBA', SIZE, (0,0,0,0))
    pd = ImageDraw.Draw(plate)
    pw,ph=360,180
    px,py=cx-pw//2, cy-ph//2-(20 if sub else 0)
    steps=10
    for s in range(steps):
        t1=s/steps; t2=(s+1)/steps
        y1=py+int(ph*t1); y2=py+int(ph*t2)
        r,g,b = int(20+180*t1), int(18+140*t1), int(12+30*t1)
        pd.rectangle([px,y1,px+pw,y2], fill=(r,g,b,255))
    # shine lines
    for i in range(6):
        y=py+10+i*28
        pd.line([(px+10,y),(px+pw-10,y)], fill=(255,255,200,25), width=1)
    img = Image.alpha_composite(img, plate)
    draw = ImageDraw.Draw(img)
    draw.text((cx, cy-(15 if sub else 0)), text, fill=(255,223,100,255), font=font, anchor='mm')
    if sub: draw.text((cx, cy+55), sub, fill=(220,220,220,255), font=subfont, anchor='mm')
    return img

def make_video(frames, out_path, fps=20):
    clear_out()
    for idx, frame in enumerate(frames):
        p = os.path.join(OUT, f'f_{idx:03d}.png')
        frame.save(p)
    cmd = [
        'ffmpeg','-y','-framerate',str(fps),'-i',os.path.join(OUT,'f_%03d.png'),
        '-c:v','libwebp','-pix_fmt','yuva420p','-lossless','0','-compression_level','6','-q:v','70',
        '-loop','0','-an',
        out_path
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print('STDERR', r.stderr[-500:])
        raise SystemExit('ffmpeg error')
    print('Saved', out_path, os.path.getsize(out_path))

make_video([draw_coin(SIZE, i*math.pi/20) for i in range(40)], os.path.join(FINAL,'vyronx-coin-3d.webp'), 20)
make_video([draw_coin(SIZE, math.pi*(i/50), scale=0.4+0.6*(1-abs(2*(i/50)-1)), ox=int(80*math.sin(2*math.pi*(i/50)))) for i in range(50)], os.path.join(FINAL,'vyronx-coin-flip.webp'), 25)
make_video([vx_pulse(int((math.sin(i*math.pi/10)+1)*10)) for i in range(40)], os.path.join(FINAL,'vyronx-vx-pulse.webp'), 20)
make_video([text_sticker('HOLD')]*30, os.path.join(FINAL,'vyronx-hold.webp'), 30)
make_video([text_sticker('MOON','TO THE 🌕')]*30, os.path.join(FINAL,'vyronx-moon.webp'), 30)
make_video([text_sticker('$VYR','VYRONX')]*30, os.path.join(FINAL,'vyronx-vyr.webp'), 30)
print('ALL DONE')
