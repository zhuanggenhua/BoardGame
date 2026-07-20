# 召唤师战争灰烬派系重录入与审计复盘（2026-07-20）

## 结论

- 本轮不是单点错误。抽样命中 `玛达莉雅女王`、`炫目光芒` 后，继续全量核对又发现英雄/士兵牌组符号和事件阶段存在多处错误。
- 继续复核召唤师正文后，又发现 `召集护卫` 是机制级录入错误：图上是“指定场上友方士兵为目标并放置到本单位相邻区格”，旧实现/文案/E2E 锁成了“从手牌召唤士兵”。
- 已按主真相源图片重新核对并修正灰烬静态配置：`src/games/summonerwars/config/factions/huijin.ts`。
- 已补灰烬静态和机制测试：召唤师数值、单位符号、事件阶段、事件符号、`召集护卫` 场上目标移动链一起断言，不再只测旧错字段。
- 旧审计不是“没审计”，而是审计方式失效：旧证据把错误字段写成 `passed`，测试也把错误字段当期望值。

## 真相源

| 类型 | 路径 | 覆盖对象 | 结论 |
| --- | --- | --- | --- |
| 召唤师完整图 | `public/assets/i18n/zh-CN/summonerwars/hero/huijin/hero.png` | 玛达莉雅女王名称、生命、攻击力量、攻击类型、技能 | 可读 |
| 卡牌图集 | `public/assets/i18n/zh-CN/summonerwars/hero/huijin/cards.jpg` | 3 英雄、4 士兵、4 事件、空槽 | 可读 |
| 临时核对裁图 | `temp/huijin-reintake-crops/slot-00.png` 至 `slot-15.png` | 单槽读图 | 中间产物，不进正式资源链 |
| 临时召唤师放大图 | `temp/huijin-reintake-crops/hero-upscaled.png` | 召唤师读图 | 中间产物，不进正式资源链 |

## 全量字段核对

| 对象 | 图上字段 | 旧代码字段 | 本轮修正 | 状态 |
| --- | --- | --- | --- | --- |
| 玛达莉雅女王 | 攻击力量 4；生命 9；远程 | 攻击力量 3；生命 14 | 攻击力量 4；生命 9 | 已修正 |
| 赫丽丝 | 费用 5；生命 7；攻击力量 3；远程；火焰符号 | 匹配 | 无改动 | 通过 |
| 火焰龙兽 | 费用 8；生命 10；攻击力量 4；远程；火焰 + 凤凰符号 | 只有凤凰符号 | 火焰 + 凤凰符号 | 已修正 |
| 风妮莎 | 费用 5；生命 9；攻击力量 3；近战；凤凰符号 | 火焰 + 凤凰符号 | 凤凰符号 | 已修正 |
| 灰烬法师 | 费用 1；生命 2；攻击力量 2；远程；凤凰符号 | 火焰符号 | 凤凰符号 | 已修正 |
| 皇家卫士 | 费用 2；生命 4；攻击力量 1；近战；凤凰符号 | 匹配 | 无改动 | 通过 |
| 灰烬野兽 | 费用 2；生命 3；攻击力量 3；近战；火焰符号 | 匹配 | 无改动 | 通过 |
| 灰烬弓箭手 | 费用 1；生命 2；攻击力量 2；远程；凤凰符号 | 匹配 | 无改动 | 通过 |
| 炫目光芒 | 普通事件；魔力阶段；费用 1；凤凰符号；持续 | 召唤阶段；火焰符号 | 魔力阶段；凤凰符号 | 已修正 |
| 灼烧 | 普通事件；移动阶段；费用 0；火焰符号 | 召唤阶段；火焰符号 | 移动阶段；火焰符号 | 已修正 |
| 神族复仇 | 普通事件；魔力阶段；费用 0；火焰 + 凤凰符号；持续 | 召唤阶段；火焰 + 凤凰符号 | 魔力阶段；火焰 + 凤凰符号 | 已修正 |
| 凤凰之魂 | 传奇事件；召唤阶段；费用 0；无牌组符号；持续 | 匹配 | 无改动 | 通过 |
| slot 11-15 | 黑色空槽 | 未录入卡牌 | 无改动 | 通过 |

## 机制正文重审

| 对象 | 图上原文/含义 | 旧实现/文案 | 本轮修正 | 状态 |
| --- | --- | --- | --- | --- |
| 召集护卫 | 攻击阶段结束时，可消耗 1 点充能指定一个友方士兵为目标；将目标放置到本单位相邻区格 | 文案写成“将手牌中的一个友方士兵放置到相邻空区格”；系统交互先选手牌卡；执行器发 `UNIT_SUMMONED` 并从手牌移除 | 改为先选择场上友方士兵，再选择召唤师相邻空格；执行器扣 1 充能并移动该场上单位，不再从手牌召唤 | 已修正 |

## 旧审计为什么失效

