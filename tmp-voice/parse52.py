import re
raw = open(r'C:/Users/Mandhollo/AppData/Local/hermes/cache/terminal/hermes-results/call_94e6d937bc2242a281ad0100.txt', encoding='utf-8').read()
labels = re.findall(r'"role": "ListItem", "label": "((?:[^"\\]|\\.)*)"', raw)
def dec(lab):
    return lab.encode().decode('unicode_escape').encode('latin1', errors='ignore').decode('utf-8', errors='replace')
# chat messages only: sender line first, end with time; exclude chat-list entries (start with Grupo,/Canal,)
msgs = []
for lab in labels:
    d = dec(lab)
    if re.search(r'(Recebido|Enviado)', d) and not re.match(r'^(Grupo|Canal|Bot|Notifica|Anderson,)', d):
        msgs.append(d)
print(f"TOTAL {len(msgs)}")
for m in msgs[-18:]:
    print(m.replace('\n', ' | ')[:350])
    print('===')
