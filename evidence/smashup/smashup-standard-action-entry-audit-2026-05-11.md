# SmashUp standard action 入口语义部分重审（2026-05-11）

## 背景

`sharks_air_jaws` 暴露的问题不是单卡特例，而是通用审计缺口：规则/卡牌描述里的动作链第一用户选择对象，必须与 UI 入口字段、command payload、validator、resolver/handler 消费字段一致。旧审计只覆盖注册、targetType、ongoingTarget、时机和部分行为链，未强制核对“玩家第一下应该点什么”。

## 通用规范变更

- 变更文件：`.spec/knowledge/standards/testing-audit.md`
- 新增维度：**交互入口语义必须审计（强制）**。
- 适用范围：所有规则、卡牌、技能、按钮描述中包含“选择 / 移动 / 打出到 / 从...到... / 另一个 / 你的 / 敌方 / 任意 / 至多 / 可以 / 然后 / choose / move / target”等动作链的对象。
- 审计要求：拆出第一用户选择对象，核对 UI 入口、command payload、validator、resolver/handler 消费字段是否同一语义；后续目标不能误当前置入口；后续选择必须携带前置上下文。
- 约束：这是通用维度，不按 `sharks_air_jaws`、飞鲨或任意单卡写特例。

## 本轮重审范围

- 游戏：Smash Up / 大杀四方。
- 对象：所有 `subtype === 'standard'` 的 action card。
- 重审链路：`zh-CN effectText -> 动作链第一入口推断 -> playNeedsBase/playNeedsMinion -> PLAY_ACTION 入口语义`。
- 自动审计位置：`src/games/smashup/__tests__/abilityBehaviorAudit.test.ts`。

## 自动审计规则

新增测试：`standard 行动卡的直接入口字段必须匹配描述动作链的第一选择对象`。

检查内容：

1. 对 standard action 读取 zh-CN `effectText`，做通用文本规整（空白、仆从/随从、战斗力/力量）。
2. 用通用动作链模式推断第一入口对象：`base` 或 `minion`。
3. 用 `actionLikeNeedsPlayBase()` / `actionLikeNeedsPlayMinion()` 读取实际声明入口。
4. 若同时声明 `playNeedsBase` 和 `playNeedsMinion`，直接视为 UI 第一入口双重真相。
5. 若描述入口和字段入口不一致，输出卡牌 id、中文名、字段值和 effectText。
6. 为防空跑，测试断言本轮审计覆盖数量必须大于 20，且必须同时覆盖 `base` 与 `minion` 两类入口。

## 发现与处理

### 真实问题：`sharks_air_jaws`

- 文案语义：先选择“你的一个仆从”，移动到“另一个基地”，再消灭那里 3- 仆从。
- 旧字段：`playNeedsBase: true`。
- 错误后果：Board 把行动卡识别为“先选择基地”的入口。
- 修复：
  - `src/games/smashup/data/factions/sharks.ts`：改为 `playNeedsMinion: true`。
  - `src/games/smashup/abilities/sharks.ts`：先消费 `targetMinionUid` / 随从 prompt，再弹目标基地 prompt，随后移动并消灭目标基地低战力随从。
  - `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`：补真实 PLAY_ACTION 入口回归。

### 启发式收窄：`princesses_tale_as_old_as_time`

初版通用规则把“选择一个基地并将你的所有仆从移动到那里”误判成随从入口。处理方式不是加卡名白名单，而是收窄通用正则：`选择...随从` 不跨过“基地”词，确保“选择基地并移动随从到那里”仍判为基地入口。

## 验证记录

- `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "standard 行动卡的直接入口字段"` → 1 passed。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts -t "飞鲨"` → 1 passed。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → 11 passed。
- `npx eslint src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/abilities/sharks.ts src/games/smashup/data/factions/sharks.ts` → 0 errors。

## 结论

- 本轮已新增通用审计维度，并把 SmashUp standard action 入口字段重审落成可执行审计测试。
- 本轮不是“所有游戏全量重审”，结论只覆盖 SmashUp standard action 的 `effectText -> playNeedsBase/playNeedsMinion` 直接入口契约。
- 飞鲨旧审计结论已在 `evidence/smashup/smashup-shayu-faction-audit.md` 回写为曾失效并已修复。

## 剩余风险

1. 当前自动规则只覆盖可由文案首段稳定推断为 `base` / `minion` 的 standard action；玩家、手牌、弃牌堆、牌库、资源、格子等其他入口类型需要后续按同一通用维度扩展，不应写成游戏/单卡特例。
2. 当前验证是静态审计 + 领域行为回归，没有新增浏览器 E2E 截图；不得把本轮验证冒充 L3 E2E。
3. 全量 `abilityBehaviorAudit` 已知还有其他历史失败项，本轮没有把这些既有失败纳入修复范围；本轮只验证新增入口语义审计用例。
