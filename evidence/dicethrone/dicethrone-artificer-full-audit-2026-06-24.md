# DiceThrone 工匠全面审计

> 2026-06-27 补充回写：2026-06-24 版本把工匠记为“`P0 真实入口闭环已完成；扩展审计仍有余量`”。当前工作目录随后补齐了稍作调整 II、防御链，扳手攻击 II 升级后再次触发链，电路图 II、灵感突现 II、唤醒机械 II、超频运行 II 能量提升、电能脉冲 III 机械大军、真本能量双机器人不同选择链，以及真实在线电能机器人“本体保留、只记录本回合激活次数”链路。并已在当前工作目录重跑：
>
> - `src/games/dicethrone/__tests__/artificer-mechanics.test.ts`
> - `src/games/dicethrone/__tests__/artificer-bot-persistence.test.ts`
> - `src/games/dicethrone/__tests__/artificer-intake.test.ts`
> - `src/games/dicethrone/__tests__/artificer-overclock-energy-boost.test.ts`
> - `src/games/dicethrone/__tests__/artificer-overclock-nanobomb-sequencing.test.ts`
> - `src/games/dicethrone/__tests__/artificer-precision-fabrication.test.ts`
> - `e2e/dicethrone/artificer-intake.e2e.ts`
> - `e2e/dicethrone/artificer-full-audit.e2e.ts`
>
> 当前结果为：领域测试 `66/66 passed`，真实入口 intake `3/3 passed`，真实入口 full audit `27/27 passed`。对“开局合成器数量”“高级电能机器人降级/消失”“升级高级机器人合成器成本”“机器人被清除/转移指示物误处理”“扳手攻击 II 只加 3 伤害不走后续”这 5 条反馈，当前证据已闭环；按 `.codex/skill/add-new-faction/SKILL.md` 与 `docs/games/dicethrone/workflows/dicethrone-hero-intake.md` 的门禁，本轮工匠对象级录入、机制、审计与真实入口验证已收口完成。

## 1. 基本信息

- 对象：工匠（`artificer` / Artificer）
- 日期：2026-06-24
- 文档类型：`audit`
- 关联任务：用户要求“现在没审计就开始审计”
- 当前工作目录：`D:\gongzuo\webgame\BoardGame`
- 当前分支：`main`

## 2. 审计范围

本轮按新增英雄审计口径执行，覆盖工匠当前工作目录里的录入、实现、测试与 evidence。

| 范围 | 覆盖对象 |
| --- | --- |
| 角色静态接入 | 角色目录、骰面、资源路径、状态图集、手牌 atlas、完成态徽标 |
| 玩家板能力 | 扳手攻击、电路图、收集配件、灵感突现、唤醒机械、超频运行、电能脉冲、稍作调整、真本能量 |
| 状态 / Token / 工坊 | 合成器、纳米爆弹、纳米机器人、电能机器人、治疗机器人、工匠工坊 |
| 专属手牌 | 合成大师、机械的反击、电弧盾、稍作调整 II、超频运行 II、电能脉冲 III、唤醒机械 II、灵感突现 II、电路图 II、扳手攻击 II、收集配件 II、超高电压、纳米袭击、万能电流、这玩意儿真棒 |
| 真实入口证据 | 在线双玩家选择工匠开局；工坊按钮激活纳米机器人并引爆纳米爆弹；真实响应窗口；攻击后机器人选择链；专属行动牌代表；多目标敌方选择代表；升级牌代表；状态图标 DOM |

明确不在本轮范围内：

- 不扩大修改工匠机制语义；本轮只收口当前工作目录里已经存在的工匠对象与共享链。
- 不把未来新需求、跨英雄共享治理或额外美术优化混入“当前英雄是否完成”的结论。

## 3. 结论等级

结论：`按当前项目新增派系规范，工匠已完成对象级审计与真实入口收口`

判定理由：

- L0/L1：工匠素材、静态接入、资源路径、卡牌 atlas、骰面、状态图集已有当前代码和录入文档支撑。
- L2：工匠主要机制已有 `artificer-intake / mechanics / bot-persistence / closeout / overclock-energy-boost / overclock-nanobomb-sequencing / precision-fabrication` 共 `66/66` 领域测试覆盖，且对象全集、共享消费点与 custom action 元数据均已锁定。
- L3：当前已有 `27/27` 真实入口 E2E，覆盖全部玩家板能力的基础/升级代表链、全部专属手牌/升级牌的真实打出或真实触发链、工坊真实按钮制造/升级、电能机器人本体保留链、状态图标 sprite 命中，以及终极技的攻击前 token 响应与攻击后双机器人不同选择链。
- L4：复杂链路已同时拿到命令级最终状态与真实 UI 收口证据；无独立交互 UI 的被动维护/共享工坊链路，已在共享链判等矩阵中登记为“同构合法复用”，当前批次不存在 `blocked` 或 `scoped-debt` 残项。

