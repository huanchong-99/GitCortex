# GitCortex Docker Deployment Guide

## Quick Start

Windows one-click interactive installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\docker\install-docker.ps1
```

The installer asks where to mount host files into `/workspace`, generates `docker/compose/.env`, validates compose, builds, starts, and checks readiness.
It also supports disabling starter project bootstrap and cleaning old data volume before startup.
If `docker/compose/.env` already exists, the installer can now switch directly into update flow and reuse the existing deployment settings.

Manual flow:

```bash
cd docker/compose
cp .env.example .env
# Edit .env and set at least:
# - GITCORTEX_ENCRYPTION_KEY (32 chars)
# Optional:
# - HOST_WORKSPACE_ROOT=E:/test (or another host path containing git repos)
# - INSTALL_AI_CLIS=1 (install AI CLIs during image build)
docker compose up -d
```

Access: http://localhost:23456

## Isolation and Mount Scope

- Containers are isolated by default and cannot read your full host disk automatically.
- The app can access:
  - container filesystem
  - named volume mounted at `/var/lib/gitcortex`
  - only the host path you map to `/workspace` (`HOST_WORKSPACE_ROOT`)
- To expand accessible host files, change `HOST_WORKSPACE_ROOT` and recreate containers.

## Runtime Path Behavior

- GitCortex now distinguishes containerized runtime from direct host runtime.
- In Docker mode, repo browsing prefers `GITCORTEX_WORKSPACE_ROOT` (default `/workspace`) so the workflow wizard starts from the mounted workspace instead of a host-only default path.
- In direct local mode, the same picker falls back to the backend-selected local browse root instead of assuming Docker paths exist.

## Update Existing Deployment

Recommended Windows update flow:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\docker\update-docker.ps1 -PullLatest
```

What it does:
- optionally runs `git pull --ff-only`
- validates `docker/compose/.env`
- rebuilds the image
- recreates containers
- waits for `/readyz`

Manual cross-platform update flow:

```bash
git pull --ff-only
docker compose -f docker/compose/docker-compose.yml --env-file docker/compose/.env build --pull
docker compose -f docker/compose/docker-compose.yml --env-file docker/compose/.env up -d --force-recreate --remove-orphans --no-build
curl http://localhost:23456/readyz
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITCORTEX_ENCRYPTION_KEY` | Yes | - | 32-char encryption key for credentials |
| `GITCORTEX_DOCKER_API_TOKEN` | No | - | Bearer token for `/api` routes (Docker-only variable) |
| `ANTHROPIC_API_KEY` | No | - | Claude Code API key |
| `OPENAI_API_KEY` | No | - | Codex CLI API key |
| `GOOGLE_API_KEY` | No | - | Gemini CLI API key |
| `PORT` | No | 23456 | Host port mapping |
| `RUST_LOG` | No | info | Log level (debug/info/warn/error) |
| `HOST_WORKSPACE_ROOT` | No | `../..` | Host path mounted into container for repo discovery |
| `GITCORTEX_WORKSPACE_ROOT` | No | `/workspace` | Workspace mount point in container |
| `GITCORTEX_ALLOWED_ROOTS` | No | `/workspace,/var/lib/gitcortex` | Allowed roots for filesystem scanning |
| `INSTALL_AI_CLIS` | No | `0` | Set to `1` to install AI CLIs during image build |
| `GITCORTEX_AUTO_SETUP_PROJECTS` | No | `1` | Set to `0` to disable auto-creating starter projects on first launch |

## Volumes

Named volume `gitcortex-data` mounted at `/var/lib/gitcortex`:
- `assets/` -> SQLite DB, config, credentials
- `worktrees/` -> Git worktrees (auto-created by app)

Bind mount:
- `${HOST_WORKSPACE_ROOT}` -> `${GITCORTEX_WORKSPACE_ROOT}` (host git repos visible in container)

## Health Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `/healthz` | None | Liveness (process alive) |
| `/readyz` | None | Readiness (DB + dirs OK) |
| `/api/health` | Token | Application health |

## Common Operations

```bash
# View logs
docker compose -f docker/compose/docker-compose.yml logs -f

# Restart
docker compose -f docker/compose/docker-compose.yml restart

# Rebuild after code changes
docker compose -f docker/compose/docker-compose.yml up -d --build

# Update an existing deployment using the current .env
powershell -ExecutionPolicy Bypass -File .\scripts\docker\update-docker.ps1 -PullLatest

# Clean old data volume (destructive)
docker compose -f docker/compose/docker-compose.yml down -v --remove-orphans
docker compose -f docker/compose/docker-compose.yml up -d

# Dev mode
docker compose -f docker/compose/docker-compose.dev.yml up -d --build
```

## Backup & Restore

```bash
# Backup SQLite
docker compose -f docker/compose/docker-compose.yml exec gitcortex \
  cp /var/lib/gitcortex/assets/gitcortex.db /tmp/backup.db
docker compose -f docker/compose/docker-compose.yml cp \
  gitcortex:/tmp/backup.db ./backup.db

# Restore
docker compose -f docker/compose/docker-compose.yml cp \
  ./backup.db gitcortex:/var/lib/gitcortex/assets/gitcortex.db
docker compose -f docker/compose/docker-compose.yml restart
```

## Rollback to Local Mode

1. `docker compose down`
2. Run `cargo run -p server` directly (no env vars needed, original paths used)
3. SQLite can be copied from Docker volume if needed

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Port unreachable | HOST not 0.0.0.0 | Check `HOST` env var |
| `/readyz` returns 503 | DB or dir missing | Check volume mounts |
| `401` on `/api/*` | Docker API token enabled | Set `GITCORTEX_DOCKER_API_TOKEN` correctly or leave it empty |
| Repo scan returns empty | Host workspace not mounted | Set `HOST_WORKSPACE_ROOT` and restart compose |
| CLI not detected | Install disabled/failed | Set `INSTALL_AI_CLIS=1` and rebuild, or use `Settings -> Agents -> One-click Install AI CLIs`; run `/opt/gitcortex/install/verify-all-clis.sh` |
| Unexpected starter projects | Old data volume reused or auto-setup enabled | Set `GITCORTEX_AUTO_SETUP_PROJECTS=0`; run `docker compose down -v --remove-orphans` for a clean state |
| Permission denied | Volume ownership | Ensure volume owned by `gitcortex` user |
