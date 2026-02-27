-- NOTE: Keep this migration SQLite-compatible and behavior-preserving for historical rows.
PRAGMA foreign_keys = ON;

-- Add executor_action column to execution_processes table for storing full ExecutorActions JSON
ALTER TABLE execution_processes ADD COLUMN executor_action TEXT NOT NULL DEFAULT '{}';

-- Backfill legacy rows with placeholder-but-valid ExecutorAction JSON to preserve
-- execution history and avoid cascading deletes in related tables.
UPDATE execution_processes
SET executor_action = CASE
    WHEN process_type = 'codingagent' THEN json_object(
        'typ', json_object(
            'type', 'CodingAgentInitialRequest',
            'prompt', '[legacy execution process migrated without original prompt]',
            'executor_profile_id', json_object(
                'executor', COALESCE(NULLIF(upper(replace(executor_type, '-', '_')), ''), 'CLAUDE_CODE'),
                'variant', json('null')
            ),
            'working_dir', json('null')
        ),
        'next_action', json('null')
    )
    ELSE json_object(
        'typ', json_object(
            'type', 'ScriptRequest',
            'script', '',
            'language', 'Bash',
            'context', CASE process_type
                WHEN 'cleanupscript' THEN 'CleanupScript'
                WHEN 'devserver' THEN 'DevServer'
                ELSE 'SetupScript'
            END,
            'working_dir', json('null')
        ),
        'next_action', json('null')
    )
END
WHERE executor_action IS NULL OR executor_action IN ('{}', '');
