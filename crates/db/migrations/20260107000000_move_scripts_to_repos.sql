-- Add script columns to repos
ALTER TABLE repos ADD COLUMN setup_script TEXT;
ALTER TABLE repos ADD COLUMN cleanup_script TEXT;
ALTER TABLE repos ADD COLUMN copy_files TEXT;
ALTER TABLE repos ADD COLUMN parallel_setup_script INTEGER NOT NULL DEFAULT 0;
ALTER TABLE repos ADD COLUMN dev_server_script TEXT;

-- Migrate scripts only when repo-level value is unambiguous.
-- Avoid LIMIT 1 so shared repos with diverging per-project scripts are not
-- silently overwritten by an arbitrary row.
UPDATE repos
SET
    setup_script = (
        SELECT CASE
            WHEN COUNT(DISTINCT NULLIF(pr.setup_script, '')) <= 1
                THEN MAX(NULLIF(pr.setup_script, ''))
            ELSE NULL
        END
        FROM project_repos pr
        WHERE pr.repo_id = repos.id
    ),
    cleanup_script = (
        SELECT CASE
            WHEN COUNT(DISTINCT NULLIF(pr.cleanup_script, '')) <= 1
                THEN MAX(NULLIF(pr.cleanup_script, ''))
            ELSE NULL
        END
        FROM project_repos pr
        WHERE pr.repo_id = repos.id
    ),
    copy_files = (
        SELECT CASE
            WHEN COUNT(DISTINCT NULLIF(pr.copy_files, '')) <= 1
                THEN MAX(NULLIF(pr.copy_files, ''))
            ELSE NULL
        END
        FROM project_repos pr
        WHERE pr.repo_id = repos.id
    ),
    parallel_setup_script = (
        SELECT CASE
            WHEN COUNT(DISTINCT pr.parallel_setup_script) <= 1
                THEN COALESCE(MAX(pr.parallel_setup_script), 0)
            ELSE 0
        END
        FROM project_repos pr
        WHERE pr.repo_id = repos.id
    );

-- Migrate dev_script only when repo-level value is unambiguous across projects.
UPDATE repos
SET dev_server_script = (
    SELECT CASE
        WHEN COUNT(DISTINCT NULLIF(p.dev_script, '')) <= 1
            THEN MAX(NULLIF(p.dev_script, ''))
        ELSE NULL
    END
    FROM projects p
    JOIN project_repos pr ON pr.project_id = p.id
    WHERE pr.repo_id = repos.id
);

-- Keep legacy per-project script columns for compatibility and manual conflict
-- remediation when a shared repo has divergent project-specific scripts.
