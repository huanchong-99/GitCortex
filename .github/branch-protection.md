# Branch Protection Rules

Recommended GitHub branch protection configuration for SoloDawn.

## `main` branch

### On Pull Request

Required status checks that must pass before merging:

| Workflow | Job | Required |
|----------|-----|----------|
| Basic Checks (`ci-basic.yml`) | `backend-check` | Yes |
| Basic Checks (`ci-basic.yml`) | `frontend-check` | Yes |
| Quality Gate Check (`ci-quality.yml`) | `quality-gate` | Yes |

Additional settings:
- Require branches to be up to date before merging
- Require at least 1 approving review
- Dismiss stale pull request approvals when new commits are pushed
- Require conversation resolution before merging

### On Push (direct)

Required status checks:

| Workflow | Job | Required |
|----------|-----|----------|
| Basic Checks (`ci-basic.yml`) | `backend-check` | Yes |

Note: Direct pushes to main should be restricted to administrators only.

## Release tags (`v*`)

All three CI workflows must pass before a release is published:

| Workflow | Job(s) | Required |
|----------|--------|----------|
| Basic Checks (`ci-basic.yml`) | `backend-check`, `frontend-check` | Yes |
| Quality Gate Check (`ci-quality.yml`) | `sonar-analysis`, `quality-gate` | Yes |
| Docker Build Check (`ci-docker.yml`) | `docker-build` | Yes |

### Setup via GitHub CLI

```bash
# Enable branch protection for main
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["backend-check","frontend-check","quality-gate"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null

# For release tag protection, use GitHub rulesets (recommended over legacy branch protection):
gh api repos/{owner}/{repo}/rulesets \
  --method POST \
  --input - <<'EOF'
{
  "name": "Release Tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/tags/v*"], "exclude": [] }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": [
          { "context": "backend-check" },
          { "context": "frontend-check" },
          { "context": "quality-gate" },
          { "context": "sonar-analysis" },
          { "context": "docker-build" }
        ]
      }
    }
  ]
}
EOF
```
