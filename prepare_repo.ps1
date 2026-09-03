$ErrorActionPreference = "Stop"

$source = "d:\TokoKu-POS-Source"
$dest = "d:\TokoKu-POS-Source\berkah-sekar-app"

Write-Host "Copying files..."
$excludes = @("berkah-sekar-app", ".git", ".idea", "node_modules", "venv", "__pycache__", ".artifacts")

Get-ChildItem -Path $source | Where-Object { $excludes -notcontains $_.Name } | Copy-Item -Destination $dest -Recurse -Force

Write-Host "Renaming TokoKu POS to Toko Berkah Sekar in text files..."
$textExtensions = @(".html", ".js", ".css", ".json", ".md")

Get-ChildItem -Path $dest -Recurse | Where-Object { -not $_.PSIsContainer -and ($textExtensions -contains $_.Extension) } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    $modified = $false
    
    if ($content -match "TokoKu POS") {
        $content = $content -creplace "TokoKu POS", "Toko Berkah Sekar"
        $modified = $true
    }
    
    if ($content -match '"short_name":\s*"TokoKu"') {
        $content = $content -creplace '"short_name":\s*"TokoKu"', '"short_name": "Berkah Sekar"'
        $modified = $true
    }
    
    if ($content -match "TokoKu") {
        # Only replace visible TokoKu that are not part of code logic if possible, 
        # but let's just do exact case-sensitive replacements for the title
        $content = $content -creplace "<title>TokoKu -", "<title>Toko Berkah Sekar -"
        $modified = $true
    }
    
    if ($modified) {
        Set-Content -Path $_.FullName -Value $content -NoNewline
    }
}

Write-Host "Done!"
