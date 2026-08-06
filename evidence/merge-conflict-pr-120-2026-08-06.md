# 冲突解决汇报：PR #120（DIY 杀手与小丑）

## 1. 背景

- PR：`zhuanggenhua/BoardGame#120`
- base：`main@37b6b03a477c924cd53042125306e938a3dfb7c9`
- head：`codex/smashup-diy-killers-clowns-pr@279d50605a6a1c933ae46d60824f03f283830e95`
- 触发命令：`git merge origin/main --no-commit --no-ff`
- 目的：把 PR #120 的 DIY 杀手与小丑派系合入最新主线，同时保留主线已经合入的 PR #119 与其他规则补齐。

## 2. 冲突文件

- `public/assets/i18n/assets-manifest.json`
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `src/games/smashup/Board.tsx`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/reduce.ts`

## 3. 解决策略

### `public/assets/i18n/assets-manifest.json`

- 策略：按 JSON 键做语义合并，不整份接受任一侧。
- 合并要点：保留主线已有资源条目；补回 PR 侧独有的 23 个资源条目（包括胡鲁瓦瓦资源与 DiceThrone/The Gang 资源）；相同资源键以最新主线的资源哈希、大小和 MIME 信息为准。
- 原因：这是资源派生清单。主线已包含 PR #119 和其他最新资源更新，PR #120 还携带少量主线没有的资源；整份取一侧会静默丢资源或回退资源哈希。
- 文件级原因说明：不能直接保留 PR 侧，因为它缺少主线新增资源；也不能直接保留主线，因为 PR 侧独有条目会消失。最终结果保留双方独有内容，共享键不覆盖主线当前真实资源信息。

### `public/assets/i18n/zh-CN/smashup/assets-manifest.json`

- 策略：保留主线清单的条目与顺序；确认 PR 侧在该文件没有主线缺失的独有键，DIY 条目已在双方清单中一致存在。
- 原因：冲突来自生成清单的大块排序/插入位置，不是 DIY 资源缺失。采用主线生成结果不会丢 PR #120 的 DIY 资源。
- 文件级原因说明：该文件最终以主线内容为基线，是因为逐键比对确认 PR 侧没有独有条目；若误取 PR 侧，可能丢掉 Munchkin、哥布林、圆桌骑士及半场战争资源。最可能的错误不是丢 DIY，而是回退主线资源清单。

### `src/games/smashup/Board.tsx`

- 策略：合并双方代码块。
- 冲突块裁决：保留主线新增的 Munchkin 怪物击败交互处理；弃牌堆出牌提示统一使用主线已有的 `select_target_minion_hint`，保留 PR #120 的 DIY 相关 Board 改动。
- 原因：Munchkin 交互是主线已合入并由既有测试/规范覆盖的功能入口；`select_target_minion_hint` 明确表达“选择目标随从”，比旧的通用 `select_minion_hint` 更符合当前目标交互语义。
- 文件级原因说明：不能整份保留任一侧；整份保留 PR 侧会丢 Munchkin 交互入口，整份保留主线会丢 DIY 派系接线。若提示裁决错误，最可能出现的是玩家在弃牌堆行动随从流程中看到过时提示，而不是规则结算本身改变。

### `src/games/smashup/data/cards.ts`

- 策略：保留双方导入和注册。
- 合并要点：同时注册 DIY 杀手/小丑和主线半场战争派系。
- 原因：两侧是不同派系的独立注册入口，互不冲突；单边取舍会让其中一组派系从卡牌注册表消失。

### `src/games/smashup/domain/atlasCatalog.ts`

- 策略：保留双方图集目录条目。
- 合并要点：同时保留 DIY 图集与半场战争图集，沿用各自卡牌网格规格。
- 原因：两侧是不同资源的图集声明，属于互补内容；单边覆盖会造成对应卡牌找不到预览图。

### `src/games/smashup/domain/ids.ts`

- 策略：保留双方 ID 常量。
- 合并要点：同时保留 DIY 派系 ID 与半场战争派系 ID，保持已有字符串值不变。
- 原因：ID 是资源/注册/运行时引用的公开契约，不能因冲突整段覆盖。

### `src/games/smashup/domain/reduce.ts`

- 策略：合并事件载荷字段。
- 合并要点：保留 PR #120 的弃牌堆出牌来源与行动额度字段，同时保留主线的 `payloadDefId` 回退读取，使缺少卡牌实例时仍能从事件载荷恢复卡牌定义。
- 原因：两侧字段服务不同的运行时路径，均被后续逻辑使用；单边取值会丢弃一条状态归约契约。
- 文件级原因说明：这是核心状态归约文件，不能以任何一边整份覆盖。PR 侧的字段影响 DIY 弃牌堆能力，主线字段影响 Munchkin/事件回放兼容；误判会导致行动额度错误或事件无法恢复卡牌定义。

## 4. 风险与验证

- 风险点：资源清单合并后可能存在 JSON 格式、资源键遗漏或共享键哈希回退；`Board.tsx` 与 `reduce.ts` 可能出现类型/运行时契约不一致。
- 已执行：冲突标记扫描无命中；两个资源清单均可解析；`git diff --check` 通过。
- `npx tsc --noEmit --pretty false`：通过。
- SmashUp 定向测试 5 个文件：30 项全部通过。
- `npx eslint src/ --ext .ts,.tsx`（`NODE_OPTIONS=--max-old-space-size=8192`）：0 errors，1423 warnings；warning 为仓库现有基线问题。
- `npm run merge:audit -- HEAD`：混合结果 2、与两侧相同 21、完全等于父2 15、完全等于父1 0。
- `npm run merge:audit:strict -- HEAD`：按规则对 15 个父2一致文件返回非 0，已逐项解释如下；这不是未解释的单边覆盖。

### 单边覆盖审计解释

严格审计中的 15 个“完全等于父2”文件均为安全的主线等价保留，不是把 PR #120 的有效内容静默删掉：

- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`：逐键比对确认 PR 侧没有主线缺失的独有键，DIY 资源键在双方都存在；主线版本已包含 Munchkin、哥布林、圆桌骑士和半场战争资源。
- `public/locales/en/game-smashup.json`、`public/locales/zh-CN/game-smashup.json`：主线已经包含 DIY 杀手/小丑文案，并补充当前主线目标提示文案；没有发现 PR 侧独有的 DIY 文案被丢弃。
- `src/games/smashup/__tests__/Board.interactionBars.test.ts`：双方断言内容等价，主线版本只是保留了相同的弃牌堆交互合同。
- `src/games/smashup/abilities/index.ts`：主线版本同时保留 DIY 注册，并增加 Munchkin、哥布林、圆桌骑士、半场战争注册；PR 侧没有未迁移的 DIY 注册。
- `src/games/smashup/data/cards.ts`：主线版本保留 DIY 卡牌/基地注册，并补充主线派系；已用 `DIY_*` 注册项逐项核对。
- `src/games/smashup/domain/atlasCatalog.ts`、`src/games/smashup/domain/ids.ts`：主线版本保留 DIY 图集和 ID，同时补充主线新增派系；双方有效声明均在最终文件中。
- `src/games/smashup/domain/commands.ts`、`src/games/smashup/domain/index.ts`、`src/games/smashup/domain/reactionSession.ts`、`src/games/smashup/domain/reducer.ts`、`src/games/smashup/domain/types.ts`：主线版本已保留弃牌堆、DIY 合同和 PR 侧类型基础，并增加 Munchkin 等主线契约；定向测试覆盖了 DIY 弃牌堆入口。
- `src/games/smashup/domain/reduce.ts`：主线版本包含 PR 侧弃牌堆字段以及更多 Munchkin 状态事件；本次冲突块已特别保留 `discardPlaySourceId`、`consumesNormalLimit` 和 `payloadDefId` 三组字段。
- `src/games/smashup/ui/factionMeta.ts`：主线版本保留 DIY 杀手/小丑派系元数据，并补充主线派系元数据；DIY 开关和展示信息仍存在。

因此，严格审计的父2一致结果来自“主线已经等价吸收或包含 PR 内容”，而不是未审查的整份覆盖；真正存在双方不同有效内容的文件为 `public/assets/i18n/assets-manifest.json` 与 `src/games/smashup/Board.tsx`，两者均为混合结果。

## 5. 回归与行为变化登记

- 原 PR 目标问题：接入 DIY 杀手与小丑派系、资源、卡牌注册、弃牌堆入口和对应测试。
- 本次额外发现的真实回归：合并前发现 PR #120 与最新主线存在 7 个文件的内容冲突；本次未发现新的业务回归，已完成双边内容吸收。
- 仅业务口径/规则变化：本次没有新增业务规则；弃牌堆提示统一到当前已有的“选择目标随从”文案契约。

## 6. 结果

- 合并提交：`5cb4adb1`（`合并 PR #120 DIY 杀手与小丑并保留最新主线`）。
- fork 写权限核验：当前身份对 `deathcats4/BoardGame` 为 `push=false`，不能回写作者分支；PR 元数据中的 `maintainerCanModify=true` 不改变该事实。
- 推送目标：`zhuanggenhua/BoardGame:main`，采用已授权的直接落主线 fallback；推送后确认并关闭原 PR #120，不删除作者分支。
