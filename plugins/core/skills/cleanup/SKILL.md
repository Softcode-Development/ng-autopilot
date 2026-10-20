---
name: cleanup
description: List what agent sessions left on disk for this project — session scratch folders, tool-result dumps, the repo's git-ignored run output (.claude/tmp/), and anything else an agent wrote outside the repo (gate output, spike copies, screenshots) — with sizes, and delete it after one confirmation. Use on "/autopilot:cleanup", "clean up temp files", "free disk space after the delivery". /deliver runs the same duty at Close.
---

# Autopilot cleanup

Launcher: `node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" cleanup .`

1. **Collect the extras.** The script finds Claude Code's folders for this project and `.claude/tmp/` by itself. Add, with one `--path <p>` each, every other file or folder you or your agents wrote outside the repo during the work — gate-output folders, copies of the repo, temp builds, saved screenshots, downloaded files. Take them from the worklog, the agents' hand-backs and your own commands. Paths you are unsure of are listed, not guessed.
2. **List:** run the launcher with the extras. It prints each item with its size and what it is; it refuses paths that are roots, the home folder, Claude Code's own settings, transcripts and memory, the project itself or anything tracked inside it.
3. **One confirmation.** Show the owner the list and the total in a single question: delete all (recommended), keep some (name them — they become `--skip <p>`), or keep everything.
4. **Delete:** the same command plus the owner's `--skip`s and `--delete`. Report what was freed and anything refused or missing.

Never delete outside this flow, never delete what the owner did not see in the list, and never touch session transcripts or auto-memory. A session that is still running keeps working after its scratch folder is gone; its next write recreates it.
