import json, urllib.request, time

RPC = "https://bsc-dataseed.binance.org"
W = "0xcA7Df2522b08453715372EEc33b40aB499d9B86C".lower()
TOKEN = "0xBFa4E255745e784bc3A449a2C507f5C29877cD66".lower()

TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"  # Transfer(address,address,uint256)
WRAP_PADDED = "0x000000000000000000000000" + W[2:]

def rpc_call(method, params):
    payload = json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req = urllib.request.Request(RPC, data=payload, headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())

bn = int(rpc_call("eth_blockNumber", [])["result"], 16)
START = bn - 400_000  # ~14 dias
print(f"VYR Transfers FROM wrapper | blocos {START}..{bn}", flush=True)

out, b, chunk = [], bn, 5000
while b > START:
    frm = max(START, b - chunk)
    try:
        res = rpc_call("eth_getLogs", [{
            "address": TOKEN,
            "topics": [TRANSFER, WRAP_PADDED],
            "fromBlock": hex(frm), "toBlock": hex(b),
        }])
        out.extend(res.get("result", []))
    except Exception as e:
        chunk //= 2
        if chunk < 400:
            time.sleep(1); chunk = 400
            try:
                res = rpc_call("eth_getLogs", [{
                    "address": TOKEN, "topics": [TRANSFER, WRAP_PADDED],
                    "fromBlock": hex(frm), "toBlock": hex(b)}])
                out.extend(res.get("result", []))
            except Exception:
                print(f"fail {frm}-{b}", flush=True)
    b = frm

print(f"\n{len(out)} transfers do wrapper:", flush=True)
for lg in out:
    blk = int(lg["blockNumber"], 16)
    to = "0x" + lg["topics"][2][-40:]
    amt = int(lg["data"], 16) / 1e18
    print(f"blk {blk} | -> {to} | {amt:,.2f} VYR | tx {lg['transactionHash']}")
