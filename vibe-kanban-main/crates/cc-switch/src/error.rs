//! CC-Switch 错误类型

use thiserror::Error;

/// CC-Switch 错误
#[derive(Error, Debug)]
pub enum CCSwitchError {
    #[error("Configuration file not found: {path}")]
    ConfigNotFound { path: String },

    #[error("Failed to read configuration: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse JSON: {0}")]
    JsonParseError(#[from] serde_json::Error),

    #[error("Failed to parse TOML: {0}")]
    TomlParseError(#[from] toml::de::Error),

    #[error("Invalid configuration: {message}")]
    InvalidConfig { message: String },

    #[error("CLI not supported: {cli_name}")]
    UnsupportedCli { cli_name: String },

    #[error("Atomic write failed: {0}")]
    AtomicWriteError(String),

    #[error("Home directory not found")]
    HomeDirNotFound,
}

pub type Result<T> = std::result::Result<T, CCSwitchError>;
