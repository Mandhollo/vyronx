import re
raw = open(r'C:/Users/Mandhollo/AppData/Local/hermes/cache/terminal/hermes-results/call_94e6d937bc2242a281ad0100.txt', encoding='utf-8').read()
def dec(lab):
    return lab.encode().decode('unicode_escape').encode('latin1', errors='ignore').decode('utf-8', errors='replace')
# find the 00:24 voice ListItem with bounds
for m in re.finditer(r'"role": "ListItem", "label": "((?:[^"\\]|\\.)*)", "bounds": \[(\d+), (\d+), (\d+), (\d+)\]', raw):
    d = dec(m.group(1))
    if '00:24' in d or ('Mensagem de voz' in d and '91.9' in d):
        print(repr(d[:200]))
        print('BOUNDS:', m.group(2), m.group(3), m.group(4), m.group(5))
        print('---')
# also the photo 591x1280 at 13:45
for m in re.finditer(r'"role": "ListItem", "label": "((?:[^"\\]|\\.)*)", "bounds": \[(\d+), (\d+), (\d+), (\d+)\]', raw):
    d = dec(m.group(1))
    if '13:45' in d:
        print('MSG13:45:', repr(d[:150]), 'BOUNDS:', m.group(2), m.group(3), m.group(4), m.group(5))
