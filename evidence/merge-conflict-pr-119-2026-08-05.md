# PR #119 合并重叠文件审计

## 背景

- PR：#119《实现哥布林与圆桌骑士派系》
- PR 来源：`deathcats4/BoardGame:codex/smashup-goblins-round-table-knights-only`
- PR 侧提交：`e1c0847c64bf195732d6b3bc5040c8cbdc84bde0`
- main 侧提交：`372924c468a28cecc877e0d1b3d794c5f20cfeea`
- GitHub 生成的合并提交：`fdbe67b33ed4cc601dd4b1e83dc7b4deefc56c1c`
- 两侧共同基线：`553dbb4ecedd9ee49cd89626e786b48a0ec5a90a`

这次没有文本冲突标记，但 main 和 PR 都修改了同一批 Smash Up 共享文件。质量门将这些文件视为需要人工说明的合并结果，因此补充本审计文档。裁决目标是保留两侧各自新增的有效内容，不用任一侧整份覆盖另一侧。

## 重叠文件

- `public/assets/i18n/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/abilities/ongoing_modifiers.ts`
- `src/games/smashup/domain/types.ts`

## 逐文件裁决

### `public/assets/i18n/assets-manifest.json`

- main 侧保留了 Munchkin 精灵、法师等派系的图片与图集索引，例如 `munchkin_elves_bases`、`munchkin_mages`。
- PR 侧把哥布林和圆桌骑士的旧 `new_*` 资源索引改为正式路径，例如 `goblins_bases`、`round_table_knights_bases`。
- 合并结果同时保留两类内容：Munchkin 资源索引没有丢失，哥布林/圆桌骑士资源也完成正式命名收口。
- 文件级风险：若采用任一单边，会分别丢失 Munchkin 新资源或本 PR 的正式资源路径，导致对应卡牌/基地图片无法按索引加载。

### `public/locales/en/game-smashup.json`

- main 侧新增并保留 Munchkin 法师、精灵、牧师、兽人等交互提示，例如 `munchkin_mages_blaster_master_discard_title`。
- PR 侧将 `new_*` 派系和卡牌文案改为 `goblins` / `round_table_knights` 正式键，并新增哥布林硬币能力反馈文案。
- 合并结果同时保留 Munchkin 交互提示和哥布林/圆桌骑士正式文案；当前提交还补齐了两个哥布林反馈键。
- 文件级风险：采用单边会让另一侧对应玩法出现缺少可见提示、语言键缺失或旧键残留。

### `public/locales/zh-CN/game-smashup.json`

- main 侧新增并保留 Munchkin 各派系的中文交互提示，例如 `munchkin_mages_blaster_master_discard_title`。
- PR 侧完成哥布林/圆桌骑士从 `new_*` 到正式键的命名迁移，并补充中文反馈文案；同时将本 PR 带入的英文残留改为中文，避免语言包质量门新增 warning。
- 合并结果同时保留两侧有效中文内容；`round_table_knights`、`goblins`、`goblins_make_your_own_luck_ready` 与 Munchkin 提示均存在。
- 文件级风险：采用单边会静默丢失另一侧的中文交互入口或卡牌/派系显示文案。

### `src/games/smashup/abilities/ongoing_modifiers.ts`

- main 侧新增 Munchkin 精灵与兽人的持续力量修正注册：`registerMunchkinElvesModifiers`、`registerMunchkinOrcsModifiers`。
- PR 侧移除旧的 Munchkin 宝藏持续修正重复实现，并新增哥布林“魔法”头盔、圆桌骑士加文/圣剑/圆桌基地的持续修正注册。
- 合并结果保留 main 侧 Munchkin 精灵/兽人修正，也保留 PR 侧哥布林/圆桌骑士修正；旧重复的 Munchkin 宝藏实现不恢复。
- 文件级风险：只取 main 侧会丢失本 PR 派系能力的持续力量计算；只取 PR 侧会丢失 main 侧 Munchkin 精灵/兽人的持续修正。

### `src/games/smashup/domain/types.ts`

- main 侧新增 Munchkin 怪物登场、临时控制、放回公共牌库，以及计分前后选择上下文的类型合同。
- PR 侧新增“目标基地不能有己方行动牌”的出牌约束，并为基地能力、天赋和特殊能力透传目标基地/目标随从字段。
- 合并结果同时保留两类领域类型：Munchkin 事件合同和本 PR 的目标选择/出牌约束合同均存在。
- 文件级风险：单边覆盖会让另一条玩法链失去类型合同，表现为 Munchkin 怪物事件或哥布林/圆桌骑士目标选择无法安全接入。

## 验证

- 合并审计：
  - `node scripts/verify/merge-conflict-audit.mjs refs/remotes/origin/pr-119-merge`
  - 结果：5 个重叠文件全部为“混合结果”，完全等于父 1：0，完全等于父 2：0。
  - `--fail-on-single-side` 口径下无单边覆盖文件。
- 关键内容核对：
  - 合并结果包含 `munchkin_mages_blaster_master_discard_title`、`goblins_make_your_own_luck_ready`、`round_table_knights`。
  - 合并结果包含 `registerMunchkinElvesModifiers`、`registerMunchkinOrcsModifiers`、`registerGoblinsModifiers`、`registerRoundTableKnightsModifiers`。
  - 合并结果包含 `MunchkinMonsterPlayedEvent`、`MunchkinMonsterControlChangedEvent`、`MunchkinMonsterToDeckBottomEvent` 和 `requireNoOwnActionsOnBase`。
- PR 修复验证：语言包无缺失键，JSON 可解析，类型检查通过；哥布林/圆桌骑士相关 3 个测试文件共 29 条测试通过。
- `git diff --check`：无格式错误。

## 回归与行为变化登记

- 原 PR 目标：接入哥布林与圆桌骑士派系、正式化资源和文案命名，并完成对应能力实现。
- 合并额外保留：main 在 PR 创建后新增的 Munchkin 资源、交互提示、持续修正和怪物事件类型。
- 本次未发现新的业务回归；本文件只记录共享文件的双侧内容保留和合并门禁补记，不扩大 PR 的玩法范围。
