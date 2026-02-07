//! Terminal Prompt Detection Module
//!
//! Detects and classifies interactive prompts from PTY output.
//! Supports 6 prompt types with priority-based detection.
//!
//! ## Prompt Types (Detection Priority: High to Low)
//!
//! 1. **Password** - Sensitive input requiring user intervention
//! 2. **Input** - Free-form text input
//! 3. **ArrowSelect** - Multi-line options with arrow key navigation
//! 4. **Choice** - Single-line option selection (A/B/C, 1/2/3)
//! 5. **YesNo** - Binary yes/no confirmation
//! 6. **EnterConfirm** - Simple Enter key confirmation

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

// ============================================================================
// Prompt Types
// ============================================================================

/// Detected prompt type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptKind {
    /// Press Enter to continue (response: `\n`)
    EnterConfirm,
    /// Yes/No confirmation (response: `y\n` or `n\n`)
    YesNo,
    /// Single-line choice selection (response: option letter/number + `\n`)
    Choice,
    /// Multi-line arrow key selection (response: arrow sequences + `\n`)
    ArrowSelect,
    /// Free-form text input (response: text + `\n`)
    Input,
    /// Sensitive input requiring user intervention (must ask user)
    Password,
}

impl PromptKind {
    /// Returns true if this prompt type requires user intervention
    pub fn requires_user_input(&self) -> bool {
        matches!(self, PromptKind::Password)
    }

    /// Returns true if this prompt can be auto-confirmed with high confidence
    pub fn can_auto_confirm(&self) -> bool {
        matches!(self, PromptKind::EnterConfirm)
    }

    /// Returns true if this prompt requires LLM decision
    pub fn requires_llm_decision(&self) -> bool {
        matches!(
            self,
            PromptKind::YesNo | PromptKind::Choice | PromptKind::ArrowSelect | PromptKind::Input
        )
    }
}

// ============================================================================
// Arrow Select Option
// ============================================================================

/// Represents a single option in an ArrowSelect prompt
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArrowSelectOption {
    /// Option index (0-based)
    pub index: usize,
    /// Option label text
    pub label: String,
    /// Whether this option is currently selected
    pub selected: bool,
}

// ============================================================================
// Detected Prompt
// ============================================================================

/// A detected prompt with its classification and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedPrompt {
    /// The type of prompt detected
    pub kind: PromptKind,
    /// The raw text that triggered detection
    pub raw_text: String,
    /// Detection confidence score (0.0 - 1.0)
    pub confidence: f32,
    /// For ArrowSelect: the list of options
    pub options: Option<Vec<ArrowSelectOption>>,
    /// For ArrowSelect: the currently selected index
    pub selected_index: Option<usize>,
    /// Whether dangerous keywords were detected
    pub has_dangerous_keywords: bool,
}

impl DetectedPrompt {
    /// Create a new detected prompt
    pub fn new(kind: PromptKind, raw_text: String, confidence: f32) -> Self {
        let has_dangerous_keywords = DANGEROUS_KEYWORDS_RE.is_match(&raw_text);
        Self {
            kind,
            raw_text,
            confidence,
            options: None,
            selected_index: None,
            has_dangerous_keywords,
        }
    }

    /// Create an ArrowSelect prompt with options
    pub fn arrow_select(
        raw_text: String,
        confidence: f32,
        options: Vec<ArrowSelectOption>,
        selected_index: usize,
    ) -> Self {
        let has_dangerous_keywords = DANGEROUS_KEYWORDS_RE.is_match(&raw_text);
        Self {
            kind: PromptKind::ArrowSelect,
            raw_text,
            confidence,
            options: Some(options),
            selected_index: Some(selected_index),
            has_dangerous_keywords,
        }
    }
}

// ============================================================================
// Regex Patterns
// ============================================================================

/// Password/sensitive input detection
static PASSWORD_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(password|passphrase|token|secret|api[_\s]?key|credential|private[_\s]?key)\b",
    )
    .expect("Invalid PASSWORD_RE regex")
});

/// Input field detection (free-form text input)
static INPUT_FIELD_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(enter|provide|input|type|specify)\s+.{0,30}(:|>\s*$)")
        .expect("Invalid INPUT_FIELD_RE regex")
});

/// Arrow key hint detection
static ARROW_HINT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(use|press)\s+(arrow\s*keys?|↑|↓|up/down)")
        .expect("Invalid ARROW_HINT_RE regex")
});

/// Arrow select marker detection (line-by-line)
static SELECT_MARKER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[\s]*(?P<mark>>|\*|❯|▸|→|\[x\]|\[\s\]|\(x\)|\(\s\)|●|○)\s+(?P<label>.+)$")
        .expect("Invalid SELECT_MARKER_RE regex")
});

