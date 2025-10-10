# 1. Commit the .gitignore changes that are already there
git add .gitignore
git commit -m "Update gitignore"

# 2. Remove the env file from tracking (if it exists)
git rm --cached .env-exportbackend

# 3. Commit that removal
git commit -m "Remove env file from tracking"

# 4. Now clean the history
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env-exportbackend" --prune-empty --tag-name-filter cat -- --all

# 5. Cleanup refs and garbage collect
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Force push
git push origin main --force