//! Terminal management module
//!
//! Provides:
//! - ProcessManager: Process lifecycle management (spawn, kill, monitor)
//! - CliDetector: CLI availability and version detection
//! - TerminalLauncher: Serial terminal launcher with model switching

pub mod detector;
pub mod launcher;
pub mod process;

pub use detector::CliDetector;
pub use launcher::{LaunchResult, TerminalLauncher};
pub use process::{ProcessHandle, ProcessManager};
