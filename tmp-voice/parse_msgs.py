import re
raw = open(r'C:/Users/Mandhollo/AppData/Local/hermes/cache/terminal/hermes-results/call_a46e51c96f354f2dbdc0036f.txt', encoding='utf-8').read()
labels = re.findall(r'"role": "ListItem", "label": "((?:[^"\\]|\\.)*)"', raw)
def dec(lab):
    return lab.encode().decode('unicode_escape').encode('latin1', errors='ignore').decode('utf-8', errors='replace')
msgs = [dec(l) for l in labels]
# messages in the open chat start with a name line and end with "às HH:MM" (the à got mangled to \xef\xbf\xbd or similar)
cand = [m for m in msgs if re.search(r'Recebido|Enviado', m) and not m.startswith('Grupo,') and not m.startswith('Canal,') and not m.startswith('Bot,') and not m.startswith('Notifica')]
for m in cand:
    print(m.replace('\n', ' | ')[:500])
    print('===')
