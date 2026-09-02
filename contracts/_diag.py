import paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('2.25.102.234', username='root', password='VyronX@151826')

sftp = client.open_sftp()
sftp.put(r'C:\Users\Mandhollo\vyronx\contracts\_new_server.py', '/opt/vyronx-auction-img/server.py')
sftp.put(r'C:\Users\Mandhollo\vyronx\contracts\butler_bot.py', '/opt/vyronx-butler/butler_bot.py')
sftp.close()
print('uploaded')

for c in [
    "systemctl restart vyronx-auction-img vyronx-butler; sleep 4",
    "journalctl -u vyronx-butler -n 2 --no-pager | tail -2",
    # public smoke test of the click endpoint
    "curl -s -m 6 -X POST 'https://arb.vyronx.io/butler/click?aid=99&user=0xd7A8484fD713D28870FCd4ad198fAB9e3ffDedB1' -H 'Origin: https://vyronx.io'",
    "curl -s -m 6 'https://arb.vyronx.io/butler/clicks'",
]:
    _, o, e = client.exec_command(c, timeout=40)
    print((o.read().decode() + e.read().decode()).strip()[:300])
client.close()
