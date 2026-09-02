import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('2.25.102.234', username='root', password='VyronX@151826')
_, o, _ = client.exec_command("journalctl -u vyronx-butler -f --no-pager -n 0 & sleep 90; kill %1 2>/dev/null; journalctl -u vyronx-butler --since '-95 sec' --no-pager | grep -vE '^--' | tail -40", timeout=140)
print(o.read().decode()[-2500:])
client.close()
