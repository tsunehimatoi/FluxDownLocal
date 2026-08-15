[CmdletBinding()]
param (
    [string]$UpstreamBranch = "upstream/main",
    [string]$TargetBranch = "main"
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== Fetching upstream information (git fetch upstream) ===" -ForegroundColor Cyan
git fetch upstream --quiet

Write-Host "`n=== Upstream core commits (engine / api / cli) pending sync ===" -ForegroundColor Green
Write-Host "Range:  $TargetBranch .. $UpstreamBranch" -ForegroundColor Gray
Write-Host "Filter: native/engine, native/api, native/cli`n" -ForegroundColor Gray

$commits = git log "$TargetBranch..$UpstreamBranch" --oneline -- native/engine native/api native/cli

if ($commits) {
    $commits | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Yellow
    }
    Write-Host "`n[Sync workflow]:" -ForegroundColor Cyan
    Write-Host "  1. git checkout -b sync/update $TargetBranch"
    Write-Host "  2. git cherry-pick <commit-hash>"
    Write-Host "  3. Audit for redlines (no cloud/telemetry), run cargo check -p fluxdown_engine"
    Write-Host "  4. git checkout $TargetBranch && git merge --ff-only sync/update && git branch -d sync/update"
} else {
    Write-Host "No pending engine/api commits found. Everything is in sync." -ForegroundColor Green
}
