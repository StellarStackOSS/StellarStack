#!/bin/bash

#
# Cross-Platform Build Script for StellarStack Installer
# Builds binaries for Windows, macOS, and Linux (including ARM variants)
#
# This script must be run on a Unix-like system (Linux, macOS, or WSL on Windows)
# On native Windows, use build-all-platforms.ps1 instead
#

set -e

VERSION="1.2.0"
OUTPUT_DIR="./dist"
BINARY_NAME="installer"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     StellarStack Installer - Cross-Platform Build Script      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# Define build targets
declare -a TARGETS=(
    "linux:amd64:installer-linux-x86_64"
    "linux:arm64:installer-linux-arm64"
    "darwin:amd64:installer-macos-x86_64"
    "darwin:arm64:installer-macos-arm64"
    "windows:amd64:installer-windows-x86_64.exe"
)

echo "🔨 Building for all platforms..."
echo ""

# Counter for tracking progress
total=${#TARGETS[@]}
current=0

for target in "${TARGETS[@]}"; do
    IFS=':' read -r goos goarch output <<< "$target"
    current=$((current + 1))

    echo "[$current/$total] Building for $goos/$goarch..."

    # Set environment variables and build
    GOOS="$goos" GOARCH="$goarch" go build \
        -ldflags="-s -w" \
        -o "$OUTPUT_DIR/$output" \
        . 2>/dev/null

    # Get file size
    if [ -f "$OUTPUT_DIR/$output" ]; then
        size=$(du -h "$OUTPUT_DIR/$output" | cut -f1)
        echo "  ✓ $OUTPUT_DIR/$output ($size)"
    else
        echo "  ✗ Build failed for $goos/$goarch"
        exit 1
    fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Build Complete!                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Binaries created in: $OUTPUT_DIR"
echo ""
echo "Available binaries:"
ls -lah "$OUTPUT_DIR" | grep installer | awk '{print "  " $9 " (" $5 ")"}'
echo ""
