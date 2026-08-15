import re

# 1) Parse da árvore real V4 (on-chain)
real = {}
with open(r'C:\Users\Mandhollo\vyronx\chain-verify\v4_tree_audit.txt') as f:
    for line in f:
        line = line.strip()
        m = re.match(r'referrer\[(0x[0-9a-fA-F]{40})\]=(0x[0-9a-fA-F]{40}|0x0{40})', line)
        if m:
            real[m.group(1).lower()] = m.group(2).lower()
        m = re.match(r'direct\[(0x[0-9a-fA-F]{40})\]\[(\d+)\]=(0x[00-9a-fA-F]{40})', line)
        if m:
            real.setdefault('directs:' + m.group(1).lower(), []).append(m.group(3).lower())
        m = re.match(r'voucher\[(\d+)\]=(.*)', line)
        if m:
            real.setdefault('vouchers', []).append((int(m.group(1)), m.group(2)))

# 2) Parse da lista que o admin vai migrar (web/app/admin/page.tsx)
admin = {}
src = open(r'C:\Users\Mandhollo\vyronx\web\app\admin\page.tsx', encoding='utf-8').read()
for m in re.finditer(r"recipient: '(0x[0-9a-fA-F]{40})', poolId: (\d+), usdtValue: '(\d+)', referrer: '(0x[0-9a-fA-F]{40})', name: '([^']+)'", src):
    admin[m.group(1).lower()] = {'pool': m.group(2), 'value': m.group(3), 'ref': m.group(4).lower(), 'name': m.group(5)}

names = {a.lower(): n for a, n in [(k, v['name']) for k, v in admin.items()]}
names['0x77619322427f006b14da3dbb25f9eb420372f7c7'] = 'OWNER'
names['0x22b057604bce4b807ced6172dd5b9eb7c18777f3'] = 'Wallet Tier2 (0x22b0)'
def nm(a):
    return names.get(a, a[:10] + '…')

errors, warns = [], []

# A) Cada voucher V4 tem que estar na lista admin com mesmo referrer
vouchers_real = {}
for i, blob in real.get('vouchers', []):
    parts = [p.strip() for p in blob.split('|') if p.strip()]
    if len(parts) >= 6:
        vouchers_real[parts[0].lower()] = {'pool': parts[1].split()[0], 'value': parts[2].split()[0], 'redeemed': parts[4], 'cancelled': parts[5]}

print(f"Vouchers on-chain V4: {len(vouchers_real)} | Lista admin: {len(admin)}")
if len(vouchers_real) != len(admin):
    errors.append(f"CONTAGEM DIVERGE: V4={len(vouchers_real)} admin={len(admin)}")

for addr, v in vouchers_real.items():
    if addr not in admin:
        errors.append(f"Voucher V4 {addr} NAO esta na lista admin")
        continue
    a = admin[addr]
    if a['ref'] != real.get(addr):
        errors.append(f"REFERRER ERRADO {nm(addr)}: admin={nm(a['ref'])} | V4 real={nm(real.get(addr, '0x0'))}")
    if a['pool'] != '3':
        errors.append(f"POOL ERRADA {nm(addr)}: admin=3 esperado? real={v['pool']}")
    if a['value'] != '1100':
        errors.append(f"VALOR ERRADO {nm(addr)}: admin={a['value']} | real={v['value']}")

# B) Wallets na lista admin que NÃO existem na V4
for addr in admin:
    if addr not in vouchers_real:
        errors.append(f"Lista admin tem {addr} ({admin[addr]['name']}) que NAO existe como voucher na V4")

# C) Referrer de cada wallet == primeiro "direct" do upline (consistência V4)
for addr, ref in real.items():
    if addr.startswith('0x') and not addr.startswith('directs') and ref != '0x' + '0'*40:
        dlist = real.get('directs:' + ref, [])
        if addr not in dlist:
            errors.append(f"INCONSISTENCIA V4: {nm(addr)} tem referrer {nm(ref)} mas NAO esta nos directs do upline")

# D) Árvore completa (diretos V4 vs esperado pós-migração V5)
print("\n=== ÁRVORE ESPERADA NO V5 PÓS-MIGRAÇÃO ===")
children = {}
for addr, ref in real.items():
    if isinstance(addr, str) and addr.startswith('0x') and not addr.startswith('directs') and ref != '0x' + '0'*40:
        children.setdefault(ref, []).append(addr)

def show(addr, depth=0):
    print('  ' * depth + ('└─ ' if depth else '') + nm(addr))
    for c in sorted(children.get(addr, [])):
        show(c, depth + 1)

show('0x77619322427f006b14da3dbb25f9eb420372f7c7')

# E) 0x22b0 fica fora da migração (sem voucher)
if '0x22b057604bce4b807ced6172dd5b9eb7c18777f3' in real and real['0x22b057604bce4b807ced6172dd5b9eb7c18777f3'] != '0x' + '0'*40:
    warns.append("0x22b0 (sem voucher) tem referrer na V4 e NAO sera migrada — precisa re-registrar via link antes de stakear")

print("\n=== RESULTADO ===")
if errors:
    print(f"❌ {len(errors)} ERROS:")
    for e in errors:
        print("  -", e)
else:
    print("✅ ZERO erros: lista admin == árvore on-chain V4 (referrers, valores, pools, contagem)")
for w in warns:
    print("⚠️ ", w)
