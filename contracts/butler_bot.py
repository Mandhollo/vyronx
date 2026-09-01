#!/usr/bin/env python3
"""VyronX Butler Bot v3 — no getLogs bulk; tiny incremental windows + on-chain validation."""
import json, time, os, urllib.request

RPC = os.environ.get("BSC_RPC", "https://bsc-dataseed.nariox.org")
AUCTION = os.environ.get("AUCTION", "0xd238121ca8c40F87E75f05e6E9c75C87704A2D94")
BOT_KEY = os.environ["BOT_KEY"]
POLL = int(os.environ.get("POLL", "3"))
TRIGGER = int(os.environ.get("TRIGGER", "5"))

def rpc(method, params):
    req = urllib.request.Request(RPC, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        j = json.loads(r.read())
    if "error" in j:
        raise RuntimeError(str(j["error"])[:120])
    return j.get("result")

def call(to, data):
    return rpc("eth_call", [{"to": to, "data": data}, "latest"])

def h2i(h): return int(h, 16) if h and h != "0x" else 0

from Crypto.Hash import keccak
def sel(sig):
    k = keccak.new(digest_bits=256); k.update(sig.encode())
    return "0x" + k.hexdigest()[:8]

SEL_ACTIVE = sel("getActiveAuctionIds()")
SEL_GETAUC = sel("getAuction(uint256)")
SEL_BUTLER = sel("butlers(uint256,address)")
SEL_EXEC = sel("executeButler(uint256,address)")
EV_TOPIC = "0x" + keccak.new(digest_bits=256, data=b"ButlerArmed(uint256,address,uint96,uint128)").hexdigest()

def word(d, i): return d[2 + 64 * i: 2 + 64 * (i + 1)]
def addr_in_word(d, i): return "0x" + word(d, i)[24:]
def pad32hex(x): return hex(x)[2:].zfill(64) if isinstance(x, int) else x[2:].zfill(64)

from eth_account import Account
acct = Account.from_key(BOT_KEY)

def logs_range(a, b):
    return rpc("eth_getLogs", [{"fromBlock": hex(a), "toBlock": hex(b), "address": AUCTION, "topics": [EV_TOPIC]}]) or []

def send_tx(to, data):
    try:
        nonce = rpc("eth_getTransactionCount", [acct.address, "pending"])
        gas_price = rpc("eth_gasPrice", [])
        tx = {"to": to, "data": data, "chainId": 56, "nonce": int(nonce, 16),
              "gas": 300000, "gasPrice": int(int(gas_price, 16) * 1.15), "value": 0}
        signed = acct.sign_transaction(tx)
        raw = "0x" + signed.raw_transaction.hex()
        h = rpc("eth_sendRawTransaction", [raw])
        print(f"TX SENT {h}", flush=True)
        return h
    except Exception as e:
        print("tx err:", str(e)[:150], flush=True)
        return None

def main():
    print(f"butler-bot v3 up | auction={AUCTION} | bot={acct.address}", flush=True)
    armed = {}
    # catch-up: 10-block windows, one per cycle (never floods RPC)
    catchup_from = h2i(rpc("eth_blockNumber", [])) - 3000
    beat = 0
    while True:
        try:
            bn = h2i(rpc("eth_blockNumber", []))
            # 1) catch-up scan: single 10-block window per cycle
            if catchup_from < bn:
                a, b = catchup_from, min(catchup_from + 10, bn)
                try:
                    for lg in logs_range(a, b):
                        aid = h2i(lg["topics"][1])
                        user = "0x" + lg["topics"][2][26:]
                        armed[(aid, user.lower())] = True
                        print(f"discovered butler aid={aid} user={user}", flush=True)
                except Exception:
                    pass  # window throttled → retry next cycle
                catchup_from = b

            # 2) live auctions
            ids_raw = call(AUCTION, SEL_ACTIVE)
            n = h2i(word(ids_raw, 1)) if ids_raw and len(ids_raw) > 130 else 0
            now = int(time.time())
            for i in range(n):
                aid = h2i(word(ids_raw, 2 + i))
                au = call(AUCTION, SEL_GETAUC + pad32hex(aid))
                if not au or len(au) < 300: continue
                last_bidder = addr_in_word(au, 3).lower()
                end_time = h2i(word(au, 6))
                left = end_time - now
                if left > TRIGGER or left < -3: continue
                for (a2, user) in list(armed.keys()):
                    if a2 != aid: continue
                    if user == last_bidder: continue
                    st = call(AUCTION, SEL_BUTLER + pad32hex(aid) + pad32hex(user))
                    if not st or len(st) < 200: continue
                    max_bids = h2i(word(st, 0))
                    active = h2i(word(st, 2)) == 1
                    if not active or max_bids == 0:
                        armed.pop((a2, user), None)
                        continue
                    print(f"FIRE: aid={aid} user={user} left={left}s", flush=True)
                    send_tx(AUCTION, SEL_EXEC + pad32hex(aid) + pad32hex(user))
                    time.sleep(1.5)
            beat += 1
            if beat % 20 == 0:
                print(f"beat: active={n} armed={len(armed)} catchup_blk={catchup_from}/{bn}", flush=True)
        except Exception as e:
            print("loop err:", str(e)[:150], flush=True)
        time.sleep(POLL)

if __name__ == "__main__":
    main()
