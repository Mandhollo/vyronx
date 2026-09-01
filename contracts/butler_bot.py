#!/usr/bin/env python3
"""VyronX Butler Bot — watches auctions and executes armed butlers.

Every POLL seconds:
  1. read active auction ids
  2. for each, read auction state
  3. find armed butlers (ButlerArmed events since auction start)
  4. if user is LOSING and timer < TRIGGER_SECONDS: executeButler on their behalf
Gas is paid by the bot wallet. Bids come from the USER's credit balance.
"""
import json, time, os, urllib.request

RPC = os.environ.get("BSC_RPC", "https://bsc-dataseed.binance.org")
AUCTION = os.environ.get("AUCTION", "0xd238121ca8c40F87E75f05e6E9c75C87704A2D94")
BOT_KEY = os.environ["BOT_KEY"]          # deployer wallet (0xd7A8...) private key
POLL = int(os.environ.get("POLL", "3"))
TRIGGER = int(os.environ.get("TRIGGER", "5"))  # fire when <=5s left

def rpc(method, params):
    req = urllib.request.Request(RPC, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read()).get("result")

def call(to, data):
    return rpc("eth_call", [{"to": to, "data": data}, "latest"])

def h2i(h): return int(h, 16) if h and h != "0x" else 0

# selectors
SEL_ACTIVE_IDS = "0x" + "0" * 0  # getActiveAuctionIds() -> set via cast below
# precomputed:
# getActiveAuctionIds() = 0x9dd57f4c
# getAuction(uint256)   = 0x9d76bf58  (returns tuple)
# executeButler(uint256,address) = ?
# butlers(uint256,address) = ?

import hashlib
def keccak_sel(sig):
    # use cast-equivalent: rely on precomputed table passed via env? simplest: use web3-free keccak from eth_hash
    try:
        from Crypto.Hash import keccak
        k = keccak.new(digest_bits=256); k.update(sig.encode())
        return "0x" + k.hexdigest()[:8]
    except ImportError:
        raise SystemExit("pip install pycryptodome")

SEL_ACTIVE = keccak_sel("getActiveAuctionIds()")
SEL_GETAUC = keccak_sel("getAuction(uint256)")
SEL_BUTLER = keccak_sel("butlers(uint256,address)")
SEL_EXEC = keccak_sel("executeButler(uint256,address)")

def pad32(x): return hex(x)[2:].zfill(64) if isinstance(x, int) else x[2:].zfill(64)

# ── find armed butlers via logs (ButlerArmed event) ──
EV_TOPIC = None  # filled at start
def get_event_topic():
    global EV_TOPIC
    from Crypto.Hash import keccak
    k = keccak.new(digest_bits=256)
    k.update(b"ButlerArmed(uint256,address,uint96,uint128)")
    EV_TOPIC = "0x" + k.hexdigest()

def logs_from(from_block):
    flt = {"fromBlock": hex(from_block), "toBlock": "latest", "address": AUCTION, "topics": [EV_TOPIC]}
    return rpc("eth_getLogs", [flt]) or []

# ── tx send via eth_account ──
from eth_account import Account
acct = Account.from_key(BOT_KEY)

def send_tx(to, data):
    try:
        nonce = rpc("eth_getTransactionCount", [acct.address, "pending"])
        gas_price = rpc("eth_gasPrice", [])
        tx = {
            "to": to, "data": data, "chainId": 56,
            "nonce": int(nonce, 16), "gas": 250000,
            "gasPrice": int(int(gas_price, 16) * 1.1),
            "value": 0,
        }
        signed = acct.sign_transaction(tx)
        raw = "0x" + signed.raw_transaction.hex()
        h = rpc("eth_sendRawTransaction", [raw])
        print(f"tx sent: {h} data={data[:20]}...")
        return h
    except Exception as e:
        print("tx err:", str(e)[:120])
        return None

def main():
    get_event_topic()
    print(f"butler-bot up | auction={AUCTION} | bot={acct.address} | trigger<= {TRIGGER}s")
    last_block = h2i(rpc("eth_blockNumber", [])) - 600  # ~30min of blocks
    while True:
        try:
            bn = h2i(rpc("eth_blockNumber", []))
            # refresh armed butlers
            armed = {}  # (auctionId, user) -> True
            for lg in logs_from(max(last_block, bn - 3000)):
                aid = int(lg["topics"][1].hex() if isinstance(lg["topics"][1], bytes) else lg["topics"][1], 16)
                user = "0x" + (lg["topics"][2][26:] if not isinstance(lg["topics"][2], bytes) else lg["topics"][2].hex()[26:])
                armed[(aid, user.lower())] = True
            last_block = bn

            ids_raw = call(AUCTION, SEL_ACTIVE)
            # uint[] return: offset(32) + len(32) + elems
            if ids_raw and len(ids_raw) > 130:
                n = int(ids_raw[66:130], 16)
                for i in range(n):
                    aid = int(ids_raw[130 + 64 * i:194 + 64 * i], 16)
                    # getAuction: lastBidder at word 4 (after prize,price,bidCount), endTime word 7
                    au = call(AUCTION, SEL_GETAUC + pad32(aid))
                    if not au or len(au) < 200: continue
                    last_bidder = "0x" + au[10 + 64 * 3 : 10 + 64 * 3 + 40]
                    end_time = int(au[2 + 64 * 6: 2 + 64 * 7], 16)
                    now = int(time.time())
                    left = end_time - now
                    if left > TRIGGER or left < -2: continue
                    for (a2, user) in list(armed.keys()):
                        if a2 != aid: continue
                        if user == last_bidder.lower(): continue  # already winning
                        st = call(AUCTION, SEL_BUTLER + pad32(aid) + pad32(user))
                        if not st or len(st) < 130: continue
                        max_bids = int(st[2:66], 16)
                        active = int(st[130:194], 16) == 1
                        if not active or max_bids == 0: continue
                        print(f"FIREFIGHT: auction {aid} user {user} left={left}s -> executeButler")
                        send_tx(AUCTION, SEL_EXEC + pad32(aid) + pad32(user))
                        armed.pop((a2, user), None)
                        time.sleep(1)
        except Exception as e:
            print("loop err:", str(e)[:150])
        time.sleep(POLL)

if __name__ == "__main__":
    main()
