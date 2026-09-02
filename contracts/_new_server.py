import json, hashlib, threading, time
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://vyronx.io", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/opt/vyronx-auction-img/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ARMED_FILE = Path("/opt/vyronx-butler/armed.json")
CLICKS_FILE = Path("/opt/vyronx-butler/clicks.json")
LOCK = threading.Lock()

@app.post("/auction-img/upload")
async def upload(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Max 5MB")
    ext = (file.filename or "img.png").rsplit(".", 1)[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "webp", "gif"):
        raise HTTPException(400, "Invalid type")
    name = hashlib.sha256(data).hexdigest()[:16] + "." + ("jpg" if ext == "jpeg" else ext)
    (UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"https://arb.vyronx.io/auction-img/{name}"}

# ── Butler registry ──
def _load():
    try:
        return json.loads(ARMED_FILE.read_text())
    except Exception:
        return {}

def _save(d):
    ARMED_FILE.parent.mkdir(parents=True, exist_ok=True)
    ARMED_FILE.write_text(json.dumps(d))

@app.get("/butler/armed")
async def butler_armed():
    return _load()

# ── Instant click-to-bid queue (bot pays gas; user never signs) ──
# Simple in-memory rate limit: max 12 requests per IP per 10s (per endpoint family)
from collections import defaultdict
_rl_hits = defaultdict(list)

def _rate_limited(ip: str, limit = 12, window = 10.0) -> bool:
    now = time.time()
    hits = [t for t in _rl_hits[ip] if now - t < window]
    hits.append(now)
    _rl_hits[ip] = hits
    return len(hits) > limit

@app.post("/butler/click")
async def butler_click(aid: int, user: str, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if _rate_limited(f"click:{ip}"):
        raise HTTPException(429, "Too many requests")
    if not user.lower().startswith("0x") or len(user) != 42:
        raise HTTPException(400, "Invalid user")
    if aid <= 0 or aid > 10_000_000:
        raise HTTPException(400, "Invalid aid")
    user = user.lower()
    with LOCK:
        try:
            q = json.loads(CLICKS_FILE.read_text())
        except Exception:
            q = []
        now = time.time()
        q = [c for c in q if now - c.get("ts", 0) < 30]
        # dedupe window: 1.5s (rapid-fire clicks allowed, spam-bot bursts limited by rate-limit)
        if not any(c["aid"] == aid and c["user"] == user and now - c.get("ts", 0) < 1.5 for c in q):
            q.append({"aid": aid, "user": user, "ts": now})
            CLICKS_FILE.write_text(json.dumps(q))
    return {"ok": True, "queued": len(q)}

@app.post("/butler/arm")
async def butler_arm(aid: int, user: str, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if _rate_limited(f"arm:{ip}"):
        raise HTTPException(429, "Too many requests")
    user = user.lower()
    with LOCK:
        d = _load()
        d[str(aid)] = sorted(set(d.get(str(aid), [])) | {user})
        _save(d)
    return {"ok": True, "registered": d[str(aid)]}

@app.get("/butler/clicks")
async def butler_clicks():
    try:
        return json.loads(CLICKS_FILE.read_text())
    except Exception:
        return []
