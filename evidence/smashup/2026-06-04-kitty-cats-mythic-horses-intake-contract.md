# Kitty Cats / Mythic Horses Intake Contract (2026-06-04)

## Scope

- Game: `smashup`
- Expansion: `Pretty Pretty Smash Up`
- Requested factions this round: `Kitty Cats / 猫咪` and `Mythic Horses / 小马`
- Delivery level in this pass: runtime faction/card/base/locale/resource wiring plus focused L2 behavior implementation for the cards listed below. Full faction L3/L4 gameplay closeout remains a separate task unless tests explicitly cover the behavior.

## Truth Sources

| Type | Source | Role |
| --- | --- | --- |
| 图片真相源 | `public/assets/i18n/zh-CN/smashup/cards/pretty_pretty.png` | Card atlas geometry, row-major indices, Chinese image names/text |
| 图片真相源 | `public/assets/i18n/zh-CN/smashup/base/base3.png` | Pretty Pretty base atlas geometry and Chinese base text |
| Existing intake contracts | `evidence/smashup/2026-04-28-fairies-intake-contract.md`, `evidence/smashup/2026-04-29-princesses-intake-contract.md` | Confirms shared atlas geometry and mixed-faction index ranges |
| English compare source | `https://smashup.fandom.com/wiki/Kitty_Cats` | Canonical English card names, counts, and effect text |
| English compare source | `https://smashup.fandom.com/wiki/Mythic_Horses` | Canonical English card names, counts, and effect text |

## Geometry Findings

| Asset | Size | Observed structure | Runtime landing |
| --- | --- | --- | --- |
| Card atlas | `3332 x 4096` | `7 x 8` grid, row-major, Pretty Pretty four-faction mixed atlas | Existing `SMASHUP_ATLAS_IDS.CARDS8` -> `smashup/cards/pretty_pretty` |
| Base atlas | Existing `BASE3` | `2 x 4` grid | Existing `SMASHUP_ATLAS_IDS.BASE3` -> `smashup/base/base3` |

## Mixed Atlas Findings

- Card atlas indices `0-11`: `Kitty Cats`.
- Card atlas indices `12-23`: `Mythic Horses`.
- Card atlas indices `24-38`: `Princesses`.
- Card atlas indices `39-50`: `Fairies`.
- Card atlas indices `51-55`: title/logo tail cells.

Temporary review crops were generated under `temp/smashup-pretty-pretty-intake/` only for visual verification. They are not runtime resources.

## Kitty Cats Row-Major Index Table

| Index | Card | Chinese on image | Count / type |
| --- | --- | --- | --- |
| `0` | `Grumpiness` | `悲哀` | `x2 action` |
| `1` | `Cat Fight` | `猫咪打架` | `x2 action` |
| `2` | `Cat's Paw` | `猫咪的爪子` | `x1 action` |
| `3` | `Invisible Bicycle` | `隐形自行车` | `x1 action` |
| `4` | `Mr. Grumpers` | `坏脾气先生` | `x4 minion, power 2` |
| `5` | `Nine Lives` | `九条命` | `x1 action` |
| `6` | `Muffin` | `松饼` | `x3 minion, power 3` |
| `7` | `Hang in There` | `坚持下去` | `x1 action` |
| `8` | `Whiskers` | `威斯克` | `x2 minion, power 4` |
| `9` | `Queen Fluffy` | `毛茸茸女王` | `x1 minion, power 5` |
| `10` | `Hissy Fit` | `发脾气` | `x1 action` |
| `11` | `Can Has Cheeseburger?` | `我能吃起士堡吗?` | `x1 action` |

## Mythic Horses Row-Major Index Table

| Index | Card | Chinese on image | Count / type |
| --- | --- | --- | --- |
| `12` | `Teaching Power` | `教学之力` | `x1 action` |
| `13` | `Sharing Power` | `分享之力` | `x1 action` |
| `14` | `Super Future Space Armor Power` | `超未来装甲之力` | `x1 action` |
| `15` | `Togetherness Power` | `同行之力` | `x2 action` |
| `16` | `Encouragement Power` | `鼓舞之力` | `x2 action` |
| `17` | `Adventure Power` | `冒险之力` | `x1 action` |
| `18` | `Starlyte` | `星耀` | `x1 minion, power 5` |
| `19` | `Pinkie` | `Pinkie` | `x4 minion, power 2` |
| `20` | `Freedom Power` | `自由之力` | `x1 action` |
| `21` | `Friendship Power` | `友谊之力` | `x1 action` |
| `22` | `Seastar` | `海星` | `x3 minion, power 3` |
| `23` | `Rainbow` | `彩虹` | `x2 minion, power 4` |

