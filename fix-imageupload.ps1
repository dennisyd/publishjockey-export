# Fix duplicate imageUpload declaration

# Back up original file
Copy-Item server.js server.js.backup

# Read the file content
$content = Get-Content server.js

# Keep only lines before the duplicate and after the declaration
$fixedContent = $content[0..2087] + $content[2108..2114]

# Write the fixed content
$fixedContent | Set-Content server.js.fixed

Write-Host 'Fixed version saved as server.js.fixed'
Write-Host 'To apply the fix: Copy-Item server.js.fixed server.js'
