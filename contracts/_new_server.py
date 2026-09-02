import json, hashlib, threading, time
from fastapi import FastAPI, UploadFile, File, HTTPException
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

@app.post("/butler/arm")
async def butler_arm(aid: int, user: str):
    user = user.lower()
    with LOCK:
        d = _load()
        d[str(aid)] = sorted(set(d.get(str(aid), [])) | {user})
        _save(d)
    return {"ok": True, "registered": d[str(aid)]}

@app.get("/butler/armed")
async def butler_armed():
    return _load()

# ── Instant click-to-bid queue (bot pays gas; user never signs) ──
@app.post("/butler/click")
async def butler_click(aid: int, user: str):
    user = user.lower()
    with LOCK:
        try:
            q = json.loads(CLICKS_FILE.read_text())
        except Exception:
            q = []
        now = time.time()
        q = [c for c in q if now - c.get("ts", 0) < 30]
        if not any(c["aid"] == aid and c["user"] == user for c in q):
            q.append({"aid": aid, "user": user, "ts": now})
            CLICKS_FILE.write_text(json.dumps(q))
    return {"ok": True, "queued": len(q)}

@app.get("/butler/clicks")
async def butler_clicks():
    try:
        return json.loads(CLICKS_FILE.read_text())
    except Exception:
        return []
