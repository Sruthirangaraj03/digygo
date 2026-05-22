import paramiko
import sys
import io
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

host = "31.97.227.208"
user = "root"
pw   = "v'8L,9y?p.zxW9Nwe"
APP  = "/var/www/digygocrm"

def run(client, cmd, timeout=300):
    print(f"\n>>> {cmd}")
    sys.stdout.flush()
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    if err: print("ERR:", err)
    code = stdout.channel.recv_exit_status()
    print(f"[exit {code}]")
    sys.stdout.flush()
    return code

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("Connecting...")
client.connect(host, username=user, password=pw, timeout=15)
print("Connected!\n")

# 1. Pull latest code
print("=" * 50)
print("STEP 1: Git pull")
print("=" * 50)
run(client, f"cd {APP} && git stash && git pull origin main")

# Verify new commit is there
run(client, f"cd {APP} && git log --oneline -3")

# 2. Backend: install deps + run migrations + build
print("\n" + "=" * 50)
print("STEP 2: Backend build + migrations")
print("=" * 50)
run(client, f"cd {APP}/backend && npm install --legacy-peer-deps 2>&1 | tail -5")
run(client, f"cd {APP}/backend && npx ts-node src/db/migrate.ts 2>&1 | tail -10")
run(client, f"cd {APP}/backend && npm run build 2>&1 | tail -10")

# 3. Frontend: install + build
print("\n" + "=" * 50)
print("STEP 3: Frontend build")
print("=" * 50)
run(client, f"cd {APP}/frontend && npm install --legacy-peer-deps 2>&1 | tail -5")
run(client, f"cd {APP}/frontend && npm run build 2>&1 | tail -10", timeout=300)

# 4. Restart backend via PM2
print("\n" + "=" * 50)
print("STEP 4: Restart PM2")
print("=" * 50)
run(client, "pm2 reload digygocrm --update-env")
time.sleep(3)
run(client, "pm2 list --no-color | cat")
run(client, "pm2 logs digygocrm --lines 20 --nostream --no-color 2>&1 | cat")

print("\n" + "=" * 50)
print("DEPLOYMENT COMPLETE")
print("=" * 50)

client.close()
