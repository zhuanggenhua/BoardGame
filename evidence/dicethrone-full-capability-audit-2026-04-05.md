# DiceThrone 全角色能力 / 交互 / Token 总审计（2026-04-05）

## 审计范围

- 游戏：`dicethrone`
- 角色：`barbarian`、`gunslinger`、`monk`、`moon_elf`、`paladin`、`pyromancer`、`samurai`、`shadow_thief`
- 本轮覆盖对象：
  - 英雄级被动能力
  - `player.passiveAbilities`
  - `TokenDef.activeUse`
  - `TokenDef.passiveTrigger`
  - 复杂交互家族（`simple-choice` / `compare-roll-choice` / `dt:card-interaction` / `dt:bonus-dice` / `dt:token-response` / 非阻塞 settlement）
  - `evidence/` 现有文档覆盖度

## 权威来源

- 运行时注册表：
  - `src/games/dicethrone/domain/characters.ts`
  - `src/games/dicethrone/domain/sharedTokens.ts`
- 运行时消费链：
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/execute.ts`
  - `src/games/dicethrone/domain/executeTokens.ts`
- 复杂交互入口：
  - `src/games/dicethrone/domain/customActions/common.ts`
  - `src/games/dicethrone/domain/customActions/*.ts`
- 既有专项证据：
  - `evidence/dicethrone-passive-ability-audit-2026-04-05.md`
  - `evidence/dicethrone-other-ability-interaction-audit-2026-04-05.md`
  - `evidence/dicethrone-special-interaction-ui-reaudit-2026-04-05.md`
  - `evidence/dicethrone-compare-roll-e2e-test.md`

## 审计方法

1. 直接读取 `CHARACTER_DATA_MAP`，枚举 8 个角色的被动能力、`activeUse`、`passiveTrigger`。
2. 扫描 `customActions/*.ts`，归类所有会打开结构化交互或特殊结算 UI 的入口。
3. 反查 `evidence/` 中已有 DiceThrone 文档，识别“已有专项文档”和“只有测试、没有角色级 evidence”的对象。
4. 跑覆盖 8 个角色的审计 / 能力 / token / 行为测试，避免把静态枚举误当运行时事实。
5. 把本轮结论回填为单一总审计文档，避免继续只靠零散旧文档拼接口径。

## 总量结论

- 英雄级 / 玩家级被动共 `3` 条：
  - `quick-draw`
  - `bushido`
  - `tithes`
- `TokenDef.activeUse` 共 `14` 条。
- `TokenDef.passiveTrigger` 共 `13` 条。
- 当前 DiceThrone 运行时复杂交互不是“只有一个复杂能力”，而是至少 `6` 个家族：
  - `simple-choice`
  - `compare-roll-choice`
  - `dt:card-interaction`
  - `dt:bonus-dice`
  - `dt:token-response`
  - 非阻塞 `display-only settlement`

## 复杂交互家族审计

| 家族 | 运行时入口 | 主要承载对象 | 结论 |
|---|---|---|---|
| `simple-choice` | `CHOICE_REQUESTED` -> `systems.ts` | 僧侣、炎术士、部分 flow hook 选择 | 仍是当前主链，没有发现需要新拆类型却仍硬塞进去的第二个 compare-roll 级缺口 |
| `compare-roll-choice` | `COMPARE_ROLL_REQUESTED` -> `systems.ts` | 枪手 `Duel / Showdown` | 本轮已补齐正式交互模型与 E2E 证据 |
| `dt:card-interaction` | `INTERACTION_REQUESTED` -> `systems.ts` | 通用改骰 / 选状态 / 选目标，圣骑士、暗影刺客、枪手、武士 | 仍是最大共享交互壳，当前没有扫出第二种必须独立拆壳的新类型 |
| `dt:bonus-dice` | `BONUS_DICE_REROLL_REQUESTED` | 武士、炎术士、通用奖励骰链 | 仍走统一 bonus-dice 结算链 |
| `dt:token-response` | 伤害链自动生成 `TOKEN_RESPONSE_REQUESTED` | 护盾、防御 token、进攻强化 token | 仍是 token 响应主链 |
| `display-only settlement` | `createDisplayOnlySettlement()` | 狂战士、月精灵、枪手、武士等额外骰子展示 | 属于结构化过程帧，不阻塞流程，但确实是特殊结算家族，不应混成普通日志文本 |

## 全角色矩阵

| 角色 | 被动能力 | `activeUse` token | `passiveTrigger` token | 复杂交互 / 复杂结算 | 既有角色级 evidence（本轮前） | 本轮审计结论 |
|---|---|---|---|---|---|---|
| `barbarian` | 无英雄级被动 | 无 | `concussion`、`daze` | `display-only settlement` | 无 | 没有“无文档就没审”的理由；之前只是缺角色级 evidence 文件名，本轮补进总审计 |
| `gunslinger` | `quick-draw` | `evasive`、`loaded` | `knockdown`、`bounty` | `compare-roll-choice`、`dt:card-interaction`、`display-only settlement` | 有，多份枪手 / 枪手-武士专项文档 | 已有专项文档最多；本轮确认它不是全游戏唯一复杂交互角色 |
| `monk` | 无英雄级被动 | `taiji`、`evasive`、`purify` | `knockdown` | `simple-choice` | 无 | 之前缺角色级 evidence，不等于缺运行时能力；本轮补进总审计 |
| `moon_elf` | 无英雄级被动 | `evasive` | `blinded`、`entangle`、`targeted` | `display-only settlement` | 无 | 之前缺角色级 evidence；本轮补进总审计，并继续以本地 `evasive activeUse` 为准 |
| `paladin` | `tithes`（`player.passiveAbilities`） | `crit`、`accuracy`、`protect`、`retribution` | `blessing_of_divinity` | `dt:card-interaction`、`dt:token-response` | 仅 `blessing` 单项专项文档 | 不是只有 Blessing；本轮把 `tithes` / 其余 token 一并纳入总审计 |
| `pyromancer` | 无英雄级被动 | 无 | `burn`、`knockdown`、`daze` | `simple-choice`、`dt:bonus-dice` | 无 | 之前缺角色级 evidence；本轮补进总审计 |
| `samurai` | `bushido` | `honor`、`shame`、`samurai_retribution` | 无 | `dt:card-interaction`、`dt:bonus-dice`、`display-only settlement` | 有，多份武士专项文档 | 已有专项较多；本轮确认它也不是全游戏唯一复杂交互角色 |
| `shadow_thief` | 无英雄级被动 | `sneak_attack` | `poison` | `dt:card-interaction`、`dt:token-response` | 无 | 之前缺角色级 evidence；本轮补进总审计 |

## 文档覆盖结论

### 1. 之前不是“所有角色都有对应 evidence”

- 本轮前，按角色名可直接命中的 DiceThrone evidence 主要集中在：
  - `gunslinger`
  - `samurai`
  - `paladin`（且只有 blessing 单点）
- 本轮前，以下 `5` 个角色没有直接对应的角色级 evidence 文件名：
  - `barbarian`
  - `monk`
  - `moon_elf`
  - `pyromancer`
  - `shadow_thief`

### 2. 这不代表它们没有能力或没有测试

- 上述 5 个角色在仓库内都已有能力 / token / 行为测试。
- 问题在于证据分散在测试文件和零散缺陷修复文档里，缺一份能直接回答“这个角色有哪些 runtime 能力入口、现在是否有效”的正式审计文档。

### 3. 本文档的作用

- 本文档是 DiceThrone 全角色能力 / token / 复杂交互的统一审计入口。
- 之后如果要对外说“DiceThrone 全角色能力已审过”，应以本文档加专项补充文档为准，不应只引用枪手 / 武士的旧专项。

## 运行时裁决

### 1. 不是只有一个被动

- 当前 runtime 主链的被动能力是：
  - `quick-draw`
  - `bushido`
  - `tithes`
- 当前 runtime 主链的 token 被动不是少数例外，而是 `13` 条 `passiveTrigger`。

### 2. 不是只有一个复杂能力

- 枪手的 `compare-roll-choice` 只是本轮最显眼的新交互。
- 但全局还存在 `simple-choice`、`dt:card-interaction`、`dt:bonus-dice`、`dt:token-response`、`display-only settlement` 等其它复杂家族。
- 结论应是“compare-roll 是新增独立家族”，不是“DiceThrone 只有 compare-roll 这一类复杂能力”。

### 3. token 不是边角料

- `activeUse` `14` 条，覆盖：
  - 枪手
  - 僧侣
  - 月精灵
  - 圣骑士
  - 武士
  - 暗影刺客
- `passiveTrigger` `13` 条，覆盖：
  - 狂战士
  - 枪手
  - 僧侣
  - 月精灵
  - 圣骑士
  - 炎术士
  - 暗影刺客

### 4. 历史残留裁决

- `TITHES_UPGRADED`：
  - 仍保留在 token 定义里，但当前不驱动 runtime 被动执行
  - 真正生效的是升级后的 `player.passiveAbilities.tithes`
- 共享 `EVASIVE`：
  - 已从 `sharedTokens.ts` 删除
  - 当前应统一按各英雄本地 `activeUse` 理解

## 已运行验证

### 第一轮：全量入口审计 / token / 交叉角色

1. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts src/games/dicethrone/__tests__/passive-reroll-validation.test.ts src/games/dicethrone/__tests__/shared-state-consistency.test.ts src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/cross-hero.test.ts src/games/dicethrone/__tests__/barbarian-tokens.test.ts src/games/dicethrone/__tests__/monk-abilities.test.ts src/games/dicethrone/__tests__/moon-elf-abilities.test.ts src/games/dicethrone/__tests__/paladin-tokens.test.ts src/games/dicethrone/__tests__/pyromancer-tokens.test.ts src/games/dicethrone/__tests__/shadow-thief-tokens.test.ts --configLoader native`
   - 默认配置实际执行并通过 `10` 个文件、`224` 条测试
   - `ability-customaction-audit.test.ts` 因默认配置不纳入，需要独立用 audit 配置补跑

### 第二轮：audit 专用配置

2. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native`
   - `30` 条通过

### 第三轮：角色能力 / 行为补强

3. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/barbarian-abilities.test.ts src/games/dicethrone/__tests__/paladin-abilities.test.ts src/games/dicethrone/__tests__/pyromancer-abilities.test.ts src/games/dicethrone/__tests__/shadow-thief-abilities.test.ts src/games/dicethrone/__tests__/monk-behavior.test.ts src/games/dicethrone/__tests__/moon_elf-behavior.test.ts src/games/dicethrone/__tests__/paladin-behavior.test.ts src/games/dicethrone/__tests__/pyromancer-behavior.test.ts src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts --configLoader native`
   - `9` 个文件、`251` 条通过

### 汇总

- 本轮实际通过：
  - `20` 个测试文件
  - `505` 条测试

## 命中的审计维度

- `D3` 数据流闭环：全角色被动 / token / 交互入口都按“定义 -> 注册 -> 执行 / 交互 -> 证据”复核
- `D8` 时序正确：继续确认 `quick-draw`、`bushido`、upkeep 类 token 与响应窗口链时序
- `D12` 写入-消费对称：`tithes`、token 响应、compare-roll、bonus-dice 均有对应消费链
- `D28` 白名单 / 注册完整性：`ability-customaction-audit.test.ts` 继续作为 custom action 注册门禁
- `D33` 跨实体同类路径一致性：统一确认 8 角色的 token / 交互家族落点，不再把枪手个案当全局唯一
- `D49` 证据可复查性：把原先没有角色级 evidence 的 5 个角色统一补进正式审计文档

## 审计结论

- DiceThrone 不是“只有一个被动、只有一个复杂能力、只有两个角色有文档”。
- 当前 runtime 主链里：
  - 被动能力有 `3` 条
  - `activeUse` token 有 `14` 条
  - `passiveTrigger` token 有 `13` 条
  - 复杂交互 / 特殊结算有 `6` 个家族
- 原先 evidence 覆盖确实偏向枪手 / 武士 / 个别圣骑士问题，`barbarian / monk / moon_elf / pyromancer / shadow_thief` 缺角色级 evidence。
- 本文档已经把这 `5` 个角色补进正式审计范围；以后不应再说“这些角色没有文档”。

## 未覆盖风险

1. 本轮是“全角色 runtime 能力 / token / 复杂交互 / 证据覆盖审计”，不是“每张牌、每个 UI 过程帧的全量 E2E 重跑”。
2. 现有 DiceThrone evidence 总数很多（本轮盘点到 `96` 份相关文档），但不少是问题单、E2E 单点或历史调查，仍存在“文档多但入口散”的阅读成本；本文档负责收口入口，不替代所有旧专项。
3. `gunslinger` / `samurai` 没有按角色名命名的单元测试文件，但其能力和交互并非无测试，而是主要落在 `cross-hero.test.ts` 与专项 E2E / 审计文档中。

## 修订记录

- 2026-04-05：
  - 首次把 8 个角色的被动 / token / 复杂交互 / evidence 覆盖放进单一总审计文档
  - 明确记录此前缺角色级 evidence 的 5 个角色
  - 以 `20` 个测试文件、`505` 条测试为本轮运行验证基线