## Confirmed Base Table

| Index | Base | Chinese | Faction |
| --- | --- | --- | --- |
| `0` | `Cat Fanciers' Alley` | `诡猫巷` | `Kitty Cats` |
| `1` | `House of Nine Lives` | `九命之家` | `Kitty Cats` |
| `6` | `Land of Balance` | `平衡之地` | `Mythic Horses` |
| `7` | `Pony Paradise` | `小马乐园` | `Mythic Horses` |

## Runtime Decisions

- `kitty_cats` and `mythic_horses` use the existing `CARDS8` / `BASE3` resources.
- No new runtime image resource is added in this pass, so no compression/upload step is required.
- Card definitions are registered as static data with exact `previewRef` indices. Gameplay ability implementation is only claimed for the L2-covered cards listed below.
- This pass deliberately supersedes the older mixed-atlas boundary notes in the Fairies/Princesses intake contracts for the first half of `pretty_pretty.png`; those older notes over-assigned indices `12-15` to Kitty Cats even though the image shows Mythic Horses cards there.
- `mythic_horses_super_future_space_armor_power` gives temporary `+2` power to each friendly minion on a base where that player controls another minion. The card grants no destroy/move/affect protection.

## L2 Behavior Implemented In This Pass

The following pure ongoing power modifiers are wired through `src/games/smashup/abilities/ongoing_modifiers.ts` and covered by `src/games/smashup/__tests__/ongoingModifiers.test.ts`:

| Card | Runtime behavior covered |
| --- | --- |
| `kitty_cats_grumpiness` | Attached minion gets `-2` power; other minions are unaffected. |
| `kitty_cats_hissy_fit` | Minions controlled by other players at the attached base get `-1` power. |
| `mythic_horses_starlyte` | Other friendly minions at the same base get `+1` power; Starlyte does not boost itself. |
| `mythic_horses_pinkie` | Pinkie gets `+1` power only while another friendly minion is at the same base. |
| `mythic_horses_encouragement_power` | Each attached copy grants `+1` only if that copy's owner controls another minion at the same base. |

The following interaction/trigger abilities are wired through `src/games/smashup/abilities/kitty_cats.ts` / `src/games/smashup/abilities/mythic_horses.ts` and covered by focused L2 behavior tests:

| Card | Runtime behavior covered |
| --- | --- |
| `kitty_cats_mr_grumpers` | Real `PLAY_MINION` entry creates a target prompt and applies temporary `-2` power to the chosen minion. |
| `kitty_cats_muffin` | Real `PLAY_MINION` entry targets an opponent minion with effective power `<=5`, changes control until the acting player's `TURN_ENDED`, then restores the original controller. |
| `kitty_cats_whiskers` | Real `USE_TALENT` entry grants one extra action and then prompts for an owned minion to receive temporary `+1` power. |
| `kitty_cats_queen_fluffy` | Real `USE_TALENT` entry targets an opponent minion with effective power `<=3` and changes control until turn end. |
| `kitty_cats_cat_fight` | Real `PLAY_ACTION` entry chooses an owned minion, draws cards equal to its effective power, then destroys that minion. |
| `kitty_cats_nine_lives` | Real `PLAY_ACTION` entry chooses an owned minion, destroys it, and grants one extra action limit. |
| `kitty_cats_invisible_bicycle` | Real `PLAY_ACTION` entry chooses a source base, multi-selects minions there with effective power `<=2`, then moves them to another selected base. |
| `kitty_cats_hang_in_there` | `onMinionDestroyed` replacement trigger prevents the destruction of an owned minion, prompts for another base when needed, moves the minion there, and detaches/discards this attached action. |
| `kitty_cats_can_has_cheeseburger` | `beforeScoring` special executor prompts only minions at the scoring base with effective power `<=5`, then changes control until turn end; the real Me First `PLAY_ACTION` response-window path is covered and records `SPECIAL_LIMIT_USED`. |
| `mythic_horses_seastar` | Real `USE_TALENT` entry grants Seastar one extra talent use this turn while the player has a minion at another base; the second use is consumed and a third use is rejected. |
| `mythic_horses_rainbow` | Real `USE_TALENT` entry draws one card when another friendly minion is at Rainbow's base. |
| `mythic_horses_teaching_power` | `beforeScoring` special executor reveals one deck-top card per friendly minion at the scoring base, can play one revealed minion from the deck as an extra minion at that base, and uses an ordered multi-select to put the other revealed cards back on top in player-chosen order; the real Me First `PLAY_ACTION` response-window path is covered and records `SPECIAL_LIMIT_USED`. |
| `mythic_horses_super_future_space_armor_power` | Real `PLAY_ACTION` entry gives temporary `+2` power to every friendly minion on a base where that player controls another minion; lonely friendly minions and enemy minions are unaffected. |
| `mythic_horses_togetherness_power` | Real `PLAY_ACTION` entry only offers bases where the player controls a minion, then grants one base-limited extra minion quota. |
| `mythic_horses_adventure_power` | Real `PLAY_ACTION` entry multi-selects owned minions and moves them to the selected destination base. |
| `mythic_horses_freedom_power` | Real `PLAY_ACTION` entry targets an action on a base or minion and returns it to its owner's hand via the field-aware `CARD_TRANSFERRED` path. |
| `mythic_horses_friendship_power` | Real `PLAY_ACTION` entry moves an owned minion to another base where the player has a minion, then optionally places this action on top of its owner's deck instead of leaving it in discard. |
| `mythic_horses_sharing_power` | `onTurnStart` trigger owned by the attached action's owner draws one card if its base has a minion with effective power `<=2`. |

