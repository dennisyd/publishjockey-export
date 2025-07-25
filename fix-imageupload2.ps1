# Fix duplicate imageUpload declaration

# Back up original file
Copy-Item server.js server.js.backup

# Read the file content
$content = Get-Content server.js

# Find the lines with the API route
$apiRouteStart = ($content | Select-String -Pattern "// POST /api/uploads").LineNumber - 1
$apiRouteEnd = $apiRouteStart + 7  # The route is about 7 lines long

# Combine content before the duplicate declaration and after the declaration, plus the API route
$fixedContent = $content[0..2087] + $content[$apiRouteStart..$apiRouteEnd]

# Write the fixed content
$fixedContent | Set-Content server.js.fixed2

Write-Host "Fixed version saved as server.js.fixed2"
Write-Host "To apply the fix: Copy-Item server.js.fixed2 server.js"
