# Git safety

- **Conventional Commits.** Type/scope allowlist lives in the project's `commitlint` config.
  - **Enforcement:** `commit-msg` hook (commitlint).
- **Never `--no-verify`.** A red hook means fix the underlying problem. A sanctioned bypass, if a project has one, is owner-invoked, carries a matching commit trailer as its audit record, and is never agent-selected.
  - **Enforcement:** PreToolUse Bash guard blocks the flag; settings deny-list.
- **No force-push, no `reset --hard`, no `publish`** from an agent session.
  - **Enforcement:** PreToolUse Bash guard + settings deny-list.
- **No direct pushes to protected trunks** (`main`, `master`, `production`, plus `.claude/autopilot.json` → `protectedBranches`); work lands through PRs. Agents push feature branches and open, edit and comment on PRs without asking; **merging is the owner's call**. Project's branch model lives in `docs/TECH_STACK.md` (Non-stack decisions).
  - **Enforcement:** PreToolUse Bash guard (explicit refspecs, `HEAD:main`, `+main`, `--all` / `--mirror`, and a bare `git push` while on a trunk) + settings deny-list; `gh pr merge` and `git merge` ask.
- **Commit only when asked** — or when the active workflow step says so. Tick the plan/task checkbox in the same commit that lands the code.
- **Bump the app version once per change** that touches app code, as the last step before the PR, when the project versions its app (SemVer by commit type: `feat` → minor, `fix`/`chore`/`perf`/`refactor` → patch, breaking → major). Docs/CI-only changes don't bump.
  - **Why:** the running version (footer, `/version`) must identify the code that is deployed.
- **Secrets never enter git** — no `.env*`, keys, certificates or credentials files. Reading them is denied to agents.
  - **Enforcement:** settings deny-list + Bash guard (closes the `cat .env` side-channel) + secret scanner in pre-commit/CI.