/// Selected marker patterns (indicates current selection)
static SELECTED_MARKER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[\s]*(>|\*|❯|▸|→|\[x\]|\(x\)|●)").expect("Invalid SELECTED_MARKER_RE regex")
});

/// Choice detection (single-line options with multiple choices)
static CHOICE_RE: Lazy<Regex> = Lazy::new(|| {
    // Matches: "Choose:", "Select [", or patterns like [a/b/c], (1/2/3)
    // Note: [y/n] patterns are handled by YES_NO_RE which has higher priority
    Regex::new(r"(?i)(choose|select|option|pick)\s*[:\[]|\[[a-z0-9](/[a-z0-9])+\]|\([a-z0-9](/[a-z0-9])+\)")
        .expect("Invalid CHOICE_RE regex")
});

/// Indented option line (for arrow select without explicit marker)
static OPTION_INDENTED_RE: Lazy<Regex> = Lazy::new(|| {
    // Matches lines with 2+ leading spaces followed by non-whitespace content
    Regex::new(r"^[\s]{2,}(\S.*)$").expect("Invalid OPTION_INDENTED_RE regex")
});

/// Yes/No detection
static YES_NO_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[y/?n\]|\(y/?n\)|\byes/?no\b|\[yes/?no\]|\(yes/?no\)")
        .expect("Invalid YES_NO_RE regex")
});

/// Enter confirmation detection
static ENTER_CONFIRM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(press|hit|tap)\s+(the\s+)?(enter|return)\b|\[enter\]|\benter\s+to\s+(continue|proceed|resume|exit|confirm)\b|\bpress\s+any\s+key\b|\bcontinue\?\s*$")
        .expect("Invalid ENTER_CONFIRM_RE regex")
});

/// Dangerous keywords that should trigger LLM decision or user confirmation
static DANGEROUS_KEYWORDS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(delete|remove|destroy|wipe|format|drop|overwrite|reset|publish|deploy|merge|push|force|permanent|irreversible)\b")
        .expect("Invalid DANGEROUS_KEYWORDS_RE regex")
});

// ============================================================================
// Prompt Detector
// ============================================================================

/// Detects and classifies interactive prompts from terminal output
#[derive(Debug, Default)]
pub struct PromptDetector {
    /// Buffer for accumulating multi-line output
    line_buffer: Vec<String>,
    /// Maximum lines to keep in buffer
    max_buffer_lines: usize,
}

impl PromptDetector {
    /// Create a new prompt detector
    pub fn new() -> Self {
        Self {
            line_buffer: Vec::new(),
            max_buffer_lines: 20,
        }
    }

    /// Create a prompt detector with custom buffer size
    pub fn with_buffer_size(max_lines: usize) -> Self {
        Self {
            line_buffer: Vec::new(),
            max_buffer_lines: max_lines,
        }
    }

    /// Clear the line buffer
    pub fn clear_buffer(&mut self) {
        self.line_buffer.clear();
    }

    /// Add a line to the buffer and detect prompts
    ///
    /// Returns `Some(DetectedPrompt)` if a prompt is detected.
    pub fn process_line(&mut self, line: &str) -> Option<DetectedPrompt> {
        // Add line to buffer
        self.line_buffer.push(line.to_string());

        // Trim buffer if too large
        while self.line_buffer.len() > self.max_buffer_lines {
            self.line_buffer.remove(0);
        }

        // Detect prompt from current line and buffer context
        self.detect(line)
    }

    /// Detect prompt type from a single line of output
    ///
    /// Detection priority (high to low):
    /// 1. Password - sensitive input
    /// 2. ArrowSelect - multi-line options
    /// 3. Input - free-form text
    /// 4. YesNo - binary confirmation (before Choice to prevent [y/n] misdetection)
    /// 5. Choice - single-line options
    /// 6. EnterConfirm - simple confirmation
    pub fn detect(&self, text: &str) -> Option<DetectedPrompt> {
        // Priority 1: Password detection (highest priority)
        if self.detect_password(text) {
            return Some(DetectedPrompt::new(
                PromptKind::Password,
                text.to_string(),
                0.95,
            ));
        }

        // Priority 2: ArrowSelect detection (check buffer for multi-line options)
        if let Some(prompt) = self.detect_arrow_select(text) {
            return Some(prompt);
        }

        // Priority 3: Input field detection
        if self.detect_input(text) {
            return Some(DetectedPrompt::new(
                PromptKind::Input,
                text.to_string(),
                0.8,
            ));
        }

        // Priority 4: YesNo detection (BEFORE Choice to prevent [y/n] misdetection)
        if self.detect_yes_no(text) {
            return Some(DetectedPrompt::new(
                PromptKind::YesNo,
                text.to_string(),
                0.9,
            ));
        }

        // Priority 5: Choice detection
        if self.detect_choice(text) {
            return Some(DetectedPrompt::new(
                PromptKind::Choice,
                text.to_string(),
                0.85,
            ));
        }

        // Priority 6: EnterConfirm detection (lowest priority)
        if self.detect_enter_confirm(text) {
            return Some(DetectedPrompt::new(
                PromptKind::EnterConfirm,
                text.to_string(),
                0.85,
            ));
        }

        None
    }

