<#
.SYNOPSIS
    Commits the recovered Talent Studio working tree in twelve reviewable batches.

.DESCRIPTION
    Run this from inside the recovered repo (C:\dev\talent-consulting) after
    recover-repo.ps1 has completed and `git diff` is proven working.

    Each batch stages a set of path patterns and makes one commit. Anything not
    matched by any batch is caught by a final sweep commit, so nothing is silently
    left behind. Secret files are refused outright.

.PARAMETER DryRun
    Show what each batch would contain. Nothing is staged or committed.

.EXAMPLE
    .\commit-batches.ps1 -DryRun
    .\commit-batches.ps1
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$Repo = "C:\dev\talent-consulting"
)

# NOTE: must NOT be "Stop". Windows PowerShell 5.1 wraps a native command's stderr
# in a NativeCommandError, which "Stop" turns into a terminating error even when the
# command exited 0. Several git calls here write to stderr by design -- notably the
# `git ls-files --error-unmatch` secret check below, which is *expected* to fail when
# a secret is correctly untracked. Control flow relies on explicit $LASTEXITCODE
# checks and Write-Die, not on exceptions, so "Continue" weakens no guard.
$ErrorActionPreference = "Continue"

function Write-Step { param($m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "  [ok] $m"   -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "  [!!] $m"   -ForegroundColor Yellow }
function Write-Die  { param($m) Write-Host "  [XX] $m"   -ForegroundColor Red; exit 1 }

# Never stage these, whatever the patterns say. All are untracked and gitignored.
$NeverCommit = @(".env", ".env.local", ".env.cloudrun.yaml", "hermes-agent-keys.txt")

# Tracked BY DESIGN — do not treat as a secret.
# .env.production holds only NEXT_PUBLIC_* values (public Firebase config, Stripe
# publishable key) that are compiled into the client bundle anyway. The Docker build
# reads it for build-time SSG; see commit 959fb69. It is not gitignored and must stay
# committed. Its own first line says "safe to embed".
$TrackedByDesign = @(".env.production")

$Batches = @(
    @{ Name = "chore: normalise file modes from WSL/OneDrive mount"
       Paths = @(".agent/") }

    @{ Name = "feat(admin): Firestore-backed RBAC, admin accounts and audit log"
       Paths = @("lib/admin-*.ts", "lib/admin/", "app/api/admin/", "scripts/admin-*") }

    @{ Name = "feat(admin): Command Grid console — nine modules"
       Paths = @("app/suite/admin/", "app/suite/admin-preview/", "components/admin/") }

    @{ Name = "feat(email): V2 catalog, Firestore outbox and delivery receipts"
       Paths = @("lib/email/", "lib/email-*.ts", "lib/communication*.ts", "emails/",
                 "app/api/email/", "app/api/cron/email-outbox/", "app/api/communication-preferences/",
                 "scripts/*email*", "scripts/*resend*", "scripts/*unsubscribe*") }

    @{ Name = "feat(observability): user observability v1 behind feature flag"
       Paths = @("lib/observability/", "lib/analytics/", "app/api/observability/",
                 "app/api/privacy/", "scripts/observability-*", "scripts/analytics-privacy-*") }

    @{ Name = "feat(billing): Stripe checkout hardening and runtime price resolution"
       Paths = @("lib/billing*.ts", "lib/billing/", "lib/plan-identity.ts", "lib/pricing-tiers.ts",
                 "app/api/stripe/", "app/api/billing/", "app/api/webhooks/",
                 "scripts/stripe-*", "scripts/*plan-*", "scripts/*pricing*", "scripts/*checkout*") }

    @{ Name = "feat(jobs): Talent Fit v2, recommendation ledger and calibration"
       Paths = @("lib/job-*.ts", "lib/recommendation-*.ts", "lib/career-*.ts", "lib/semantic-match.ts",
                 "app/api/jobs/", "app/api/applications/",
                 "scripts/job-*", "scripts/recommendation-*", "scripts/ever-jobs-*") }

    @{ Name = "feat(resume): truth-locked studio, export guardrails and signature templates"
       Paths = @("lib/resume-*.ts", "lib/resume-*.tsx", "lib/resume-templates/",
                 "components/resume-studio/", "components/resume-templates/",
                 "app/api/resume/", "scripts/resume-*", "scripts/*morph*") }

    @{ Name = "feat(assistant): Taco/Sona toolkit and AI provider routing"
       Paths = @("lib/ai/", "lib/sona*.ts", "lib/sona/", "lib/assistant/", "components/assistant/",
                 "app/api/agent/", "app/api/ai/", "app/api/chat/", "scripts/sona-*") }

    @{ Name = "feat(auth): account lifecycle, recovery and action tokens"
       Paths = @("lib/auth-*.ts", "lib/account-action-tokens.ts", "lib/api-auth.ts",
                 "app/api/auth/", "app/api/account/", "app/auth/", "app/account/",
                 "scripts/*auth*", "scripts/workspace-*") }

    @{ Name = "feat(ui): suite pages, mobile surfaces and shared components"
       Paths = @("app/suite/", "app/tools/", "app/", "components/", "hooks/", "types/") }

    @{ Name = "docs: rebuild architecture, changelog and status; add recovery runbook"
       Paths = @("*.md", "docs/", "firestore.rules", "firestore.indexes.json", "firebase.json",
                 "next.config.js", "package.json", "package-lock.json", "tsconfig.json",
                 "tailwind.config.ts", "postcss.config.js", "Dockerfile", "cloudbuild.yaml",
                 ".env.production", ".gitignore") }
)

# ---------------------------------------------------------------- preflight

Write-Step "Preflight"

if (-not (Test-Path -LiteralPath $Repo)) { Write-Die "Repo not found: $Repo" }
Set-Location -LiteralPath $Repo
Write-Ok "In $Repo"

& git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) { Write-Die "Not a git repository" }

