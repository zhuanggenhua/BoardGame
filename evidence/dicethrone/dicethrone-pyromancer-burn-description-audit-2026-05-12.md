# DiceThrone 火法 Burn 描述一致性审计（2026-05-12）

## 审计范围

- 对象：Pyromancer / Burn（`STATUS_IDS.BURN`）
- 链路：图片规则 -> 用户故事 -> i18n 文案 -> TokenDef -> 状态施加事件 -> reducer -> upkeep 结算 -> 测试口径
- 结论等级：已按图片主真相源收敛；验证命令见下方“验证记录”。

## 权威来源与裁决

| 来源 | 内容 | 结论 |
| --- | --- | --- |
| 图片主真相源：`public/assets/i18n/zh-CN/dicethrone/images/pyromancer/compressed/tip.webp` | “燃烧（负面效果，不可叠加）/ Does not stack”；“持续效果。有此标记的玩家在他的每个维持阶段受到2伤害。” | 主裁决：不叠加、固定 2、持续，不因 upkeep 自动移除 |
| 用户故事：`docs/user-stories/dicethrone/pyromancer-burn-image-standard-2026-05-12.md` | 图片优先于 Wiki；除非用户故事明确覆盖 | 本轮无覆盖图片的例外用户故事 |
| Dice Throne Wiki / Burn | Stack limit: 1；Upkeep 受到 2 点伤害；Persistent | 仅作对照；本轮不作为主标准 |

## 看图描述

我实际打开并查看了 `tip.webp`。图中 Burn 区块位于左上第一项：

- 图标是黄色圆形内的白色火焰。
- 标题为“燃烧”，副标题写“负面效果，不可叠加”，右侧英文写 “Does not stack”。
- 正文写“持续效果。有此标记的玩家在他的每个维持阶段受到2伤害。”

因此本轮按图片裁决：Burn 是一个不可叠加的持续负面状态，每个维持阶段固定造成 2 点伤害，不是“按层数造成伤害并移除 1 层”。

## 本轮发现的错误

| 链路 | 旧问题 | 本轮裁决 |
| --- | --- | --- |
| i18n 文案 | 曾写成“按层数伤害，然后移除 1 层” | 改为“不叠加，维持阶段固定 2 点伤害” |
| TokenDef | `stackLimit` 曾允许多层 Burn | 改为 `stackLimit: 1` |
| 自定义施加路径 | 部分 Pyromancer custom action 手写 `current + 1` | 改为通过 helper 按 Burn 上限计算 |
| reducer | `STATUS_APPLIED` 曾直接信任 payload `newTotal` | 改为按 `getTokenStackLimit` 二次钳制 |
| 旧脏状态 | 历史/测试注入 Burn=3 时仍可能显示多层 | upkeep 固定造成 2 点后将非法多层归一为 1 |
| 生命周期 | 只查了单次 upkeep，没有验证跨多个 upkeep 的持续性 | 已补跨多个自己 upkeep 的回归，确认不会自然消失 |
| 测试夹具 | Burn 快照曾保留 “Then remove this token” 旧口径 | 改为 Persistent / Does not stack / Upkeep 2 damage |

## 命中维度

- D1 语义保真：旧实现失败；本轮已按图片统一。
- D3 数据流闭环：旧实现失败；本轮 TokenDef、施加路径、reducer、upkeep、i18n、测试夹具统一。
- D12 写入-消耗对称：旧实现失败；本轮重复施加不能写出合法多层，旧脏多层会归一。
- D14 生命周期清理：Burn 不因 upkeep 自动移除；只有非法额外层会被归一清理。
- D15 UI 状态同步：旧文案与状态冲突；本轮玩家可见文案不再宣称按层数或自动移除。

## 修复文件

- `src/games/dicethrone/heroes/pyromancer/tokens.ts`
- `src/games/dicethrone/domain/customActions/pyromancer.ts`
- `src/games/dicethrone/domain/reducer.ts`
- `src/games/dicethrone/domain/flowHooks.ts`
- `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`
- `src/games/dicethrone/__tests__/pyromancer-tokens.test.ts`
- `src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts`
- `src/games/dicethrone/__tests__/token-execution.test.ts`
- `src/games/dicethrone/__tests__/shared-state-consistency.test.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`
- 对应 `e2e/src/games/dicethrone/**` 镜像文件

## 验证记录

- 已运行：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/pyromancer-tokens.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/shared-state-consistency.test.ts src/games/dicethrone/__tests__/pyromancer-behavior.test.ts --configLoader native --maxWorkers 1
```

- 结果：`5 passed / 157 tests passed`
- 备注：`e2e/src` 目录是镜像源码，不在当前 Vitest 默认 include 范围内，因此没有单独再跑到它；镜像内容已按同样口径同步。

## 为什么前一次没查出来

1. 只看了 Burn 在单次 upkeep 的伤害值，没把“持续效果”拆成“本轮结算”和“下一轮是否还在”两个独立验收点。
2. 误把 `passiveTrigger.removable` 当成生命周期语义，而没有先确认它在项目里实际只服务于净化/移除/转移路径。
3. 旧审计把“没有自动移除”与“不会自然消失”混在一起，没有补跨多个自己 upkeep 的回归。
4. 证据当时主要依赖描述和旧测试口径，没有用图片里的 “Does not stack” 反向审一遍状态层数是否可能自然掉到 0。
