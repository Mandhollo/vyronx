#!/bin/bash
# BFS COMPLETO: encontra TODAS wallets com referrer registrado (V4 e V5)
RPC=https://bsc-dataseed.binance.org
V4=0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A
V5=0xc9c5680487f1EFEEAb5F1aDF31D3D110FabA9aB4
OWNER=0x77619322427f006b14DA3Dbb25F9eb420372f7c7

bfs() {
  local C=$1 LABEL=$2
  echo "===== $LABEL ====="
  local queue="$OWNER"
  local visited="$OWNER"
  local found=0
  while [ -n "$queue" ]; do
    local nextq=""
    for addr in $queue; do
      local i=0
      while true; do
        res=$(cast call $C "directReferrals(address,uint256)(address)" $addr $i --rpc-url $RPC 2>/dev/null) || break
        [ -z "$res" ] && break
        case "$visited" in *"$res"*) i=$((i+1)); continue;; esac
        visited="$visited $res"
        nextq="$nextq $res"
        nref=$(cast call $C "referrer(address)(address)" $res --rpc-url $RPC 2>/dev/null)
        nstk=$(cast call $C "getUserStakeCount(address)(uint256)" $res --rpc-url $RPC 2>/dev/null)
        echo "direto_de[$addr] wallet=$res referrer=$nref stakes=$nstk"
        found=$((found+1))
        i=$((i+1))
      done
    done
    queue="$nextq"
  done
  echo "TOTAL_REGISTRADOS_$LABEL=$found (além do owner)"
}

bfs $V4 "V4" 
bfs $V5 "V5"
