-- NOTE: Normalize NULL/empty checks with NULLIF to keep migration predicates explicit.

-- Complete API key encryption migration by backfilling data into the new column
-- introduced in 20260119000000_encrypt_api_keys.sql.
--
-- Notes:
-- 1) Existing `workflow.orchestrator_api_key` values are already encrypted by app logic.
-- 2) We mirror those encrypted payloads into `orchestrator_api_key_encrypted` so future
--    readers can switch columns safely without data loss.

ALTER TABLE workflow ADD COLUMN orchestrator_api_key_encrypted TEXT;

-- Backfill existing rows once.
UPDATE workflow
SET orchestrator_api_key_encrypted = orchestrator_api_key
WHERE NULLIF(orchestrator_api_key_encrypted, '') IS NULL
  AND NULLIF(orchestrator_api_key, '') IS NOT NULL;

-- Keep both columns synchronized during the transition window.
CREATE TRIGGER IF NOT EXISTS trg_workflow_api_key_mirror_insert
AFTER INSERT ON workflow
FOR EACH ROW
WHEN NULLIF(NEW.orchestrator_api_key_encrypted, '') IS NULL
  AND NULLIF(NEW.orchestrator_api_key, '') IS NOT NULL
BEGIN
  UPDATE workflow
  SET orchestrator_api_key_encrypted = NEW.orchestrator_api_key
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workflow_api_key_mirror_update
AFTER UPDATE OF orchestrator_api_key ON workflow
FOR EACH ROW
WHEN NULLIF(NEW.orchestrator_api_key, '') IS NOT NULL
  AND NULLIF(NEW.orchestrator_api_key_encrypted, '') IS NULL
BEGIN
  UPDATE workflow
  SET orchestrator_api_key_encrypted = NEW.orchestrator_api_key
  WHERE id = NEW.id;
END;
