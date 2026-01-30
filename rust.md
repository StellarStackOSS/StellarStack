# StellarStack Rust Coding Standards

This document defines the coding standards for Rust code in the StellarStack project. All Rust contributions must adhere to these guidelines to maintain code quality, safety, and consistency.

## Table of Contents

- [Naming Conventions](#naming-conventions)
- [Type Safety & Error Handling](#type-safety--error-handling)
- [Module Organization](#module-organization)
- [Documentation](#documentation)
- [Code Patterns](#code-patterns)
- [Trait Design](#trait-design)
- [Testing](#testing)
- [Performance & Safety](#performance--safety)
- [Example: Complete Module](#example-complete-module)

---

## Naming Conventions

Follow the official [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).

### Type Names (PascalCase)

- Structs, enums, traits, type aliases: `PascalCase`
- Generic type parameters: Single uppercase letters or descriptive PascalCase

**✅ Good:**
```rust
// Struct
pub struct ServerConfiguration {
    name: String,
    port: u16,
}

// Enum
pub enum ServerState {
    Running,
    Stopped,
    Restarting,
}

// Trait
pub trait ProcessEnvironment {
    fn start(&mut self) -> Result<()>;
}

// Generic type parameter
pub struct Container<T: ProcessEnvironment> {
    environment: T,
}

// Type alias
type ServerResult<T> = Result<T, ServerError>;
```

### Function & Method Names (snake_case)

All functions and methods use `snake_case`, including async functions.

**✅ Good:**
```rust
pub fn create_server(name: &str) -> Result<Server, ServerError> {
    // ...
}

pub async fn start_server(server_id: &str) -> Result<(), ServerError> {
    // ...
}

impl Server {
    pub fn get_status(&self) -> ServerState {
        // ...
    }

    pub async fn restart(&mut self) -> Result<(), ServerError> {
        // ...
    }
}
```

### Constant Names (UPPER_SNAKE_CASE)

All constants use `UPPER_SNAKE_CASE`.

**✅ Good:**
```rust
pub const DEFAULT_PORT: u16 = 8080;
pub const MAX_CONNECTIONS: usize = 100;
pub const CONNECTION_TIMEOUT_SECS: u64 = 30;
const INTERNAL_BUFFER_SIZE: usize = 4096;
```

### Variable Names (snake_case)

All variables and mutable bindings use `snake_case`.

**✅ Good:**
```rust
let server_name = "my-server";
let mut connection_count = 0;
let is_running = true;
```

### Module Names (snake_case)

Module names use `snake_case` and should be descriptive.

**✅ Good:**
```
src/
├── lib.rs
├── main.rs
├── server/
│   ├── mod.rs
│   ├── manager.rs
│   ├── state.rs
│   └── power.rs
├── environment/
│   ├── mod.rs
│   ├── traits.rs
│   └── docker/
│       ├── mod.rs
│       └── container.rs
├── api/
│   ├── mod.rs
│   ├── client.rs
│   └── errors.rs
```

---

## Type Safety & Error Handling

### Use Custom Error Types

Never use `String` for errors. Define custom error types using `thiserror` or `anyhow`.

**❌ Bad:**
```rust
fn parse_config(content: &str) -> Result<Config, String> {
    if content.is_empty() {
        return Err("config is empty".to_string());
    }
    // ...
}
```

**✅ Good:**
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("configuration is empty")]
    EmptyConfig,

    #[error("invalid configuration: {0}")]
    Invalid(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

fn parse_config(content: &str) -> Result<Config, ConfigError> {
    if content.is_empty() {
        return Err(ConfigError::EmptyConfig);
    }
    serde_json::from_str(content).map_err(ConfigError::from)
}
```

### Type Aliases for Result

Define type aliases for common Result types in your module.

**✅ Good:**
```rust
// In server/mod.rs
pub type Result<T> = std::result::Result<T, ServerError>;

pub fn start_server(server_id: &str) -> Result<()> {
    // ...
}

// In environment/mod.rs
pub type Result<T> = std::result::Result<T, EnvironmentError>;

pub fn create_container(config: ContainerConfig) -> Result<Container> {
    // ...
}
```

### No Unwrap or Expect in Library Code

Never use `unwrap()` or `expect()` in library code. These panic at runtime and break async contexts.

**❌ Bad:**
```rust
pub fn load_server(path: &str) -> Server {
    let content = std::fs::read_to_string(path).unwrap(); // PANIC!
    serde_json::from_str(&content).expect("invalid json") // PANIC!
}
```

**✅ Good:**
```rust
pub fn load_server(path: &str) -> Result<Server> {
    let content = std::fs::read_to_string(path)?;
    let server = serde_json::from_str(&content)?;
    Ok(server)
}

// Only in binary/main.rs:
#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
```

### Generic Error Context

Use `Result<T>` without context parameters where possible.

**✅ Good:**
```rust
pub fn process_file(path: &Path) -> Result<Data> {
    let content = std::fs::read_to_string(path)?;
    // Process content
    Ok(data)
}
```

---

## Module Organization

### Module Structure

Each module should have a `mod.rs` file that:
1. Declares submodules
2. Re-exports the public API
3. Contains only module-level documentation

**✅ Good:**
```rust
// server/mod.rs

//! Server management and lifecycle operations.
//!
//! This module handles all server-related operations including:
//! - Server creation and deletion
//! - Power state management
//! - Configuration handling
//!
//! # Example
//!
//! ```ignore
//! use stellar_daemon::server::{Manager, ServerConfig};
//!
//! let mut manager = Manager::new();
//! let server = manager.create("my-server", config).await?;
//! server.start().await?;
//! ```

pub mod configuration;
pub mod manager;
pub mod power;
pub mod state;

pub use configuration::ServerConfiguration;
pub use manager::Manager;
pub use power::PowerAction;
pub use state::ServerState;
```

### File Organization

Keep files focused on a single responsibility.

**✅ Good File Organization:**
```
server/
├── mod.rs              # Module root, re-exports
├── manager.rs          # Server lifecycle management
├── configuration.rs    # Server configuration
├── state.rs           # Server state machine
├── power.rs           # Power operations
├── backup.rs          # Backup operations
└── install.rs         # Installation process
```

### Avoid Overly Large Files

If a file exceeds 300 lines, consider splitting it into multiple modules.

---

## Documentation

### Module-Level Documentation

Document every public module with a top-level doc comment.

**✅ Good:**
```rust
//! Server management and lifecycle.
//!
//! This module provides the core functionality for managing server
//! instances, including power operations, configuration, and state tracking.
//!
//! # Main Types
//!
//! - [`Server`]: Represents a single server instance
//! - [`Manager`]: Manages multiple server instances
//! - [`ServerState`]: Enumeration of server states
//!
//! # Examples
//!
//! ```ignore
//! use stellar_daemon::server::{Manager, ServerConfig};
//!
//! let mut manager = Manager::new();
//! manager.load_all().await?;
//! ```

pub mod manager;
pub mod state;
```

### Function Documentation

Document all public functions with examples when helpful.

**✅ Good:**
```rust
/// Starts a server and waits for it to be ready.
///
/// This function starts the server process and blocks until the server
/// reports that it's ready to accept connections. If the server fails
/// to start within the timeout, an error is returned.
///
/// # Arguments
///
/// * `timeout` - Maximum time to wait for server startup
///
/// # Errors
///
/// Returns [`ServerError::StartTimeout`] if the server doesn't start
/// within the specified timeout.
///
/// # Example
///
/// ```ignore
/// use std::time::Duration;
///
/// let mut server = Server::new("my-server", config)?;
/// server.start_with_timeout(Duration::from_secs(30)).await?;
/// println!("Server is ready!");
/// ```
pub async fn start_with_timeout(
    &mut self,
    timeout: std::time::Duration,
) -> Result<(), ServerError> {
    // Implementation
}
```

### Struct & Enum Documentation

Document all public fields and variants.

**✅ Good:**
```rust
/// Configuration for a server instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfiguration {
    /// Unique identifier for the server
    pub id: String,

    /// Human-readable server name
    pub name: String,

    /// Port the server listens on
    pub port: u16,

    /// Maximum amount of memory to allocate (MB)
    pub memory_limit: u64,

    /// Whether the server auto-starts on daemon startup
    pub auto_start: bool,
}

/// Possible states of a server.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerState {
    /// Server is running and accepting connections
    Running,

    /// Server is stopped
    Stopped,

    /// Server is in the process of starting
    Starting,

    /// Server is in the process of stopping
    Stopping,

    /// Server encountered an error
    Error,
}
```

### Trait Documentation

Document trait behavior and implementing requirements.

**✅ Good:**
```rust
/// Represents a process runtime environment (e.g., Docker, LXC).
///
/// Types implementing this trait provide the necessary operations to
/// manage containerized processes. Each method is expected to be idempotent
/// where applicable.
///
/// # Safety
///
/// Implementations must ensure proper resource cleanup even if operations fail.
pub trait ProcessEnvironment: Send + Sync {
    /// Starts the process.
    ///
    /// Returns an error if the process is already running.
    async fn start(&mut self) -> Result<(), EnvironmentError>;

    /// Stops the process gracefully.
    ///
    /// This sends a termination signal and waits for the process to exit.
    /// If the process doesn't exit within a reasonable timeout, it may be
    /// forcibly terminated.
    async fn stop(&mut self) -> Result<(), EnvironmentError>;

    /// Gets current process statistics.
    async fn stats(&self) -> Result<ProcessStats, EnvironmentError>;
}
```

---

## Code Patterns

### Use Builder Pattern for Complex Types

For types with many optional fields, use the builder pattern.

**✅ Good:**
```rust
/// Builder for `ServerConfiguration`.
pub struct ServerConfigBuilder {
    id: String,
    name: String,
    port: u16,
    memory_limit: Option<u64>,
    auto_start: Option<bool>,
}

impl ServerConfigBuilder {
    pub fn new(id: String, name: String, port: u16) -> Self {
        Self {
            id,
            name,
            port,
            memory_limit: None,
            auto_start: None,
        }
    }

    pub fn memory_limit(mut self, limit: u64) -> Self {
        self.memory_limit = Some(limit);
        self
    }

    pub fn auto_start(mut self, auto_start: bool) -> Self {
        self.auto_start = Some(auto_start);
        self
    }

    pub fn build(self) -> ServerConfiguration {
        ServerConfiguration {
            id: self.id,
            name: self.name,
            port: self.port,
            memory_limit: self.memory_limit.unwrap_or(512),
            auto_start: self.auto_start.unwrap_or(false),
        }
    }
}

// Usage
let config = ServerConfigBuilder::new("srv1".to_string(), "My Server".to_string(), 8080)
    .memory_limit(1024)
    .auto_start(true)
    .build();
```

### Avoid Cloning When Possible

Use references and borrowing instead of cloning.

**❌ Bad:**
```rust
pub fn process_config(config: ServerConfiguration) -> Result<()> {
    let cloned = config.clone();  // Unnecessary clone
    validate(&cloned)?;
    save(&cloned)?;
    Ok(())
}
```

**✅ Good:**
```rust
pub fn process_config(config: &ServerConfiguration) -> Result<()> {
    validate(config)?;
    save(config)?;
    Ok(())
}
```

### Use Owned Types in Structs

For data stored in structs, use owned types (`String`, `Vec<T>`).

**✅ Good:**
```rust
pub struct ServerConfiguration {
    /// Owned string, not &str
    pub id: String,
    pub name: String,
    pub environment_variables: Vec<String>,
}

impl ServerConfiguration {
    /// Takes a reference to the stored data
    pub fn get_id(&self) -> &str {
        &self.id
    }

    pub fn get_name(&self) -> &str {
        &self.name
    }
}
```

### Use Type-Level Distinctions

Use phantom types or newtypes to distinguish different kinds of IDs.

**✅ Good:**
```rust
/// Server ID newtype for type safety
#[derive(Debug, Clone, Eq, PartialEq, Hash)]
pub struct ServerId(String);

impl ServerId {
    pub fn new(id: String) -> Result<Self> {
        if id.is_empty() {
            return Err(ServerError::InvalidId);
        }
        Ok(ServerId(id))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// Now the function signature is clearer
pub fn get_server(id: ServerId) -> Result<Server> {
    // ...
}

// This won't compile - type safety!
// let server = get_server(some_string);
```

### Use Async/Await for Concurrent Operations

Use `async`/`await` for I/O-bound operations.

**✅ Good:**
```rust
pub async fn load_all_servers(&mut self) -> Result<()> {
    // Concurrent file reads
    let handles: Vec<_> = server_paths
        .into_iter()
        .map(|path| tokio::spawn(load_server_file(path)))
        .collect();

    for handle in handles {
        let server = handle.await??;
        self.servers.insert(server.id.clone(), server);
    }

    Ok(())
}
```

### No Panics in Library Code

Panic only in tests or binary entry points.

**❌ Bad:**
```rust
pub fn get_server(&self, id: &str) -> Server {
    self.servers
        .get(id)
        .expect("server not found")  // PANIC!
}
```

**✅ Good:**
```rust
pub fn get_server(&self, id: &str) -> Option<&Server> {
    self.servers.get(id)
}

// Or with error context
pub fn get_server(&self, id: &str) -> Result<&Server> {
    self.servers
        .get(id)
        .ok_or_else(|| ServerError::NotFound(id.to_string()))
}
```

---

## Trait Design

### Favor Composition Over Inheritance

Use small, focused traits that can be composed.

**✅ Good:**
```rust
/// Something that can be started
pub trait Startable {
    async fn start(&mut self) -> Result<()>;
}

/// Something that can be stopped
pub trait Stoppable {
    async fn stop(&mut self) -> Result<()>;
}

/// Something with state
pub trait Stateful {
    type State;
    fn state(&self) -> Self::State;
}

/// A server combines all three concerns
pub struct Server;

impl Startable for Server {
    async fn start(&mut self) -> Result<()> { /* ... */ }
}

impl Stoppable for Server {
    async fn stop(&mut self) -> Result<()> { /* ... */ }
}

impl Stateful for Server {
    type State = ServerState;
    fn state(&self) -> Self::State { /* ... */ }
}
```

### Use Associated Types for Flexibility

Avoid lifetime parameters when associated types work better.

**✅ Good:**
```rust
pub trait DataStore {
    type Item;
    type Error;

    async fn get(&self, id: &str) -> std::result::Result<Self::Item, Self::Error>;
    async fn put(&mut self, id: String, item: Self::Item) -> std::result::Result<(), Self::Error>;
}

impl DataStore for InMemoryStore {
    type Item = ServerConfiguration;
    type Error = StoreError;

    async fn get(&self, id: &str) -> std::result::Result<Self::Item, Self::Error> {
        // ...
    }

    async fn put(&mut self, id: String, item: Self::Item) -> std::result::Result<(), Self::Error> {
        // ...
    }
}
```

---

## Testing

### Test Module Organization

Include tests in the same file as the code, in a `tests` module.

**✅ Good:**
```rust
pub fn validate_server_config(config: &ServerConfiguration) -> Result<()> {
    if config.port == 0 || config.port > 65535 {
        return Err(ServerError::InvalidPort(config.port));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_config() {
        let config = ServerConfiguration {
            port: 8080,
            // ...
        };
        assert!(validate_server_config(&config).is_ok());
    }

    #[test]
    fn test_validate_invalid_port() {
        let config = ServerConfiguration {
            port: 0,
            // ...
        };
        let error = validate_server_config(&config);
        assert!(matches!(error, Err(ServerError::InvalidPort(0))));
    }
}
```

### Async Tests

Use `#[tokio::test]` for async functions.

**✅ Good:**
```rust
#[tokio::test]
async fn test_server_startup() {
    let mut server = create_test_server().await;
    assert!(server.start().await.is_ok());
    assert_eq!(server.state(), ServerState::Running);
}
```

---

## Performance & Safety

### Avoid Unnecessary Allocations

Reuse allocations when dealing with large collections.

**✅ Good:**
```rust
// Reuse the same buffer
pub fn process_stream<R: Read>(reader: R) -> Result<Vec<Item>> {
    let mut buf = vec![0u8; 8192];  // Allocate once
    let mut items = Vec::new();

    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 { break; }

        for item in parse_items(&buf[..n]) {
            items.push(item);
        }
    }

    Ok(items)
}
```

### Use Iterator Adapters

Chain iterator adapters instead of collecting intermediate values.

**✅ Good:**
```rust
// Bad: multiple allocations
let doubled: Vec<_> = items.iter().map(|x| x * 2).collect();
let even: Vec<_> = doubled.iter().filter(|x| x % 2 == 0).collect();
let result: i32 = even.iter().sum();

// Good: single pass
let result: i32 = items
    .iter()
    .map(|x| x * 2)
    .filter(|x| x % 2 == 0)
    .sum();
```

### Use References in Trait Objects

Prefer `&dyn Trait` to `Box<dyn Trait>` when ownership isn't needed.

**✅ Good:**
```rust
pub fn handle_request(&self, handler: &dyn Handler) -> Result<Response> {
    handler.process(self)
}
```

### Minimize Lock Scope

Hold locks for the minimum time necessary.

**✅ Good:**
```rust
pub async fn get_server(&self, id: &str) -> Result<ServerConfiguration> {
    let server = {
        let servers = self.servers.read().await;
        servers.get(id).cloned()
    }; // Lock released here

    server.ok_or_else(|| ServerError::NotFound(id.to_string()))
}
```

---

## Example: Complete Module

Here's a complete example module following all standards:

```rust
//! Server state management and transitions.
//!
//! This module handles server state tracking and provides methods
//! to query and update server states safely.

use thiserror::Error;

/// Errors that can occur during state operations.
#[derive(Error, Debug)]
pub enum StateError {
    #[error("invalid state transition from {from} to {to}")]
    InvalidTransition { from: String, to: String },

    #[error("server is in invalid state: {0}")]
    InvalidState(String),
}

/// Result type for state operations.
pub type Result<T> = std::result::Result<T, StateError>;

/// Represents the operational state of a server.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ServerState {
    /// Server is running
    Running,
    /// Server is stopped
    Stopped,
    /// Server is starting
    Starting,
    /// Server is stopping
    Stopping,
}

impl std::fmt::Display for ServerState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Running => write!(f, "running"),
            Self::Stopped => write!(f, "stopped"),
            Self::Starting => write!(f, "starting"),
            Self::Stopping => write!(f, "stopping"),
        }
    }
}

/// Manages server state transitions and validation.
#[derive(Debug)]
pub struct StateManager {
    current: ServerState,
}

impl StateManager {
    /// Creates a new state manager with initial state `Stopped`.
    pub fn new() -> Self {
        Self {
            current: ServerState::Stopped,
        }
    }

    /// Returns the current server state.
    pub fn current(&self) -> ServerState {
        self.current
    }

    /// Attempts to transition to a new state.
    ///
    /// Returns an error if the transition is invalid according to
    /// the state machine rules.
    ///
    /// # Valid Transitions
    ///
    /// - `Stopped` → `Starting`
    /// - `Starting` → `Running`
    /// - `Starting` → `Stopped` (startup failed)
    /// - `Running` → `Stopping`
    /// - `Stopping` → `Stopped`
    pub fn transition_to(&mut self, new_state: ServerState) -> Result<()> {
        let valid = matches!(
            (self.current, new_state),
            (ServerState::Stopped, ServerState::Starting)
                | (ServerState::Starting, ServerState::Running)
                | (ServerState::Starting, ServerState::Stopped)
                | (ServerState::Running, ServerState::Stopping)
                | (ServerState::Stopping, ServerState::Stopped)
        );

        if !valid {
            return Err(StateError::InvalidTransition {
                from: self.current.to_string(),
                to: new_state.to_string(),
            });
        }

        self.current = new_state;
        Ok(())
    }

    /// Checks if a transition to the given state would be valid.
    pub fn can_transition_to(&self, state: ServerState) -> bool {
        self.transition_to(state).is_ok()
    }
}

impl Default for StateManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_startup_sequence() {
        let mut state = StateManager::new();
        assert_eq!(state.current(), ServerState::Stopped);

        assert!(state.transition_to(ServerState::Starting).is_ok());
        assert_eq!(state.current(), ServerState::Starting);

        assert!(state.transition_to(ServerState::Running).is_ok());
        assert_eq!(state.current(), ServerState::Running);
    }

    #[test]
    fn test_invalid_transition() {
        let mut state = StateManager::new();
        let result = state.transition_to(ServerState::Running);
        assert!(matches!(result, Err(StateError::InvalidTransition { .. })));
    }

    #[test]
    fn test_can_transition() {
        let state = StateManager::new();
        assert!(state.can_transition_to(ServerState::Starting));
        assert!(!state.can_transition_to(ServerState::Running));
    }
}
```

---

## Summary Checklist

- [ ] All types use PascalCase (structs, enums, traits, type aliases)
- [ ] All functions and methods use snake_case
- [ ] All constants use UPPER_SNAKE_CASE
- [ ] All modules use snake_case names
- [ ] Custom error types defined using `thiserror`
- [ ] No `unwrap()` or `expect()` in library code
- [ ] Type aliases for `Result<T>` defined per module
- [ ] All public items have rustdoc comments
- [ ] Module-level documentation included in `mod.rs`
- [ ] No panics in library code
- [ ] Functions return `Result<T>` instead of panicking
- [ ] Traits are small and focused (composition over inheritance)
- [ ] Tests included in `#[cfg(test)]` modules
- [ ] Async operations use `async`/`await`
- [ ] Prefer references over cloning when possible
- [ ] Lock scopes minimized
- [ ] Iterator chains used instead of intermediate collections

