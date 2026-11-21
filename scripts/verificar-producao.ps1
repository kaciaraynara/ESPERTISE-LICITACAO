$ErrorActionPreference = 'Stop'

$backend = 'https://espertise-licitacao.onrender.com/api/v1'
$frontend = 'https://www.expertiselicitatoria.com.br'
$domain = 'https://www.expertiselicitatoria.com.br'

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

function Test-FrontendBundle([string]$Url) {
  $html = & curl.exe -sS --max-time 30 $Url 2>$null
  $asset = ([regex]::Matches($html, 'src="([^"]+\.js)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -First 1)

  if (-not $asset) {
    Write-Host '[FALHA] Bundle do frontend (asset nao encontrado)' -ForegroundColor Red
    $script:failures += 'Bundle do frontend'
    return
  }

  $js = & curl.exe -sS --max-time 60 ($Url.TrimEnd('/') + $asset) 2>$null
  if ($js -match 'onrender\.com/api(?!\/v1)') {
    Write-Host "[FALHA] Bundle do frontend ($asset usa fallback sem /v1)" -ForegroundColor Red
    $script:failures += 'Bundle do frontend'
  } else {
    Write-Host "[OK] Bundle do frontend ($asset)" -ForegroundColor Green
  }
}

function Test-ApexRedirect() {
  $result = & curl.exe -sS -L -o NUL --max-time 30 -w '%{http_code} %{url_effective}' 'http://expertiselicitatoria.com.br/' 2>$null
  if ($result -match '^200\s+https://www\.expertiselicitatoria\.com\.br/?$') {
    Write-Host "[OK] Apex -> www ($result)" -ForegroundColor Green
  } else {
    Write-Host "[FALHA] Apex -> www (recebido: $result)" -ForegroundColor Red
    $script:failures += 'Apex -> www'
  }
}

Write-Host '=== Verificacao de producao ===' -ForegroundColor Cyan

Test-JsonField 'Backend health' "$backend/health" 'status' 'ok'
Test-JsonField 'Backend versao (service)' "$backend/health" 'service' 'expertise-api'
# A versao publicada pode nao expor o campo "database", mas o 200 de readiness
# so ocorre depois de um SELECT 1 real no Neon.
Test-JsonField 'Backend readiness (Neon)' "$backend/health/readiness" 'status' 'ready'
Test-JsonField 'Vercel proxy readiness' "$frontend/api/v1/health/readiness" 'status' 'ready'
Test-HttpStatus 'Dominio oficial' $domain
Test-ApexRedirect
Test-FrontendBundle $frontend

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
