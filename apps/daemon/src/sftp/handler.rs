//! SFTP file handler
//!
//! Implements SFTP file operations with permission checking.

use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;
use tracing::{debug, warn};

use crate::filesystem::Filesystem;

use super::auth::SftpUser;
use super::{SftpError, SftpResult};

/// Simple file attributes structure for SFTP
#[derive(Debug, Clone, Default)]
pub struct FileAttributes {
    pub size: Option<u64>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
    pub permissions: Option<u32>,
    pub atime: Option<u32>,
    pub mtime: Option<u32>,
}

/// Open file flags
#[derive(Debug, Clone, Copy)]
pub struct OpenFlags(u32);

impl OpenFlags {
    pub fn from_bits_truncate(bits: u32) -> Self {
        Self(bits)
    }
}

/// SFTP file operations handler
pub struct SftpFileHandler {
    /// Server filesystem
    filesystem: Arc<Filesystem>,

    /// Authenticated user
    user: SftpUser,

    /// Read-only mode
    read_only: bool,

    /// Open file handles
    handles: RwLock<HashMap<String, OpenHandle>>,

    /// Handle counter
    handle_counter: RwLock<u64>,

    /// Packet buffer for incomplete packets
    buffer: RwLock<Vec<u8>>,
}

/// An open file or directory handle
enum OpenHandle {
    File {
        #[allow(dead_code)]
        path: PathBuf,
        file: std::fs::File,
        #[allow(dead_code)]
        flags: OpenFlags,
    },
    Directory {
        #[allow(dead_code)]
        path: PathBuf,
        entries: Vec<(String, std::fs::Metadata)>,
        position: usize,
    },
}

impl SftpFileHandler {
    /// Create a new SFTP file handler
    pub fn new(filesystem: Arc<Filesystem>, user: SftpUser, read_only: bool) -> Self {
        Self {
            filesystem,
            user,
            read_only,
            handles: RwLock::new(HashMap::new()),
            handle_counter: RwLock::new(0),
            buffer: RwLock::new(Vec::new()),
        }
    }

    /// Generate a new handle ID
    fn next_handle(&self) -> String {
        let mut counter = self.handle_counter.write();
        *counter += 1;
        format!("h{}", *counter)
    }

    /// Convert filesystem path to safe absolute path within server directory
    fn safe_path(&self, path: &str) -> SftpResult<PathBuf> {
        self.filesystem.safe_path(path)
            .map(|sp| sp.resolved().to_path_buf())
            .map_err(|e| {
                SftpError::PermissionDenied(format!("Path escape attempt: {}", e))
            })
    }

    /// Convert std::fs::Metadata to SFTP FileAttributes
    fn metadata_to_attrs(metadata: &std::fs::Metadata) -> FileAttributes {
        let mut attrs = FileAttributes::default();

        attrs.size = Some(metadata.len());

        // File permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            attrs.permissions = Some(metadata.mode());
            attrs.uid = Some(metadata.uid());
            attrs.gid = Some(metadata.gid());
        }

        #[cfg(not(unix))]
        {
            // Default permissions for non-Unix
            if metadata.is_dir() {
                attrs.permissions = Some(0o755);
            } else {
                attrs.permissions = Some(0o644);
            }
            attrs.uid = Some(1000);
            attrs.gid = Some(1000);
        }

        // Times
        if let Ok(mtime) = metadata.modified() {
            if let Ok(duration) = mtime.duration_since(std::time::UNIX_EPOCH) {
                attrs.mtime = Some(duration.as_secs() as u32);
            }
        }
        if let Ok(atime) = metadata.accessed() {
            if let Ok(duration) = atime.duration_since(std::time::UNIX_EPOCH) {
                attrs.atime = Some(duration.as_secs() as u32);
            }
        }

