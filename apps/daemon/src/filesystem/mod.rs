//! Filesystem operations module
//!
//! Provides safe file operations with path traversal prevention,
//! disk quota management, and archive compression/extraction.

mod archive;
pub mod cache;
pub mod disk;
mod errors;
mod filesystem;
mod path;

pub use archive::{compress, decompress, ArchiveFormat};
pub use cache::{DirectoryCache, CachedFileInfo, CacheStats};
pub use disk::DiskUsage;
pub use errors::{FilesystemError, FilesystemResult};
pub use filesystem::{FileInfo, Filesystem};
pub use path::SafePath;
