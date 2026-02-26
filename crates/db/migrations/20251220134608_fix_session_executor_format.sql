-- Fix session executor values that were incorrectly stored with variant suffix
-- Values like "CLAUDE_CODE:ROUTER" should be "CLAUDE_CODE"
-- This was introduced in the refactor from task_attempts to sessions (commit 6a129d0fa)
-- Optimized: Using instr() instead of LIKE to avoid full table scan warning
UPDATE sessions
SET executor = substr(executor, 1, instr(executor, ':') - 1),
    updated_at = datetime('now', 'subsec')
WHERE instr(executor, ':') > 0;
