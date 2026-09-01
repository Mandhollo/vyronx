import paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('2.25.102.234', username='root', password='VyronX@151826')
_, o, _ = client.exec_command("systemctl is-active vyronx-butler; journalctl -u vyronx-butler -n 6 --no-pager | tail -6", timeout=40)
print(o.read().decode())
client.close()
