# GitCortex Docker Deployment Guide

## Quick Start

```bash
cd docker/compose
cp .env.example .env
# Edit .env — set GITCORTEX_ENCRYPTION_KEY (32 chars) and API keys
docker compose up -d
```

Access: http://localhost:23456

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITCORTEX_ENCRYPTION_KEY` | Yes | — | 32-char encryption key for credentials |
| `GITCORTEX_API_TOKEN` | No | — | Bearer token for `/api` routes |
| `ANTHROPIC_API_KEY` | No | — | Claude Code API key |
| `OPENAI_API_KEY` | No | — | Codex CLI API key |
| `GOOGLE_API_KEY` | No | — | Gemini CLI API key |
| `PORT` | No | 23456 | Host port mapping |
| `RUST_LOG` | No | info | Log level (debug/info/warn/error) |

## Volumes

Single volume `gitcortex-data` mounted at `/var/lib/gitcortex`:
- `assets/` — SQLite DB, config, credentials
- `worktrees/` — Git worktrees (auto-created by app)

## Health Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `/healthz` | None | Liveness — process alive |
| `/readyz` | None | Readiness — DB + dirs OK |
| `/api/health` | Token | Application health |

## Common Operations

```bash
# View logs
docker compose -f docker/compose/docker-compose.yml logs -f

# Restart
docker compose -f docker/compose/docker-compose.yml restart

# Rebuild after code changes
docker compose -f docker/compose/docker-compose.yml up -d --build

# Dev mode (debug logging, dev encryption key)
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
2. Run `cargo run -p server` directly — no env vars needed, original paths used
3. SQLite can be copied from Docker volume if needed

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Port unreachable | HOST not 0.0.0.0 | Check `HOST` env var |
| `/readyz` returns 503 | DB or dir missing | Check volume mounts |
| CLI not detected | Install failed | `docker exec -it <id> bash /opt/gitcortex/install/verify-all-clis.sh` |
| Permission denied | Volume ownership | Ensure volume owned by `gitcortex` user |
