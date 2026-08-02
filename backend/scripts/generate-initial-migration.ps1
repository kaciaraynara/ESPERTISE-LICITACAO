param(
  [string]$Name = "init"
)

$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
Set-Location $backendRoot

$safeName = $Name.ToLowerInvariant() -replace "[^a-z0-9_\s-]", ""
$safeName = $safeName -replace "[\s-]+", "_"
if ([string]::IsNullOrWhiteSpace($safeName)) {
  $safeName = "init"
}

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$migrationDir = Join-Path $backendRoot "prisma\migrations\${timestamp}_${safeName}"
$migrationFile = Join-Path $migrationDir "migration.sql"
$migrationsRoot = Join-Path $backendRoot "prisma\migrations"

$existingRealMigrations = Get-ChildItem -Path $migrationsRoot -Recurse -Filter "migration.sql" |
  Where-Object { $_.Length -gt 100 }

if ($existingRealMigrations.Count -gt 0) {
  throw "A real migration already exists. Use npm run migrate:dev for incremental schema changes."
}

if (Test-Path $migrationDir) {
  throw "Migration directory already exists: $migrationDir"
}

New-Item -ItemType Directory -Path $migrationDir | Out-Null

$sqlLines = & npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
if ($LASTEXITCODE -ne 0) {
  throw "Prisma migrate diff failed."
}

$header = @(
  "-- Initial migration generated from prisma/schema.prisma.",
  "-- Review this file before applying it in production.",
  "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
  ""
)

Set-Content -Path $migrationFile -Value ($header + $sqlLines) -Encoding UTF8

& npx prisma validate
if ($LASTEXITCODE -ne 0) {
  throw "Prisma schema validation failed."
}

Write-Host "Created migration: $migrationFile"
Write-Host "Apply pending migrations in production with: npm run migrate"
