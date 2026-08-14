# DiceThrone 被动能力专项审计（2026-04-05）

## 审计范围

- 游戏：`dicethrone`
- 目标：核对当前仓库内所有已实现的 DiceThrone 被动能力入口，确认是否存在“只定义、不生效”或“定义与执行链断开”的情况。
- 本轮覆盖入口：
  - 英雄级被动能力
  - `TokenDef.passiveTrigger`
  - 共享流程中的被动专门分支
  - 被动升级卡替换链路
- 本轮重点文件：
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/domain/passiveAbility.ts`
  - `src/games/dicethrone/domain/reduceCards.ts`
  - `src/games/dicethrone/heroes/**/abilities.ts`
  - `src/games/dicethrone/heroes/**/tokens.ts`
  - `src/games/dicethrone/domain/sharedTokens.ts`

## 权威来源

- 运行时真实实现：
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/reduceCards.ts`
- 被动定义来源：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts`
  - `src/games/dicethrone/heroes/samurai/abilities.ts`
  - `src/games/dicethrone/heroes/paladin/abilities.ts`
  - `src/games/dicethrone/heroes/**/tokens.ts`
  - `src/games/dicethrone/domain/sharedTokens.ts`
- 审计规范：
  - `.spec/knowledge/standards/testing-audit.md`

## 审计方法

1. 枚举所有 `type: 'passive'` 英雄能力。
2. 枚举所有 `TokenDef.passiveTrigger`。
3. 逐项反查是否存在真实消费链路：
   - `flowHooks.ts` 阶段钩子
   - `systems.ts afterEvents`
   - `effects.ts -> createDamageCalculation -> passiveTriggerHandler`
   - 其他专门分支
4. 对“只有定义或契约测试，没有执行证明”的入口补最小执行级回归。
5. 把每个入口归类为：
   - 已执行级证明
   - 通过共享链代表性证明
   - 非运行时入口 / 历史元数据

## 逐项结论

| 对象 | 定义入口 | 运行时入口 | 结论 | 证据 |
|---|---|---|---|---|
| `quick-draw` | `heroes/gunslinger/abilities.ts` | `flowHooks.ts` upkeep `phaseStart` 被动执行 | 已执行级证明 | `cross-hero.test.ts`：`gunslinger initializes with duel defense ability`；首回合 `loaded=1` |
| `bushido` | `heroes/samurai/abilities.ts` | `flowHooks.ts` upkeep / 回合末专门分支 | 已执行级证明 | `cross-hero.test.ts`：`bushido grants 1 honor...`、`bushido does not grant extra honor...` |
| `tithes` I | `heroes/paladin/abilities.ts` | `passiveAbility.ts` 可用性校验 + `USE_PASSIVE_ABILITY` 执行 | 通过共享链代表性证明 | `passive-reroll-validation.test.ts` 13 条通过 |
| `tithes` II | `heroes/paladin/abilities.ts` | `reduceCards.ts` 升级替换 + `systems.ts` 监听 `ABILITY_ACTIVATED` | 已执行级证明 | 本轮新增 `cross-hero.test.ts`：`tithes II 在激活包含 pray 面的技能时额外获得 1 CP` |
| `knockdown` | `domain/sharedTokens.ts` | `flowHooks.ts` 进攻阶段前移除 / 跳过 | 通过共享链代表性证明 | `flow.test.ts`、`multi-turn.test.ts`、`rule-consistency.test.ts` |
| `concussion` | `heroes/barbarian/tokens.ts` | `flowHooks.ts` income 跳过 | 已执行级证明 | `token-execution.test.ts`、`shared-state-consistency.test.ts` |
| `daze` | `domain/sharedTokens.ts` | `flowHooks.ts` 攻击结束额外攻击 | 已执行级证明 | `token-execution.test.ts`、`daze-extra-attack-simple.test.ts`、`interaction-chain-conditional.test.ts` |
| `burn` | `heroes/pyromancer/tokens.ts` | `flowHooks.ts` upkeep 固定 2 伤害 | 已执行级证明 | `token-execution.test.ts`、`shared-state-consistency.test.ts` |
| `poison` | `heroes/shadow_thief/tokens.ts` | `flowHooks.ts` upkeep 按层数伤害 | 已执行级证明 | `token-execution.test.ts`、`shared-state-consistency.test.ts` |
| `blinded` | `heroes/moon_elf/tokens.ts` | `flowHooks.ts` / 攻击流程判定 | 已执行级证明 | `token-execution.test.ts`、`interaction-chain-conditional.test.ts`、`moon-elf-abilities.test.ts` |
| `entangle` | `heroes/moon_elf/tokens.ts` | `flowHooks.ts` 进入进攻阶段时减少掷骰并移除 | 已执行级证明 | `token-execution.test.ts`、`shared-state-consistency.test.ts` |
| `targeted` | `heroes/moon_elf/tokens.ts` | `effects.ts` 伤害计算收集 `modifyStat` | 已执行级证明 | `targeted-defense-damage.test.ts`；`token-execution.test.ts` 仍主要是定义检查 |
| `bounty` | `heroes/gunslinger/tokens.ts` | `effects.ts` 伤害计算 `modifyStat + custom reward` | 已执行级证明 | 本轮新增 `token-execution.test.ts`：`赏金在受伤时会让伤害 +1，并使攻击者获得 1 CP` |
| `blessing_of_divinity` | `heroes/paladin/tokens.ts` | `effects.ts` custom handler `paladin-blessing-prevent` | 已执行级证明 | `token-execution.test.ts`、`token-fix-coverage.test.ts`、`paladin-blessing-removable.test.ts` |

## 特别发现

### 1. `quick-draw` 之前确实存在“有定义、无执行”的断层

- 根因：
  - 枪手把 `quick-draw` 定义成 `AbilityDef(type='passive', trigger.type='phaseStart')`
  - 但旧流程没有真正消费 `phaseStart` 型被动
- 本轮状态：
  - 已在 `flowHooks.ts` upkeep 入口补上 `phaseStart` 被动执行通道
  - 首回合 `setup -> upkeep` 也已覆盖

### 2. `TITHES_UPGRADED` token 目前不是运行时被动入口

- 位置：`src/games/dicethrone/heroes/paladin/tokens.ts`
- 现状：
  - 只存在 token 定义与测试夹具引用
  - 仓库内未找到任何授予、消费或 UI 依赖它驱动真实被动结算的路径
- 当前真实生效链路：
  - `card-tithes-2` 通过 `replaceAbility('tithes', PALADIN_TITHES_UPGRADED, 2, ...)`
  - 实际升级的是 `player.passiveAbilities` 中的 `tithes`
- 判定：
  - 这是历史元数据 / 展示残留，不应再被当成当前 runtime 被动入口
  - 本轮新增测试已锁定：
    - `paladin-tokens.test.ts` 明确要求它没有 `activeUse / passiveTrigger`
    - `card-tithes-2` 必须通过 `replaceAbility('tithes', ...)` 升级 `passiveAbilities`

### 3. `sharedTokens.ts` 中的共享 `EVASIVE.passiveTrigger` 已裁掉

- 原因：
  - 当前实际使用的英雄（武僧、月精灵、枪手）都在各自 token 定义里用 `activeUse` 处理闪避
  - 共享 `EVASIVE.passiveTrigger` 没有真实运行时消费者，只会误导后续审计
- 本轮处理：
  - 已从 `src/games/dicethrone/domain/sharedTokens.ts` 删除共享 `EVASIVE`
  - `shared-state-consistency.test.ts` 继续锁定 `monk / moon_elf / gunslinger` 的 `Evasive` 必须走本地 `activeUse`
- 判定：
  - `Evasive` 不再属于共享被动入口
  - 当前 DiceThrone runtime 中不存在“共享 Evasive 与本地 Evasive 并存”的歧义口径

## 已运行验证

### 本轮新增 / 重跑

1. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-execution.test.ts -t "赏金 \\(Bounty\\) 伤害与奖励" --configLoader native`
   - 通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "tithes II 在激活包含 pray 面的技能时额外获得 1 CP" --configLoader native`
   - 通过
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/passive-reroll-validation.test.ts --configLoader native`
   - 13 条通过
4. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "gunslinger initializes with duel defense ability|bushido grants 1 honor to the starting samurai at game start|bushido does not grant extra honor after exactly 3 offensive rolls" --configLoader native`
   - 3 条通过
5. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native`
   - 30 条通过
6. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/shared-state-consistency.test.ts --configLoader native`
   - 13 条通过
7. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/paladin-tokens.test.ts --configLoader native`
   - 18 条通过
8. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/shared-state-consistency.test.ts src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native`
   - 通过（清理共享 `EVASIVE` 后回归）
9. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native`
   - 通过（清理共享 `EVASIVE` 后复核 customAction 审计门禁）

## 命中的审计维度

- `D3` 数据流闭环：本轮重点补了 `quick-draw`、`bounty`、`tithes II` 的定义 -> 注册 -> 执行 -> 状态证明闭环
- `D8` 时序正确：`quick-draw` 的 `setup -> upkeep` 首回合断层已修复
- `D12` 写入-消耗对称：`tithes II` 现在已证明升级后的 `player.passiveAbilities` 会被 `systems.ts` 消费
- `D28` 白名单/注册完整性：`ability-customaction-audit.test.ts` 继续保证 token 引用的 custom action 已注册
- `D33` 跨实体同类路径一致性：多数 `onDamageReceived` / upkeep 被动继续走共享管线；`bushido` 仍属专门分支

## 审计结论

- 不能再说“枪手被动没实装”。`quick-draw` 现已真实在 upkeep 发 `loaded`。
- 当前 DiceThrone 的主要被动入口中，运行时生效链已经全部能落到明确执行路径。
- 本轮新增执行级证明后，之前最可疑的两个缺口：
  - `quick-draw`
  - `bounty`
  - `tithes II pray trigger`
  都已有直接证据。

## 未覆盖风险

1. 本轮没有把每个被动都重新做 E2E；当前证据以领域层 / 流程层回归为主。
2. `TITHES_UPGRADED` token 当前属于非运行时入口；若后续 UI 仍展示它为真实被动标记，应补专门整理，避免继续误导后续审计。

## 修订记录

- 2026-04-05：
  - 新增 `quick-draw` 首回合 upkeep 触发执行链
  - 新增 `bounty` 执行级测试
  - 新增 `tithes II` pray 触发执行级测试
  - 明确记录 `TITHES_UPGRADED` 为历史元数据而非当前 runtime 入口
  - 删除 `sharedTokens.ts` 中无消费者的共享 `EVASIVE`，消除共享/本地并存的误导口径
