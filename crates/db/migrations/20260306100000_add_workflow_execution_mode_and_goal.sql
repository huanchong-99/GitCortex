-- Add dual-mode workflow support.
-- execution_mode keeps existing workflows in diy mode by default.

ALTER TABLE workflow ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'diy';
ALTER TABLE workflow ADD COLUMN initial_goal TEXT;