## 4. 权威来源

| 类型 | 路径 / 入口 | 本轮用途 |
| --- | --- | --- |
| 真相源表 | `src/games/dicethrone/rule/工匠真相源表.md` | 锁定英雄、资源、骰面、玩家板槽位、状态 / Token |
| 录入核对 | `src/games/dicethrone/rule/工匠录入核对.md` | 锁定玩家板能力与规则子句 |
| 卡牌录入 | `src/games/dicethrone/rule/工匠卡牌录入核对.md` | 锁定 15 张专属牌与 slot / atlas |
| 当前实现 | `src/games/dicethrone/heroes/artificer/*` | 静态定义、能力、手牌、Token、骰面 |
| 自定义动作 | `src/games/dicethrone/domain/customActions/artificer.ts` | 机器人、纳米爆弹、电弧盾、分支选择、投骰、多人目标 |
| 阶段退出链 | `src/games/dicethrone/domain/flowHooks.ts` | 攻击后机器人选择生成后必须先暂停，不能同批提前收口攻击 |
| L1/L2/L4 测试 | `src/games/dicethrone/__tests__/artificer-intake.test.ts`、`artificer-mechanics.test.ts`、`artificer-closeout.test.ts` | 静态接入、机制行为、对象全集、元数据 |
| 选择锚点契约 | `src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts`、`src/games/dicethrone/domain/systems.ts` | 真实 simple-choice 响应事件在系统层触发 followup，且无锚点 / 无交互快照时仍拒绝 |
| L3 E2E | `e2e/dicethrone/artificer-intake.e2e.ts` | 在线开局与工坊纳米机器人链 |
| P0/P1 L3 E2E | `e2e/dicethrone/artificer-full-audit.e2e.ts` | 真实响应窗口、攻击后机器人选择链、专属行动牌代表、多目标敌方选择代表、replaceAbility 升级牌代表、状态图标 DOM 已通过：机械的反击、电弧盾、电能机器人、治疗机器人、超高电压、合成大师、万能电流、这玩意儿真棒、纳米袭击、扳手攻击 II、状态图标 sprite |
| 旧 closeout 证据 | `evidence/dicethrone/dicethrone-artificer-l2-mechanics-2026-06-23.md` | 历史实现 closeout 入口，本轮不再把它当作全面审计完成证明 |

## 5. 逐对象审计矩阵

