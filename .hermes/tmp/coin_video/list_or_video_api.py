import json, urllib.request

req = urllib.request.Request(
    "https://openrouter.ai/api/v1/videos/models",
    headers={"User-Agent": "Mozilla/5.0"},
)
try:
    data = json.load(urllib.request.urlopen(req, timeout=30))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
    raise SystemExit
models = data.get("data", data)
print("MODELOS DE VIDEO:", len(models))
for m in models:
    print(json.dumps(m, indent=None)[:600])
