# Smash Up 动作英雄 / 返时者 / 异形变体 / 青少年 / 怨灵捕手 Preflight

## Status

- Change ID: `add-smashup-excellent-movies-teens-factions`
- Current stage: proposal/preflight only; runtime implementation is pending explicit approval.
- OpenSpec validation: `openspec validate add-smashup-excellent-movies-teens-factions --strict --no-interactive` passed.
- Runtime code touched for this change: none.

## Source Image

| Field | Value |
| --- | --- |
| Source path | `C:/Users/Dqm/.codex/attachments/abf0887d-b89b-4aec-8493-d88ecbd0a3fc/image-1.png` |
| Size | `5000 × 4888` |
| Bytes | `42,388,920` |
| SHA-256 | `a9714cc812f55e62d8f1e7dede010a5838dc2ecf4ef17f031a17bedd6b1cd720` |
| Format / mode | `PNG / RGBA` |
| Recorded time | `2026-07-25` |

## Generated Preflight Assets

| Asset | Path |
| --- | --- |
| Overview | `temp/smashup-excellent-movies-teens-intake/overview-2200w.png` |
| Grid overview | `temp/smashup-excellent-movies-teens-intake/overview-grid-2200w.png` |
| Source metadata | `temp/smashup-excellent-movies-teens-intake/source-and-grid-feasibility.json` |
| Single-card crops | `temp/smashup-excellent-movies-teens-intake/cards/slot-00-r1c1.png` through `slot-69-r7c10.png` |
| Row previews | `temp/smashup-excellent-movies-teens-intake/rows/row-1.png` through `row-7.png` |

## Grid Feasibility

| Slot range | Preliminary object | Status |
| --- | --- | --- |
| `00-16` | 动作英雄（Action Heroes） | `source-found` |
| `17-28` | 返时者（Backtimers） | `source-found` |
| `29-40` | 异形变体（Extramorphs） | `source-found` |
| `41-53` | 青少年（Teens） | `source-found` |
| `54-65` | 怨灵捕手（Wraithrustlers） | `source-found` |
| `66-69` | 黑底空槽 / 非卡牌尾格 | `not-applicable` |

## Comparison Sources To Lock During Intake

| Source | Intended Use | Status |
| --- | --- | --- |
| `https://www.alderac.com/wp-content/uploads/2024/05/SU_ExcellentMoviesDude_Rulebook.pdf` | Excellent Movies, Dudes! official comparison for four factions, bases, Stasis and Stored Cards | `downloaded-to-temp` |
| `https://smashup-rulebook.alderac.com/wiki/Action_Heroes` | 动作英雄 canonical entries, copy counts, effect text, base text, clarifications | `downloaded-to-temp` |
| `https://smashup-rulebook.alderac.com/wiki/Backtimers` | 返时者 canonical entries, copy counts, effect text, base text, clarifications | `downloaded-to-temp` |
| `https://smashup-rulebook.alderac.com/wiki/Extramorphs` | 异形变体 canonical entries, copy counts, effect text, base text, clarifications | `downloaded-to-temp` |
| `https://smashup-rulebook.alderac.com/wiki/Wraithrustlers` | 怨灵捕手 canonical entries, copy counts, effect text, base text, clarifications | `downloaded-to-temp` |
| `https://smashup-rulebook.alderac.com/wiki/Teens` | 青少年 canonical entries, copy counts, effect text, base text, clarifications | `downloaded-to-temp` |
| SmashUp Fandom `Action Heroes`, `Backtimers`, `Extramorphs`, `Wraithrustlers`, `Teens` pages | Secondary cross-check only | `blocked-by-cloudflare` |

## Candidate Extraction

| Artifact | Path | Status |
| --- | --- | --- |
| AEG entry candidates | `temp/smashup-excellent-movies-teens-intake/contracts/aeg-official-entry-candidates.md` | `candidate` |
| AEG entry candidates JSON | `temp/smashup-excellent-movies-teens-intake/contracts/*-aeg-entry-candidates.json` | `candidate` |
| Slot candidate map | `temp/smashup-excellent-movies-teens-intake/contracts/slot-candidate-map.md` | `candidate` |
| Slot candidate map JSON | `temp/smashup-excellent-movies-teens-intake/contracts/slot-candidate-map.json` | `candidate` |

Extraction summary:

- 动作英雄：17 distinct card slots / 20 card copies, plus 2 official bases from AEG.
- 返时者：12 distinct card slots / 20 card copies, plus 2 official bases from AEG.
- 异形变体：12 distinct card slots / 20 card copies, plus 2 official bases from AEG.
- 青少年：13 distinct card slots / 20 card copies, plus 2 official bases from AEG.
- 怨灵捕手：12 distinct card slots / 20 card copies, plus 2 official bases from AEG.
- Slot match summary: 63 direct matches, 3 alias candidates, 0 unmatched, 4 non-card blank slots.
- Alias candidates requiring intake judgment: `Rescue Mission` vs `Hostage Rescue`, `From the Past` vs `Help From the Past`, `Abe Froman` vs `Abe Frohman`.

## Boundary Notes

- Existing untracked `openspec/changes/add-smashup-disney-four-factions/` and `temp/smashup-disney-four-factions-intake/` belong to a different Disney batch and were not modified.
- Existing untracked `add-smashup-explorers-star-roamers-vigilantes-luchadors-pod` and Smash Up POD runtime edits remain separate work and were not absorbed here.
- This preflight does not lock card text, copy counts, bases or gameplay semantics. Those remain pending intake after approval.
