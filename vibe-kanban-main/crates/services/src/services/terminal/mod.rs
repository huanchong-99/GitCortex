//! Terminal management module
//!
//! Provides:
//! - TerminalLauncher: Serial terminal launching with model switching
//! - ProcessManager: Process lifecycle management (spawn, kill, monitor)
//! - CliDetector: CLI availability and version detection

pub mod launcher;
pub mod process;
pub mod detector;

pub use launcher::{TerminalLauncher, LaunchResult};
pub use process::{ProcessHandle, ProcessManager};
pub use detector::CliDetector;
