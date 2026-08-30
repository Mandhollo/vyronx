"""Submit VyronX coin keyframe to OpenRouter video API (alibaba/wan-3.0).
Reads key from ~/AppData/Local/hermes/.env in memory only. Never prints it.
Step 1 (this run): check credits. Step 2: submit + poll + download.
"""
import base64, json, os, sys, time, urllib.request

def get_key():
    env = os.path.expanduser("~/AppData/Local/hermes/.env")
    for line in open(env, encoding="utf-8"):
        line = line.strip()
        if line.startswith("OPENROUTER_API_KEY"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENROUTER_API_KEY not in .env")

KEY = get_key()
print("key loaded: len", len(KEY), "prefix", KEY[:5] + "***")

def api(path, data=None, method=None, raw=False):
    url = "https://openrouter.ai/api/v1" + path
    body = None
    headers = {"Authorization": f"Bearer {KEY}"}
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    if method:
        headers["X-HTTP-Method-Override"] = method  # not needed; urllib uses full URL
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            payload = r.read()
            return r.status, (payload if raw else json.loads(payload))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:800]

# ---- Step 1: credits ----
if len(sys.argv) > 1 and sys.argv[1] == "credits":
    status, resp = api("/credits")
    print(status, json.dumps(resp, indent=2) if not isinstance(resp, str) else resp)
    sys.exit(0)

# ---- Step 2: submit ----
def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()

prompt = (
    "Cinematic product showcase: a luxurious gold-and-black crypto coin floats inside a "
    "trapezoidal holographic glass display case with glowing golden neon edges, on a dark "
    "studio stage with a reflective floor. The coin slowly rotates around its vertical axis, "
    "revealing its ornate back face, then continues turning. Golden dust particles drift in "
    "the light. Subtle camera push-in. The title text 'VYRONX' at top and the tagline text "
    "at bottom remain perfectly static, sharp and unchanged. Premium, elegant, high-end "
    "commercial style, volumetric lighting, 3D render."
)

payload = {
    "model": "alibaba/wan-3.0",
    "prompt": prompt,
    "duration": 12,
    "resolution": "720p",
    "aspect_ratio": "1:1",
    "frame_images": [
        {"type": "image_url",
         "image_url": {"url": b64("keyframe_first.png")},
         "frame_type": "first_frame"}
    ],
    "input_references": [
        {"type": "image_url", "image_url": {"url": b64("front.png")}},
        {"type": "image_url", "image_url": {"url": b64("back.png")}},
    ],
}

status, resp = api("/videos", payload)
print("SUBMIT:", status, json.dumps(resp)[:500] if not isinstance(resp, str) else resp)
if status not in (200, 201, 202):
    sys.exit(1)

job_id = resp.get("id") if isinstance(resp, dict) else None
if not job_id:
    sys.exit("no job id")

# ---- poll ----
deadline = time.time() + 570
last = None
while time.time() < deadline:
    time.sleep(12)
    st, job = api(f"/videos/{job_id}")
    if not isinstance(job, dict):
        print("poll", st, str(job)[:200]); continue
    s = job.get("status")
    if s != last:
        print(time.strftime("%H:%M:%S"), "status:", s, flush=True)
        last = s
    if s in ("completed", "failed", "cancelled", "expired"):
        print(json.dumps(job)[:900])
        break

if isinstance(job, dict) and job.get("status") == "completed":
    st2, content = api(f"/videos/{job_id}/content", raw=True)
    if isinstance(content, bytes):
        out = "vyronx_coin_wan30.mp4"
        open(out, "wb").write(content)
        print("DOWNLOADED:", out, len(content), "bytes | usage:", job.get("usage"))
    else:
        print("content fetch failed:", st2, str(content)[:300])
else:
    print("job did not complete:", job if isinstance(job, dict) else "?")
