-- NOTE: SonarCloud flags duplicate string literals in this migration.
-- This is acceptable for SQL migration scripts where json_extract/json_set patterns repeat field paths.

-- JSON format changed, means you can access logs from old execution_processes

UPDATE execution_processes
SET executor_action = json_set(
  json_remove(executor_action, '$.typ.profile'),
  '$.typ.profile_variant_label',
  json_object(
    'profile', json_extract(executor_action, '$.typ.profile'),
    'variant', json('null')
  )
)
WHERE json_type(executor_action, '$.typ') IS NOT NULL
  AND json_type(executor_action, '$.typ.profile') = 'text';