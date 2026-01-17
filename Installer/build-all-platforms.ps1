# Cross-Platform Build Script for StellarStack Installer (PowerShell)
# Builds binaries for Windows, macOS, and Linux (including ARM variants)
# Run this on Windows to cross-compile for all platforms

param(
    [switch]$Help,
    [switch]$CleanOnly
)

if ($Help) {
    Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║     StellarStack Installer - Cross-Platform Build Script      ║
╚════════════════════════════════════════════════════════════════╝

Usage: .\build-all-platforms.ps1 [options]

Options:
    -Help       Show this help message
    -CleanOnly  Clean dist directory without building

This script builds the StellarStack installer for:
  • Windows (x86_64)
  • Linux (x86_64, ARM64)
  • macOS (x86_64, Apple Silicon/ARM64)

Requirements:
  • Go 1.25.6 or later
  • All platform builds are done via cross-compilation

Output:
  Binaries are created in ./dist directory

Examples:
    .\build-all-platforms.ps1           # Build all platforms
    .\build-all-platforms.ps1 -CleanOnly # Clean output directory
"@
    exit 0
}

$VERSION = "1.2.0"
$OUTPUT_DIR = ".\dist"
$BINARY_NAME = "installer"

# Colors for output
$Color_Header = "Cyan"
$Color_Success = "Green"
$Color_Info = "Yellow"
$Color_Error = "Red"

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Color_Header
Write-Host "║     StellarStack Installer - Cross-Platform Build Script      ║" -ForegroundColor $Color_Header
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Color_Header
Write-Host ""

# Create output directory
if (Test-Path $OUTPUT_DIR) {
    Remove-Item -Path $OUTPUT_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
Write-Host "📁 Output directory: $OUTPUT_DIR" -ForegroundColor $Color_Info
Write-Host ""

if ($CleanOnly) {
    Write-Host "✓ Cleaned dist directory" -ForegroundColor $Color_Success
    exit 0
}

# Define build targets
$TARGETS = @(
    @{ GOOS = "windows"; GOARCH = "amd64"; Output = "installer-windows-x86_64.exe" },
    @{ GOOS = "linux"; GOARCH = "amd64"; Output = "installer-linux-x86_64" },
    @{ GOOS = "linux"; GOARCH = "arm64"; Output = "installer-linux-arm64" },
    @{ GOOS = "darwin"; GOARCH = "amd64"; Output = "installer-macos-x86_64" },
    @{ GOOS = "darwin"; GOARCH = "arm64"; Output = "installer-macos-arm64" }
)

Write-Host "🔨 Building for all platforms..." -ForegroundColor $Color_Info
Write-Host ""

$total = $TARGETS.Count
$current = 0

foreach ($target in $TARGETS) {
    $current++
    $outputPath = Join-Path $OUTPUT_DIR $target.Output

    Write-Host "[$current/$total] Building for $($target.GOOS)/$($target.GOARCH)..." -ForegroundColor $Color_Info

    # Set environment variables and build
    $env:GOOS = $target.GOOS
    $env:GOARCH = $target.GOARCH

    $output = & go build -ldflags="-s -w" -o $outputPath . 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0 -and (Test-Path $outputPath)) {
        $size = (Get-Item $outputPath).Length / 1MB
        Write-Host "  ✓ $outputPath ($([Math]::Round($size, 2)) MB)" -ForegroundColor $Color_Success
    } else {
        Write-Host "  ✗ Build failed for $($target.GOOS)/$($target.GOARCH)" -ForegroundColor $Color_Error
        Write-Host "  Error: $output" -ForegroundColor $Color_Error
        exit 1
    }
}

# Reset environment variables
$env:GOOS = ""
$env:GOARCH = ""

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Color_Header
Write-Host "║                    Build Complete!                            ║" -ForegroundColor $Color_Header
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Color_Header
Write-Host ""
Write-Host "📦 Binaries created in: $OUTPUT_DIR" -ForegroundColor $Color_Success
Write-Host ""
Write-Host "Available binaries:" -ForegroundColor $Color_Info

Get-ChildItem $OUTPUT_DIR | ForEach-Object {
    $size = $_.Length / 1MB
    Write-Host "  $($_.Name) ($([Math]::Round($size, 2)) MB)"
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor $Color_Info
Write-Host "  1. Test binaries on target platforms"
Write-Host "  2. Create checksums: Get-FileHash dist/* | Out-File checksums.txt"
Write-Host "  3. Upload to GitHub releases"
Write-Host ""
