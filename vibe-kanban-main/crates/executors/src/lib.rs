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

pub mod actions;
pub mod approvals;
pub mod command;
pub mod env;
pub mod executors;
pub mod logs;
pub mod mcp_config;
pub mod profile;
pub mod stdout_dup;
