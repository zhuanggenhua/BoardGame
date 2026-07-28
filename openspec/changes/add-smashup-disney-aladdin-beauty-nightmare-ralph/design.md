## Context

The requested batch is a new Smash Up faction batch sourced from a single user-provided Disney contact sheet. The sheet visually contains 阿拉丁、美女与野兽、圣诞夜惊魂 and 无敌破坏王 card fronts. The existing Smash Up workflow requires intake and implementation to be separated, and the source image alone does not visibly include standard base cards.

The original working directory already contains unrelated active POD faction work, so implementation has been moved to a clean worktree and branch.

## Goals

- Deliver four Disney factions to release-readiness after approval: 阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王.
- Preserve a field-level source contract from user image and comparison source to runtime data, locale, gameplay, tests, resources, and evidence.
- Implement gameplay through existing Smash Up shared runtime patterns wherever possible.
- Produce enough validation and evidence that the final branch can be pushed or handed to the original author without hidden intake or gameplay gaps.

## Non-Goals

- Do not invent missing bases, counts, English canonical text, or unreadable rule clauses.
- Do not treat the contact sheet thumbnail as final OCR truth for effect text.
- Do not merge or complete the existing POD change as part of this Disney batch.
- Do not mark gameplay complete from static registration or faction picker visibility alone.

## Decisions

- Decision: Use the user image as the primary source for Chinese card faces and card order, then create single-card crops before locking text.
  - Rationale: Project data-entry rules forbid using low-resolution contact sheets to finalize powers, types, and rule clauses.
- Decision: Use Smash Up Wiki / rule pages as comparison sources for fields not carried by the image.
  - Rationale: The image does not directly encode physical card counts, English canonical text, base details, or FAQ / clarification text.
- Decision: Build one OpenSpec capability for this specific four-faction Disney batch rather than editing an unrelated POD change.
  - Rationale: The original worktree has active unrelated work; a dedicated change keeps approval, evidence, and release scope traceable.
- Decision: Implement one faction at a time after intake handoff.
  - Rationale: Smash Up implementation workflow requires per-faction closure before moving to the next faction.
- Decision: Treat missing base image or base rule information as a blocker unless a later source or user approval resolves it.
  - Rationale: Smash Up factions normally require base integration, and guessing bases would make the batch non-auditable.

## Risks / Trade-Offs

- Risk: The provided image may be too low-resolution for some card text.
  - Mitigation: Generate complete single-card crops and mark only unreadable fields `blocked`; seek clearer source only for blocked fields.
- Risk: Four full gameplay factions may require new shared mechanisms.
  - Mitigation: Start with static intake, then implement each faction through config reuse, shared mechanism extension, and UI/E2E layers.
- Risk: Base card images are not visible in the supplied contact sheet.
  - Mitigation: Use comparison source only after documenting field ownership; if no source-backed image exists, keep base image/resource status blocked rather than faking assets.
- Risk: Remote asset upload may be blocked by credentials or environment.
  - Mitigation: Record local resource state separately from server state and stop release-readiness if representative URL `HEAD 200` cannot be proven.

## Verification Plan

- `openspec validate add-smashup-disney-aladdin-beauty-nightmare-ralph --strict --no-interactive`
- Intake contract self-check: source metadata, grid, crop table, card/base contract, visual contract, dispute table.
- Focused Vitest for registry, atlas, locale, card counts, critical images, and each faction ability module.
- `npx eslint <changed ts/tsx files>`
- `npm run typecheck`
- `npm run i18n:check`
- `npm run assets:validate`
- Target Smash Up E2E covering faction selection, game initialization, card/base rendering, and first direct real-entry evidence for new interaction types.
- Resource upload precheck/upload and public URL `HEAD 200` for representative card/base atlas assets.
