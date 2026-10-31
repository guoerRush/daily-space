[CmdletBinding()]
param(
  [string]$ProjectPath = ".",
  [switch]$SkipLint,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$packagePath = Join-Path $resolvedProject "package.json"
if (-not (Test-Path -LiteralPath $packagePath)) {
  throw "No package.json found at $resolvedProject"
}

$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
$runnerCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $runnerCommand) {
  $runnerCommand = Get-Command npm -ErrorAction Stop
}
$runner = $runnerCommand.Source

function Assert-LastCommand([string]$label) {
  if ($LASTEXITCODE -ne 0) {
    throw "$label failed with exit code $LASTEXITCODE"
  }
}

Push-Location $resolvedProject
try {
  $tsc = Join-Path $resolvedProject "node_modules\.bin\tsc.cmd"
  if (-not (Test-Path -LiteralPath $tsc)) {
    $tsc = Join-Path $resolvedProject "node_modules\.bin\tsc"
  }
  if ((Test-Path -LiteralPath "tsconfig.json") -and (Test-Path -LiteralPath $tsc)) {
    Write-Host "[verify] TypeScript"
    & $tsc --noEmit
    Assert-LastCommand "TypeScript"
  }

  if (-not $SkipLint -and $package.scripts.lint) {
    Write-Host "[verify] Lint"
    & $runner run lint
    Assert-LastCommand "Lint"
  }

  if (-not $SkipBuild -and $package.scripts.build) {
    Write-Host "[verify] Production build"
    & $runner run build
    Assert-LastCommand "Production build"
  }

  Write-Host "[verify] All requested checks passed."
} finally {
  Pop-Location
}
