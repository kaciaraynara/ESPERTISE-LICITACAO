$ErrorActionPreference = 'Stop'

$backend = 'https://espertise-licitacao.onrender.com/api/v1'
$frontend = 'https://espertise-licitacao-53xf.vercel.app'
$domain = 'https://expertiselicitatoria.com.br'

$failures = @()

function Test-HttpStatus([string]$Name, [string]$Url, [int]$Expected = 200) {
  $status = & curl.exe -sS -L -o NUL --max-time 30 -w '%{http_code}' $Url 2>$null
  if ($status -eq [string]$Expected) {
    Write-Host "[OK] $Name ($status)" -ForegroundColor Green
  } else {
    Write-Host "[FALHA] $Name (esperado $Expected, recebido $status)" -ForegroundColor Red
    $script:failures += $Name
  }
}

function Test-JsonField([string]$Name, [string]$Url, [string]$Field, [string]$Expected) {
  $body = & curl.exe -sS --max-time 30 $Url 2>$null
  try {
    $json = $body | ConvertFrom-Json
  } catch {
    Write-Host "[FALHA] $Name (JSON invalido)" -ForegroundColor Red
    $script:failures += $Name
    return
  }

  if ([string]$json.$Field -eq $Expected) {
    Write-Host "[OK] $Name ($Field=$($json.$Field))" -ForegroundColor Green
  } else {
    Write-Host "[FALHA] $Name ($Field=$($json.$Field), esperado $Expected)" -ForegroundColor Red
    $script:failures += $Name
  }
}

function Test-Cors([string]$Origin) {
  $headers = & curl.exe -sS -i --max-time 30 -X OPTIONS "$backend/health" `
    -H "Origin: $Origin" `
    -H 'Access-Control-Request-Method: GET' `
    -H 'Access-Control-Request-Headers: authorization,content-type' 2>$null

  $allowed = $headers | Select-String -Pattern '^access-control-allow-origin:\s*(.+)$' -CaseSensitive:$false
  if ($allowed -and $allowed.Matches[0].Groups[1].Value.Trim() -eq $Origin) {
    Write-Host "[OK] CORS $Origin" -ForegroundColor Green
  } else {
    Write-Host "[FALHA] CORS $Origin" -ForegroundColor Red
    $script:failures += "CORS $Origin"
  }
}

Write-Host '=== Verificacao de producao ===' -ForegroundColor Cyan

Test-JsonField 'Backend health' "$backend/health" 'status' 'ok'
# A versao publicada pode nao expor o campo "database", mas o 200 de readiness
# so ocorre depois de um SELECT 1 real no Neon.
Test-JsonField 'Backend readiness (Neon)' "$backend/health/readiness" 'status' 'ready'
Test-JsonField 'Vercel proxy readiness' "$frontend/api/v1/health/readiness" 'status' 'ready'
Test-HttpStatus 'Dominio oficial' $domain

Test-Cors 'https://expertiselicitatoria.com.br'
Test-Cors 'https://www.expertiselicitatoria.com.br'
Test-Cors 'https://espertise-licitacao-53xf.vercel.app'

Write-Host ''
if ($failures.Count -gt 0) {
  Write-Host "Falhas: $($failures.Count)" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host " - $_" }
  exit 1
}

Write-Host 'Todas as verificacoes passaram.' -ForegroundColor Green
