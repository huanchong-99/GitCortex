-- NOTE: SonarCloud flags duplicate string literals in this migration.
-- This is acceptable for SQL migration scripts where json_extract/json_set patterns repeat field paths.

-- JSON format changed, means you can access logs from old execution_processes
WITH json_paths AS (
  SELECT
    '$.typ.profile' AS profile_path,
    '$.typ.profile_variant_label' AS profile_variant_label_path
)
UPDATE execution_processes
SET executor_action = json_set(
  json_remove(executor_action, (SELECT profile_path FROM json_paths)),
  (SELECT profile_variant_label_path FROM json_paths),
  json_object(
    'profile', json_extract(executor_action, (SELECT profile_path FROM json_paths)),
    'variant', json('null')
  )
)
WHERE json_type(executor_action, '$.typ') IS NOT NULL
  AND json_type(executor_action, (SELECT profile_path FROM json_paths)) = 'text';
