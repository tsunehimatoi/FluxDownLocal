# Publish GitHub Release with Artifacts
# Delegates to scripts/publish_release.py for robust binary uploading and token handling.
param(
    [string]$TagName = "v0.4.7-local.1",
    [string]$Repo = "tsunehimatoi/FluxDownLocal",
    [string]$DistDir = "dist"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyScript = Join-Path $scriptDir "publish_release.py"

python $pyScript --tag $TagName --repo $Repo --dist $DistDir
