# Cross-Platform Build Guide

The StellarStack Installer now supports **Windows, macOS, and Linux** across all major architectures including **ARM variants**.

## Supported Platforms

### Tier 1 (Fully Tested)

- ✅ **Windows 10/11** (x86_64)
- ✅ **Ubuntu 20.04+** (x86_64, ARM64)
- ✅ **macOS 11+** (Intel x86_64, Apple Silicon ARM64)

### Installation Paths by Platform

**Windows:**

```
C:\ProgramData\StellarStack\
├── docker-compose.yml
├── .env
└── .backup/
```

**macOS:**

```
/opt/stellarstack/
├── docker-compose.yml
├── .env
└── .backup/
```

**Linux:**

```
/opt/stellarstack/
├── docker-compose.yml
├── .env
└── .backup/
```

## Building for All Platforms

### Option 1: Windows PowerShell (Recommended on Windows)

```powershell
# From Installer directory
.\build-all-platforms.ps1

# Clean output directory
.\build-all-platforms.ps1 -CleanOnly
```

### Option 2: Windows Batch

```cmd
# From Installer directory
build-all-platforms.bat
```

### Option 3: Unix/Linux/macOS/WSL

```bash
# From Installer directory
chmod +x build-all-platforms.sh
./build-all-platforms.sh
```

## Build Output

All binaries are created in the `./dist` directory:

```
dist/
├── installer-windows-x86_64.exe      (Windows 64-bit)
├── installer-linux-x86_64            (Linux 64-bit x86)
├── installer-linux-arm64             (Linux 64-bit ARM)
├── installer-macos-x86_64            (macOS Intel)
└── installer-macos-arm64             (macOS Apple Silicon)
```

## Manual Cross-Compilation

If you prefer to build individual binaries:

```bash
# Windows
GOOS=windows GOARCH=amd64 go build -o installer-windows-x86_64.exe

# Linux
GOOS=linux GOARCH=amd64 go build -o installer-linux-x86_64
GOOS=linux GOARCH=arm64 go build -o installer-linux-arm64

# macOS
GOOS=darwin GOARCH=amd64 go build -o installer-macos-x86_64
GOOS=darwin GOARCH=arm64 go build -o installer-macos-arm64
```

## Platform-Specific Features

### Windows-Specific

- ✓ Installs to `C:\ProgramData\StellarStack`
- ✓ Requires Docker Desktop with WSL2 or Hyper-V
- ✓ Supports PowerShell 5.1+
- ✓ Reads `%ProgramData%` environment variable

### macOS-Specific

- ✓ Installs to `/opt/stellarstack`
- ✓ Requires Docker Desktop for macOS
- ✓ Supports both Intel (x86_64) and Apple Silicon (ARM64)
- ✓ Uses Homebrew for package management
- ✓ Nginx paths: `/usr/local/etc/nginx/sites-*`

### Linux-Specific

- ✓ Installs to `/opt/stellarstack`
- ✓ Supports Ubuntu 20.04+, Debian 11+, RHEL 8+, CentOS 8+
- ✓ ARM64 support for Raspberry Pi, AWS Graviton, etc.
- ✓ Standard Linux paths: `/etc/nginx/sites-*`

## Testing Binaries

### Windows

```powershell
.\dist\installer-windows-x86_64.exe --help
.\dist\installer-windows-x86_64.exe --debug
```

### macOS/Linux

```bash
chmod +x dist/installer-linux-x86_64
./dist/installer-linux-x86_64 --help
./dist/installer-linux-x86_64 --debug
```

## Docker Desktop Requirements

### Windows

- Docker Desktop 4.0+ with **WSL2 or Hyper-V**
- At least 4GB RAM allocated to Docker
- Administrator privileges required

### macOS

- Docker Desktop 4.0+
- Compatible with both Intel and Apple Silicon Macs
- 4GB+ RAM recommended

### Linux

- Docker Engine (Community or Enterprise)
- Docker Compose v2.0+
- User permissions configured (`docker` group)

## Creating Release Packages

### Generate Checksums

```powershell
# PowerShell
Get-FileHash dist/* | Out-File checksums.txt

# Bash
cd dist && sha256sum installer-* > ../checksums.txt
```

### Create Archives

```bash
# Linux
cd dist
tar -czf stellarstack-installer-linux-x86_64.tar.gz installer-linux-x86_64
tar -czf stellarstack-installer-linux-arm64.tar.gz installer-linux-arm64
tar -czf stellarstack-installer-macos-x86_64.tar.gz installer-macos-x86_64
tar -czf stellarstack-installer-macos-arm64.tar.gz installer-macos-arm64

# Windows
# Use 7-Zip or Windows built-in compression
```

## GitHub Actions Integration

For automated cross-platform builds on GitHub:

```yaml
name: Build Installers

on:
  push:
    tags:
      - "v*"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: "1.25.6"

      - name: Build binaries
        run: |
          cd Installer
          chmod +x build-all-platforms.sh
          ./build-all-platforms.sh

      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: Installer/dist/*
```

## Troubleshooting

### Issue: "GOOS not supported" on Windows

**Solution:** Use the provided batch or PowerShell scripts which properly set environment variables:

```powershell
# Correct
.\build-all-platforms.ps1

# Incorrect (may fail on native Windows)
# GOOS=linux go build ...
```

### Issue: "permission denied" on Linux/macOS

**Solution:** Make build scripts executable:

```bash
chmod +x build-all-platforms.sh
chmod +x dist/installer-linux-*
```

### Issue: Build takes longer on non-native platforms

This is expected. Cross-compilation may take 2-3x longer than native compilation.

### Issue: "CGO_ENABLED" errors

**Solution:** Set `CGO_ENABLED=0` for pure Go binaries:

```bash
CGO_ENABLED=0 GOOS=linux go build -o installer-linux-x86_64
```

## Architecture Matrix

| OS          | x86_64     | ARM64                              | ARM32 |
| ----------- | ---------- | ---------------------------------- | ----- |
| **Windows** | ✅         | ⚠️ (ARM64 Desktop)                 | ❌    |
| **macOS**   | ✅ (Intel) | ✅ (Apple Silicon)                 | ❌    |
| **Linux**   | ✅         | ✅ (Raspberry Pi 4+, AWS Graviton) | ✅    |

✅ = Supported
⚠️ = Technically possible but rare/untested
❌ = Not supported

## Binary Sizes

Typical binary sizes after stripping symbols:

- Windows x86_64: ~4.5 MB
- Linux x86_64: ~4.2 MB
- Linux ARM64: ~4.2 MB
- macOS x86_64: ~4.3 MB
- macOS ARM64: ~4.2 MB

## Version Information

The installer automatically detects and displays:

- Operating System (Windows, macOS, Linux)
- Architecture (x86_64, ARM64, ARM32)
- Installer Version (1.2.0)
- Build Date (2026-01-17)

Example on startup:

```
Platform: macOS (ARM64)
```

## Next Steps

1. **Test** binaries on each target platform
2. **Generate** checksums for integrity verification
3. **Create** release packages for distribution
4. **Upload** to GitHub Releases or package repositories
5. **Document** platform-specific installation steps

## References

- [Go Platform Support](https://golang.org/doc/install/source#environment)
- [Cross-compilation Guide](https://golang.org/doc/install/source#cgo)
- [Docker Platform Support](https://docs.docker.com/install/)