| 对象 | 规则子句 / 语义 | 实现入口 | 命中维度 | 证据层级 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| 扳手攻击 / 扳手攻击 II | 3/4/5 扳手伤害；投 1 骰或花费 1 合成器选择扳手/齿轮/电能追加 | `wrench-strike`、`artificer-wrench-strike-branch` | D1/D3/D5/D8/D11/D12/D22 | L2/L3/L4 passed | 基础版、升级牌真实打出、能力等级替换，以及升级后从真实玩家板再次触发电能分支并收口均已通过 |
| 电路图 / 电路图 II | 抽牌、治疗、合成器；II 额外 2 CP | `schematics`、`SCHEMATICS_2` | D1/D3/D11/D12 | L2/L3 passed | 升级牌真实打出与升级后真实玩家板触发均已通过，`+2 CP / 抽 2 / 治疗 2 / 获得 4 合成器` 已在真实入口收口 |
| 收集配件 / 收集配件 II | 维护阶段合成器；II 投骰分支；花费 4 合成器施加纳米爆弹 | `collect-parts`、`artificer-workshop` | D1/D3/D5/D8/D11/D15/D24 | L2 passed；L3/L4 shared-chain passed | 维护阶段属于无独立交互 UI 的共享 upkeep 流水线；多人敌方目标、升级牌真实打出与工坊被动按钮代表链均已通过，当前按共享链合法复用收口 |
| 灵感突现 / 灵感突现 II | 上半区伤害/合成器；从头构建高级机器人或升级基础机器人 | `eureka`、`artificer-build-from-scratch-choice` | D1/D3/D5/D8/D11/D24 | L2/L3 passed | 基础版真实玩家板触发与 II 版从头构建选择链均已通过 |
| 唤醒机械 / 唤醒机械 II | 小顺子主效果；精密制造获得 5 合成器 | `activate-bots`、`ACTIVATE_BOTS_2` | D1/D3/D8/D11/D12 | L2/L3 passed | 基础版真实玩家板触发与 II 版精密制造真实触发均已通过 |
| 超频运行 / 超频运行 II | 纳米爆弹、不可防御伤害、激活至多 2 个不同机器人；II 施加 3 纳米爆弹 | `overclock`、`artificer-activate-bots` | D1/D3/D5/D8/D11/D22/D24/D55 | L2/L3/L4 passed | 基础版真实玩家板触发、攻击后双机器人选择链，以及 II 版能量提升真实触发均已通过 |
| 电能脉冲 / 电能脉冲 III | 施加纳米爆弹、9 伤害、激活 1 机器人；机械大军按机器人种类加伤 | `shock-bot`、`artificer-activate-bots`、`artificer-mechanical-army` | D1/D3/D5/D8/D11/D12/D22/D24 | L2/L3/L4 passed | 基础版真实玩家板触发与 III 版机械大军真实触发均已通过 |
| 稍作调整 / 稍作调整 II | 防御掷 4/5；合成器、反击、纳米爆弹 | `tinker`、`artificer-tinker-defense`、`artificer-tinker-2-defense` | D1/D3/D5/D8/D10/D22 | L2/L3 passed | 基础版与 II 版真实防御入口均已通过 |
| 真本能量 | 2 合成器、纳米爆弹、10 伤害、激活至多 2 个不同机器人 | `maximum-power`、`artificer-activate-bots` | D1/D3/D5/D8/D11/D22/D24 | L2/L3/L4 passed | 真实终极入口已覆盖攻击前 token 响应、攻击后双机器人不同选择链与最终收口 |
| 合成器 | 上限 7；制造/升级/激活机器人；4 合成器施加纳米爆弹 | `TOKEN_IDS.SYNTH`、`artificer-workshop` | D1/D3/D5/D11/D12/D15/D20 | L1/L2 passed；L3/L4 shared-chain passed | 资源消耗和目标链有测试；真实 UI 已覆盖纳米机器人按钮、电能机器人制造/升级、电能/治疗机器人激活链与状态图标，当前按共享链矩阵收口 |
| 纳米爆弹 | 上限 3；维护投骰移除；被纳米机器人引爆后按层数伤害并清空 | `STATUS_IDS.NANOBOMB`、`flowHooks`、`artificer-nanobot-detonate` | D1/D3/D8/D12/D14/D15/D22 | L2 passed；L3/L4 shared-chain passed | 工坊引爆与多条施加链已有真实入口；维护移除属于共享 upkeep 流水线，当前按共享链合法复用收口 |
| 纳米机器人 | 维护阶段激活并引爆纳米爆弹；基础/高级成本 2/1 合成器 | `TOKEN_IDS.NANOBOT`、`artificer-workshop` | D1/D3/D5/D8/D11/D12/D15 | L2/L3/L4 passed | 制造、升级、维护阶段激活、引爆纳米爆弹、机器人本体保留与成本门禁均已收口；其余同构工坊按钮按共享链矩阵合法复用 |
| 电能机器人 | 攻击后可激活，攻击伤害 +3；基础/高级成本 2/1 合成器 | `TOKEN_IDS.SHOCK_BOT`、`activeUse.beforeDamageDealt` | D1/D3/D5/D8/D11/D22 | L2/L3/L4 passed | 真实 UI 已覆盖制造、升级、攻击后选择、扣合成器、记录本回合使用次数、追加伤害并收口攻击 |
| 治疗机器人 | 至少 6 点攻击伤害后可激活，投骰治疗 1/2；基础/高级成本 2/1 合成器 | `TOKEN_IDS.HEAL_BOT`、`artificer-heal-bot-use` | D1/D3/D5/D8/D11/D22 | L2/L3/L4 passed | 真实 UI 已覆盖攻击后选择、扣合成器、消耗使用次数、投骰治疗并收口攻击；制造/升级与上限差异按共享链矩阵合法复用 |
| 工匠工坊 | 9 个被动动作：引爆、施加纳米爆弹、制造/升级三类机器人 | `ARTIFICER_PASSIVE_ABILITIES` | D3/D5/D10/D11/D15/D24 | L2/L3/L4 passed | action index、成本、按钮族与对象全集被 closeout 测试锁定；真实入口已覆盖引爆、施加纳米爆弹、制造/升级与后续激活链，当前按共享链合法复用收口 |
| 专属行动牌：合成大师、超高电压、纳米袭击、万能电流、这玩意儿真棒 | 投骰分支、合成器、纳米爆弹、多目标敌方选择 | `ARTIFICER_CARDS`、对应 custom action | D1/D3/D5/D8/D10/D11/D12/D24/D47 | L2/L3/L4 passed | 5 张行动牌的真实手牌打出、奖励骰分支、多目标敌方选择与最终状态收口均已通过；共享壳差异已按对象级真实入口分别验证 |
| 专属响应牌：机械的反击、电弧盾 | 受击响应、防伤、伤害护盾、纳米爆弹、可选花费合成器 | `card-artificer-mechanical-strike`、`upgrade-artificer-shock-bot-2`、`artificer-arc-shield` | D1/D3/D5/D8/D10/D11/D22/D24 | L2 passed；L3 passed | 真实响应窗口已覆盖从手牌打出、选择防 3、HP / 护盾 / 纳米爆弹状态收口 |
| 专属升级牌：稍作调整 II、超频运行 II、电能脉冲 III、唤醒机械 II、灵感突现 II、电路图 II、扳手攻击 II、收集配件 II | replaceAbility 或响应型升级；替换后能力语义生效 | `replaceAbility(...)`、`ARTIFICER_ABILITIES` 升级定义 | D1/D3/D8/D10/D23/D52 | L1/L2/L3/L4 passed | 8 张升级牌的真实打出、能力替换、升级后真实玩家板再次触发，以及响应型升级牌即时窗口均已通过 |

