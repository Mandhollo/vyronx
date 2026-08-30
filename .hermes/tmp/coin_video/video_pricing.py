import json, urllib.request

req = urllib.request.Request(
    "https://openrouter.ai/api/v1/videos/models",
    headers={"User-Agent": "Mozilla/5.0"},
)
data = json.load(urllib.request.urlopen(req, timeout=30))["data"]

shortlist = ["alibaba/wan-3.0", "alibaba/wan-3.0-prime", "bytedance/seedance-2.0",
             "bytedance/seedance-2.0-fast", "bytedance/seedance-2.5",
             "kwaivgi/kling-v3.0-pro", "kwaivgi/kling-v3.0-std", "minimax/hailuo-3",
             "runway/gen-4.5", "alibaba/wan-2.7"]

for m in data:
    if m["id"] in shortlist:
        print("=" * 70)
        print(m["id"])
        for k in ("supported_frame_images", "supported_durations", "supported_sizes",
                  "supported_resolutions", "supported_aspect_ratios"):
            print(f"  {k}: {m.get(k)}")
        print("  pricing:", json.dumps(m.get("pricing")))
        # dump any other useful keys
        for k, v in m.items():
            if k not in ("id", "description", "name", "canonical_slug", "hugging_face_id",
                         "created", "supported_frame_images", "supported_durations",
                         "supported_sizes", "supported_resolutions",
                         "supported_aspect_ratios", "pricing") and v:
                print(f"  {k}: {str(v)[:200]}")
