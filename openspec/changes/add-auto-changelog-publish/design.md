## Context
The platform already stores game changelogs in MongoDB through the NestJS `game-changelog` module. Admin and developer users can create changelogs through existing REST endpoints with role and game-scope checks.

## Goals / Non-Goals
- Goals: automate changelog generation from git changes, publish through existing authenticated APIs, and keep credentials outside the repository.
- Non-Goals: add a second changelog database path, bypass admin/developer authorization, or change public changelog rendering.

## Decisions
- Use a release CLI script instead of a git hook by default, so missing credentials or network failures do not unexpectedly block every push.
- Call `/auth/login` and `/admin/game-changelogs`, preserving the current JWT and developer-game permission model.
- Detect games from changed paths under `src/games/<gameId>`, `e2e/<gameId>`, `docs/games/<gameId>`, game locale files, and game asset folders.
- Filter out games whose manifest declares `statusTag: 'under_construction'` by default, with `--include-under-construction` as the explicit escape hatch for non-public or exceptional releases.
- Generate Markdown-like plain text with player-facing sections such as `## 修复`, `## 新增`, `## 优化`, and `## 调整`, matching the current plain-text frontend renderer.
- Drop internal-only commit messages such as tests, verification, documentation, audit notes, and git gatekeeping from public changelog drafts.

## Risks / Trade-offs
- Automatic summaries are only as good as commit messages; the script supports `--summary`, `--title`, and `--content-file` overrides for release-quality edits.
- Multiple games in one commit may receive the same high-level summary; `--game` can narrow publication when needed.
- Implementation-status filtering depends on each game's `manifest.ts`; missing or stale status tags can still cause a game to be included.
- Commit messages still need player-readable wording; the script removes obvious internal-only lines but cannot fully rewrite vague release notes.
- The script avoids direct database writes, so API availability and credentials are required for real publishing.
