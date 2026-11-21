[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DeployHookUrl,

  [string]$HealthUrl = 'https://espertise-licitacao.onrender.com/api/v1/health',

  [int]$TimeoutMinutes = 15
)

$ErrorActionPreference = 'Stop'

if ($DeployHookUrl -notmatch '^https://api\.render\.com/deploy/') {
  Write-Host 'ERRO: informe a URL do Deploy Hook do Render (https://api.render.com/deploy/...).' -ForegroundColor Red
  exit 1
}

Write-Host 'Disparando deploy no Render...' -ForegroundColor Cyan
try {
  $response = Invoke-WebRequest -Method Post -Uri $DeployHookUrl -TimeoutSec 60 -UseBasicParsing
  Write-Host "Deploy solicitado (HTTP $($response.StatusCode))." -ForegroundColor Green
} catch {
  Write-Host "ERRO ao disparar o deploy: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host 'Aguardando a nova versao ficar saudavel...' -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$lastState = ''

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 20

  try {
    $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 30

    if ($health.service -eq 'expertise-api') {
      Write-Host ''
      Write-Host 'OK: backend atualizado e respondendo com a versao nova.' -ForegroundColor Green
      Write-Host "status=$($health.status) service=$($health.service) timestamp=$($health.timestamp)"
      exit 0
    }

    $state = "aguardando (status=$($health.status), uptime=$([math]::Round([double]$health.uptime, 0))s)"
    if ($state -ne $lastState) {
      Write-Host $state
      $lastState = $state
    }
  } catch {
    if ($lastState -ne 'health indisponivel (deploy em andamento)') {
      Write-Host 'health indisponivel (deploy em andamento)'
      $lastState = 'health indisponivel (deploy em andamento)'
    }
  }
}

Write-Host ''
Write-Host "TIMEOUT: o backend nao apresentou a versao nova em $TimeoutMinutes minutos." -ForegroundColor Red
Write-Host 'Verifique no Render: Logs do deploy, branch conectada e se o build falhou.' -ForegroundColor Yellow
exit 1
