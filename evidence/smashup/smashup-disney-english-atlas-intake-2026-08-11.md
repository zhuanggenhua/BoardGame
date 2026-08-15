# SmashUp Disney English POD Atlas Intake (2026-08-11)

## Scope

- User supplied three English Disney Edition POD atlas screenshots:
  - `C:\Users\Dqm\.codex\attachments\888a0b6c-c74e-47ce-b4ec-fe785b228a78\image-1.png`
  - `C:\Users\Dqm\.codex\attachments\888a0b6c-c74e-47ce-b4ec-fe785b228a78\image-2.png`
  - `C:\Users\Dqm\.codex\attachments\888a0b6c-c74e-47ce-b4ec-fe785b228a78\image-3.png`
- This intake is for the English resource surface only. Disney gameplay, card identities, English names, and locale text already existed in code; this change adds the English image delivery contract.
- Covered objects:
  - 8 factions: Aladdin, Beauty and the Beast, Nightmare Before Christmas, Wreck-It Ralph, Big Hero 6, Frozen, Lion King, Mulan.
  - 120 physical cards across two card atlases.
  - 16 bases split across two base atlases.

## Source Images

| Source | Dimensions | Interpretation |
| --- | ---: | --- |
| image-1.png | 4888 x 4096 | `DISNEY_FOUR_FACTION_CARDS`: Big Hero 6 / Frozen / Lion King / Mulan |
| image-2.png | 4888 x 4096 | `DISNEY_CARDS`: Aladdin / Beauty and the Beast / Nightmare Before Christmas / Wreck-It Ralph |
| image-3.png | 3500 x 2506 | 16 English Disney bases, split into the two existing sparse base atlases |

## Atlas Mapping

### Card Atlases

- `smashup/cards/disney_four_factions`: source image-1 order matches the existing `DISNEY_FOUR_FACTION_CARDS` indexes; no card reordering was applied.
- `smashup/cards/disney`: source image-2 order mostly matches the existing `DISNEY_CARDS` indexes. The source positions for `nightmare_before_christmas_jack_skellington` and `nightmare_before_christmas_zero` were swapped when generating the English atlas so runtime indexes stay compatible with existing code:
  - `nightmare_before_christmas_jack_skellington` remains atlas index 27.
  - `nightmare_before_christmas_zero` remains atlas index 33.

### Base Atlases

The English base source page was split into two sparse 4 x 4 atlases to preserve existing `previewRef.index` values. Source indexes are row-major across image-3.

| Target atlas | Target index | Source index | Base |
| --- | ---: | ---: | --- |
| disney_bases | 0 | 14 | The Dump |
| disney_bases | 1 | 0 | Sultan's Palace |
| disney_bases | 3 | 2 | Enchanted Castle |
| disney_bases | 4 | 15 | The Power Strip |
| disney_bases | 5 | 1 | Agrabah Bazaar |
| disney_bases | 7 | 3 | Gaston's Tavern |
| disney_bases | 10 | 13 | Halloween Town |
| disney_bases | 14 | 12 | Spiral Hill |
| disney_four_faction_bases | 4 | 11 | Training Camp |
| disney_four_faction_bases | 5 | 10 | Forbidden City |
| disney_four_faction_bases | 6 | 9 | Jungle Paradise |
| disney_four_faction_bases | 7 | 8 | Pride Rock |
| disney_four_faction_bases | 8 | 7 | Ice Palace |
| disney_four_faction_bases | 9 | 6 | Arendelle |
| disney_four_faction_bases | 10 | 5 | SFIT Robotics Lab |
| disney_four_faction_bases | 11 | 4 | Krei Tech |

## Generated Resources

All generated resources live under `public/assets/i18n/en/smashup/`. Source PNG/JPG files are local generation artifacts. Runtime delivery uses the compressed WebP files and root manifest entries.

| Manifest key | Dimensions | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| en/smashup/cards/disney | 4888 x 4096 | 33283832 | ab35ed10b863de226c3bdda0e391ddb5e4f9a01ed666a6867fd5280e67b0915d |
| en/smashup/cards/disney_four_factions | 4888 x 4096 | 34764781 | daad522f77d5e4b256aad3f23fe22f76860ec0183cfa137f1f4305c03ae54406 |
| en/smashup/cards/compressed/disney | 4888 x 4096 | 3992798 | 79f07743e43de2f380d1abc37ab202a436915ae247e8adaebfd02093216cffb8 |
| en/smashup/cards/compressed/disney_four_factions | 4888 x 4096 | 3795192 | 15fa5154e7b88c59a913aeb7277950475e55c288e835bd43e9ddc3c47de19f11 |
| en/smashup/base/disney_bases | 3500 x 2506 | 3224843 | ef0b81fe9a25314903a5e22901f96639d3543cee9ff1c599f724326c16240572 |
| en/smashup/base/disney_four_faction_bases | 3500 x 2506 | 3341993 | 00e533350eac1b5dfe81ba891aa6e188e86697bbf50212d4524cff9b8958730d |
| en/smashup/base/compressed/disney_bases | 3500 x 2506 | 1016654 | f901157e1f01d33bf47024dc42c58b49974df40e988620510c9ba644b94dfeea |
| en/smashup/base/compressed/disney_four_faction_bases | 3500 x 2506 | 1064666 | 0702bbada2cf35f45d46f55754a47a400ca57753bf3d00a4ecb6e311528367d4 |

## Manual Spot Checks

Temporary visual spot-check files were generated under `temp/smashup-disney-english-atlas-check/` and are intentionally not committed:

- `disney_cards_27_jack.png`: verifies atlas index 27 is Jack Skellington after the source swap.
- `disney_cards_33_zero.png`: verifies atlas index 33 is Zero after the source swap.
- `disney_bases_sparse.png`: verifies sparse base placement for `disney_bases`.
- `disney_four_bases_sparse.png`: verifies sparse base placement for `disney_four_faction_bases`.

The compressed runtime atlases were also checked with the local vision helper:

- `disney_four_factions.webp` was recognized as English Disney Edition art for Big Hero 6, Frozen, The Lion King, and Mulan.
- `disney.webp` was recognized as English Disney Edition art for Aladdin, Beauty and the Beast, The Nightmare Before Christmas, and Wreck-It Ralph. Jack Skellington and Zero were both visible in the expected generated slots.
- `disney_bases.webp` exposed the expected eight English base names: The Dump, Sultan's Palace, Enchanted Castle, The Power Strip, Agrabah Bazaar, Gaston's Tavern, Halloween Town, and Spiral Hill.
- `disney_four_faction_bases.webp` exposed the expected eight English base names: Training Camp, Forbidden City, Jungle Paradise, Pride Rock, Ice Palace, Arendelle, SFIT Robotics Lab, and Krei Tech.

## Validation

- Added `src/games/smashup/__tests__/disneyEnglishAtlasContract.test.ts`.
- Passed: `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/disneyEnglishAtlasContract.test.ts --configLoader native`.
- Disney-focused run: 36/37 tests passed. The only failure is the pre-existing Chinese atlas hash assertion because this partial worktree does not contain the ignored local file `public/assets/i18n/zh-CN/smashup/cards/disney.png`; all gameplay, English atlas, and critical-image resolver tests passed.
- Asset publication dry-run found exactly four runtime objects under `i18n/en/smashup`.
- CDN HEAD verification on 2026-08-12 returned 404 for all four runtime URLs. The local environment has neither an asset publishing token nor an accepted SSH key, so actual CDN publication remains pending the repository owner's asset-publish credentials.
