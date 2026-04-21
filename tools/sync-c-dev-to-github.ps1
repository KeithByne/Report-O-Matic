# Makes C:\dev\report-o-matic-git match origin/main (GitHub / typical Vercel deploy).
$ErrorActionPreference = "Stop"
$repo = "C:\dev\report-o-matic-git"
if (-not (Test-Path -LiteralPath (Join-Path $repo ".git"))) {
  Write-Error "Not a git repo: $repo"
}
$appEnv = Join-Path $repo "app\.env.local"
$rootEnv = Join-Path $repo ".env.local"
$backupApp = Join-Path $env:TEMP "rom-app-env-local.backup"
$backupRoot = Join-Path $env:TEMP "rom-root-env-local.backup"

if (Test-Path -LiteralPath $appEnv) {
  Copy-Item -LiteralPath $appEnv -Destination $backupApp -Force
  Write-Host "Backed up app\.env.local -> $backupApp"
}
if (Test-Path -LiteralPath $rootEnv) {
  Copy-Item -LiteralPath $rootEnv -Destination $backupRoot -Force
  Write-Host "Backed up .env.local -> $backupRoot"
}

git -C $repo fetch origin
git -C $repo reset --hard origin/main
git -C $repo clean -fdx
# Second pass (Windows sometimes leaves locked paths on first clean)
git -C $repo clean -fdx 2>$null

$nested = Join-Path $repo "app\app"
if (Test-Path -LiteralPath $nested) {
  Write-Warning "Nested folder still present: $nested — close any Node/IDE using it, then delete that folder manually and run: git -C `"$repo`" clean -fdx"
}

if (Test-Path -LiteralPath $backupApp) {
  $dest = Split-Path -Parent $appEnv
  if (-not (Test-Path -LiteralPath $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
  Copy-Item -LiteralPath $backupApp -Destination $appEnv -Force
  Write-Host "Restored app\.env.local from backup."
}
if (Test-Path -LiteralPath $backupRoot) {
  Copy-Item -LiteralPath $backupRoot -Destination $rootEnv -Force
  Write-Host "Restored repo root .env.local from backup."
}

Write-Host "--- status ---"
git -C $repo status -sb
Write-Host "--- HEAD ---"
git -C $repo rev-parse HEAD
Write-Host "Done."
