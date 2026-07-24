# Configura secrets y despliega la Edge Function submit-asesoramiento
# Requisitos: Node, y haber corrido `npx supabase login` una vez

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$secretsFile = Join-Path $root ".env.secrets"
if (-not (Test-Path $secretsFile)) {
  Write-Error "No existe .env.secrets. Crearlo primero."
}

$pairs = @()
Get-Content $secretsFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  # Supabase inyecta SUPABASE_*; el Dashboard también los rechaza como secrets manuales
  if ($line -match '^(SUPABASE_|SB_)') { return }
  $pairs += $line
}

$projectRef = "wnzugiqyezrkywwfrbdw"

Write-Host ">> Subiendo secrets a Supabase ($projectRef)..."
npx --yes supabase secrets set --project-ref $projectRef @pairs

Write-Host ">> Deploy de submit-asesoramiento..."
npx --yes supabase functions deploy submit-asesoramiento --project-ref $projectRef --no-verify-jwt

Write-Host "Listo."
