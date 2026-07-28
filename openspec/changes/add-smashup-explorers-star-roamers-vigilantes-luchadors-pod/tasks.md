## 1. Source And Assets

- [x] 1.1 Identify the four supplied 4×5 POD card atlases as 探险家、星际旅者、侠义义警 and 摔角手.
- [x] 1.2 Copy the supplied card atlases into formal Smash Up runtime asset paths.
- [x] 1.3 Generate runtime WebP assets without downsampling and refresh the i18n asset manifest.

## 2. POD Registry And Data

- [x] 2.1 Add POD atlas IDs, faction IDs and domain display names.
- [x] 2.2 Add complete POD card data files with _pod card IDs, counts, tags and atlas indexes.
- [x] 2.3 Register the four POD card sets in the global Smash Up card registry.
- [x] 2.4 Add faction metadata so POD variants are selectable while preserving base-faction in-progress status.
- [x] 2.5 Add English and Simplified Chinese faction/card locale entries.

## 3. Variant And Ability Semantics

- [x] 3.1 Add shared POD variant profiles for 探险家、星际旅者 and 摔角手.
- [x] 3.2 Add a separate POD variant profile for 侠义义警 cards whose POD text differs from the base version.
- [x] 3.3 Implement representative 侠义义警 POD overrides for 一天的快乐、直面恐惧、谁爱你小老弟、凶恶百倍、咬紧牙关 and 瞌睡的亨利.

## 4. Validation

- [x] 4.1 Add a targeted POD intake Vitest suite for the four new factions.
- [x] 4.2 Run targeted Vitest, i18n check, typecheck and OpenSpec strict validation; asset validation was attempted in the clean PR worktree and is blocked by the unrelated existing `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json` manifest mismatch.
- [x] 4.3 Attempt the documented POD data audit command; current branch does not contain scripts/audit-pod-data-consistency.mjs or a package script for it, so the unavailable audit is recorded as an environment/spec-doc mismatch rather than bypassed.
