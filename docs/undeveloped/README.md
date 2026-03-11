# Documentation Layout

This repository uses two top-level documentation folders:

- `docs/developed/`: completed and stable documentation
- `docs/undeveloped/`: pending or in-progress documentation

Current `docs/undeveloped/` structure:

- `docs/undeveloped/current/`: active unfinished work (entry point is `TODO.md`)

Current `docs/developed/` structure:

- `docs/developed/plans/`: completed phase plans and design documents
- `docs/developed/issues/`: resolved audit reports and issue analyses
- `docs/developed/ops/`: operations runbook, troubleshooting, deployment guides
- `docs/developed/misc/`: archived TODO lists, user guide, operations manual, and other reference docs

Maintenance rules:

1. Add new work-in-progress docs under `docs/undeveloped/current/`.
2. Move docs to `docs/developed/` after work is complete.
3. Keep `docs/undeveloped/current/TODO.md` as the single source of truth for active unfinished tasks.
4. Avoid duplicate documents across `developed/` and `undeveloped/`.
