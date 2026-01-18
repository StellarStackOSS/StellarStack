# Platform Compatibility Audit

## Current Status: ⚠️ Partially Compatible

The installer builds on all platforms, but has platform-specific issues preventing full cross-platform support.

## Issues Found

### 1. File Path Handling ❌ CRITICAL

**Problem:** Hard-coded Unix path separators "/" in file operations

**Files Affected:**

- `executor/files.go` - 7 occurrences
  - Line 41: `cfg.InstallDir + "/" + config.BackupDirName`
  - Line 82: `cfg.InstallDir + "/" + config.BackupDirName + "/" + timestamp`
  - Line 92, 94: Backup file paths
  - Line 111, 113: .env file paths
  - Line 147: env file path
  - Line 226: docker-compose file path

**Impact on Windows:** Creates invalid mixed paths like `C:\opt\stellarstack/docker-compose.yml`

**Solution:** Use `filepath.Join()` for all path operations

```go
// Before (wrong)
envFile := cfg.InstallDir + "/" + config.EnvFileName

// After (correct)
envFile := filepath.Join(cfg.InstallDir, config.EnvFileName)
```

---

### 2. Default Install Directory ❌ CRITICAL

**Problem:** Hard-coded Linux path `/opt/stellarstack`

**Files Affected:**

- `config/defaults.go` - Line 30

**Platform Requirements:**

- **Linux:** `/opt/stellarstack` ✓
- **macOS:** Should be `/opt/stellarstack` or `/usr/local/stellarstack`
- **Windows:** Should be `C:\Program Files\StellarStack` or `C:\ProgramData\StellarStack`

**Solution:** Detect OS and set appropriate default:

```go
import "runtime"

var DefaultInstallDir string

func init() {
    switch runtime.GOOS {
    case "windows":
        DefaultInstallDir = `C:\ProgramData\StellarStack`
    case "darwin":
        DefaultInstallDir = "/opt/stellarstack"
    default: // linux, etc
        DefaultInstallDir = "/opt/stellarstack"
    }
}
```

---

### 3. System Requirements Checks ⚠️ PARTIAL

**Problem:** Some dependency checks may be platform-specific

**Files Affected:**

- `checks/system.go` - Dependency detection

**Status:**

- Docker: ✓ Works on all platforms (cross-platform CLI)
- Docker Compose: ✓ Works on all platforms
- Nginx: ⚠️ Path differences (Windows uses different installation methods)
- Certbot: ⚠️ May not exist on Windows (uses different tools)
- Git: ✓ Works on all platforms
- Rust: ✓ Works on all platforms

**Solution:** Add platform detection for OS-specific checks:

```go
var isWindows = runtime.GOOS == "windows"
var isDarwin = runtime.GOOS == "darwin"

// In CheckNginx():
if isWindows {
    // Windows-specific nginx check
    // Check Program Files or Chocolatey locations
} else {
    // Unix-style check
    // Use whereis or which
}
```

---

### 4. Docker Desktop on Windows ⚠️ KNOWN LIMITATION

**Problem:** Docker Desktop on Windows has different requirements:

- Requires WSL2 or Hyper-V
- Different daemon startup commands
- Path mounting differences

**Note:** This is expected and documented. Users on Windows must have Docker Desktop installed and configured.

---

### 5. Configuration File Paths ⚠️ PARTIAL

**Problem:** Docker-compose.yml and .env have hardcoded forward slashes in embedded YAML

**Files Affected:**

- `executor/files.go` - generateDockerComposeContent() function

**Status:** YAML is platform-agnostic, so this is less critical, but generates mixed-separator paths in comments.

---

## Platform-Specific Considerations

### Linux ✅

- ✓ All checks work natively
- ✓ Path handling correct
- ✓ Default install directory available
- ✓ Docker daemon runs as systemd service

### macOS ✅

- ✓ Most checks work
- ⚠️ Default install directory needs confirmation (may prefer /usr/local)
- ⚠️ Docker Desktop specific setup
- ✓ Xcode tools or Homebrew for dependencies

### Windows ⚠️

- ❌ Path separators broken (critical)
- ❌ Default install directory Linux-only
- ⚠️ Docker Desktop required (WSL2 or Hyper-V)
- ⚠️ Some tools installed via Chocolatey or Scoop
- ⚠️ Different service management (needs Windows Service or Task Scheduler)

---

## Recommended Fixes (Priority Order)

### Priority 1: CRITICAL (Blocks Windows support)

1. [ ] Fix file path handling - use `filepath.Join()` throughout
2. [ ] Make default install directory platform-aware

### Priority 2: HIGH (Proper cross-platform support)

3. [ ] Platform-aware system requirement checks
4. [ ] Detect and warn about Windows-specific requirements
5. [ ] Handle path differences in configuration generation

### Priority 3: NICE-TO-HAVE (Polish)

6. [ ] Platform-specific help messages
7. [ ] Better error messages for platform-specific failures
8. [ ] Documentation for each platform's prerequisites

---

## Build Instructions (After Fixes)

```bash
# Windows
GOOS=windows GOARCH=amd64 go build -o installer-windows-amd64.exe

# Linux
GOOS=linux GOARCH=amd64 go build -o installer-linux-amd64
GOOS=linux GOARCH=arm64 go build -o installer-linux-arm64

# macOS
GOOS=darwin GOARCH=amd64 go build -o installer-macos-amd64
GOOS=darwin GOARCH=arm64 go build -o installer-macos-arm64
```

---

## Affected Code Summary

**Total Issues:** 10+ path operations + 1 config default + potential check variations

**Estimated Fix Effort:**

- Path handling: ~20 minutes (straightforward)
- Install directory: ~10 minutes (simple logic)
- System checks: ~30 minutes (platform-aware logic)
- Testing: ~30 minutes (test on each platform)

---

## Test Plan

After fixes, test on:

1. **Windows 11** - Verify path handling, install to C:\ProgramData\StellarStack
2. **Ubuntu 22.04** - Verify Linux installation path and checks
3. **macOS 13+** - Verify macOS-specific behavior
4. **Docker Support** - Confirm Docker commands work on each platform

---

## Files to Modify

1. `config/defaults.go` - Platform-aware install directory
2. `executor/files.go` - Fix all path concatenations (7 locations)
3. `checks/system.go` - Add platform-specific checks (optional but recommended)
4. `main.go` - Add platform detection info to welcome screen (optional)

---

## References

- Go runtime package: https://pkg.go.dev/runtime
- filepath package: https://pkg.go.dev/path/filepath
- os/exec cross-platform: https://pkg.go.dev/os/exec