## 6. 对象级层级矩阵

| 分组 | L0 | L1 | L2 | L3 | L4 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 静态角色 / 资源 / atlas / 骰面 | passed | passed | n/a | passed | n/a | 结构审计通过 |
| 玩家板能力 | passed | passed | passed | passed | passed | 9 个玩家板能力及其升级/变体真实入口已补齐 |
| 状态 / Token / 工坊 | passed | passed | passed | passed | passed | 三类机器人、合成器、纳米爆弹、工坊共享链当前已完成对象级收口 |
| 专属行动牌 | passed | passed | passed | passed | passed | 全部专属行动牌已有真实打出或共享链合法复用证据 |
| 专属响应 / 升级牌 | passed | passed | passed | passed | passed | 响应牌、升级牌、replaceAbility 代表链与真实触发链均已收口 |

## 7. 共享链判等矩阵

| 对象族 | 共享链名称 | 代表对象 | 是否满足“仅配置不同” | 判等依据 | 剩余差异 / 风险 |
| --- | --- | --- | --- | --- | --- |
| 工坊制造机器人 | `artificer-build-*` | 纳米机器人 / 电能机器人 / 治疗机器人 | 是，制造基础机器人仅 tokenId 不同 | `artificer-closeout.test.ts` 锁定 action 集；custom action 均为 token 类；真实入口已覆盖纳米机器人与电能机器人制造按钮 | 治疗机器人制造按钮未单独再写一条 E2E，但因链路仅 tokenId 不同，当前按共享链合法复用收口 |
| 工坊升级机器人 | `artificer-upgrade-*` | 纳米机器人 / 电能机器人 / 治疗机器人 | 是，升级基础机器人仅 tokenId 不同 | custom action 元数据均为 token；L2 测试覆盖无基础机器人不扣费；真实入口已覆盖电能机器人升级按钮 | 纳米 / 治疗机器人升级按钮未逐条单列 E2E，但链路合同一致，当前按共享链合法复用收口 |
| 攻击后激活机器人 | `artificer-activate-bots` | 超频运行 / 电能脉冲 / 真本能量 | 否 | 共享选择壳相同，但剩余次数、是否可跳过、后续伤害/治疗/引爆语义不同；full audit 已分别覆盖单机器人与双机器人不同选择链 | 当前对象差异已由电能机器人、治疗机器人、真本能量双机器人选择与对应结算链分别证明，无未收口风险 |
| 奖励骰行动牌 | `rollDie` / custom roll | 合成大师、万能电流、这玩意儿真棒 | 否 | 都有奖励骰壳，但分支消费者分别是抽牌/合成器/治疗/纳米爆弹；full audit 已分别覆盖真实手牌打出后的差异分支 | 当前不再把这组对象记为“代表链未外推”；差异语义已逐对象闭环 |
| 响应型防伤牌 | pendingDamage response | 机械的反击、电弧盾 | 否 | 都在受击窗口，但一个授予伤害护盾并施加纳米爆弹，一个选择防 2/防 3 且可花费合成器；full audit 已分别覆盖真实响应窗口 | 当前两条响应链均已对象级收口，不再作为“仍待补齐”的共享链风险 |

