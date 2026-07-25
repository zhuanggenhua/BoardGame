# Smash Up 动作英雄 / 返时者 / 异形变体 / 青少年 / 怨灵捕手 Approval Readiness

## Current Verdict

- Status: `ready-for-approval-review`, not implementation-ready.
- Change ID: `add-smashup-excellent-movies-teens-factions`.
- Runtime implementation state: not started.
- Runtime code/assets/tests touched by this batch: none.
- Latest OpenSpec validation: `openspec validate add-smashup-excellent-movies-teens-factions --strict --no-interactive` passed.

## Prepared Inputs

| Artifact | Path | Purpose |
| --- | --- | --- |
| OpenSpec proposal | `openspec/changes/add-smashup-excellent-movies-teens-factions/proposal.md` | Defines why/what/impact and approval gate |
| OpenSpec design | `openspec/changes/add-smashup-excellent-movies-teens-factions/design.md` | Documents implementation order and mechanism decisions |
| OpenSpec tasks | `openspec/changes/add-smashup-excellent-movies-teens-factions/tasks.md` | Tracks approval, intake, implementation and verification tasks |
| Intake contract | `evidence/smashup/2026-07-25-excellent-movies-teens-intake-contract-draft.md` | Field-level source contract, object gate matrix and worktree boundary |
| Preflight evidence | `evidence/smashup/2026-07-25-excellent-movies-teens-preflight.md` | Source image metadata, hash and crop generation evidence |
| Object gate JSON | `temp/smashup-excellent-movies-teens-intake/contracts/object-gate-matrix.json` | Machine-readable `locked/blocked/disputed` object state |
| Implementation handoff | `temp/smashup-excellent-movies-teens-intake/contracts/implementation-handoff.md` | Post-approval execution checklist and do-not-absorb boundary |

## Approval Blockers

| Gate | Current status | Required approval / decision |
| --- | --- | --- |
| 0.1 OpenSpec implementation approval | `pending` | User explicitly approves implementing `add-smashup-excellent-movies-teens-factions` |
| 0.2 Worktree decision | `pending` | User chooses side-by-side in current dirty worktree or isolation for this batch |
| Object locks | `0 locked`, `72 blocked`, `4 disputed` | After approval, review 66 card crops and resolve the four disputes before runtime definitions |
| Base assets | `blocked` | Locate/approve runtime base art for 10 bases, or explicitly freeze base art as blocked |

## Exact Approval Needed

To continue into runtime implementation without ambiguity, the next user instruction should say one of:

- `批准继续实装，同工作区继续。`
- `批准继续实装，先隔离本批次。`

If base art is not yet available, include one more clause:

- `基地素材先标 blocked，先做可锁定卡牌。`

## First Action After Approval

1. Mark tasks 0.1 and 0.2 only after the approval/worktree decision is explicit.
2. Start object locking from the single-card crops; do not create runtime entries for still-blocked objects.
3. Resolve the four disputed items before IDs/locales:
   - 动作英雄 slot 11: `Rescue Mission` vs `Hostage Rescue`
   - 返时者 slot 26: `From the Past` vs `Help From the Past`
   - 异形变体 slot 38: `Head Grabber` AEG placeholder vs crop text
   - 青少年 slot 46: `Abe Froman / Abe Frohman` vs `Abe Frohman`
4. Only then begin task 2.x static registry/assets work.

## Boundary Reminder

Do not absorb unrelated dirty work unless the user expands scope:

- Disney four-faction OpenSpec and evidence.
- Explorers / Star Roamers / Vigilantes / Luchadors POD OpenSpec, files, tests and evidence.
- Existing 中国 / 远猴 / Disney / POD runtime/test edits.

This file is a readiness checkpoint, not approval itself.
