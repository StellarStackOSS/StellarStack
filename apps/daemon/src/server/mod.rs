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
mod schedule_status;
mod server;
mod state;
mod transfer;

pub use backup::{create_backup, create_backup_with_config, restore_backup, delete_backup, list_backups, BackupResult, BackupError, BackupInfo, BackupCompressionLevel};
pub use configuration::*;
pub use crash::CrashHandler;
pub use install::InstallationProcess;
pub use manager::Manager;
pub use power::{PowerAction, PowerError};
pub use schedule_status::{ScheduleStatus, ScheduleStatusTracker};
pub use server::Server;
pub use state::ServerState;
pub use transfer::{
    create_transfer_archive, upload_transfer_archive, receive_transfer_archive,
    cleanup_transfer_archive, TransferArchiveResult, TransferConfig, TransferError,
};