## 8. 验证证据

### L1 结构证据

- `src/games/dicethrone/__tests__/artificer-intake.test.ts`
- 当前覆盖：角色完成态、AI 可选、骰面、卡牌 atlas、状态图集、关键资源路径、压缩资源存在。

### L2 领域行为证据

- `src/games/dicethrone/__tests__/artificer-mechanics.test.ts`
- 当前覆盖：42 个工匠核心机制用例，包括合成器、纳米爆弹、三类机器人、工坊动作、多人敌方目标选择、响应牌、奖励骰牌、升级能力、攻击后机器人选择链、防御技和终极后续链。
- 本轮实跑命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/artificer-intake.test.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts src/games/dicethrone/__tests__/artificer-bot-persistence.test.ts src/games/dicethrone/__tests__/artificer-closeout.test.ts src/games/dicethrone/__tests__/artificer-overclock-energy-boost.test.ts src/games/dicethrone/__tests__/artificer-overclock-nanobomb-sequencing.test.ts src/games/dicethrone/__tests__/artificer-precision-fabrication.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 本轮实跑结果：7 个测试文件通过，66 个用例通过。

### 选择锚点修复证据

- 本轮发现：攻击后机器人 simple-choice 弹窗能扣除合成器和机器人，但没有追加真实伤害 / 治疗事件，也没有把攻击后续收口到 `readyToResolve`。现实含义是“玩家点了机器人按钮，资源花掉了，但机器人效果没有真正进入攻击结算”。
- 直接原因：simple-choice 响应事件进入 DiceThrone 系统时，交互系统可能已经把当前交互弹窗关闭，导致核心状态里的当前选择来源锚点不可用；系统层只看核心锚点，不看响应事件自带的交互快照，所以跳过了 followup。
- 修复：`src/games/dicethrone/domain/systems.ts` 仍优先使用核心锚点；当核心锚点已被交互系统关闭时，必须由同一 `SYS_INTERACTION_RESOLVED` 事件携带的交互快照同时证明 `sourceId`、`optionId` 和 `customId` 对齐，才允许触发 followup。
- 修复：`src/games/dicethrone/domain/flowHooks.ts` 在 post-damage 收口前补上阻塞交互检查，攻击后机器人选择生成后必须先暂停，不能同批清空 pendingAttack。
- 回归保护：`choice-interaction-anchor-contract.test.ts` 新增“真实 simple-choice 交互快照存在时可不依赖 core 锚点生效”，同时保留“只有 source 正确但没有锚点 / 没有交互快照时拒绝”的旧用例。
- 回归保护：`artificer-mechanics.test.ts` 新增“攻击后机器人选择生成后应暂停攻击结算并保留 pendingAttack”。

### Closeout 结构证据

- `src/games/dicethrone/__tests__/artificer-closeout.test.ts`
- 当前覆盖：玩家板能力全集、专属手牌全集、状态 / Token / 工坊动作全集、关键 custom action 与 metadata、工坊资源门禁。

### L3 真实玩法证据

- `e2e/dicethrone/artificer-intake.e2e.ts`
- 当前覆盖：
  - 在线双玩家选择工匠开局，看到玩家板、技能槽、手牌和状态栏。
  - 工坊按钮激活纳米机器人，引爆纳米爆弹后状态和 HP 收口。
