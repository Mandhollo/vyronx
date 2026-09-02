import paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('2.25.102.234', username='root', password='VyronX@151826')

sftp = client.open_sftp()
sftp.put(r'C:\Users\Mandhollo\vyronx\contracts\butler_bot.py', '/opt/vyronx-butler/butler_bot.py')
sftp.close()
_, o, _ = client.exec_command("systemctl restart vyronx-butler", timeout=30)
o.channel.recv_exit_status()
time.sleep(6)
_, o, _ = client.exec_command("journalctl -u vyronx-butler -n 2 --no-pager | tail -2", timeout=30)
print(o.read().decode())
client.close()
