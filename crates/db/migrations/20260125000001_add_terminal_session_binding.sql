-- Add session_id and execution_process_id to terminal table
ALTER TABLE terminal ADD COLUMN session_id TEXT;
ALTER TABLE terminal ADD COLUMN execution_process_id TEXT;

-- Create index for lookups
CREATE INDEX idx_terminal_session_id ON terminal(session_id);
CREATE INDEX idx_terminal_execution_process_id ON terminal(execution_process_id);

-- Add terminal_id to sessions table for reverse lookup
ALTER TABLE sessions ADD COLUMN terminal_id TEXT;
CREATE INDEX idx_sessions_terminal_id ON sessions(terminal_id);
