//! Validated JSON serialization and transactional filesystem replacement.

use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use juris_case_catalog::{validate_matter_identity, MatterIdentity, Severity};

use crate::BuilderError;

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Reads one matter identity from JSON.
pub fn read_identity(path: impl AsRef<Path>) -> Result<MatterIdentity, BuilderError> {
    let path = path.as_ref();
    let bytes = fs::read(path).map_err(|source| BuilderError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    serde_json::from_slice(&bytes).map_err(|source| BuilderError::Json {
        path: path.to_path_buf(),
        source,
    })
}

/// Serializes one validated identity using deterministic pretty JSON plus LF.
pub fn serialize_identity(identity: &MatterIdentity) -> Result<Vec<u8>, BuilderError> {
    validate_before_write(identity)?;
    let mut bytes = serde_json::to_vec_pretty(identity)
        .map_err(|source| BuilderError::Serialization { source })?;
    bytes.push(b'\n');
    Ok(bytes)
}

/// Writes an identity through a sibling temporary file.
///
/// Without `force`, an existing target is never touched. With `force`, the
/// previous target is first moved to a sibling backup, the validated temporary
/// file is moved into place, and the backup is removed only after success.
/// This avoids partial JSON files and supports rollback on replacement failure.
pub fn write_identity(
    path: impl AsRef<Path>,
    identity: &MatterIdentity,
    force: bool,
) -> Result<(), BuilderError> {
    let path = path.as_ref();
    let bytes = serialize_identity(identity)?;

    if path.exists() && !force {
        return Err(BuilderError::OutputExists {
            path: path.to_path_buf(),
        });
    }

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).map_err(|source| BuilderError::Io {
        path: parent.to_path_buf(),
        source,
    })?;

    let temporary_path = sibling_work_path(path, "tmp")?;
    let backup_path = sibling_work_path(path, "bak")?;

    let result = write_and_replace(path, &temporary_path, &backup_path, &bytes, force);
    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

fn validate_before_write(identity: &MatterIdentity) -> Result<(), BuilderError> {
    let report = validate_matter_identity(identity);
    if report.is_valid() {
        return Ok(());
    }

    let diagnostics = report
        .diagnostics()
        .iter()
        .filter(|diagnostic| diagnostic.severity == Severity::Error)
        .map(|diagnostic| {
            format!(
                "{} {}: {}",
                diagnostic.code, diagnostic.path, diagnostic.message
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    Err(BuilderError::InvalidIdentity { diagnostics })
}

fn write_and_replace(
    target: &Path,
    temporary: &Path,
    backup: &Path,
    bytes: &[u8],
    force: bool,
) -> Result<(), BuilderError> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(temporary)
        .map_err(|source| BuilderError::Io {
            path: temporary.to_path_buf(),
            source,
        })?;

    file.write_all(bytes).map_err(|source| BuilderError::Io {
        path: temporary.to_path_buf(),
        source,
    })?;
    file.sync_all().map_err(|source| BuilderError::Io {
        path: temporary.to_path_buf(),
        source,
    })?;
    drop(file);

    if !target.exists() {
        return fs::rename(temporary, target).map_err(|source| BuilderError::Io {
            path: target.to_path_buf(),
            source,
        });
    }

    if !force {
        return Err(BuilderError::OutputExists {
            path: target.to_path_buf(),
        });
    }

    fs::rename(target, backup).map_err(|source| BuilderError::Io {
        path: target.to_path_buf(),
        source,
    })?;

    match fs::rename(temporary, target) {
        Ok(()) => {
            fs::remove_file(backup).map_err(|source| BuilderError::Io {
                path: backup.to_path_buf(),
                source,
            })?;
            Ok(())
        }
        Err(source) => {
            let _ = fs::rename(backup, target);
            Err(BuilderError::Io {
                path: target.to_path_buf(),
                source,
            })
        }
    }
}

fn sibling_work_path(target: &Path, marker: &str) -> Result<PathBuf, BuilderError> {
    let Some(file_name) = target.file_name() else {
        return Err(BuilderError::InvalidOutputPath {
            path: target.to_path_buf(),
        });
    };

    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let name = format!(
        ".{}.{}-{}-{counter}",
        file_name.to_string_lossy(),
        marker,
        std::process::id()
    );
    Ok(target.with_file_name(name))
}
