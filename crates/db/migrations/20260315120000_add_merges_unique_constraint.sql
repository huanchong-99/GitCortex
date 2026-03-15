-- G34-003: Add unique constraint to merges table to prevent duplicate PR records.
-- A workspace can only have one merge record per (workspace_id, pr_number) combination.
-- This prevents race conditions where the same PR gets recorded multiple times.
CREATE UNIQUE INDEX IF NOT EXISTS idx_merges_unique_workspace_pr
    ON merges(workspace_id, pr_number)
    WHERE merge_type = 'pr' AND pr_number IS NOT NULL;