## Verification Notes

- 2026-07-18 rule correction: the official card image at `public/assets/i18n/zh-CN/smashup/cards/pretty_pretty.png`, atlas index `14`, states that each qualifying minion gains `+2` until end of turn. The previous single-target `+2` plus protection contract was incorrect and is superseded by the runtime decision and L2 row above.

- `npx vitest run src/games/smashup/__tests__/abilities/kitty-cats.test.ts src/games/smashup/__tests__/abilities/mythic-horses.test.ts` passed: 2 files / 20 tests.
- `npx vitest run src/games/smashup/__tests__/abilities/kitty-cats.test.ts src/games/smashup/__tests__/abilities/mythic-horses.test.ts src/games/smashup/__tests__/ongoingModifiers.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts` passed: 4 files / 110 tests on `upstream/main@5bbad66f`, including Teaching Power's ordered return of the other revealed cards.
- `npx vitest run src/games/smashup/__tests__/cardI18nIntegrity.test.ts -t "Pretty Pretty 的猫咪与小马卡组按实际卡图索引注册"` passed.
- `npx vitest run src/games/smashup/__tests__/criticalImageResolver.test.ts` passed.
- `npx vitest run src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/scoreBases-mefirst-window.test.ts` passed: 2 files / 46 tests.
- `npx eslint src/games/smashup/domain/reducer.ts src/games/smashup/domain/reduce.ts src/games/smashup/domain/commands.ts src/games/smashup/domain/ongoingEffects.ts src/games/smashup/abilities/kitty_cats.ts src/games/smashup/abilities/mythic_horses.ts src/games/smashup/abilities/index.ts src/games/smashup/data/factions/kitty_cats.ts src/games/smashup/data/factions/mythic_horses.ts src/games/smashup/__tests__/abilities/kitty-cats.test.ts src/games/smashup/__tests__/abilities/mythic-horses.test.ts src/games/smashup/__tests__/ongoingModifiers.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts` exited 0. It still reports existing warnings inside shared domain files.
- `npx tsc --noEmit --pretty false` passed.
- Full `npx vitest run src/games/smashup/__tests__/cardI18nIntegrity.test.ts` still fails on unrelated upstream gaps outside this pass: Dragons/Superheroes/Geeks card and base locale coverage plus one existing Oops POD wording expectation. The Pretty Pretty Kitty Cats/Mythic Horses focused i18n test passes.

## Remaining Scope

- `kitty_cats_can_has_cheeseburger` and `mythic_horses_teaching_power` now have real Me First `PLAY_ACTION` response-window tests. They still do not have a full L4 auto `scoreBases` end-to-end scoring-session test that opens the window, resolves all responders, and scores the base.
- No new runtime image resource was added, so R2/CDN upload and remote `HEAD` verification are not required for this pass.
