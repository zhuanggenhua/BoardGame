# Smash Up POD intake: Disco Dancers and Teddy Bears

Date: 2026-09-10

## Scope

This intake covers the two user-provided POD atlas images currently available in the task:

| Image | Runtime disposition | Faction | Runtime faction id | Notes |
| --- | --- | --- | --- | --- |
| `C:\Users\Dqm\.codex\attachments\93a663b7-cfac-4ba4-b8f3-3bb57b68bbf0\image-1.png` | `runtime` | Disco Dancers | `disco_dancers_pod` | 4x5 POD card atlas. This is not Rock Stars. |
| `C:\Users\Dqm\.codex\attachments\93a663b7-cfac-4ba4-b8f3-3bb57b68bbf0\image-2.png` | `runtime` | Teddy Bears | `teddy_bears_pod` | 4x5 POD card atlas. |
| Rock Stars POD | `blocked` | Rock Stars | `rock_stars_pod` | No Rock Stars POD source image is present in this batch. |

## Source Images

| Image | Dimensions | SHA256 | Read action | Status |
| --- | --- | --- | --- | --- |
| `image-1.png` | 1876 x 2100 | `11e3a92eee5e2499eb5c401af132e1ca39f590a5130f950ae4bc6eb573d8d589` | Visual inspection + structured card-slot read | `locked` |
| `image-2.png` | 1876 x 2100 | `dadb48ffcfc7585a9d6b9a80e264e1d6e32fc4aaa0582b2e0c859e089450f3bd` | Visual inspection + structured card-slot read | `locked` |

## Disco Dancers POD Atlas Contract

Runtime asset path: `smashup/cards/disco_dancers_pod`

Grid: 4 rows x 5 columns, row-major indexes 0-19.

| Slot | Card | Type | Power | Runtime id | Count represented |
| --- | --- | --- | --- | --- | --- |
| 0 | It's Raining Men | action |  | `disco_dancers_its_raining_men_pod` | 1 |
| 1 | I Will Survive | action |  | `disco_dancers_i_will_survive_pod` | 1 |
| 2 | I'm So Excited | action |  | `disco_dancers_im_so_excited_pod` | 1 |
| 3 | We Are Family | action |  | `disco_dancers_we_are_family_pod` | 1 |
| 4 | Get Down Tonight | action |  | `disco_dancers_get_down_tonight_pod` | 1 |
| 5 | Stayin' Alive | action |  | `disco_dancers_stayin_alive_pod` | 1 |
| 6 | Disco Inferno | action |  | `disco_dancers_disco_inferno_pod` | 1 |
| 7 | Last Dance | action |  | `disco_dancers_last_dance_pod` | 1 |
| 8 | Celebration | action |  | `disco_dancers_celebration_pod` | 1 |
| 9 | Turn The Beat Around | action |  | `disco_dancers_turn_the_beat_around_pod` | 1 |
| 10 | Roller | minion | 2 | `disco_dancers_roller_pod` | 4 |
| 14 | Diva | minion | 3 | `disco_dancers_diva_pod` | 3 |
| 17 | Disco Lou | minion | 4 | `disco_dancers_ul_disco_lou_pod` | 2 |
| 19 | Dancing King | minion | 5 | `disco_dancers_dancing_king_pod` | 1 |

Implementation notes:

- The POD image contains one `Get Down Tonight` and one `Turn The Beat Around`; the existing classic Disco Dancers data has `disco_dancers_get_down_tonight` count 2.
- The existing classic data stores `Turn The Beat Around` under Truckers as `truckers_turn_the_beat_around`. The POD runtime uses a Disco Dancers id because the image places that card in the Disco Dancers POD atlas.
- `Disco Lou` keeps the classic family id `disco_dancers_ul_disco_lou_pod` so the shared POD ability alias can resolve to the existing `disco_dancers_ul_disco_lou` implementation.

## Teddy Bears POD Atlas Contract

Runtime asset path: `smashup/cards/teddy_bears_pod`

Grid: 4 rows x 5 columns, row-major indexes 0-19.

| Slot | Card | Type | Power | Runtime id | Count represented |
| --- | --- | --- | --- | --- | --- |
| 0 | Tea Party | action |  | `teddy_bears_tea_party_pod` | 1 |
| 1 | Cuddle | action |  | `teddy_bears_cuddle_pod` | 2 |
| 3 | Care Package | action |  | `teddy_bears_care_package_pod` | 2 |
| 5 | Group Hug | action |  | `teddy_bears_group_hug_pod` | 1 |
| 6 | Bear Picnic | action |  | `teddy_bears_bear_picnic_pod` | 1 |
| 7 | Too Cute | action |  | `teddy_bears_too_cute_pod` | 1 |
| 8 | Love Overload | action |  | `teddy_bears_love_overload_pod` | 1 |
| 9 | Square Deal | action |  | `teddy_bears_square_deal_pod` | 1 |
| 10 | Snuggly Bear | minion | 1 | `teddy_bears_snuggly_bear_pod` | 4 |
| 14 | Lovey Bear | minion | 3 | `teddy_bears_lovey_bear_pod` | 3 |
| 17 | Fun Bear | minion | 2 | `teddy_bears_fun_bear_pod` | 2 |
| 19 | Sir Squeezes | minion | 5 | `teddy_bears_sir_squeezes_pod` | 1 |

## Consumption Map

| Consumer | Required update |
| --- | --- |
| Runtime assets | Add source PNGs and compressed WebP outputs under `public/assets/i18n/en/smashup/cards/`. |
| Atlas catalog | Register `DISCO_DANCERS_POD_CARDS` and `TEDDY_BEARS_POD_CARDS` as 4x5 card atlases. |
| Card registry | Add POD card definition arrays and register them in `src/games/smashup/data/cards.ts`. |
| Faction metadata | Add `disco_dancers_pod` and `teddy_bears_pod` entries so the web faction picker exposes POD variants. |
| Variant bindings | Add POD profiles for Disco Dancers and Teddy Bears. |
| Ability runtime | Shared `_pod` aliases cover same-family cards; `disco_dancers_turn_the_beat_around_pod` must explicitly reuse the Turn The Beat Around program. |
| i18n | Add faction labels/descriptions and explicit POD card locale entries for `en` and `zh-CN`. |
| Tests | Add focused integration coverage for counts, slot indexes, atlas paths, metadata, variant bindings, locales, critical image preload, and ability alias registration. |

## Final Status

Disco Dancers POD and Teddy Bears POD are `locked` for runtime implementation.

Rock Stars POD remains `blocked` until a Rock Stars POD source atlas is provided.