    /// Detect password/sensitive input prompt
    fn detect_password(&self, text: &str) -> bool {
        PASSWORD_RE.is_match(text)
    }

    /// Detect free-form input prompt
    fn detect_input(&self, text: &str) -> bool {
        // Must match input pattern but NOT be a password prompt
        INPUT_FIELD_RE.is_match(text) && !PASSWORD_RE.is_match(text)
    }

    /// Detect arrow select prompt from buffer
    fn detect_arrow_select(&self, current_line: &str) -> Option<DetectedPrompt> {
        // Check for arrow hint in current line or recent buffer
        let has_arrow_hint = ARROW_HINT_RE.is_match(current_line)
            || self
                .line_buffer
                .iter()
                .rev()
                .take(5)
                .any(|line| ARROW_HINT_RE.is_match(line));

        // Parse options from buffer
        let mut options: Vec<ArrowSelectOption> = Vec::new();
        let mut selected_index: Option<usize> = None;

        for line in &self.line_buffer {
            // First try to match lines with explicit markers (>, *, etc.)
            if let Some(caps) = SELECT_MARKER_RE.captures(line) {
                let label = caps.name("label").map(|m| m.as_str().trim().to_string());
                if let Some(label) = label {
                    let is_selected = SELECTED_MARKER_RE.is_match(line);
                    let index = options.len();

                    if is_selected {
                        selected_index = Some(index);
                    }

                    options.push(ArrowSelectOption {
                        index,
                        label,
                        selected: is_selected,
                    });
                }
            }
            // If we have an arrow hint, also consider indented lines as options
            else if has_arrow_hint {
                if let Some(caps) = OPTION_INDENTED_RE.captures(line) {
                    if let Some(label_match) = caps.get(1) {
                        let label = label_match.as_str().trim().to_string();
                        // Skip empty labels or lines that look like prompts/questions
                        if !label.is_empty() && !label.ends_with('?') && !label.contains(':') {
                            options.push(ArrowSelectOption {
                                index: options.len(),
                                label,
                                selected: false,
                            });
                        }
                    }
                }
            }
        }

        // Need at least 2 options to be considered an arrow select
        if options.len() >= 2 && (has_arrow_hint || options.len() >= 3) {
            let raw_text = self.line_buffer.join("\n");
            let confidence = if has_arrow_hint { 0.95 } else { 0.75 };

            return Some(DetectedPrompt::arrow_select(
                raw_text,
                confidence,
                options,
                selected_index.unwrap_or(0),
            ));
        }

        None
    }

    /// Detect single-line choice prompt
    fn detect_choice(&self, text: &str) -> bool {
        CHOICE_RE.is_match(text)
    }

    /// Detect yes/no prompt
    fn detect_yes_no(&self, text: &str) -> bool {
        YES_NO_RE.is_match(text)
    }

    /// Detect enter confirmation prompt
    fn detect_enter_confirm(&self, text: &str) -> bool {
        ENTER_CONFIRM_RE.is_match(text)
    }

    /// Check if text contains dangerous keywords
    pub fn has_dangerous_keywords(&self, text: &str) -> bool {
        DANGEROUS_KEYWORDS_RE.is_match(text)
    }
}

// ============================================================================
// Arrow Key Sequence Builder
// ============================================================================

/// ANSI escape sequence for up arrow
pub const ARROW_UP: &str = "\x1b[A";

/// ANSI escape sequence for down arrow
pub const ARROW_DOWN: &str = "\x1b[B";