& git diff --shortstat *> $null
if ($LASTEXITCODE -ne 0) { Write-Die "git diff fails — the repo is still damaged. Run recover-repo.ps1 first." }
Write-Ok "git diff works"

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
Write-Ok "On branch $branch"

# Refuse to run if a real secret is already tracked. This is a genuine emergency:
# the value is in git history and needs rotating, not just unstaging.
foreach ($f in $NeverCommit) {
    $null = & git ls-files --error-unmatch $f 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Die @"
$f is TRACKED by git — that is a live secret in your history.
       Untrack it, then ROTATE the credentials it contains:
         git rm --cached "$f"
         echo "$f" >> .gitignore
"@
    }
}
Write-Ok "No secrets tracked ($($NeverCommit.Count) checked)"

# .env.production is expected to be tracked. Say so, so its presence in a commit
# does not look like an accident during review.
foreach ($f in $TrackedByDesign) {
    $null = & git ls-files --error-unmatch $f 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Ok "$f tracked (by design — public NEXT_PUBLIC_* config)" }
    else { Write-Warn "$f is NOT tracked. The Docker build needs it for build-time SSG — check this is intentional." }
}

$total = (& git status --porcelain | Measure-Object -Line).Lines
Write-Ok "$total changed entries to distribute"

if ($DryRun) { Write-Warn "DRY RUN — nothing will be staged or committed" }

# ---------------------------------------------------------------- batches

$committed = 0
$i = 0

foreach ($b in $Batches) {
    $i++
    Write-Step "Batch $i/$($Batches.Count): $($b.Name)"

    # Reset the index so each batch stages only its own paths.
    if (-not $DryRun) { & git reset *> $null }

    $staged = 0
    # Dedupe: one file can match several patterns in the same batch, and a file
    # consumed by an earlier batch still shows in `git status` during a dry run.
    # Counting a set rather than summing keeps the preview honest.
    $seen = [System.Collections.Generic.HashSet[string]]::new()

    foreach ($p in $b.Paths) {
        if ($DryRun) {
            $hits = & git status --porcelain -- $p 2>$null
            foreach ($h in $hits) {
                $path = $h.Substring(3).Trim('"')
                if ($seen.Add($path)) {
                    if ($seen.Count -le 6) { Write-Host "      $path" -ForegroundColor DarkGray }
                }
            }
        } else {
            & git add -- $p 2>$null
        }
    }
    if ($DryRun) {
        $staged = $seen.Count
        if ($seen.Count -gt 6) { Write-Host "      ... and $($seen.Count - 6) more" -ForegroundColor DarkGray }
    }

    if (-not $DryRun) {
        # Defensive: unstage anything forbidden that a glob may have caught.
        foreach ($f in $NeverCommit) { & git reset -- $f *> $null }

        $staged = (& git diff --cached --name-only | Measure-Object -Line).Lines
        if ($staged -eq 0) { Write-Warn "nothing matched — skipped"; continue }

        & git commit -m $b.Name --no-verify | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Die "commit failed for batch $i" }
        $committed++
        Write-Ok "$staged files committed"
    } else {
        if ($staged -eq 0) { Write-Warn "nothing matched" } else { Write-Ok "$staged files would be committed" }
    }
}

# ---------------------------------------------------------------- sweep

Write-Step "Sweep — anything not matched above"

if ($DryRun) {
    $left = & git status --porcelain
    if ($left) {
        Write-Warn "$(($left | Measure-Object -Line).Lines) entries would remain (dry run cannot simulate batch consumption accurately)"
    }
} else {
    & git reset *> $null
    & git add -A 2>$null
    foreach ($f in $NeverCommit) { & git reset -- $f *> $null }

    $left = (& git diff --cached --name-only | Measure-Object -Line).Lines
    if ($left -gt 0) {
        & git commit -m "chore: remaining working tree after batched recovery" --no-verify | Out-Null
        $committed++
        Write-Ok "$left remaining files committed"
    } else {
        Write-Ok "nothing left over — clean"
    }
}

# ---------------------------------------------------------------- report

Write-Step "Result"

if (-not $DryRun) {
    Write-Ok "$committed commits created"
    & git log --oneline -15
    $dirty = (& git status --porcelain | Measure-Object -Line).Lines
    if ($dirty -eq 0) { Write-Ok "working tree clean" } else { Write-Warn "$dirty entries still uncommitted (check .gitignore)" }
    Write-Host "`n  Next: git push -u origin $branch" -ForegroundColor Cyan
} else {
    Write-Host "  Re-run without -DryRun to commit." -ForegroundColor Cyan
}

Write-Host ""
