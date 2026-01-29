//! Template Renderer for Slash Commands
//!
//! This module provides template rendering functionality using Handlebars.
//! It supports rendering prompt templates with custom parameters and workflow context.

use anyhow::Result;
use handlebars::{Handlebars, RenderError};
use serde::{Serialize, Deserialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// Template renderer for slash command prompts
#[derive(Clone)]
pub struct TemplateRenderer {
    handlebars: Handlebars<'static>,
}

impl TemplateRenderer {
    /// Create a new template renderer
    pub fn new() -> Self {
        let mut handlebars = Handlebars::new();

        // Register strict mode: fail on missing variables
        handlebars.set_strict_mode(true);

        // Disable escaping for prompt templates (we want raw output)
        handlebars.register_escape_fn(handlebars::no_escape);

        Self { handlebars }
    }

    /// Render a template with custom parameters and workflow context
    ///
    /// # Arguments
    /// * `template` - The template string to render (may contain {{variables}})
    /// * `custom_params` - Optional JSON string with custom parameters
    /// * `workflow_context` - Optional workflow context (task name, branch, etc.)
    ///
    /// # Returns
    /// The rendered template string
    ///
    /// # Errors
    /// Returns error if:
    /// - Custom params JSON is invalid
    /// - Template syntax is invalid
    /// - Required variables are missing
    pub fn render(
        &self,
        template: &str,
        custom_params: Option<&str>,
        workflow_context: Option<&WorkflowContext>,
    ) -> Result<String> {
        // Build the template data context
        let mut data = HashMap::new();

        // Add custom parameters if provided
        if let Some(params_str) = custom_params {
            if !params_str.trim().is_empty() {
                let params: JsonValue = serde_json::from_str(params_str)
                    .map_err(|e| anyhow::anyhow!("Invalid custom_params JSON: {}", e))?;

                // Merge custom params into data
                if let Some(obj) = params.as_object() {
                    for (key, value) in obj {
                        data.insert(key.clone(), value.clone());
                    }
                }
            }
        }

        // Add workflow context if provided
        if let Some(ctx) = workflow_context {
            data.insert("workflow".to_string(), serde_json::to_value(ctx)?);
        }

        // Render the template
        self.handlebars
            .render_template(template, &data)
            .map_err(|e| anyhow::anyhow!("Template rendering failed: {}", e))
    }
}

impl Default for TemplateRenderer {
    fn default() -> Self {
        Self::new()
    }
}

/// Workflow context available during template rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowContext {
    /// Workflow name
    pub name: String,
    /// Workflow description
    pub description: Option<String>,
    /// Target branch
    pub target_branch: String,
    /// Current task name (if applicable)
    pub current_task: Option<String>,
    /// Current task branch (if applicable)
    pub current_branch: Option<String>,
}

impl WorkflowContext {
    /// Create a new workflow context
    pub fn new(
        name: String,
        description: Option<String>,
        target_branch: String,
    ) -> Self {
        Self {
            name,
            description,
            target_branch,
            current_task: None,
            current_branch: None,
        }
    }

    /// Set the current task context
    pub fn with_current_task(mut self, task_name: String, branch: String) -> Self {
        self.current_task = Some(task_name);
        self.current_branch = Some(branch);
        self
    }
}

/// Template context for validation and testing
#[derive(Debug, Clone)]
pub struct TemplateContext {
    /// Custom parameters
    pub custom_params: Option<String>,
    /// Workflow context
    pub workflow_context: Option<WorkflowContext>,
}

impl TemplateContext {
    /// Create a new template context
    pub fn new(
        custom_params: Option<String>,
        workflow_context: Option<WorkflowContext>,
    ) -> Self {
        Self {
            custom_params,
            workflow_context,
        }
    }

    /// Create a context with only custom params
    pub fn with_params(params: String) -> Self {
        Self {
            custom_params: Some(params),
            workflow_context: None,
        }
    }

