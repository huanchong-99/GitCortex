#![warn(clippy::pedantic)]
#![allow(
    clippy::doc_markdown,
    clippy::module_name_repetitions,
    clippy::must_use_candidate,
    clippy::missing_errors_doc,
    clippy::missing_panics_doc,
    clippy::similar_names,
    clippy::too_many_lines
)]

pub mod services;
pub mod utils;

// Re-export commonly used modules for convenience
pub use services::git;
pub use services::git_watcher;
pub use services::merge_coordinator;
pub use services::orchestrator;
pub use services::terminal;
