# GitHub Actions Pipeline Setup

## Overview

The StellarStack Installer uses a multi-pipeline GitHub Actions workflow for building, testing, and releasing across all platforms. This document explains the architecture and how to use it.

## Pipeline Architecture

```
                    Push to tag: installer-v*
                           ↓
                  ┌─────────┴─────────┐
                  ↓                   ↓
           ┌──────────────┐   ┌──────────────┐
           │   Pull on    │   │   Pull on    │
           │   Installer/ │   │   Installer/ │
           └──────────────┘   └──────────────┘
                  ↓                   ↓
        ┌─────────────────┬───────────────────┬─────────────────┐
        ↓                 ↓                   ↓
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │   Linux     │  │   macOS      │  │   Windows    │
  │   Pipeline  │  │   Pipeline   │  │   Pipeline   │
  └─────────────┘  └──────────────┘  └──────────────┘
        ↓                 ↓                   ↓
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Build x86_64│  │ Build x86_64 │  │ Build x86_64 │
  │ Build ARM64 │  │ Build ARM64  │  │              │
  └─────────────┘  └──────────────┘  └──────────────┘
        ↓                 ↓                   ↓
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │    Test     │  │    Test      │  │     Test     │
  └─────────────┘  └──────────────┘  └──────────────┘
        ↓                 ↓                   ↓
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │  Checksums  │  │  Checksums   │  │  Checksums   │
  └─────────────┘  └──────────────┘  └──────────────┘
        │                 │                   │
        └─────────────────┼───────────────────┘
                          ↓
              ┌───────────────────────┐
              │ Release Coordinator   │
              │ (Waits for all three) │
              └───────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                 ↓
   ┌──────────────┐            ┌──────────────────┐
   │   Unified    │            │  Update Latest   │
   │   Release    │            │  Release Tag     │
   └──────────────┘            └──────────────────┘
```

## Workflow Files

### 1. Platform-Specific Build Pipelines

#### `installer-build-linux.yml`
**Trigger:**
- Push with tag `installer-v*`
- Push to `Installer/` directory
- Manual workflow dispatch

**Jobs:**
- `build-linux`: Builds both x86_64 and ARM64 binaries on Ubuntu
  - Linux x86_64 (native)
  - Linux ARM64 (cross-compilation)
- `test`: Verifies binaries run correctly
- `checksums`: Generates SHA256 checksums for Linux binaries

**Outputs:**
- Artifacts: `stellarstack-installer-linux-x86_64`, `stellarstack-installer-linux-arm64`
- Checksums: `linux-checksums.txt`

#### `installer-build-macos.yml`
**Trigger:**
- Push with tag `installer-v*`
- Push to `Installer/` directory
- Manual workflow dispatch

**Jobs:**
- `build-macos`: Builds both Intel and Apple Silicon binaries on macOS
  - macOS x86_64 (Intel)
  - macOS ARM64 (Apple Silicon)
- `test`: Verifies binaries run correctly on macOS
- `checksums`: Generates SHA256 checksums for macOS binaries

**Outputs:**
- Artifacts: `stellarstack-installer-macos-x86_64`, `stellarstack-installer-macos-arm64`
- Checksums: `macos-checksums.txt`

#### `installer-build-windows.yml`
**Trigger:**
- Push with tag `installer-v*`
- Push to `Installer/` directory
- Manual workflow dispatch

**Jobs:**
- `build-windows`: Builds x86_64 binary on Windows
  - Windows x86_64
- `test`: Verifies binary runs correctly on Windows
- `checksums`: Generates SHA256 checksums for Windows binary

**Outputs:**
- Artifacts: `stellarstack-installer-windows-x86_64.exe`
- Checksums: `windows-checksums.txt`

### 2. Release Coordinator

#### `installer-release.yml`
**Trigger:**
- Push with tag `installer-v*` (after platform builds complete)
- Manual workflow dispatch

**Jobs:**
1. `wait-for-builds`: Waits for all three platform pipelines to complete
2. `unified-release`: Downloads artifacts from all platforms and creates a unified GitHub release
3. `update-latest`: Updates the `installer-latest` tag with the newest binaries

**Key Features:**
- Waits for Linux, macOS, and Windows builds to finish
- Combines all binaries into a single GitHub release
- Creates checksums file combining all platforms
- Provides installation instructions for each platform
- Maintains an `installer-latest` tag for easy access to the newest version

## Workflow Execution

### Tag Push Flow

When you push a tag like `installer-v1.2.0`:

1. **Immediately (Parallel Execution):**
   - Linux pipeline starts building on ubuntu-latest
   - macOS pipeline starts building on macos-latest
   - Windows pipeline starts building on windows-latest

2. **After 2-5 minutes (Parallel Tests):**
   - Each platform tests its binaries
   - Checksums are generated per platform

3. **After all tests pass (Sequential):**
   - Release Coordinator waits for all three to complete
   - Downloads artifacts from all pipelines
   - Creates unified release with all 5 binaries
   - Updates `installer-latest` tag

