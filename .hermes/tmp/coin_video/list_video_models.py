import json, urllib.request

req = urllib.request.Request("https://openrouter.ai/api/v1/models", headers={"User-Agent": "Mozilla/5.0"})
data = json.load(urllib.request.urlopen(req, timeout=30))["data"]
print("TOTAL MODELOS:", len(data))

video = []
for m in data:
    arch = m.get("architecture", {})
    mods = [str(x).lower() for x in (arch.get("output_modalities") or []) + (arch.get("input_modalities") or [])]
    if "video" in mods:
        video.append(m)

print("COM VIDEO:", len(video))
for m in video:
    p = m.get("pricing", {})
    print("-", m["id"],
          "| in:", ",".join(m["architecture"]["input_modalities"]),
          "| out:", ",".join(m["architecture"]["output_modalities"]),
          "| video$:", p.get("video"),
          "| image$:", p.get("image"),
          "| text$:", p.get("prompt") or p.get("text"))
