-- Migration: Add encrypted API key column
-- This adds a new column for encrypted API keys
-- Data migration will be handled in application code

-- Add new encrypted column
ALTER TABLE workflow ADD COLUMN orchestrator_api_key_encrypted TEXT;

-- Old column will be dropped after data migration is verified
-- ALTER TABLE workflow DROP COLUMN orchestrator_api_key;