4. **Final Result:**
   - Single GitHub release with all platform binaries
   - Platform-specific instructions in release notes
   - Checksums for verification

### Total Build Time
- **Parallel builds:** ~2-3 minutes per platform
- **Waiting for slowest:** ~5-7 minutes total
- **Release creation:** ~1-2 minutes
- **Total time:** ~7-10 minutes from tag push to release available

## Triggering Releases

### Method 1: Git Tags (Recommended)
```bash
# Create and push a tag
git tag installer-v1.2.0
git push origin installer-v1.2.0
```

### Method 2: GitHub UI
1. Go to Actions tab
2. Select "Installer Release Coordinator"
3. Click "Run workflow"
4. Enter version number (e.g., 1.2.0)
5. Click "Run workflow"

### Method 3: CLI with gh
```bash
gh workflow run installer-release.yml -f version=1.2.0
```

## Release Assets

Each release includes:

```
installer-v1.2.0/
├── stellarstack-installer-linux-x86_64          (Linux x86_64)
├── stellarstack-installer-linux-arm64           (Linux ARM64)
├── stellarstack-installer-macos-x86_64          (macOS Intel)
├── stellarstack-installer-macos-arm64           (macOS Apple Silicon)
├── stellarstack-installer-windows-x86_64.exe    (Windows)
├── checksums.txt                                (Combined checksums)
├── linux-checksums.txt                          (Linux only)
├── macos-checksums.txt                          (macOS only)
└── windows-checksums.txt                        (Windows only)
```

## Verifying Binaries

### SHA256 Verification

**Linux/macOS:**
```bash
sha256sum -c checksums.txt
```

**Windows (PowerShell):**
```powershell
# Individual file
$(certUtil -hashfile stellarstack-installer-windows-x86_64.exe SHA256)[1] -join ''

# Compare with checksums.txt (visual comparison)
cat checksums.txt
```

## Customizing the Pipelines

### Adding Build Steps

Edit individual platform files to add build flags or environment variables:

```yaml
- name: Build binary
  working-directory: Installer
  env:
    GOOS: linux
    GOARCH: amd64
    # Add custom flags here
    ADDITIONAL_FLAG: value
  run: |
    go build -o ${{ matrix.artifact }} -ldflags="-s -w -X version=${{ github.ref_name }}" main.go
```

### Changing Build Trigger Paths

Edit the `on:` section to trigger on different paths:

```yaml
on:
  push:
    paths:
      - 'Installer/**'        # Current (changes to Installer/)
      - 'go.mod'              # Add this to rebuild on dependency changes
      - 'go.sum'
```

### Adding New Platforms

1. Add new matrix entry in `build-*`:
```yaml
matrix:
  include:
    - arch: new-arch
      goarch: new-go-arch
      artifact: artifact-name
```

2. Create corresponding test steps

3. Update release notes template

## Troubleshooting

### Build Fails on Specific Platform

Check the workflow run logs:
1. Go to Actions → specific workflow
2. Click on the failed run
3. Expand job and see detailed error output

### Release Not Created

1. Verify tag format: `installer-v*` (exact prefix required)
2. Check that all three platform pipelines completed successfully
3. Verify token permissions in `installer-release.yml`

### Artifacts Not Downloaded

Check that artifact names match between platform builds and release coordinator:
- Linux: `stellarstack-installer-linux-*`
- macOS: `stellarstack-installer-macos-*`
- Windows: `stellarstack-installer-windows-*.exe`

### Path Issues in Checksums

Verify path separators in checksum files:
- Should use forward slashes in YAML
- Platform runners handle conversion automatically

## Security Considerations

1. **GITHUB_TOKEN Permissions:**
   - Workflows use automatic `GITHUB_TOKEN` (limited scope)
   - Only has write access to current repo

2. **No Secrets Required:**
   - Builds don't require any external secrets
   - Self-contained cross-compilation

3. **Artifact Retention:**
   - Default: 90 days
   - Change in repo settings if needed

## Performance Optimization

### Parallel Execution
All three platform pipelines run simultaneously on different runners:
- Linux: Ubuntu runner (standard)
- macOS: macOS runner (premium)
- Windows: Windows runner (premium)

This parallel execution reduces total time from ~15 minutes (sequential) to ~5-7 minutes (parallel).

### Caching Go Modules

Add to each platform workflow for faster builds:

```yaml
- name: Cache Go modules
  uses: actions/cache@v3
  with:
    path: ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('Installer/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

## Next Steps

1. **Test Workflows:** Push a test tag like `installer-v0.0.0-test` to verify everything works
2. **Monitor Build Time:** Check Actions tab to see actual build durations
3. **Review Release Notes:** Adjust templates in coordinator as needed
4. **Set Up Notifications:** Configure GitHub notifications for workflow failures

---

**Last Updated:** 2026-01-17
**Maintainer:** StellarStack Team
