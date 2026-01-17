@echo off
REM Cross-Platform Build Script for StellarStack Installer (Batch)
REM Builds binaries for Windows, macOS, and Linux (including ARM variants)

setlocal enabledelayedexpansion

set VERSION=1.2.0
set OUTPUT_DIR=dist
set BINARY_NAME=installer

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║     StellarStack Installer - Cross-Platform Build Script      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Create output directory
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%"
echo 📁 Output directory: %OUTPUT_DIR%
echo.

echo 🔨 Building for all platforms...
echo.

REM Windows x86_64
echo [1/5] Building for windows/amd64...
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w" -o "%OUTPUT_DIR%\installer-windows-x86_64.exe" .
if errorlevel 1 goto ERROR
echo   ✓ %OUTPUT_DIR%\installer-windows-x86_64.exe
echo.

REM Linux x86_64
echo [2/5] Building for linux/amd64...
set GOOS=linux
set GOARCH=amd64
go build -ldflags="-s -w" -o "%OUTPUT_DIR%\installer-linux-x86_64" .
if errorlevel 1 goto ERROR
echo   ✓ %OUTPUT_DIR%\installer-linux-x86_64
echo.

REM Linux ARM64
echo [3/5] Building for linux/arm64...
set GOOS=linux
set GOARCH=arm64
go build -ldflags="-s -w" -o "%OUTPUT_DIR%\installer-linux-arm64" .
if errorlevel 1 goto ERROR
echo   ✓ %OUTPUT_DIR%\installer-linux-arm64
echo.

REM macOS x86_64
echo [4/5] Building for darwin/amd64...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags="-s -w" -o "%OUTPUT_DIR%\installer-macos-x86_64" .
if errorlevel 1 goto ERROR
echo   ✓ %OUTPUT_DIR%\installer-macos-x86_64
echo.

REM macOS ARM64
echo [5/5] Building for darwin/arm64...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags="-s -w" -o "%OUTPUT_DIR%\installer-macos-arm64" .
if errorlevel 1 goto ERROR
echo   ✓ %OUTPUT_DIR%\installer-macos-arm64
echo.

REM Reset environment variables
set GOOS=
set GOARCH=

echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    Build Complete!                            ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 📦 Binaries created in: %OUTPUT_DIR%
echo.
echo Available binaries:
dir /b "%OUTPUT_DIR%\installer*"
echo.
goto END

:ERROR
echo.
echo ✗ Build failed!
exit /b 1

:END
endlocal
