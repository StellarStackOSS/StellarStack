# PowerShell script to remove mounted variable and related code

$files = @(
    "apps\web\app\page.tsx",
    "apps\web\app\admin\locations\page.tsx",
    "apps\web\app\admin\blueprints\page.tsx",
    "apps\web\app\admin\servers\new\page.tsx",
    "apps\web\app\admin\nodes\page.tsx",
    "apps\web\app\setup\page.tsx",
    "apps\web\app\servers\[id]\settings\page.tsx",
    "apps\web\app\servers\[id]\files\edit\page.tsx",
    "apps\web\app\auth\two-factor\page.tsx",
    "apps\web\app\admin\settings\page.tsx",
    "apps\web\app\admin\users\page.tsx",
    "apps\web\app\admin\servers\page.tsx",
    "apps\web\app\admin\servers\[id]\edit\page.tsx",
    "apps\web\app\admin\nodes\[id]\page.tsx",
    "apps\web\app\admin\nodes\[id]\edit\page.tsx",
    "apps\web\app\admin\layout.tsx",
    "apps\web\app\account\page.tsx",
    "apps\web\hooks\useServerWebSocket.ts"
)

foreach ($file in $files) {
    $filePath = Join-Path "C:\Users\marqu\StellarStack-REPO" $file
    if (Test-Path $filePath) {
        Write-Host "Processing $file..."
    } else {
        Write-Host "File not found: $filePath"
    }
}
