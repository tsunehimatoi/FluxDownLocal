param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$OutputDirectory = '',
  [string]$Version = '0.1.44',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $RepoRoot 'dist'
} elseif (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory = Join-Path $RepoRoot $OutputDirectory
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)

Push-Location $RepoRoot
try {
  if (-not $SkipBuild) {
    flutter pub get
    if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed.' }
    flutter build windows --release --build-name=$Version --build-number=1 --dart-define=APP_VERSION=$Version
    if ($LASTEXITCODE -ne 0) { throw 'Windows release build failed.' }
  }

  $releaseDirectory = Join-Path $RepoRoot 'build/windows/x64/runner/Release'
  if (-not (Test-Path -LiteralPath $releaseDirectory -PathType Container)) {
    throw "Windows release directory not found: $releaseDirectory"
  }

  # Incremental Flutter builds do not delete executables removed from CMake.
  # Never allow the retired online updater to leak into a new installer.
  $retiredUpdater = Join-Path $releaseDirectory 'fluxdown_updater.exe'
  if (Test-Path -LiteralPath $retiredUpdater -PathType Leaf) {
    Remove-Item -LiteralPath $retiredUpdater -Force
  }

  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $iscc = (Get-Command iscc -ErrorAction SilentlyContinue).Source
  if ([string]::IsNullOrWhiteSpace($iscc)) {
    $iscc = Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'
  }
  if (-not (Test-Path -LiteralPath $iscc -PathType Leaf)) {
    throw 'Inno Setup 6 (ISCC.exe) was not found.'
  }
  & $iscc "/DMyAppVersion=$Version" '/DMyAppArch=x64' 'installer\windows\setup.iss'
  if ($LASTEXITCODE -ne 0) { throw 'Inno Setup packaging failed.' }

  $installer = Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'build\installer') `
    -Filter "FluxDown-$Version-windows-x64-setup.exe" | Select-Object -First 1
  if ($null -eq $installer) { throw 'Installer output was not found.' }
  $destination = Join-Path $OutputDirectory $installer.Name
  Copy-Item -LiteralPath $installer.FullName -Destination $destination -Force
  Write-Host "Installer created: $destination" -ForegroundColor Green
} finally {
  Pop-Location
}
