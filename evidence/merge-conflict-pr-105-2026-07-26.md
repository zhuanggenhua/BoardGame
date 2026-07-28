# PR #105 Merge Conflict Resolution - 2026-07-26

## Scope

- PR: #105 `[codex] Smash Up 五派系图片与阶段性实装`.
- Head before resolution: `014a8a17084ff964e0fe20889e793a0e45876bb5`.
- Base branch: `origin/main` after PR #104 and PR #106 were merged.
- Resolution method: temporary Git index + commit-tree; the local dirty worktree was not staged or rewritten.

## Conflict Resolution

- Preserved PR #105 staged factions: 动作英雄, 返时者, 异形变体, 青少年, 怨灵捕手.
- Preserved main's Disney additions from PR #104/#106, including separate Disney four-faction atlas paths.
- Preserved main's newer POD atlas/faction entries and #105's excellent-movies-teens atlas entry.
- Merged `ActionPlayedEvent` payload so both `fromStored` and action target fields remain available.
- Merged locale JSON and Smash Up asset manifest by preserving existing main keys and appending missing PR keys.

## Status Notes

- This PR remains a staged in-progress implementation; it does not complete all five factions.
- Existing readiness/preflight evidence files are historical checkpoints and now include a merge note clarifying that they predate the staged runtime work.
- Server asset publication and representative public HEAD 200 checks are still not closed by this conflict-resolution commit.