        attrs
    }

    /// Process an incoming SFTP packet and return response
    pub async fn process_packet(&self, data: &[u8]) -> SftpResult<Vec<u8>> {
        // Append to buffer
        {
            let mut buffer = self.buffer.write();
            buffer.extend_from_slice(data);
        }

        let mut responses = Vec::new();

        loop {
            let packet = {
                let mut buffer = self.buffer.write();

                // Need at least 5 bytes (4 for length + 1 for type)
                if buffer.len() < 5 {
                    break;
                }

                // Read packet length
                let length = u32::from_be_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;

                // Check if we have the full packet
                if buffer.len() < 4 + length {
                    break;
                }

                // Extract the packet
                let packet: Vec<u8> = buffer.drain(..4 + length).collect();
                packet
            };

            // Process the packet
            if let Some(response) = self.handle_packet(&packet[4..]).await? {
                responses.extend(response);
            }
        }

        Ok(responses)
    }

    /// Handle a complete SFTP packet
    async fn handle_packet(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        if data.is_empty() {
            return Ok(None);
        }

        let packet_type = data[0];
        let payload = &data[1..];

        debug!("SFTP packet type: {}", packet_type);

        match packet_type {
            // SSH_FXP_INIT
            1 => self.handle_init(payload),
            // SSH_FXP_OPEN
            3 => self.handle_open(payload),
            // SSH_FXP_CLOSE
            4 => self.handle_close(payload),
            // SSH_FXP_READ
            5 => self.handle_read(payload),
            // SSH_FXP_WRITE
            6 => self.handle_write(payload),
            // SSH_FXP_LSTAT
            7 => self.handle_lstat(payload),
            // SSH_FXP_FSTAT
            8 => self.handle_fstat(payload),
            // SSH_FXP_SETSTAT
            9 => self.handle_setstat(payload),
            // SSH_FXP_FSETSTAT
            10 => self.handle_fsetstat(payload),
            // SSH_FXP_OPENDIR
            11 => self.handle_opendir(payload),
            // SSH_FXP_READDIR
            12 => self.handle_readdir(payload),
            // SSH_FXP_REMOVE
            13 => self.handle_remove(payload),
            // SSH_FXP_MKDIR
            14 => self.handle_mkdir(payload),
            // SSH_FXP_RMDIR
            15 => self.handle_rmdir(payload),
            // SSH_FXP_REALPATH
            16 => self.handle_realpath(payload),
            // SSH_FXP_STAT
            17 => self.handle_stat(payload),
            // SSH_FXP_RENAME
            18 => self.handle_rename(payload),
            // SSH_FXP_READLINK
            19 => self.handle_readlink(payload),
            // SSH_FXP_SYMLINK
            20 => self.handle_symlink(payload),
            _ => {
                warn!("Unknown SFTP packet type: {}", packet_type);
                Ok(None)
            }
        }
    }

    /// Read a u32 from bytes
    fn read_u32(data: &[u8], offset: &mut usize) -> Option<u32> {
        if *offset + 4 > data.len() {
            return None;
        }
        let value = u32::from_be_bytes([
            data[*offset],
            data[*offset + 1],
            data[*offset + 2],
            data[*offset + 3],
        ]);
        *offset += 4;
        Some(value)
    }

    /// Read a u64 from bytes
    fn read_u64(data: &[u8], offset: &mut usize) -> Option<u64> {
        if *offset + 8 > data.len() {
            return None;
        }
        let value = u64::from_be_bytes([
            data[*offset],
            data[*offset + 1],
            data[*offset + 2],
            data[*offset + 3],
            data[*offset + 4],
            data[*offset + 5],
            data[*offset + 6],
            data[*offset + 7],
        ]);
        *offset += 8;
        Some(value)
    }

    /// Read a string from bytes
    fn read_string<'a>(data: &'a [u8], offset: &mut usize) -> Option<&'a str> {
        let len = Self::read_u32(data, offset)? as usize;
        if *offset + len > data.len() {
            return None;
        }
        let s = std::str::from_utf8(&data[*offset..*offset + len]).ok()?;
        *offset += len;
        Some(s)
    }

    /// Read raw bytes from bytes
    fn read_bytes<'a>(data: &'a [u8], offset: &mut usize) -> Option<&'a [u8]> {
        let len = Self::read_u32(data, offset)? as usize;
        if *offset + len > data.len() {
            return None;
        }
        let bytes = &data[*offset..*offset + len];
        *offset += len;
        Some(bytes)
    }

    /// Build a response packet
    fn build_response(packet_type: u8, data: &[u8]) -> Vec<u8> {
        let length = (data.len() + 1) as u32;
        let mut response = Vec::with_capacity(4 + 1 + data.len());
        response.extend_from_slice(&length.to_be_bytes());
        response.push(packet_type);
        response.extend_from_slice(data);
        response
    }

    /// Build a status response
    fn build_status(request_id: u32, code: u32, message: &str) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&request_id.to_be_bytes());
        data.extend_from_slice(&code.to_be_bytes());
        // Message
        data.extend_from_slice(&(message.len() as u32).to_be_bytes());
        data.extend_from_slice(message.as_bytes());
        // Language tag (empty)
        data.extend_from_slice(&0u32.to_be_bytes());

        Self::build_response(101, &data) // SSH_FXP_STATUS
    }

    /// Build a handle response
    fn build_handle(request_id: u32, handle: &str) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&request_id.to_be_bytes());
        data.extend_from_slice(&(handle.len() as u32).to_be_bytes());
        data.extend_from_slice(handle.as_bytes());

        Self::build_response(102, &data) // SSH_FXP_HANDLE
    }

    /// Build a data response
    fn build_data(request_id: u32, bytes: &[u8]) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&request_id.to_be_bytes());
        data.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
        data.extend_from_slice(bytes);

        Self::build_response(103, &data) // SSH_FXP_DATA
    }

    /// Build a name response (for directory listings and realpath)
    fn build_name(request_id: u32, entries: &[(String, FileAttributes)]) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&request_id.to_be_bytes());
        data.extend_from_slice(&(entries.len() as u32).to_be_bytes());

        for (name, attrs) in entries {
            // Filename
            data.extend_from_slice(&(name.len() as u32).to_be_bytes());
            data.extend_from_slice(name.as_bytes());
            // Long name (for display) - same as filename for simplicity
            data.extend_from_slice(&(name.len() as u32).to_be_bytes());
            data.extend_from_slice(name.as_bytes());
            // Attributes
            Self::write_attrs(&mut data, attrs);
        }

        Self::build_response(104, &data) // SSH_FXP_NAME
    }

    /// Build an attrs response
    fn build_attrs(request_id: u32, attrs: &FileAttributes) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&request_id.to_be_bytes());
        Self::write_attrs(&mut data, attrs);

        Self::build_response(105, &data) // SSH_FXP_ATTRS
    }

    /// Write file attributes to buffer
    fn write_attrs(data: &mut Vec<u8>, attrs: &FileAttributes) {
        let mut flags: u32 = 0;

        if attrs.size.is_some() {
            flags |= 0x00000001; // SSH_FILEXFER_ATTR_SIZE
        }
        if attrs.uid.is_some() && attrs.gid.is_some() {
            flags |= 0x00000002; // SSH_FILEXFER_ATTR_UIDGID
        }
        if attrs.permissions.is_some() {
            flags |= 0x00000004; // SSH_FILEXFER_ATTR_PERMISSIONS
        }
        if attrs.atime.is_some() && attrs.mtime.is_some() {
            flags |= 0x00000008; // SSH_FILEXFER_ATTR_ACMODTIME
        }

        data.extend_from_slice(&flags.to_be_bytes());

        if let Some(size) = attrs.size {
            data.extend_from_slice(&size.to_be_bytes());
        }
        if let (Some(uid), Some(gid)) = (attrs.uid, attrs.gid) {
            data.extend_from_slice(&uid.to_be_bytes());
            data.extend_from_slice(&gid.to_be_bytes());
        }
        if let Some(perms) = attrs.permissions {
            data.extend_from_slice(&perms.to_be_bytes());
        }
        if let (Some(atime), Some(mtime)) = (attrs.atime, attrs.mtime) {
            data.extend_from_slice(&atime.to_be_bytes());
            data.extend_from_slice(&mtime.to_be_bytes());
        }
    }

    /// Handle SSH_FXP_INIT
    fn handle_init(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let version = Self::read_u32(data, &mut offset).unwrap_or(3);
        debug!("SFTP init version: {}", version);

        // Build SSH_FXP_VERSION response
        let mut response_data = Vec::new();
        response_data.extend_from_slice(&3u32.to_be_bytes()); // Version 3

        Ok(Some(Self::build_response(2, &response_data))) // SSH_FXP_VERSION
    }

    /// Handle SSH_FXP_OPEN
    fn handle_open(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let pflags = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP open: {} flags={}", path, pflags);

        // Permission check
        let is_write = (pflags & 0x00000002) != 0 || // SSH_FXF_WRITE
                       (pflags & 0x00000008) != 0 || // SSH_FXF_CREAT
                       (pflags & 0x00000010) != 0;   // SSH_FXF_TRUNC

        if is_write {
            if self.read_only {
                return Ok(Some(Self::build_status(request_id, 3, "Server is in read-only mode")));
            }
            if !self.user.can_write() {
                return Ok(Some(Self::build_status(request_id, 3, "Permission denied: cannot write")));
            }
        } else if !self.user.can_read() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied: cannot read")));
        }

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        // Open file
        let mut options = std::fs::OpenOptions::new();

        if (pflags & 0x00000001) != 0 { // SSH_FXF_READ
            options.read(true);
        }
        if (pflags & 0x00000002) != 0 { // SSH_FXF_WRITE
            options.write(true);
        }
        if (pflags & 0x00000008) != 0 { // SSH_FXF_CREAT
            options.create(true);
        }
        if (pflags & 0x00000010) != 0 { // SSH_FXF_TRUNC
            options.truncate(true);
        }
        if (pflags & 0x00000004) != 0 { // SSH_FXF_APPEND
            options.append(true);
        }

        match options.open(&safe_path) {
            Ok(file) => {
                let handle = self.next_handle();
                let flags = OpenFlags::from_bits_truncate(pflags);

                self.handles.write().insert(
                    handle.clone(),
                    OpenHandle::File {
                        path: safe_path,
                        file,
                        flags,
                    },
                );

                Ok(Some(Self::build_handle(request_id, &handle)))
            }
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such file"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_CLOSE
    fn handle_close(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let handle = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP close: {}", handle);

        if self.handles.write().remove(handle).is_some() {
            Ok(Some(Self::build_status(request_id, 0, "OK")))
        } else {
            Ok(Some(Self::build_status(request_id, 4, "Invalid handle")))
        }
    }

    /// Handle SSH_FXP_READ
    fn handle_read(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let handle = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let file_offset = Self::read_u64(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let len = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP read: {} offset={} len={}", handle, file_offset, len);

        let mut handles = self.handles.write();
        if let Some(OpenHandle::File { file, .. }) = handles.get_mut(handle) {
            // Limit read size
            let read_len = std::cmp::min(len, 65536) as usize;
            let mut buffer = vec![0u8; read_len];

            if let Err(e) = file.seek(SeekFrom::Start(file_offset)) {
                return Ok(Some(Self::build_status(request_id, 4, &format!("Seek failed: {}", e))));
            }

            match file.read(&mut buffer) {
                Ok(0) => Ok(Some(Self::build_status(request_id, 1, "EOF"))), // SSH_FX_EOF
                Ok(n) => {
                    buffer.truncate(n);
                    Ok(Some(Self::build_data(request_id, &buffer)))
                }
                Err(e) => Ok(Some(Self::build_status(request_id, 4, &format!("Read failed: {}", e)))),
            }
        } else {
            Ok(Some(Self::build_status(request_id, 4, "Invalid handle")))
        }
    }

    /// Handle SSH_FXP_WRITE
    fn handle_write(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let handle = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let file_offset = Self::read_u64(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let write_data = Self::read_bytes(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP write: {} offset={} len={}", handle, file_offset, write_data.len());

        if self.read_only || !self.user.can_write() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied")));
        }

        let mut handles = self.handles.write();
        if let Some(OpenHandle::File { file, .. }) = handles.get_mut(handle) {
            if let Err(e) = file.seek(SeekFrom::Start(file_offset)) {
                return Ok(Some(Self::build_status(request_id, 4, &format!("Seek failed: {}", e))));
            }

            match file.write_all(write_data) {
                Ok(_) => Ok(Some(Self::build_status(request_id, 0, "OK"))),
                Err(e) => Ok(Some(Self::build_status(request_id, 4, &format!("Write failed: {}", e)))),
            }
        } else {
            Ok(Some(Self::build_status(request_id, 4, "Invalid handle")))
        }
    }

    /// Handle SSH_FXP_LSTAT (stat without following symlinks)
    fn handle_lstat(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        self.handle_stat_impl(data, false)
    }

    /// Handle SSH_FXP_STAT
    fn handle_stat(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        self.handle_stat_impl(data, true)
    }

    /// Common stat implementation
    fn handle_stat_impl(&self, data: &[u8], follow_links: bool) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP stat: {} follow_links={}", path, follow_links);

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        let metadata = if follow_links {
            std::fs::metadata(&safe_path)
        } else {
            std::fs::symlink_metadata(&safe_path)
        };

        match metadata {
            Ok(meta) => {
                let attrs = Self::metadata_to_attrs(&meta);
                Ok(Some(Self::build_attrs(request_id, &attrs)))
            }
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such file"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_FSTAT
    fn handle_fstat(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let handle = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP fstat: {}", handle);

        let handles = self.handles.read();
        if let Some(OpenHandle::File { file, .. }) = handles.get(handle) {
            match file.metadata() {
                Ok(meta) => {
                    let attrs = Self::metadata_to_attrs(&meta);
                    Ok(Some(Self::build_attrs(request_id, &attrs)))
                }
                Err(e) => Ok(Some(Self::build_status(request_id, 4, &format!("Stat failed: {}", e)))),
            }
        } else {
            Ok(Some(Self::build_status(request_id, 4, "Invalid handle")))
        }
    }

    /// Handle SSH_FXP_SETSTAT
    fn handle_setstat(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let _path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        // For now, we acknowledge but don't actually change attributes
        Ok(Some(Self::build_status(request_id, 0, "OK")))
    }

    /// Handle SSH_FXP_FSETSTAT
    fn handle_fsetstat(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let _handle = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        // For now, we acknowledge but don't actually change attributes
        Ok(Some(Self::build_status(request_id, 0, "OK")))
    }

    /// Handle SSH_FXP_OPENDIR
    fn handle_opendir(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP opendir: {}", path);

        if !self.user.can_read() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied")));
        }

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        match std::fs::read_dir(&safe_path) {
            Ok(dir) => {
                let mut entries: Vec<(String, std::fs::Metadata)> = Vec::new();

                // Add . and ..
                if let Ok(meta) = std::fs::metadata(&safe_path) {
                    entries.push((".".to_string(), meta.clone()));
                    entries.push(("..".to_string(), meta));
                }

                for entry in dir.flatten() {
                    if let Ok(meta) = entry.metadata() {
                        entries.push((entry.file_name().to_string_lossy().to_string(), meta));
                    }
                }

                let handle = self.next_handle();
                self.handles.write().insert(
                    handle.clone(),
                    OpenHandle::Directory {
                        path: safe_path,
                        entries,
                        position: 0,
                    },
                );

                Ok(Some(Self::build_handle(request_id, &handle)))
            }
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such directory"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_READDIR
    fn handle_readdir(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let handle = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP readdir: {}", handle);

        let mut handles = self.handles.write();
        if let Some(OpenHandle::Directory { entries, position, .. }) = handles.get_mut(handle) {
            if *position >= entries.len() {
                return Ok(Some(Self::build_status(request_id, 1, "EOF"))); // SSH_FX_EOF
            }

            // Return up to 100 entries at a time
            let batch_size = std::cmp::min(100, entries.len() - *position);
            let batch: Vec<(String, FileAttributes)> = entries[*position..*position + batch_size]
                .iter()
                .map(|(name, meta)| (name.clone(), Self::metadata_to_attrs(meta)))
                .collect();

            *position += batch_size;

            Ok(Some(Self::build_name(request_id, &batch)))
        } else {
            Ok(Some(Self::build_status(request_id, 4, "Invalid handle")))
        }
    }

    /// Handle SSH_FXP_REMOVE
    fn handle_remove(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP remove: {}", path);

        if self.read_only || !self.user.can_delete() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied")));
        }

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        match std::fs::remove_file(&safe_path) {
            Ok(_) => Ok(Some(Self::build_status(request_id, 0, "OK"))),
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such file"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_MKDIR
    fn handle_mkdir(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP mkdir: {}", path);

        if self.read_only || !self.user.can_create_dir() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied")));
        }

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        match std::fs::create_dir(&safe_path) {
            Ok(_) => Ok(Some(Self::build_status(request_id, 0, "OK"))),
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::AlreadyExists => (4, "Directory already exists"),
                    std::io::ErrorKind::NotFound => (2, "Parent directory not found"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_RMDIR
    fn handle_rmdir(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP rmdir: {}", path);

        if self.read_only || !self.user.can_delete() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied")));
        }

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        match std::fs::remove_dir(&safe_path) {
            Ok(_) => Ok(Some(Self::build_status(request_id, 0, "OK"))),
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such directory"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_REALPATH
    fn handle_realpath(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP realpath: {}", path);

        // Normalize path - always relative to server root (/)
        let normalized = if path.is_empty() || path == "." {
            "/".to_string()
        } else {
            let p = PathBuf::from(path);
            let mut components: Vec<&std::ffi::OsStr> = Vec::new();

            for component in p.components() {
                match component {
                    std::path::Component::RootDir => {
                        components.clear();
                    }
                    std::path::Component::ParentDir => {
                        components.pop();
                    }
                    std::path::Component::Normal(name) => {
                        components.push(name);
                    }
                    _ => {}
                }
            }

            if components.is_empty() {
                "/".to_string()
            } else {
                format!("/{}", components.iter()
                    .map(|c| c.to_string_lossy())
                    .collect::<Vec<_>>()
                    .join("/"))
            }
        };

        // Get attributes if path exists
        let attrs = match self.safe_path(&normalized) {
            Ok(safe_path) => {
                std::fs::metadata(&safe_path)
                    .map(|m| Self::metadata_to_attrs(&m))
                    .unwrap_or_default()
            }
            Err(_) => FileAttributes::default(),
        };

        Ok(Some(Self::build_name(request_id, &[(normalized, attrs)])))
    }

    /// Handle SSH_FXP_RENAME
    fn handle_rename(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let old_path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let new_path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP rename: {} -> {}", old_path, new_path);

        if self.read_only || !self.user.can_write() {
            return Ok(Some(Self::build_status(request_id, 3, "Permission denied")));
        }

        let safe_old = match self.safe_path(old_path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        let safe_new = match self.safe_path(new_path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        match std::fs::rename(&safe_old, &safe_new) {
            Ok(_) => Ok(Some(Self::build_status(request_id, 0, "OK"))),
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such file"),
                    std::io::ErrorKind::PermissionDenied => (3, "Permission denied"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_READLINK
    fn handle_readlink(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;
        let path = Self::read_string(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        debug!("SFTP readlink: {}", path);

        let safe_path = match self.safe_path(path) {
            Ok(p) => p,
            Err(_) => return Ok(Some(Self::build_status(request_id, 3, "Permission denied"))),
        };

        match std::fs::read_link(&safe_path) {
            Ok(target) => {
                let target_str = target.to_string_lossy().to_string();
                Ok(Some(Self::build_name(request_id, &[(target_str, FileAttributes::default())])))
            }
            Err(e) => {
                let (code, msg) = match e.kind() {
                    std::io::ErrorKind::NotFound => (2, "No such file"),
                    std::io::ErrorKind::InvalidInput => (4, "Not a symlink"),
                    _ => (4, "Failure"),
                };
                Ok(Some(Self::build_status(request_id, code, msg)))
            }
        }
    }

    /// Handle SSH_FXP_SYMLINK
    fn handle_symlink(&self, data: &[u8]) -> SftpResult<Option<Vec<u8>>> {
        let mut offset = 0;
        let request_id = Self::read_u32(data, &mut offset).ok_or_else(|| SftpError::Other("Invalid packet".into()))?;

        // Symlinks are disabled for security
        Ok(Some(Self::build_status(request_id, 3, "Symlinks are disabled")))
    }
}
