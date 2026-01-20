# StellarStack Installer (install-script.sh) - Analysis & Optimization Plan

## Current State

**File Size:** 3,629 lines | **Complexity:** Very High

### Problems with Current Bash Implementation

#### 1. **Performance Issues**

- **String parsing inefficiencies**: Heavy use of `grep`, `sed`, `awk` chains for simple operations

  ```bash
  # Example: Multiple pipes for DNS extraction
  local extracted_panel=$(grep "^FRONTEND_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2 | tr -d '"' | xargs | sed 's|https\?://||' | sed 's|/.*||')
  ```

  - Each pipe spawns a new process
  - 5 pipes = 5+ subshells for a single variable assignment

- **Repeated network calls**: DNS verification uses multiple tools sequentially
  - `dig`, `nslookup`, `host`, `getent` - tries each one
  - Could timeout after each failed attempt

- **Blocking I/O**: All operations synchronous - can't parallelize

#### 2. **Readability Problems**

- **Scattered concerns**: Related functionality spread across 231 functions
  - DNS validation split between `verify_domain_dns()` and inline checks
  - Configuration collection in `collect_domain_config()` (500+ lines!)
  - Configuration generation in `generate_*()` functions

- **Duplicate logic**: Same patterns repeated
  - Domain extraction logic appears 4+ times
  - Domain validation logic copy-pasted
  - Certificate checking logic repeated

- **Magic strings everywhere**:
  - Config file paths hardcoded throughout
  - Colors defined separately from usage
  - Installation types referenced as strings ("panel_and_api", "panel", etc.)

- **Poor error handling**:
  - `set -e` at top, but unclear which commands actually fail
  - No detailed error messages - just "Script failed at line X"
  - User has to dig through code to understand failures

#### 3. **Maintainability Issues**

- **Monolithic configuration**: Single flat namespace of 50+ variables
- **State mutations everywhere**: Variables modified in many different places
- **Implicit dependencies**: Functions rely on global state being set
- **No validation layer**: Data validation mixed with I/O
- **Script generation approach**: Uses heredocs to create nginx/docker configs
  - Hard to version control
  - Hard to update partially
  - String templating is error-prone

#### 4. **Functional Issues**

- **No idempotency**: Running twice causes issues
  - Docker networks recreated
  - Certificates regenerated
  - Configs overwritten without backup

- **Poor offline support**: Network failures can hang installer
- **Limited rollback**: No way to undo failed installation
- **Hard to test**: Everything integrated - can't test individual functions

---

## Optimization Strategy for Go Version

### Architecture Improvements

```
Installer/
├── main.go                 # CLI entry point & Bubble Tea UI
├── config/
│   ├── types.go           # Configuration data structures
│   ├── defaults.go        # Default values & constants
│   └── validation.go      # Configuration validation logic
├── checks/
│   ├── system.go          # System requirements (Docker, nginx, etc)
│   ├── network.go         # DNS, IP detection, connectivity
│   └── existing.go        # Check for existing installations
├── steps/
│   ├── interactive.go     # User prompts & input collection
│   ├── dependencies.go    # Install missing dependencies
│   ├── generation.go      # Generate config files
│   └── deployment.go      # Deploy containers
├── executor/
│   ├── docker.go          # Docker operations
│   ├── nginx.go           # Nginx configuration
│   ├── dns.go             # DNS utilities
│   └── ssl.go             # SSL/TLS operations
└── ui/
    ├── styles.go          # Lipgloss styling
    ├── screens.go         # Screen rendering
    └── messages.go        # User messages
```

### Key Optimizations

#### 1. **Performance**

- **Parallelization**: Check multiple DNS servers simultaneously
  - Use goroutines instead of sequential tool calls
  - Timeout-aware concurrency

- **Eliminate pipes**: Direct string parsing in Go
  - Simple regex for config extraction
  - No subprocess overhead

