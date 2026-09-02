import paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('2.25.102.234', username='root', password='VyronX@151826')

sftp = client.open_sftp()
sftp.put(r'C:\Users\Mandhollo\vyronx\contracts\_new_server.py', '/opt/vyronx-auction-img/server.py')
sftp.close()
_, o, _ = client.exec_command("systemctl restart vyronx-auction-img; sleep 3", timeout=30)
o.channel.recv_exit_status()

# burst 15 requests -> expect 429 after the 12th
_, o, _ = client.exec_command(
    "for i in $(seq 1 15); do curl -s -o /dev/null -w '%{http_code} ' -X POST 'http://127.0.0.1:8100/butler/click?aid=1&user=0xd7A8484fD713D28870FCd4ad198fAB9e3ffDedB1'; done; echo", timeout=40)
print("burst:", o.read().decode().strip())
client.close()
