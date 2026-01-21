-- ============================================================================
-- Add workflow project/created_at composite index
-- Created: 2026-01-19
-- Description: Optimize project-scoped workflow listing by creation time
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workflow_project_created
ON workflow(project_id, created_at DESC);
