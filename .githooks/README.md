# Git Hooks

This directory contains git hooks that can be installed for development.

## Installation

To install the pre-commit hook:

```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or configure git to use this directory:

```bash
git config core.hooksPath .githooks
```

## Available Hooks

- `pre-commit`: Runs cargo check before allowing commits to prevent compilation errors from being committed.
