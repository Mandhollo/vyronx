import json, subprocess

RPC = "https://bsc-dataseed.binance.org"
V4 = "0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A"

def cast(sig, *args):
    cmd = ["cast", "call", V4, sig] + list(args) + ["--rpc-url", RPC]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return out.stdout.strip()

def decode_tuple(hexstr):
    h = hexstr.replace("0x", "")
    words = [h[i:i+64] for i in range(0, len(h), 64)]
    recipient = "0x" + words[0][24:]
    pool_id = int(words[1], 16)
    usdt = int(words[2], 16) / 10**18
    expiry = int(words[3], 16)
    redeemed = int(words[4], 16) == 1
    cancelled = int(words[5], 16) == 1
    return recipient, pool_id, usdt, expiry, redeemed, cancelled

def addr_of(hexword):
    return "0x" + hexword.replace("0x", "")[-40:].lstrip("0").rjust(40, "0")

count = int(cast("getVoucherCount()(uint256)").split()[0], 16)
print(f"Total vouchers in V4: {count}\n")
vouchers = []
for i in range(count):
    raw = cast("vouchers(uint256)", str(i))
    recipient, pool_id, usdt, expiry, redeemed, cancelled = decode_tuple(raw)
    ref_raw = cast("referrer(address)", recipient)
    ref = addr_of(ref_raw)
    vouchers.append({
        "id": i, "recipient": recipient, "poolId": pool_id,
        "usdt": usdt, "redeemed": redeemed, "cancelled": cancelled,
        "referrer": ref,
    })
    print(f"#{i:2d} {recipient} pool={pool_id} ${usdt:>8.0f} redeemed={str(redeemed):5s} cancelled={cancelled} ref={ref}")

with open(r"C:\Users\Mandhollo\vyronx\vouchers_v4.json", "w") as f:
    json.dump(vouchers, f, indent=2)
print(f"\nSaved {len(vouchers)} vouchers to vouchers_v4.json")
