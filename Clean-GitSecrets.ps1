# PowerShell Script to Remove Secrets from Git History
# Run this in your repository directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git Secret Cleanup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Not in a git repository!" -ForegroundColor Red
    Write-Host "Please navigate to your repository folder first." -ForegroundColor Yellow
    exit 1
}

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Confirm before proceeding
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Remove .env-exportbackend from git tracking" -ForegroundColor Yellow
Write-Host "  2. Add it to .gitignore" -ForegroundColor Yellow
Write-Host "  3. Remove the file from ALL commit history" -ForegroundColor Yellow
Write-Host "  4. Force push to remote" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This will rewrite git history!" -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Do you want to continue? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Update .gitignore" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Create or append to .gitignore
$gitignoreContent = @"

# Environment files (added by cleanup script)
.env-exportbackend
*.env
.env*
.env.local
.env.*.local

# Secrets
*.pem
*.key
secrets/
"@

Add-Content -Path ".gitignore" -Value $gitignoreContent
Write-Host "✓ Updated .gitignore" -ForegroundColor Green

# Stage .gitignore
git add .gitignore
Write-Host "✓ Staged .gitignore" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: Remove file from tracking" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Try to remove the file from git (if it exists)
git rm --cached .env-exportbackend 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Removed .env-exportbackend from tracking" -ForegroundColor Green
} else {
    Write-Host "ℹ File not in current index (might already be removed)" -ForegroundColor Yellow
}

# Commit the changes
git commit -m "Remove env files from tracking and update gitignore" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Committed changes" -ForegroundColor Green
} else {
    Write-Host "ℹ Nothing to commit (continuing...)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 3: Clean git history" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "This may take a moment..." -ForegroundColor Yellow
Write-Host ""

# Use filter-branch to remove the file from all history
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env-exportbackend" --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully cleaned git history" -ForegroundColor Green
} else {
    Write-Host "✗ Error cleaning history" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 4: Cleanup and garbage collection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Clean up refs
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
Write-Host "✓ Cleaned up refs" -ForegroundColor Green

# Expire reflog
git reflog expire --expire=now --all
Write-Host "✓ Expired reflog" -ForegroundColor Green

# Garbage collection
git gc --prune=now --aggressive
Write-Host "✓ Ran garbage collection" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 5: Verify cleanup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Search for any remaining traces
Write-Host "Searching for remaining traces of the file..." -ForegroundColor Yellow
$traces = git log --all --full-history -- .env-exportbackend 2>&1

if ([string]::IsNullOrWhiteSpace($traces)) {
    Write-Host "✓ No traces found in history!" -ForegroundColor Green
} else {
    Write-Host "⚠ File still appears in history:" -ForegroundColor Yellow
    Write-Host $traces
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 6: Force push to remote" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Ready to force push to origin/main" -ForegroundColor Yellow
Write-Host "This will overwrite remote history!" -ForegroundColor Red
Write-Host ""

$pushConfirm = Read-Host "Push to remote now? (yes/no)"
if ($pushConfirm -eq "yes") {
    git push origin main --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Successfully pushed to remote!" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "SUCCESS!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Rotate your Stripe API keys (even test keys)" -ForegroundColor Yellow
        Write-Host "  2. Update your local .env-exportbackend file" -ForegroundColor Yellow
        Write-Host "  3. Never commit .env files again!" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "✗ Push failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible reasons:" -ForegroundColor Yellow
        Write-Host "  - Branch protection is enabled" -ForegroundColor Yellow
        Write-Host "  - GitHub secret scanning still detected secrets" -ForegroundColor Yellow
        Write-Host "  - Network issues" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Try:" -ForegroundColor Cyan
        Write-Host "  1. Check GitHub branch protection settings" -ForegroundColor Cyan
        Write-Host "  2. Verify secrets are actually removed: git log -S 'sk_live' --all" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "Push cancelled. You can push manually later with:" -ForegroundColor Yellow
    Write-Host "  git push origin main --force" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Script complete!" -ForegroundColor Green
Write-Host ""