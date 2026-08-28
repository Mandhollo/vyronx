import re
raw = open(r'C:/Users/Mandhollo/AppData/Local/hermes/cache/terminal/hermes-results/call_d26439ded71f429b9bda8d34.txt', encoding='utf-8').read()
# find voice message bubbles: ListItem labels containing "Mensagem de voz"
labels = re.findall(r'"role": "ListItem", "label": "((?:[^"\\]|\\.)*)"', raw)
def dec(lab):
    return lab.encode().decode('unicode_escape').encode('latin1', errors='ignore').decode('utf-8', errors='replace')
voices = []
for lab in labels:
    d = dec(lab)
    if 'Mensagem de voz' in d and '00:07' in d:
        voices.append(d)
print(len(voices))
for v in voices:
    print(repr(v[:250]))
# also find bounds of any element with 00:07 in label
m = re.findall(r'"label": "((?:[^"\\]|\\.)*00:07(?:[^"\\]|\\.)*)", "bounds": \[(\d+), (\d+), (\d+), (\d+)\]', raw)
for lab, x, y, w, h in m[:5]:
    print('BOUNDS:', dec(lab)[:80], '=>', x, y, w, h)