/// Build arrow key sequence to navigate from current to target index
///
/// # Arguments
///
/// * `current` - Current selected index
/// * `target` - Target index to navigate to
///
/// # Returns
///
/// A string containing the arrow key escape sequences
pub fn build_arrow_sequence(current: usize, target: usize) -> String {
    if target > current {
        // Move down
        ARROW_DOWN.repeat(target - current)
    } else if target < current {
        // Move up
        ARROW_UP.repeat(current - target)
    } else {
        // Already at target
        String::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_password() {
        let detector = PromptDetector::new();

        // Should detect password prompts
        assert!(detector.detect("Enter password:").is_some());
        assert!(detector.detect("API key:").is_some());
        assert!(detector.detect("Enter your token:").is_some());
        assert!(detector.detect("Secret:").is_some());
        assert!(detector.detect("Enter passphrase:").is_some());

        // Verify it's classified as Password
        let prompt = detector.detect("Enter password:").unwrap();
        assert_eq!(prompt.kind, PromptKind::Password);
    }

    #[test]
    fn test_detect_yes_no() {
        let detector = PromptDetector::new();

        // Should detect yes/no prompts
        assert!(detector.detect("Continue? [y/n]").is_some());
        assert!(detector.detect("Proceed (yes/no)?").is_some());
        assert!(detector.detect("Are you sure? [Y/N]").is_some());

        // Verify it's classified as YesNo
        let prompt = detector.detect("Continue? [y/n]").unwrap();
        assert_eq!(prompt.kind, PromptKind::YesNo);
    }

    #[test]
    fn test_detect_enter_confirm() {
        let detector = PromptDetector::new();

        // Should detect enter confirmation prompts
        assert!(detector.detect("Press Enter to continue").is_some());
        assert!(detector.detect("Hit enter to proceed").is_some());
        assert!(detector.detect("[Enter] to confirm").is_some());
        assert!(detector.detect("Press any key to continue").is_some());

        // Verify it's classified as EnterConfirm
        let prompt = detector.detect("Press Enter to continue").unwrap();
        assert_eq!(prompt.kind, PromptKind::EnterConfirm);
    }

    #[test]
    fn test_detect_choice() {
        let detector = PromptDetector::new();

        // Should detect choice prompts
        assert!(detector.detect("Choose an option:").is_some());
        assert!(detector.detect("Select [A/B/C]:").is_some());
        assert!(detector.detect("Pick one (1/2/3):").is_some());

        // Verify it's classified as Choice
        let prompt = detector.detect("Choose an option:").unwrap();
        assert_eq!(prompt.kind, PromptKind::Choice);
    }

    #[test]
    fn test_detect_input() {
        let detector = PromptDetector::new();

        // Should detect input prompts
        assert!(detector.detect("Enter your name:").is_some());
        assert!(detector.detect("Provide the path:").is_some());
        assert!(detector.detect("Type your message:").is_some());

        // Verify it's classified as Input
        let prompt = detector.detect("Enter your name:").unwrap();
        assert_eq!(prompt.kind, PromptKind::Input);
    }

    #[test]
    fn test_detect_arrow_select() {
        let mut detector = PromptDetector::new();

        // Simulate arrow select output
        detector.process_line("? Select a framework: (Use arrow keys)");
        detector.process_line("> React");
        detector.process_line("  Vue");
        let result = detector.process_line("  Angular");

        assert!(result.is_some());
        let prompt = result.unwrap();
        assert_eq!(prompt.kind, PromptKind::ArrowSelect);
        assert!(prompt.options.is_some());

        let options = prompt.options.unwrap();
        assert_eq!(options.len(), 3);
        assert_eq!(options[0].label, "React");
        assert!(options[0].selected);
        assert_eq!(options[1].label, "Vue");
        assert!(!options[1].selected);
    }

    #[test]
    fn test_build_arrow_sequence() {
        // Move down
        assert_eq!(build_arrow_sequence(0, 2), "\x1b[B\x1b[B");

        // Move up
        assert_eq!(build_arrow_sequence(3, 1), "\x1b[A\x1b[A");

        // No movement
        assert_eq!(build_arrow_sequence(2, 2), "");
    }

    #[test]
    fn test_dangerous_keywords() {
        let detector = PromptDetector::new();

        assert!(detector.has_dangerous_keywords("Delete all files?"));
        assert!(detector.has_dangerous_keywords("Force push to main?"));
        assert!(detector.has_dangerous_keywords("This action is irreversible"));
        assert!(!detector.has_dangerous_keywords("Continue with installation?"));
    }

    #[test]
    fn test_priority_password_over_input() {
        let detector = PromptDetector::new();

        // Password should take priority over input
        let prompt = detector.detect("Enter your password:").unwrap();
        assert_eq!(prompt.kind, PromptKind::Password);
    }

    #[test]
    fn test_prompt_kind_methods() {
        assert!(PromptKind::Password.requires_user_input());
        assert!(!PromptKind::EnterConfirm.requires_user_input());

        assert!(PromptKind::EnterConfirm.can_auto_confirm());
        assert!(!PromptKind::YesNo.can_auto_confirm());

        assert!(PromptKind::YesNo.requires_llm_decision());
        assert!(PromptKind::Choice.requires_llm_decision());
        assert!(!PromptKind::Password.requires_llm_decision());
    }
}
