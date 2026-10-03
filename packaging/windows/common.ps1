$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $PSScriptRoot
$NodeExe = Join-Path $AppRoot "node\node.exe"
$AppEntry = Join-Path $AppRoot "app\dist\index.js"
$DataDir = Join-Path $env:LOCALAPPDATA "TomsCheckList"
if ($env:CHECKLIST_ENV_FILE) { $EnvFile = $env:CHECKLIST_ENV_FILE } else { $EnvFile = Join-Path $DataDir "checklist.env" }
$LogDir = Join-Path $DataDir "logs"
$LogFile = Join-Path $LogDir "checklist.log"
$ErrFile = Join-Path $LogDir "checklist.err.log"
$PidFile = Join-Path $DataDir "checklist.pid"
$StopFlag = Join-Path $DataDir "checklist.stop"
$TaskName = "TomsCheckList"

function Read-ChecklistEnv {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $text = $line.Trim()
    if ($text -eq "" -or $text.StartsWith("#")) { continue }
    $index = $text.IndexOf("=")
    if ($index -lt 1) { continue }
    $map[$text.Substring(0, $index).Trim()] = $text.Substring($index + 1).Trim().Trim('"').Trim("'")
  }
  return $map
}

function Get-ChecklistSetting {
  param([string]$Name, [string]$Default)
  if ([Environment]::GetEnvironmentVariable($Name)) { return [Environment]::GetEnvironmentVariable($Name) }
  $cfg = Read-ChecklistEnv $EnvFile
  if ($cfg[$Name]) { return $cfg[$Name] }
  return $Default
}

function Get-ChecklistPort { [int](Get-ChecklistSetting "PORT" "3711") }

function Initialize-ChecklistEnvironment {
  $env:CHECKLIST_ENV_FILE = $EnvFile
  $env:PATH = (Join-Path $AppRoot "node") + ";" + $env:PATH
}

function Test-PortInUse {
  param([int]$Port)
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Assert-PortsFree {
  $port = Get-ChecklistPort
  if (Test-PortInUse $port) {
    Write-Host "端口 $port 已被占用。先运行 status.ps1 查看，或运行 stop.ps1 停掉旧进程。"
    exit 1
  }
}

function Get-ChecklistProcess {
  if (-not (Test-Path -LiteralPath $PidFile)) { return $null }
  $raw = (Get-Content -LiteralPath $PidFile -Raw).Trim()
  if (-not $raw) { return $null }
  return Get-Process -Id ([int]$raw) -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" }
}

function Test-ChecklistHealth {
  $port = Get-ChecklistPort
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$port/healthz" -TimeoutSec 3
    return $true
  } catch {
    return $false
  }
}
