//! Terminal management module
//!
//! Provides:
//! - ProcessManager: Process lifecycle management (spawn, kill, monitor)
//! - CliDetector: CLI availability and version detection

pub mod detector;
pub mod process;

pub use detector::CliDetector;
pub use process::{ProcessHandle, ProcessManager};
