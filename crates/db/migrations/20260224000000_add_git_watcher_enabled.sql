-- Add git_watcher_enabled column to workflow table
-- Default TRUE (1) to maintain backward compatibility
ALTER TABLE workflow ADD COLUMN git_watcher_enabled INTEGER NOT NULL DEFAULT 1;
