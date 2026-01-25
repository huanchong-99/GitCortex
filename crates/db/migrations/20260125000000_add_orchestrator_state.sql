-- ============================================================================
-- Add Orchestrator State Persistence
-- Created: 2026-01-25
-- Description: Add orchestrator_state column to workflow table for crash recovery
-- ============================================================================

-- Add orchestrator_state column to store persisted orchestrator state
ALTER TABLE workflow ADD COLUMN orchestrator_state TEXT;