    /// Create a context with only workflow context
    pub fn with_workflow(ctx: WorkflowContext) -> Self {
        Self {
            custom_params: None,
            workflow_context: Some(ctx),
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_renderer() -> TemplateRenderer {
        TemplateRenderer::new()
    }

    #[test]
    fn test_render_simple_template() {
        let renderer = create_renderer();
        let template = "Hello, {{name}}!";
        let result = renderer.render(template, Some(r#"{"name": "World"}"#), None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Hello, World!");
    }

    #[test]
    fn test_render_with_multiple_params() {
        let renderer = create_renderer();
        let template = "Task: {{task_name}}, Priority: {{priority}}";
        let params = r#"{"task_name": "Fix bug", "priority": "high"}"#;
        let result = renderer.render(template, Some(params), None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Task: Fix bug, Priority: high");
    }

    #[test]
    fn test_render_with_workflow_context() {
        let renderer = create_renderer();
        let template = "Working on {{workflow.name}} targeting {{workflow.targetBranch}}";
        let ctx = WorkflowContext::new(
            "My Workflow".to_string(),
            Some("Test workflow".to_string()),
            "main".to_string(),
        );
        let result = renderer.render(template, None, Some(&ctx));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Working on My Workflow targeting main");
    }

    #[test]
    fn test_render_with_current_task() {
        let renderer = create_renderer();
        let template = "Current task: {{workflow.currentTask}} on branch {{workflow.currentBranch}}";
        let ctx = WorkflowContext::new(
            "My Workflow".to_string(),
            None,
            "main".to_string(),
        )
        .with_current_task("Task 1".to_string(), "workflow/task-1".to_string());
        let result = renderer.render(template, None, Some(&ctx));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Current task: Task 1 on branch workflow/task-1");
    }

    #[test]
    fn test_render_combined_params_and_context() {
        let renderer = create_renderer();
        let template = "{{greeting}} {{workflow.name}}: {{instruction}}";
        let params = r#"{"greeting": "Please", "instruction": "do the work"}"#;
        let ctx = WorkflowContext::new(
            "Test WF".to_string(),
            None,
            "main".to_string(),
        );
        let result = renderer.render(template, Some(params), Some(&ctx));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Please Test WF: do the work");
    }

    #[test]
    fn test_render_invalid_json_params() {
        let renderer = create_renderer();
        let template = "Hello {{name}}";
        let result = renderer.render(template, Some("invalid json"), None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid custom_params JSON"));
    }

    #[test]
    fn test_render_missing_variable() {
        let renderer = create_renderer();
        let template = "Hello {{name}}";
        // No params provided, strict mode should fail
        let result = renderer.render(template, None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Template rendering failed"));
    }

    #[test]
    fn test_render_empty_template() {
        let renderer = create_renderer();
        let result = renderer.render("", None, None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");
    }

    #[test]
    fn test_render_no_variables() {
        let renderer = create_renderer();
        let template = "Just static text";
        let result = renderer.render(template, None, None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Just static text");
    }

    #[test]
    fn test_render_with_whitespace_param() {
        let renderer = create_renderer();
        let template = "Test";
        let result = renderer.render(template, Some("   "), None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Test");
    }

    #[test]
    fn test_render_complex_json_params() {
        let renderer = create_renderer();
        let template = "User: {{user.name}}, Age: {{user.age}}";
        let params = r#"{"user": {"name": "Alice", "age": 30}}"#;
        let result = renderer.render(template, Some(params), None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "User: Alice, Age: 30");
    }

    #[test]
    fn test_render_template_with_newlines() {
        let renderer = create_renderer();
        let template = "Line 1: {{value1}}\nLine 2: {{value2}}";
        let params = r#"{"value1": "first", "value2": "second"}"#;
        let result = renderer.render(template, Some(params), None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Line 1: first\nLine 2: second");
    }

    #[test]
    fn test_template_context_with_params() {
        let ctx = TemplateContext::with_params(r#"{"key": "value"}"#.to_string());
        assert_eq!(ctx.custom_params, Some(r#"{"key": "value"}"#.to_string()));
        assert!(ctx.workflow_context.is_none());
    }

    #[test]
    fn test_template_context_with_workflow() {
        let wf_ctx = WorkflowContext::new("Test".to_string(), None, "main".to_string());
        let ctx = TemplateContext::with_workflow(wf_ctx.clone());
        assert!(ctx.custom_params.is_none());
        assert!(ctx.workflow_context.is_some());
    }

    #[test]
    fn test_workflow_context_builder() {
        let ctx = WorkflowContext::new("WF".to_string(), Some("desc".to_string()), "dev".to_string())
            .with_current_task("Task 1".to_string(), "branch-1".to_string());

        assert_eq!(ctx.name, "WF");
        assert_eq!(ctx.description, Some("desc".to_string()));
        assert_eq!(ctx.target_branch, "dev");
        assert_eq!(ctx.current_task, Some("Task 1".to_string()));
        assert_eq!(ctx.current_branch, Some("branch-1".to_string()));
    }
}
