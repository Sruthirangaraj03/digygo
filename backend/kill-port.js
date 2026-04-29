const { execSync } = require('child_process');
try {
  execSync(
    'powershell -Command "Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"',
    { stdio: 'ignore', shell: true }
  );
} catch (_) {}
