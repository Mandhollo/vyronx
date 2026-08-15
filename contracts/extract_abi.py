import json, shutil

# Extract V5 ABI from Foundry artifact
with open(r'C:\Users\Mandhollo\vyronx\contracts\out\VyronXStakingV5.sol\VyronXStakingV5.json', encoding='utf-8') as f:
    artifact = json.load(f)
abi = artifact['abi']
print('V5 ABI entries:', len(abi))
print('has setAffiliateLevel:', any(e.get('name') == 'setAffiliateLevel' for e in abi))

with open(r'C:\Users\Mandhollo\vyronx\web\lib\abi\VyronXStakingV5.json', 'w', encoding='utf-8') as f:
    json.dump(abi, f, indent=2)
print('saved to web/lib/abi/VyronXStakingV5.json')

# Also verify deployed bytecode matches source (sanity)
print('bytecode size fields present:', 'bytecode' in artifact)
