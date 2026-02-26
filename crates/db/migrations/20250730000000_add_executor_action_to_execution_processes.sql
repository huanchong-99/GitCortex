-- NOTE: SonarCloud flags duplicate string literals (e.g. 'ScriptRequest', 'Bash', json_object patterns)
-- in this migration. This is acceptable for SQL migration CASE expressions where each branch requires
-- its own complete JSON structure with repeated field names.
-- NOTE: Direct NULL comparison (e.g. 'variant', NULL) is intentional here for json_object() calls
-- which require explicit NULL values to produce valid JSON output.
PRAGMA foreign_keys = ON;

-- Add executor_action column to execution_processes table for storing full ExecutorActions JSON
ALTER TABLE execution_processes ADD COLUMN executor_action TEXT NOT NULL DEFAULT '{}';

-- Backfill legacy rows with placeholder-but-valid ExecutorAction JSON to preserve
-- execution history and avoid cascading deletes in related tables.
UPDATE execution_processes
SET executor_action = CASE process_type
    WHEN 'codingagent' THEN json_object(
        'typ', json_object(
            'type', 'CodingAgentInitialRequest',
            'prompt', '[legacy execution process migrated without original prompt]',
            'executor_profile_id', json_object(
                'executor', COALESCE(NULLIF(upper(replace(executor_type, '-', '_')), ''), 'CLAUDE_CODE'),
                'variant', NULL
            ),
            'working_dir', NULL
        ),
        'next_action', NULL
    )
    WHEN 'cleanupscript' THEN json_object(
        'typ', json_object(
            'type', 'ScriptRequest',
            'script', '',
            'language', 'Bash',
            'context', 'CleanupScript',
            'working_dir', NULL
        ),
        'next_action', NULL
    )
    WHEN 'devserver' THEN json_object(
        'typ', json_object(
            'type', 'ScriptRequest',
            'script', '',
            'language', 'Bash',
            'context', 'DevServer',
            'working_dir', NULL
        ),
        'next_action', NULL
    )
    ELSE json_object(
        'typ', json_object(
            'type', 'ScriptRequest',
            'script', '',
            'language', 'Bash',
            'context', 'SetupScript',
            'working_dir', NULL
        ),
        'next_action', NULL
    )
END
WHERE executor_action = '{}' OR executor_action = '' OR executor_action IS NULL;
