import re
raw = open(r'C:/Users/Mandhollo/AppData/Local/hermes/cache/terminal/hermes-results/call_8a3eb6bfde5242268810566c.txt', encoding='utf-8').read()
def dec(lab):
    return lab.encode().decode('unicode_escape').encode('latin1', errors='ignore').decode('utf-8', errors='replace')
for m in re.finditer(r'"role": "ListItem", "label": "((?:[^"\\]|\\.)*)", "bounds": \[(\d+), (\d+), (\d+), (\d+)\]', raw):
    d = dec(m.group(1))
    if 'Mensagem de voz' in d and '00:24' in d:
        print(repr(d[:150]))
        x, y, w, h = int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))
        print('BOUNDS:', x, y, w, h, '| center-y:', y + h//2)
