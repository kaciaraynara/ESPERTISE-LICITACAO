param(
  [ValidateSet('status', 'stop', 'restart')]
  [string]$Action = 'status',
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'
$BackendRoot = Split-Path -Parent $PSScriptRoot

function Get-PortPids {
  param([int]$LocalPort)

  try {
    $tcpRows = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction Stop
    return @($tcpRows | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $pattern = "[:\.]$LocalPort\s+.*LISTENING\s+(\d+)$"
    $lines = netstat -ano | Select-String $pattern
    return @(
      $lines | ForEach-Object {
        if ($_.Matches.Count -gt 0) {
          $_.Matches[0].Groups[1].Value
        }
      } | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique
    )
  }
}

function Get-ProcessSnapshot {
  param([int[]]$Pids)

  return @(
    $Pids | ForEach-Object {
      try {
        Get-Process -Id $_ -ErrorAction Stop | Select-Object Id, ProcessName, StartTime
      } catch {
        [PSCustomObject]@{
          Id = $_
          ProcessName = 'desconhecido'
          StartTime = $null
        }
      }
    }
  )
}

function Stop-PortProcesses {
  param([int]$LocalPort)

  $pids = @(Get-PortPids -LocalPort $LocalPort)
  if ($pids.Count -eq 0) {
    Write-Host "Nenhum processo em escuta na porta $LocalPort."
    return
  }

  foreach ($processId in $pids) {
    try {
      $proc = Get-Process -Id $processId -ErrorAction Stop
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Encerrado PID ${processId} ($($proc.ProcessName)) na porta ${LocalPort}."
    } catch {
      Write-Warning "Nao foi possivel encerrar o PID ${processId}: $($_.Exception.Message)"
    }
  }
}

function Start-BackendDetached {
  param([int]$LocalPort)

  $runtimeDir = Join-Path $BackendRoot '.runtime'
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdoutLog = Join-Path $runtimeDir "backend-dev-$stamp.out.log"
  $stderrLog = Join-Path $runtimeDir "backend-dev-$stamp.err.log"

  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

  $proc = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run', 'dev' `
    -WorkingDirectory $BackendRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

  Start-Sleep -Seconds 8

  Write-Host "Backend iniciado em background (PID $($proc.Id)) na porta $LocalPort."
  Write-Host "Logs:"
  Write-Host "  STDOUT -> $stdoutLog"
  Write-Host "  STDERR -> $stderrLog"
}

function Show-Status {
  param([int]$LocalPort)

  $pids = @(Get-PortPids -LocalPort $LocalPort)
  if ($pids.Count -eq 0) {
    Write-Host "Nenhum backend ouvindo na porta $LocalPort."
    return
  }

  Write-Host "Processos na porta ${LocalPort}:"
  Get-ProcessSnapshot -Pids $pids | Format-Table -AutoSize

  try {
    $health = Invoke-WebRequest -Uri "http://localhost:$LocalPort/health" -UseBasicParsing -TimeoutSec 10
    Write-Host ''
    Write-Host "Health: $($health.StatusCode)"
    Write-Host $health.Content
  } catch {
    Write-Warning "Health endpoint indisponivel: $($_.Exception.Message)"
  }
}

switch ($Action) {
  'status' {
    Show-Status -LocalPort $Port
  }

  'stop' {
    Stop-PortProcesses -LocalPort $Port
  }

  'restart' {
    Stop-PortProcesses -LocalPort $Port
    Write-Host "Iniciando backend local na porta $Port..."
    Start-BackendDetached -LocalPort $Port
    Show-Status -LocalPort $Port
  }
}
