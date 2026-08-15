#!/bin/bash
# AUDITORIA COMPLETA da árvore MLM na V4 (fonte da verdade on-chain)
RPC=https://bsc-dataseed.binance.org
V4=0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A
OUT=~/vyronx/chain-verify/v4_tree_audit.txt
: > $OUT

# 1) Todos os 23 vouchers: recipient, poolId, usdtValue, redeemed
echo "=== VOUCHERS V4 (id, recipient, poolId, usdtValue, redeemed, cancelled) ===" >> $OUT
COUNT=$(cast call $V4 "getVoucherCount()(uint256)" --rpc-url $RPC | awk '{print $1}')
echo "voucherCount=$COUNT" >> $OUT
for i in $(seq 0 22); do
  R=$(cast call $V4 "vouchers(uint256)(address,uint256,uint256,uint256,bool,bool)" $i --rpc-url $RPC 2>/dev/null | tr '\n' '|')
  echo "voucher[$i]=$R" >> $OUT
done

# 2) Referrer de cada wallet conhecida (owner + 23 recipients + 0x22b0)
echo "=== REFERRERS ===" >> $OUT
WALLETS="0x77619322427f006b14DA3Dbb25F9eb420372f7c7 0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c 0xEd324c73fae8bCbC3318123a025ec47A41E20b71 0xB863C989b252749f89d14086fabB40E5f17ab77D 0x5b4b91aA04e2722ebAF4A6090970c1c92BEe1090 0xd7A8484fD713D28870FCd4ad198fAB9e3ffDedB1 0xB783cC9C7785caf201d77167eCB60f381AAca9d9 0x470a2608fa72f823d4C32Bf32f3ea318fb995c6E 0x11B9aF1e89C2c51aB39be59Ea248Cb6a495Cb84e 0x301892e42aE40327856bb676B1e7c2e4C4B7392c 0x28c438cb3Ab95B6dEE755A3f3570943b52C7b0F4 0x3b791FF255AD221475e5551FfE0FB605b9753257 0xC06cedf252139469B797b719B97C0541dab7aC77 0x9D173220DA490ea1374F818106707D6a749fe700 0x8986e36a8814b3783c0C4034654708115349b356 0xE42Ea653Be137954b0bFF7193c06A363CEccbB3b 0xF077609b70baF4eA503E54D1731d65eB4eBB149e 0x9Db81f4E9CdD28C1497cC147bE36055A8859E034 0x9A38A4b356536302fdF80A114C70cbC5a9A3E8d1 0xa3Ebe62F3493DEfe02F828183796d26b39312C51 0x76a5cbf390Cb72AC820857FAA7f8F5a9152B579C 0xd784b8c7B8ADCF81dEEAbB75883656a39728C4B0 0xe9A61001c79287C300378F5caB528baec36274Cd 0x22b057604bce4b807CeD6172Dd5B9eB7c18777F3"
for w in $WALLETS; do
  R=$(cast call $V4 "referrer(address)(address)" $w --rpc-url $RPC 2>/dev/null | awk '{print $1}')
  echo "referrer[$w]=$R" >> $OUT
done

# 3) Diretos de TODAS as wallets (descoberta recursiva: 2 níveis além dos conhecidos)
echo "=== DIRETOS (enumeração por índice) ===" >> $OUT
enum_directs() {
  local w=$1
  local i=0
  while : ; do
    r=$(cast call $V4 "directReferrals(address,uint256)(address)" $w $i --rpc-url $RPC 2>/dev/null) || break
    [ -z "$r" ] && break
    echo "direct[$w][$i]=$r" >> $OUT
    i=$((i+1))
    [ $i -gt 30 ] && break
  done
}
for w in $WALLETS; do enum_directs $w; done
echo "=== FIM ===" >> $OUT
wc -l $OUT
