[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl,

  [string]$Branch = 'main',

  [string]$CommitMessage = 'fix: correcoes de exequibilidade, propostas e deploy',

  [switch]$AllowUnrelated
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Stop-WithError([string]$Message) {
  Write-Host "ERRO: $Message" -ForegroundColor Red
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Stop-WithError 'Git nao instalado.'
}

if ($RepoUrl -notmatch '^(https://|git@)') {
  Stop-WithError 'Informe a URL do repositorio GitHub (https://... ou git@...).'
}

if (-not (Test-Path '.git')) {
  Write-Host 'Inicializando repositorio Git local...' -ForegroundColor Cyan
  git init -b $Branch | Out-Null
}

$currentRemote = ''
try {
  $currentRemote = (git remote get-url origin 2>$null)
} catch {
  $currentRemote = ''
}

if ($currentRemote) {
  if ($currentRemote -ne $RepoUrl) {
    Write-Host "Remote atual: $currentRemote" -ForegroundColor Yellow
    Stop-WithError "O remote 'origin' ja existe e aponta para outra URL. Ajuste manualmente com: git remote set-url origin $RepoUrl"
  }
} else {
  git remote add origin $RepoUrl
}

Write-Host 'Verificando arquivos proibidos...' -ForegroundColor Cyan
git add -A

$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
  Write-Host 'Nenhuma alteracao para commit.' -ForegroundColor Yellow
  exit 0
}

$forbidden = @()
$secretPattern = '(?i)(SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|ACCESS_KEY)'

foreach ($file in $staged) {
  $normalized = $file -replace '\\', '/'
  $isEnv = $normalized -match '(^|/)\.env(\.|$)'
  $isExample = $normalized -match '\.example$'

  if ($isEnv -and -not $isExample) {
    $content = Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue
    if ($content -match $secretPattern) {
      $forbidden += $file
    }
  }

  $item = Get-Item -LiteralPath $file -ErrorAction SilentlyContinue
  if ($item -and $item.Length -gt 10MB) {
    $forbidden += "$file (maior que 10 MB)"
  }
}

if ($forbidden.Count -gt 0) {
  git reset | Out-Null
  Write-Host 'Commit bloqueado. Arquivos com possivel segredo ou muito grandes:' -ForegroundColor Red
  $forbidden | ForEach-Object { Write-Host " - $_" }
  exit 1
}

$status = @(git status --short)
Write-Host "Arquivos staged: $($status.Count)" -ForegroundColor Cyan
$status | Select-Object -First 20 | ForEach-Object { Write-Host $_ }
if ($status.Count -gt 20) {
  Write-Host "... e mais $($status.Count - 20) arquivos"
}

git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
  Stop-WithError 'Falha ao criar commit.'
}

Write-Host 'Enviando para o GitHub...' -ForegroundColor Cyan
$remoteHead = ''
try {
  $remoteHead = (git ls-remote --heads origin $Branch 2>$null)
} catch {
  $remoteHead = ''
}

if ($remoteHead) {
  Write-Host "A branch $Branch ja existe no remoto." -ForegroundColor Yellow
  Write-Host 'Se o historico for diferente, o push sera rejeitado. Nao use --force sem revisar.' -ForegroundColor Yellow
}

git push -u origin $Branch
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Push rejeitado. Nao use --force sem revisar.' -ForegroundColor Red
  Write-Host "Se o repositorio remoto ja tem historico, rode: git pull origin $Branch --allow-unrelated-histories"
  if ($AllowUnrelated) {
    Write-Host 'A opcao AllowUnrelated foi informada, mas o merge automatico nao e seguro. Resolva os conflitos manualmente.' -ForegroundColor Yellow
  }
  Stop-WithError 'Push nao concluido.'
}

Write-Host ''
Write-Host 'Push concluido.' -ForegroundColor Green
Write-Host 'A Vercel e o Render devem iniciar o deploy automaticamente se o repositorio estiver conectado a eles.' -ForegroundColor Green
Write-Host 'Valide com: powershell -ExecutionPolicy Bypass -File scripts/verificar-producao.ps1' -ForegroundColor Green
