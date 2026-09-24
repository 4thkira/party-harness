# SPDX-License-Identifier: GPL-3.0-only
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node.js 22 or newer, then run this launcher again. See README.md."
  exit 1
}
$serverPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "server.js"))

# server.js loads .env itself. The launcher reads it too, only so that it agrees with the server
# about the port to check and the model to announce, and by the same rules: blank lines and #
# comments are skipped, matching quotes are stripped, the first entry for a name wins, and a real
# environment variable outranks the file. Reading only $env: used to ignore RP_PORT in .env, so the
# launcher checked 8787 for an old harness while the server went on to listen somewhere else.
$envFilePath = Join-Path $PSScriptRoot ".env"
$envFileSettings = @{}
if (Test-Path -LiteralPath $envFilePath -PathType Leaf) {
  foreach ($line in @(Get-Content -LiteralPath $envFilePath -ErrorAction SilentlyContinue)) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      $name = $matches[1]
      $value = $matches[2] -replace '^([''"])(.*)\1$', '$2'
      if ($value -and -not $envFileSettings.ContainsKey($name)) { $envFileSettings[$name] = $value }
    }
  }
}
function Get-HarnessSetting([string]$Name) {
  $fromEnvironment = [Environment]::GetEnvironmentVariable($Name)
  if ($fromEnvironment) { return $fromEnvironment }
  return $envFileSettings[$Name]
}

$configuredPort = 8787
$portSetting = "$(Get-HarnessSetting 'RP_PORT')".Trim()
if ($portSetting) {
  if ($portSetting -notmatch '^\d{1,5}$' -or [int]$portSetting -lt 1 -or [int]$portSetting -gt 65535) {
    Write-Host "RP_PORT must be a whole number from 1 to 65535, not '$portSetting'. Fix or remove it in .env or your environment (the default is 8787), then run this launcher again."
    exit 1
  }
  $configuredPort = [int]$portSetting
}

# If the prototype's own server is still running, replace it cleanly. Do not
# stop an unrelated process that happens to use the same port.
$listeners = @(Get-NetTCPConnection -LocalPort $configuredPort -State Listen -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  $isOwnServer = $false
  if ($process -and $process.CommandLine) {
    # The health response identifies the actual listener PID. This avoids killing an unrelated
    # Node process merely because its command line happens to mention this workspace path.
    try {
      $health = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/health" -f $configuredPort) -TimeoutSec 2
      $isOwnServer = $health.ok -eq $true -and [int]$health.pid -eq [int]$listener.OwningProcess
    } catch {
      $isOwnServer = $false
    }
  }
  if (-not $isOwnServer -and $process -and $process.ExecutablePath -and $process.CommandLine) {
    # Compatibility fallback for an older harness without pid in /api/health. Require node.exe
    # and a path token, rather than a loose substring match.
    $nodeName = [System.IO.Path]::GetFileName($process.ExecutablePath)
    $quotedServer = '"' + $serverPath + '"'
    $bareServer = ' ' + $serverPath
    $isServerToken = $process.CommandLine.Contains($quotedServer) -or $process.CommandLine.Contains($bareServer)
    $isOwnServer = $nodeName -ieq "node.exe" -and $isServerToken
  }
  if ($isOwnServer) {
    Stop-Process -Id $listener.OwningProcess -Force
    Start-Sleep -Milliseconds 250
  } elseif ($process) {
    Write-Host "Port $configuredPort is already being used by another program (PID $($listener.OwningProcess): $($process.Name))."
    Write-Host "Close that program, or set RP_PORT to a different port and run this launcher again."
    Read-Host "Press Enter to close"
    exit 1
  }
}

# Announced, never assigned. Setting $env:OPENAI_MODEL here made it a real environment variable,
# which server.js ranks above .env, so an OPENAI_MODEL chosen in .env was silently replaced by this
# default. The server applies the same default itself. checks.js asserts this literal still
# matches the server and client defaults, and that the launcher does not assign the variable.
$DEFAULT_OPENAI_MODEL = "gpt-5.6-luna"
$announcedModel = Get-HarnessSetting "OPENAI_MODEL"
if (-not $announcedModel) { $announcedModel = $DEFAULT_OPENAI_MODEL }
Write-Host "Starting Party Harness on port $configuredPort with model $announcedModel..."
if (Test-Path -LiteralPath $envFilePath -PathType Leaf) {
  $activeEnvNames = @($envFileSettings.Keys | Sort-Object)
  if ($activeEnvNames.Count) {
    Write-Host ("Found .env beside server.js with active settings: " + ($activeEnvNames -join ", ") + ". Values are hidden.")
  } else {
    Write-Host "Found .env beside server.js, but it contains no active settings. Lines beginning with # are comments; uncomment and fill the entries you want to use."
  }
} elseif (Test-Path -LiteralPath $envFilePath) {
  Write-Host ".env exists beside server.js, but it is not a readable file. Rename or remove that path, then try again."
} else {
  Write-Host "No .env found. Enter a key in the harness Settings menu (memory only, cleared on refresh),"
  Write-Host "or copy .env.example to .env and fill it in to stop re-entering it every time."
}
node $serverPath