- **Parallel dependency checks**: Check Docker, nginx, git, rust all at once
  - Currently sequential (each adds 0.5-2s per check)
  - Could reduce from 10s to 3s

- **Async operations**: Don't block on slow network operations
  - DNS verification can timeout gracefully
  - User can skip and continue

#### 2. **Readability**

- **Separation of concerns**:
  - Config validation separate from I/O
  - Domain collection separate from DNS verification
  - Generation logic separate from template data

- **No magic strings**:

  ```go
  type InstallationType string
  const (
    PanelAndAPI InstallationType = "panel_and_api"
    Panel       InstallationType = "panel"
    API         InstallationType = "api"
    Daemon      InstallationType = "daemon"
    AllInOne    InstallationType = "all_in_one"
  )
  ```

- **Structured logging**:

  ```go
  installer.Log.Info("docker running",
    log.String("version", version),
    log.Bool("container_exists", exists),
  )
  ```

- **Explicit state machine**: Clear step transitions
  ```go
  func (s *Step) Execute(ctx context.Context) (Step, error) {
    // Do work
    // Return next step
  }
  ```

#### 3. **Maintainability**

- **Immutable configuration**: Config set once, read many times
  - No surprise mutations
  - Easy to debug state

- **Testability**: Each function has clear inputs/outputs

  ```go
  func ExtractDomain(envFile string) (string, error)
  func VerifyDNS(domain, expectedIP string) error
  func GenerateDockerCompose(cfg *Config) (string, error)
  ```

- **Idempotency**: Check before modifying
  - Docker network exists? Skip creation
  - Certificate valid? Skip renewal
  - Config unchanged? Skip generation

- **Backup & rollback**: Save previous state
  - Old configs in `.backup/`
  - Can restore on failure

#### 4. **Error Handling**

- **Structured errors**:

  ```go
  type ValidationError struct {
    Field   string
    Message string
  }

  errors.Is(err, ErrDNSNotResolved)
  ```

- **Clear error messages**:

  ```
  Domain "example.com" does not resolve to server IP (1.2.3.4)
  Tried: 8.8.8.8, 1.1.1.1, 8.8.4.4
  This usually means: DNS hasn't propagated (wait 5-15 min) or A record is wrong
  ```

- **Recovery options**: Suggest fixes for common errors
  - DNS not resolving? Show expected record
  - Docker not running? Show how to start it
  - Port in use? Show what's using it

---

## Implementation Plan

### Phase 1: Configuration & Validation (Day 1)

- Define `Config` struct with all fields
- Create validation functions
- Implement DNS/IP detection
- Build config file parsers

### Phase 2: System Checks (Day 1-2)

- Docker availability & version
- Nginx installation & configuration
- Git, Rust for daemon
- Port availability
- SSL certificate detection

### Phase 3: Interactive Steps (Day 2-3)

- Installation type selection
- Domain configuration with DNS verification
- Admin credentials collection
- Monitoring options
- Daemon configuration

### Phase 4: Execution Engine (Day 3-4)

- Docker network/container management
- Nginx configuration generation
- Environment file generation
- Docker Compose generation
- SSL certificate generation
- Container startup & health checks

### Phase 5: Polish & Testing (Day 4-5)

- Error handling improvements
- Progress indicators
- Rollback functionality
- Test on multiple OS

---

## Expected Improvements

| Metric           | Bash           | Go          |
| ---------------- | -------------- | ----------- |
| Lines of Code    | 3,629          | ~1,500      |
| Time to Run      | 45-90s         | 20-40s      |
| Parallel Checks  | No             | Yes         |
| Error Messages   | Generic        | Detailed    |
| Testability      | Low            | High        |
| Configuration    | Flat namespace | Structured  |
| DNS Timeouts     | 5+ seconds     | 1-2 seconds |
| String Parsing   | 10+ pipes      | Native      |
| Idempotent       | No             | Yes         |
| Rollback Support | No             | Yes         |
