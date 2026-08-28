import json, urllib.request, time, sys

RPCS = [
    "https://bsc-dataseed.binance.org",
    "https://bsc.publicnode.com",
    "https://binance.llamarpc.com",
]
P = "0xF695a3BEb63E54B7755c4a6110C8232C2582DA64".lower()
W = "0xcA7Df2522b08453715372EEc33b40aB499d9B86C".lower()

def k(s):
    from Crypto.Hash import keccak as _k
    h = _k.new(digest_bits=256); h.update(s.encode()); return "0x"+h.hexdigest()

TP = [k("TokensPurchased(address,uint256,uint256,uint256)")]
RR = [k("ReferralRegistered(address,address)")]
BP = [k("ReferralBonusPaid(address,address,uint256)")]
BR = [k("BoughtWithReferral(address,uint256,uint256,address)")]

def rpc_call(method, params, i=0):
    payload = json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req = urllib.request.Request(RPCS[i % len(RPCS)], data=payload,
                                 headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())

def get_logs(addr, topics, from_b, to_b):
    last_err = None
    for i in range(len(RPCS)*2):
        try:
            res = rpc_call("eth_getLogs", [{
                "address": addr, "topics": topics,
                "fromBlock": hex(from_b), "toBlock": hex(to_b),
            }], i)
            if "error" in res:
                last_err = str(res["error"])[:120]
                time.sleep(0.4); continue
            return res.get("result", [])
        except Exception as e:
            last_err = str(e)[:120]; time.sleep(0.4)
    raise RuntimeError(f"getLogs failed {from_b}-{to_b}: {last_err}")

bn = int(rpc_call("eth_blockNumber", [])["result"], 16)
START = bn - 80_000   # ~2.8 dias
print(f"scan {START}..{bn}", flush=True)

def sweep(addr, label, topics):
    out, b, chunk = [], bn, 5000
    while b > START:
        frm = max(START, b - chunk)
        try:
            out.extend(get_logs(addr, topics, frm, b))
        except RuntimeError as e:
            chunk //= 2
            if chunk < 400:
                print(f"{label}: chunk mín em {frm}", e, flush=True); chunk = 400
                try: out.extend(get_logs(addr, topics, frm, b))
                except Exception: pass
        b = frm
    print(f"{label}: {len(out)} eventos", flush=True)
    return out

def dec(lg):
    blk = int(lg["blockNumber"], 16)
    topics = ["0x"+t[-40:] for t in lg["topics"][1:]]
    data = lg.get("data","0x")
    words = [str(int(data[2+i*64:2+(i+1)*64],16)) if len(data)>=2+(i+1)*64 else "-" for i in range((len(data)-2)//64)]
    return blk, topics, words, lg["transactionHash"]

print("\n===== PRESALE: TokensPurchased (TODAS as compras, 2.8d) =====")
for lg in sweep(P, "PRESALE", TP):
    blk, t, w, tx = dec(lg)
    print(f"blk {blk} | buyer {t[0]} | usdt {w[0]} vyr {w[1]} bonus {w[2]} | tx {tx}")

print("\n===== WRAPPER: BoughtWithReferral =====")
for lg in sweep(W, "WRAP-BUY", BR):
    blk, t, w, tx = dec(lg)
    print(f"blk {blk} | buyer {t[0]} | usdt {w[0]} vyr {w[1]} | referrer {t[1] if len(t)>1 else '?'} | tx {tx}")

print("\n===== WRAPPER: ReferralBonusPaid =====")
for lg in sweep(W, "WRAP-BONUS", BP):
    blk, t, w, tx = dec(lg)
    print(f"blk {blk} | buyer {t[0]} | referrer {t[1] if len(t)>1 else '?'} | bonus {w[0]} | tx {tx}")

print("\n===== WRAPPER: ReferralRegistered =====")
for lg in sweep(W, "WRAP-REG", RR):
    blk, t, w, tx = dec(lg)
    print(f"blk {blk} | buyer {t[0]} → referrer {t[1] if len(t)>1 else '?'} | tx {tx}")
