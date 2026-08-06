## 1. Intake And Source Contract

- [x] 1.1 Copy the supplied 4-row x 4-column card atlas into the formal Smash Up card atlas source path.
- [x] 1.2 Copy the available penguins base atlas into the formal Smash Up base atlas source path.
- [x] 1.3 Generate/read complete card crops and record row-major index, card type, count, power and text.
- [x] 1.4 Lock the base atlas as actual 2-row x 2-column with duplicate slots excluded from data registration.
- [x] 1.5 Document official-source conflicts and the decision to implement the user's old Chinese atlas text as the gameplay source.

## 2. Static Data And Assets

- [x] 2.1 Ensure atlas ids, faction id and atlas catalog entries match `PENGUINS_*` contracts.
- [x] 2.2 Add `src/games/smashup/data/factions/penguins.ts` with 20-card composition and 2 bases.
- [x] 2.3 Register the faction cards and bases in `src/games/smashup/data/cards.ts`.
- [x] 2.4 Add Simplified Chinese and English locale entries for faction, cards and bases.
- [x] 2.5 Add faction metadata so 企鹅 can be selected without in-progress gating.
- [x] 2.6 Rebuild game-level plus root asset manifests.

## 3. Gameplay Implementation

- [x] 3.1 Implement the shared “打出牌库顶第一个随从” helper with reveal/reorder/fromDeck metadata.
- [x] 3.2 Implement 企鹅宝宝、时髦企鹅、企鹅司令、乔装企鹅、跳舞企鹅、冲浪企鹅 and 反刍企鹅.
- [x] 3.3 Implement 破壳而出、在冰下、我不能区分他们、秘密任务、渴望飞翔的工作.
- [x] 3.4 Implement 打到基地的 跳上船、水晶礼品、冰滑道 after-scoring / ongoing clauses.
- [x] 3.5 Implement 浮冰 and 殖民地 base abilities.
- [x] 3.6 Record scoped residual risks in closeout evidence.

## 4. Validation And Evidence

- [x] 4.1 Add targeted Vitest suites for static composition, atlas/manifest, i18n, ability registration and key behavior clauses.
- [x] 4.2 Run OpenSpec strict validation.
- [x] 4.3 Run targeted Vitest and typecheck/build checks in proportion to risk.
- [x] 4.4 Write closeout evidence with object-level status matrix and residual risk statement.

## 5. Upload, Commit And PR

- [x] 5.1 Run resource upload precheck for the new card/base atlas entries.
- [ ] 5.2 Upload runtime WebP resources to the server asset source and verify representative public `HEAD 200` URLs. Blocked locally by missing SSH public-key access; PR includes the atlas resources for maintainer-side publish.
- [x] 5.3 Review the final diff so unrelated existing worktree changes are not bundled.
- [x] 5.4 Commit with a Chinese message that names 企鹅 and the atlas/resource work.
- [x] 5.5 Push the branch and open a draft PR for the author with the atlas included in the PR scope. Draft PR: https://github.com/zhuanggenhua/BoardGame/pull/118