| 失效点 | 现实含义 | 证据 | 影响 |
| --- | --- | --- | --- |
| 审计把错误字段写成通过 | 旧审计没有逐格把图片字段和代码字段并排比对 | `evidence/summonerwars/summonerwars-huijin-intake-2026-07-16.md` 把 `炫目光芒` 写成召唤阶段并标 `passed` | 审计结果反而固化错误 |
| 测试期望来自旧代码/旧录入 | 测试不是独立真相源，只是在重复错字段 | `src/games/summonerwars/__tests__/abilities-huijin.test.ts` 旧静态断言把 `炫目光芒`、`灼烧`、`神族复仇` 都写成召唤阶段 | 测试通过不能证明录入正确 |
| 召唤师基础字段漏审 | 只测了名字/图集，没有测攻击力量和生命 | `src/games/summonerwars/__tests__/factions.test.ts` 旧灰烬入口测试只断言召唤师名字和图集 | `玛达莉雅女王` 4/9 被漏掉 |
| 牌组符号未纳入合同断言 | 符号影响组牌合法性，但旧静态测试没测 | 旧 `abilities-huijin.test.ts` 单位/事件字段映射没有 `deckSymbols` | 火焰龙兽、风妮莎、灰烬法师、炫目光芒符号错未被发现 |
| 事件阶段未逐 slot 核对 | 多张事件阶段全部按召唤阶段录入 | slot 7/8/9 图上分别是魔力/移动/魔力阶段 | 直接导致阶段打出校验拦截正常玩法 |
| 机制正文未按原子子句拆解 | 把“指定友方士兵为目标”误读成“选择手牌士兵” | 旧 `systems.ts`、`executors/huijin.ts`、i18n、E2E 都围绕手牌选择和 `UNIT_SUMMONED` | 召集护卫整条交互链、执行器、UI 文案、测试都要重写，说明旧审计没有真正核正文语义 |

## 审计是否要重构

需要，但不是先做一个大而泛的“审计系统重写”。这里暴露的是召唤师战争派系录入审计模板的问题，优先做局部重构：

1. 录入合同必须固定为 `图上字段 / 代码字段 / 测试断言 / 结论` 四列并排。
2. 召唤师必须进入静态字段合同，至少包含名称、攻击力量、生命、攻击类型、技能、符号、图集。
3. 单位和事件必须测 `deckSymbols`，因为这是可玩性字段，不是展示字段。
4. 事件必须测 `playPhase`，且至少补一个真实 `PLAY_EVENT` 校验链测试覆盖阶段可打/不可打。
5. 技能正文必须拆成原子子句：触发时机、成本、目标来源、目标限制、落点限制、状态变化、跳过结果。尤其要把“场上目标”和“手牌卡牌”作为不同目标来源列出。
6. evidence 里禁止只写 `passed`，必须写被核对的原始字段；否则 `passed` 不能作为审计证据。

## 是否需要重新审计

- 灰烬派系：需要，且本轮已经进入重审/重录流程。
- 其它召唤师战争派系：建议按同一字段矩阵做风险抽样，优先抽最近新增、使用同一 intake 流程、事件阶段多、牌组符号复杂的派系；如果抽样再命中新错误，再扩大到对应派系全量重审。
- 别的游戏：本轮没有纳入目标，不建议因为灰烬问题直接扩大到其它游戏。

## 本轮修正落点

| 文件 | 作用 |
| --- | --- |
| `src/games/summonerwars/config/factions/huijin.ts` | 修正灰烬静态录入字段 |
| `src/games/summonerwars/domain/abilities-huijin.ts` | 修正召集护卫校验：目标必须是场上友方士兵，落点必须是召唤师相邻空格 |
| `src/games/summonerwars/domain/executors/huijin.ts` | 修正召集护卫执行：扣充能并移动场上士兵，不再从手牌召唤 |
| `src/games/summonerwars/domain/systems.ts` | 修正召集护卫二段交互：场上士兵选择 -> 相邻空格选择 |
| `src/games/summonerwars/domain/execute.ts` | 修正阶段结束触发条件：检查场上友方士兵，而不是手牌士兵 |
| `src/games/summonerwars/domain/reduce.ts` | 让召集护卫的放置移动不消耗普通移动次数 |
| `src/games/summonerwars/ui/systemInteractionAdapter.ts`、`src/games/summonerwars/ui/statusBannerText.ts`、`src/games/summonerwars/Board.tsx` | UI 路由从卡牌选择器改为棋盘单位选择，并同步提示文案 |
| `public/locales/zh-CN/game-summonerwars.json`、`public/locales/en/game-summonerwars.json` | 修正文案，不再写“从手牌召唤” |
| `src/games/summonerwars/__tests__/abilities-huijin.test.ts` | 补灰烬静态合同断言、炫目光芒阶段校验、召集护卫场上移动链 |
| `src/games/summonerwars/__tests__/factions.test.ts` | 补灰烬牌组入口中的召唤师 4/9 断言 |
| `src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts` | 补召集护卫真实阶段结束交互：选择场上友方士兵、跳过不移动 |
| `src/games/summonerwars/__tests__/useGameEvents.test.ts` | 补 UI 路由矩阵：召集护卫第一步是棋盘单位选择，不是卡牌选择器 |
| `e2e/summonerwars/summonerwars-huijin-abilities.e2e.ts` | 同步真实入口 E2E 用例语义：选择场上友方士兵并放置 |

## 已跑验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-huijin.test.ts src/games/summonerwars/__tests__/factions.test.ts --configLoader native` | 2 files passed；43 tests passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts -t "huijin_call_guards" --configLoader native` | 1 file passed；2 tests passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native` | 1 file passed；36 tests passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-huijin.test.ts src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native --testNamePattern "huijin\|灰烬\|huijin_call_guards\|炫目光芒\|灼烧\|summoner"` | 3 files passed；1 file skipped；33 tests passed；193 tests skipped |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars-huijin-abilities.e2e.ts "召集护卫：阶段结束后选择场上友方士兵并放置到相邻空格"` | 1 passed；真实入口完成：结束攻击阶段 -> 选择场上友方士兵 -> 选择召唤师相邻空格 -> 单位移动并扣 1 充能 |

## 当前归档判断

- 灰烬派系本轮可归档：静态录入错误、召集护卫机制错误、测试期望错误和真实入口 E2E 都已收口。
- 不应把旧 `evidence/summonerwars/summonerwars-huijin-intake-2026-07-16.md` 当作正确 evidence；它现在只作为旧审计失效证据保留。
- 本轮没有处理其它游戏，也没有扩大到其它召唤师战争派系。
