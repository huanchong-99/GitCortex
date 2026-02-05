//! Terminal management module
//!
//! Provides:
//! - ProcessManager: Process lifecycle management (spawn, kill, monitor)
//! - CliDetector: CLI availability and version detection
//! - TerminalLauncher: Serial terminal launcher with model switching
//! - TerminalBridge: MessageBus -> PTY stdin bridge for Orchestrator communication
//! - PromptDetector: Interactive prompt detection and classification
//! - PromptWatcher: PTY output monitoring and prompt event publishing

pub mod bridge;
pub mod detector;
pub mod launcher;
pub mod process;
pub mod prompt_detector;
pub mod prompt_watcher;

pub use bridge::TerminalBridge;
pub use detector::CliDetector;
pub use launcher::{LaunchResult, TerminalLauncher};
pub use process::{ProcessHandle, ProcessManager};
pub use prompt_detector::{
    ArrowSelectOption, DetectedPrompt, PromptDetector, PromptKind,
    build_arrow_sequence, ARROW_DOWN, ARROW_UP,
};
pub use prompt_watcher::PromptWatcher;
