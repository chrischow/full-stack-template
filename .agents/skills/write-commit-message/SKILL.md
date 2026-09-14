---
name: write-commit-message
description: Writes a commit message based on the untracked changes in the repo.
---

# Write Commit Message

This skill does the following:

1. Read the staged changes using the `git_staged_changes` tool.
2. Generate a commit message that is based on the staged changes, and that follows the guidelines stated below. DO NOT commit the changes. Present it in the template `git commit -m "<commit message>"`.
3. Iterate on the commit message with the user, while keeping the commit message grounded in the staged changes.

## Commit Message Guidelines

This repo uses **Conventional Commits** as the convention for writing commit messages.

Each commit must abide by the following structure:

```
<type>[optional scope]: <description>
```

The `type` must be one of the following (case-sensitive):

- `build`
- `ci`
- `chore`
- `docs`
- `feat`
- `fix`
- `perf`
- `refactor`
- `revert`
- `style`
- `test`

The commit message must start with a lower case character.
