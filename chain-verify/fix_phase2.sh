#!/usr/bin/env bash
# Fix presale phase 2: price $200 -> $0.02 (2 cents), allocation 150M, bonus 0
set -euo pipefail
cd /c/Users/Mandhollo/vyronx/contracts
PK=$(grep '^PRIVATE_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
SENDER=$(cast wallet address "$PK")
OWNER=0x77619322427f006b14DA3Dbb25F9eb420372f7c7
echo "sender: $SENDER"
if [ "${SENDER,,}" != "${OWNER,,}" ]; then echo "ABORT: sender is not owner"; exit 1; fi
P=0xF695a3BEb63E54B7755c4a6110C8232c2582DA64
R=https://bsc-dataseed.binance.org
echo "--- before ---"
cast call $P "phases(uint256)(uint256,uint256,uint256,uint256,bool)" 1 --rpc-url $R
echo "--- sending setPhase(1, 2 cents, 0 bonus, 150M tokens) ---"
cast send $P "setPhase(uint256,uint256,uint256,uint256)" 1 2 0 150000000 --rpc-url $R --private-key "$PK"
echo "--- after ---"
cast call $P "phases(uint256)(uint256,uint256,uint256,bool)" 1 --rpc-url $R
cast call $P "currentPhase()(uint256)" --rpc-url $R
cast call $P "getPresaleInfo()(uint256,uint256,uint256,uint256,uint256,uint256,bool,bool)" --rpc-url $R
