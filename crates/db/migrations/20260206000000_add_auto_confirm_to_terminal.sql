-- Add auto_confirm field to terminal table
-- Phase 24: Terminal Auto-Confirm feature
-- When enabled, CLI will be launched with auto-confirm flags:
-- - Claude Code: --dangerously-skip-permissions
-- - Codex: --yolo
-- - Gemini: --yolo

ALTER TABLE terminal ADD COLUMN auto_confirm INTEGER NOT NULL DEFAULT 0;

-- Create index for filtering terminals by auto_confirm status
CREATE INDEX idx_terminal_auto_confirm ON terminal(auto_confirm);
