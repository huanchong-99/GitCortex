-- scripts/migrate_auto_confirm.sql
-- Phase 25 / Task 25.3
-- Purpose: Migrate historical terminal rows from auto_confirm=0 to auto_confirm=1
--
-- This file contains two SQL sections:
--   1) DRY-RUN: Inspect rows that will be changed
--   2) APPLY:   Perform update in a transaction
--
-- The wrapper script `scripts/migrate_auto_confirm.sh` executes one section at a time.

-- DRY-RUN-BEGIN
SELECT COUNT(*) AS rows_to_update
FROM terminal
WHERE auto_confirm = 0;

SELECT
    t.id              AS terminal_id,
    t.workflow_task_id,
    wt.workflow_id,
    t.cli_type_id,
    t.status,
    t.auto_confirm,
    t.created_at,
    t.updated_at
FROM terminal t
LEFT JOIN workflow_task wt ON wt.id = t.workflow_task_id
WHERE t.auto_confirm = 0
ORDER BY t.created_at DESC;
-- DRY-RUN-END

-- APPLY-BEGIN
BEGIN IMMEDIATE;
UPDATE terminal
SET auto_confirm = 1, updated_at = datetime('now')
WHERE auto_confirm = 0;
SELECT changes() AS updated_rows;
COMMIT;
-- APPLY-END
