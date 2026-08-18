# DiceThrone AI 目标授予语义修复（2026-08-18）

## 原始症状

- 用户反馈：AI 会把“飞行”这类正面效果给敌方玩家，属于资敌行为。
- 用户进一步指出：这不应当只修某个角色或某张牌，而应修 AI 逻辑和 tag / 语义系统。

## 结论

- 本轮判定为 **AI 交互语义消费缺陷**，不是炽天使单卡规则缺陷。
- 现实机制：DiceThrone 已有 `AiHint` 与本地 AI 评分器，能按“正面效果给己方、负面效果给敌方”评分；但旧 `simple-choice` 选项没有统一表达“这个选项实际作用到哪个玩家、会授予什么 token/status”。缺语义时，AI 只能退回普通选项排序或局部猜测，可能选到敌人。
- 之前只识别炽天使 `customId` 的做法只能止血，不能覆盖后续任意“给玩家正面效果”的选择。

## 修复范围

- `src/games/dicethrone/domain/events.ts`
  - `CHOICE_REQUESTED.options` 增加 `targetPlayerId`、`tokenGrantConfig(s)`、`statusGrantConfig(s)`。
  - 这些字段只描述交互语义，不替代规则结算输入。
- `src/games/dicethrone/domain/systems.ts`
  - 旧 `CHOICE_REQUESTED -> simple-choice` 适配器透传这些语义字段。
- `src/games/dicethrone/ai.ts`
  - 新增通用 grant-hint 生成逻辑。
  - `simple-choice` 与 `dt:card-interaction` 复用同一套目标授予评分语义。
  - 删除炽天使神圣裁决的 `customId` 专用 AI 特判，不再从 label / 牌名猜目标收益。
- `src/games/dicethrone/domain/customActions/tianshi.ts`
  - 炽天使神圣裁决三段选择写入真实目标玩家和效果语义：
    - 眩光：目标玩家获得 `dazzle`
    - 飞行：目标玩家获得 `flight`
    - 净化：目标玩家获得 `purify`

## 验证

- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\basic-commands-coverage.test.ts --configLoader native`
  - 137 passed
  - 新增通用用例：`simple-choice 的目标授予语义会让 AI 把正面 token 给自己而不是敌人`
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\tianshi-behavior.test.ts --configLoader native`
  - 54 passed
  - 保留真实炽天使链路：AI 处理神圣裁决飞行选择时选自己，并断言选项携带 `targetPlayerId` 与 `tokenGrantConfig`
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\ai-main-phase-turn-gating.test.ts --configLoader native`
  - 10 passed
- `node scripts\infra\vitest-cli-safe.mjs run src\engine\ai\__tests__\decisionSemantics.test.ts src\engine\ai\__tests__\interactionSemantics.test.ts --configLoader native`
  - 13 passed
- `npm run typecheck`
  - passed
- `git diff --check -- <本轮 DiceThrone 改动文件>`
  - passed，仅有 CRLF 提示

## 同类扩审

- 覆盖到两类入口：
  - 旧 `simple-choice`：以后只要选项提供 `targetPlayerId + tokenGrantConfig/statusGrantConfig`，AI 就能按正负效果评分。
  - `dt:card-interaction` 的 `selectPlayer`：继续消费 `tokenGrantConfig(s) / statusGrantConfig(s)`，并与 `simple-choice` 共享同一 hint 生成器。
- 未做全角色逐牌审计。本轮只消除“目标授予语义无法被 AI 通用读取”的共享消费缺口；没有为所有旧 choice 回填语义字段。

## 漏审复盘

- 旧测试覆盖了部分 `dt:card-interaction` 增益选人，但没有覆盖 `CHOICE_REQUESTED -> simple-choice` 这种“选项值是玩家索引、真实效果在后续 handler 里结算”的旧链路。
- 旧实现存在从 `customId` / 文案参数推断收益的倾向，这违反“AI 合法动作和评分应消费交互语义，不从 UI 文案猜”的规范口径。
- 本轮新增的通用 simple-choice 用例用于防止再次退回单卡特判。
