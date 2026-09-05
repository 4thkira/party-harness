# SPDX-License-Identifier: GPL-3.0-only
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node.js 22 or newer, then run this launcher again. See README.md."
  exit 1
}
$serverPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "server.js"))
$configuredPort = 8787
if ($env:RP_PORT -and $env:RP_PORT -match '^\d+$' -and [int]$env:RP_PORT -ge 1 -and [int]$env:RP_PORT -le 65535) {
  $configuredPort = [int]$env:RP_PORT
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

# Default only. This used to assign unconditionally, which silently overrode a model the user had
# deliberately set in their own environment. checks.js asserts this literal still matches the
# server and client defaults.
if (-not $env:OPENAI_MODEL) { $env:OPENAI_MODEL = "gpt-5.6-luna" }
Write-Host "Starting Party Harness on port $configuredPort with model $($env:OPENAI_MODEL)..."
$envFilePath = Join-Path $PSScriptRoot ".env"
if (Test-Path -LiteralPath $envFilePath -PathType Leaf) {
  $activeEnvNames = @(
    Get-Content -LiteralPath $envFilePath -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_ -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$' -and $matches[2].Trim()) {
        $matches[1]
      }
    } | Sort-Object -Unique
  )
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
