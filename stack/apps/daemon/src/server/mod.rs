//! Server management module
//!
//! Provides server lifecycle management, power operations, installation,
//! and state tracking following Wings patterns.

mod backup;
mod configuration;
mod crash;
mod install;
mod manager;
mod power;
mod server;
mod state;

pub use backup::{create_backup, restore_backup, delete_backup, list_backups, BackupResult, BackupError, BackupInfo};
pub use configuration::*;
pub use crash::CrashHandler;
pub use install::InstallationProcess;
pub use manager::Manager;
pub use power::{PowerAction, PowerError};
pub use server::Server;
pub use state::ServerState;
