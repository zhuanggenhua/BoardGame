## Context

The requested batch is a new Smash Up faction batch sourced from a single user-provided Disney contact sheet. The sheet appears to contain four 15-card factions, but it is not safe to use the full sheet thumbnail as the authoritative text source. The existing Smash Up workflow requires intake and implementation to be separated.

The current worktree already contains unrelated active POD faction work. This change must remain independently auditable and must not absorb, overwrite, or reclassify those existing modifications.

## Goals

- Deliver four Disney factions to release-readiness after approval: 超能陆战队, 冰雪奇缘, 狮子王, 花木兰.
- Preserve a field-level source contract from user image to runtime data, locale, gameplay, tests, resources, and evidence.
- Implement gameplay through existing Smash Up shared runtime patterns wherever possible.
- Produce enough validation and evidence that the final branch can be pushed or handed to the original author without hidden intake or gameplay gaps.

## Non-Goals

- Do not invent missing bases, counts, English canonical text, or unreadable rule clauses.
- Do not treat the contact sheet thumbnail as final OCR truth for effect text.
- Do not merge or complete the existing POD change as part of this Disney batch.
- Do not mark gameplay complete from static registration or faction picker visibility alone.

## Decisions

- Decision: Use the user image as the primary source for Chinese card faces and row-major order, then create single-card crops before locking text.
  - Rationale: Project data-entry rules forbid using low-resolution contact sheets to finalize numbers, powers, types, and rule clauses.
- Decision: Build one OpenSpec capability for the Disney batch rather than expanding an unrelated POD change.
  - Rationale: The branch currently has active unrelated work; a dedicated change keeps approval, evidence, and release scope traceable.
- Decision: Implement one faction at a time after intake handoff.
  - Rationale: Smash Up implementation workflow requires per-faction closure before moving to the next faction.
- Decision: Treat missing base information as a blocker unless a later source or user approval resolves it.
  - Rationale: Smash Up factions normally require base integration, and guessing bases would make the batch non-auditable.

## Risks / Trade-Offs

- Risk: The provided image may be too low-resolution for some card text.
  - Mitigation: Generate complete single-card crops and mark only the unreadable fields `blocked`; seek clearer source only for blocked fields.
- Risk: Four full gameplay factions may require new shared mechanisms.
  - Mitigation: Start with static intake, then implement each faction through config reuse, shared mechanism extension, and UI/E2E layers.
- Risk: Existing POD work in the same worktree may create shared file conflicts.
  - Mitigation: Use minimal patches against current file content and keep Disney evidence/spec paths independent.
- Risk: Remote asset upload may be blocked by credentials or environment.
  - Mitigation: Record local resource state separately from server state and stop release-readiness if representative URL `HEAD 200` cannot be proven.

## Verification Plan

- `openspec validate add-smashup-disney-four-factions --strict --no-interactive`
- Intake contract self-check: source metadata, grid, crop table, card/base contract, visual contract, dispute table.
- Focused Vitest for registry, atlas, locale, card counts, critical images, and each faction ability module.
- `npm run typecheck`
- `npm run i18n:check`
- `npm run assets:validate`
- Target Smash Up E2E covering faction selection, game initialization, card/base rendering, and first direct real-entry evidence for new interaction types.
- Resource upload precheck/upload and public URL `HEAD 200` for representative card/base atlas assets.
