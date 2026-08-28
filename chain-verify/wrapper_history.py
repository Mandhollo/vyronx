import json, urllib.request, time

RPCS = ["https://bsc-dataseed.binance.org", "https://bsc.publicnode.com"]
TOKEN = "0xBFa4E255745e784bc3A449a2C507f5C29877cD66".lower()
W = "0xca7df2522b08453715372eec33b40ab499d9b86c".lower()
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
PAD = "0x000000000000000000000000" + W[2:]

def rpc_call(method, params, i=0):
    payload = json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req = urllib.request.Request(RPCS[i % len(RPCS)], data=payload,
                                 headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())

bn = int(rpc_call("eth_blockNumber", [])["result"], 16)
START = bn - 3_000_000  # ~104 dias — cobre deploy do wrapper
print(f"histórico wrapper | blocos {START}..{bn}", flush=True)

ins, outs, b, chunk = [], [], bn, 4999
fails = 0
while b > START:
    frm = max(START, b - chunk)
    got = False
    for direction, sink in [([TRANSFER, None, PAD], ins), ([TRANSFER, PAD], outs)]:
        try:
            res = rpc_call("eth_getLogs", [{"address": TOKEN, "topics": direction,
                "fromBlock": hex(frm), "toBlock": hex(b)}], fails)
            sink.extend(res.get("result", [])); got = True
        except Exception:
            pass
    if not got:
        fails += 1
        time.sleep(0.8)
        if fails % 20 == 0: print(f"retries={fails} em blk {frm}", flush=True)
    else:
        fails = 0
    b = frm

print(f"\nENTRADAS: {len(ins)} | SAÍDAS: {len(outs)}", flush=True)
print("\n--- SAÍDAS (bônus/saques) ---")
for lg in sorted(outs, key=lambda x: int(x["blockNumber"],16)):
    print(f"blk {int(lg['blockNumber'],16)} | -> 0x{lg['topics'][2][-40:]} | {int(lg['data'],16)/1e18:,.2f} VYR | tx {lg['transactionHash'][:22]}")
print("\n--- ENTRADAS (funding) ---")
tot = 0
for lg in sorted(ins, key=lambda x: int(x["blockNumber"],16)):
    amt = int(lg["data"],16)/1e18; tot += amt
    print(f"blk {int(lg['blockNumber'],16)} | de 0x{lg['topics'][1][-40:]} | {amt:,.2f} VYR | tx {lg['transactionHash'][:22]}")
print(f"\ntotal funding: {tot:,.2f} VYR")