- `e2e/dicethrone/artificer-full-audit.e2e.ts`
  - 已通过覆盖目标：机械的反击、电弧盾、稍作调整 I/II、攻击后电能机器人、攻击后治疗机器人、超高电压、收集配件 II、合成大师、万能电流、这玩意儿真棒、纳米袭击、扳手攻击 II 升级前后、电路图 II、灵感突现 I/II、唤醒机械 I/II、超频运行 I/II、电能脉冲 I/III、真本能量、状态图标 DOM，以及工坊真实按钮制造/升级电能机器人。
  - 场景修正：真实响应窗口用 `playerID=0` 打开测试页，保证底部手牌 DOM 与工匠玩家 0 的状态同源。
  - 本轮实跑命令：

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/artificer-full-audit.e2e.ts
```

  - 本轮实跑结果：27 个真实入口 E2E 通过。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\artificer-full-audit.e2e\合成大师应可从真实手牌打出并按电能奖励骰获得-5-合成器\artificer-masterpiece-after-play.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\artificer-full-audit.e2e\纳米袭击应在-4-人组队局真实手牌打出且只允许选择敌方玩家\artificer-nano-attack-four-player-enemy-targets.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\artificer-full-audit.e2e\扳手攻击-II-打出后应可从真实玩家板触发升级后的扳手攻击并走电能分支收口\artificer-wrench-strike-2-after-electricity-branch.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\artificer-full-audit.e2e\工匠合成器、纳米爆弹和三类机器人状态图标应命中状态图集-sprite\artificer-status-icons-atlas-sprites.png`
  - 本轮补充修复：`src/games/dicethrone/Board.tsx` 不再把所有 `type: 'upgrade'` 的牌强制送进能力升级入口；只有能解析出替换目标能力的升级牌才走 `PLAY_UPGRADE_CARD`，电弧盾这类响应型即时升级牌会按普通响应牌打出。
- 当前余量：
  - 当前批次无 `blocked` 或 `scoped-debt` 残项。
  - 后续若继续补更多历史对照截图、跨英雄共享治理或额外多人玩法截图，属于扩充 evidence，不再构成工匠本轮完成门禁。

## 9. 禁止假阳性检查

| 检查项 | 当前判定 |
| --- | --- |
| 是否误用“选角 / 开局截图”充当玩法收口 | 是风险点：本审计只把开局截图算 L3 静态入口，不算玩法 L3 |
| 是否误用命令级测试充当真实 UI | 已校正：命令级测试只作为 L2 / L4 领域证据，真实 UI 结论单独由 intake 与 full audit E2E 承担 |
| 是否误用一个机器人 E2E 外推全部机器人 | 已降级：纳米机器人链不能代表电能机器人 / 治疗机器人真实入口 |
| 是否误用旧 closeout 文档充当全面审计完成 | 已降级：旧 closeout 只作为实现 closeout 证据入口 |

## 10. 修订 / 失效记录

| 旧文档 | 旧口径 | 本轮修订结论 |
| --- | --- | --- |
| `evidence/dicethrone/dicethrone-artificer-l2-mechanics-2026-06-23.md` | “当前有效结论就是：工匠规则实现已落地，目录完成态已生效，真实入口证据已经并入本工作目录的未提交改动。” | 该结论只可继续理解为实现 closeout，不等于新版全面审计完成 |
| `src/games/dicethrone/rule/工匠真相源表.md` | “当前工作目录 main 上，工匠已完成 closeout” | 已同步到当前 66/66 领域测试、3/3 intake、27/27 full audit 的对象级完成口径 |
| `src/games/dicethrone/rule/工匠录入核对.md` | 多处写“真实入口待 L3/L4”，但文首又写 closeout 完成 | 已回写对象正文行，当前与最新真实入口结论一致 |
| `src/games/dicethrone/rule/工匠卡牌录入核对.md` | 多数专属牌仍写 L2 / 真实 UI 待 L3 | 已同步到当前专属牌真实打出/真实触发已补齐的状态 |

## 11. 对外汇报口径

允许说：

- “按当前项目新增派系规范，工匠当前工作目录已完成对象级录入、机制、审计与真实入口 E2E 收口。”
- “工匠当前验证结果是：领域测试 `66/66 passed`，真实入口 intake `3/3 passed`，真实入口 full audit `27/27 passed`。”
- “当前仍保留的共享链说明，只是为了说明哪些对象是合法复用收口，不再代表本批次未完成。”

禁止说：

- “只因为一个代表链绿了，所以工匠完成。”
- “不用看当前工作目录文档正文，文首补充就足够。”
- “共享链可复用”但不给判等依据。

## 12. 当前收口

当前批次无必须继续补的对象级审计项。

后续若继续工作，只可能是以下两类：

- 扩充历史对照截图、更多共享链代表图或更多多人玩法展示；
- 未来新需求触发的跨英雄共享治理、资源替换或机制扩展。
