#!/bin/bash
# Enumera a árvore MLM da V4 via getters públicos (1 índice por vez)
RPC=https://bsc-dataseed.binance.org
V4=0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A
MAE=0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c
OWNER=0x77619322427f006b14DA3Dbb25F9eb420372f7c7
THIAGO=0xEd324c73fae8bCbC3318123a025ec47A41E20b71

echo "=== DIRETOS DA CONTA MÃE (0xFfAF) ==="
i=0
while : ; do
  r=$(cast call $V4 "directReferrals(address,uint256)(address)" $MAE $i --rpc-url $RPC 2>/dev/null) || break
  [ -z "$r" ] && break
  echo "$i: $r"
  i=$((i+1))
  [ $i -gt 40 ] && break
done

echo "=== DIRETOS DO OWNER (0x7761) ==="
i=0
while : ; do
  r=$(cast call $V4 "directReferrals(address,uint256)(address)" $OWNER $i --rpc-url $RPC 2>/dev/null) || break
  [ -z "$r" ] && break
  echo "$i: $r"
  i=$((i+1))
  [ $i -gt 40 ] && break
done

echo "=== DIRETOS DO THIAGO (0xEd32) ==="
i=0
while : ; do
  r=$(cast call $V4 "directReferrals(address,uint256)(address)" $THIAGO $i --rpc-url $RPC 2>/dev/null) || break
  [ -z "$r" ] && break
  echo "$i: $r"
  i=$((i+1))
  [ $i -gt 40 ] && break
done

echo "=== DIRETOS DO PROMOTOR 7 (0x11B9) ==="
i=0
while : ; do
  r=$(cast call $V4 "directReferrals(address,uint256)(address)" 0x11B9aF1e89C2c51aB39be59Ea248Cb6a495Cb84e $i --rpc-url $RPC 2>/dev/null) || break
  [ -z "$r" ] && break
  echo "$i: $r"
  i=$((i+1))
  [ $i -gt 40 ] && break
done

echo "=== DIRETOS DO PROMOTOR 8 (0x28c4) ==="
i=0
while : ; do
  r=$(cast call $V4 "directReferrals(address,uint256)(address)" 0x28c438cb3Ab95B6dEE755A3f3570943b52C7b0F4 $i --rpc-url $RPC 2>/dev/null) || break
  [ -z "$r" ] && break
  echo "$i: $r"
  i=$((i+1))
  [ $i -gt 40 ] && break
done
