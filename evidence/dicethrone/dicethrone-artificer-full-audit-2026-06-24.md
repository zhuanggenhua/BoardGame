# DiceThrone 工匠全面审计

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
| 真实入口证据 | 在线双玩家选择工匠开局；工坊按钮激活纳米机器人并引爆纳米爆弹 |

明确不在本轮范围内：

- 不修改工匠正式逻辑。
- 不声明“所有工匠对象已达到完整真实入口 L3/L4”。
- 不把旧 closeout 证据直接等同为新版全面审计完成。

## 3. 结论等级

结论：`仍有残余范围`

判定理由：

- L0/L1：工匠素材、静态接入、资源路径、卡牌 atlas、骰面、状态图集已有当前代码和录入文档支撑。
- L2：工匠主要机制已有 `src/games/dicethrone/__tests__/artificer-mechanics.test.ts` 命令级测试覆盖，且 `artificer-closeout.test.ts` 锁定对象全集和 custom action 元数据。
- L3：当前只有“在线开局可见”和“工坊纳米机器人引爆链”两条真实入口 E2E；其他玩家板能力、专属手牌、响应牌、升级牌、多人目标选择和攻击后机器人选择链尚未逐对象补真实入口证据。
- L4：部分复杂链路在命令级测试里证明了后续状态收口，但未形成逐对象真实 UI 截图链和共享链判等矩阵，因此不能写“全面审计完成 / 没有死角”。

## 4. 权威来源

| 类型 | 路径 / 入口 | 本轮用途 |
| --- | --- | --- |
| 真相源表 | `src/games/dicethrone/rule/工匠真相源表.md` | 锁定英雄、资源、骰面、玩家板槽位、状态 / Token |
| 录入核对 | `src/games/dicethrone/rule/工匠录入核对.md` | 锁定玩家板能力与规则子句 |
| 卡牌录入 | `src/games/dicethrone/rule/工匠卡牌录入核对.md` | 锁定 15 张专属牌与 slot / atlas |
| 当前实现 | `src/games/dicethrone/heroes/artificer/*` | 静态定义、能力、手牌、Token、骰面 |
| 自定义动作 | `src/games/dicethrone/domain/customActions/artificer.ts` | 机器人、纳米爆弹、电弧盾、分支选择、投骰、多人目标 |
| L1/L2/L4 测试 | `src/games/dicethrone/__tests__/artificer-intake.test.ts`、`artificer-mechanics.test.ts`、`artificer-closeout.test.ts` | 静态接入、机制行为、对象全集、元数据 |
| 选择锚点契约 | `src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts`、`src/games/dicethrone/domain/systems.ts` | 真实 simple-choice 响应事件在系统层触发 followup，且无锚点 / 无交互快照时仍拒绝 |
| L3 E2E | `e2e/dicethrone/artificer-intake.e2e.ts` | 在线开局与工坊纳米机器人链 |
| P0 待跑 E2E | `e2e/dicethrone/artificer-full-audit.e2e.ts` | 已新增真实响应窗口、攻击后机器人选择链用例；当前被全局重任务内存门禁阻塞，尚不能计入通过证据 |
| 旧 closeout 证据 | `evidence/dicethrone/dicethrone-artificer-l2-mechanics-2026-06-23.md` | 历史实现 closeout 入口，本轮不再把它当作全面审计完成证明 |

## 5. 逐对象审计矩阵

| 对象 | 规则子句 / 语义 | 实现入口 | 命中维度 | 证据层级 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| 扳手攻击 / 扳手攻击 II | 3/4/5 扳手伤害；投 1 骰或花费 1 合成器选择扳手/齿轮/电能追加 | `wrench-strike`、`artificer-wrench-strike-branch` | D1/D3/D5/D8/D11/D12/D22 | L2 passed；L3 pending | 命令级分支成立，缺真实入口截图链 |
| 电路图 / 电路图 II | 抽牌、治疗、合成器；II 额外 2 CP | `schematics`、`SCHEMATICS_2` | D1/D3/D11/D12 | L2 passed；L3 pending | 数值实现有测试，缺真实入口 |
| 收集配件 / 收集配件 II | 维护阶段合成器；II 投骰分支；花费 4 合成器施加纳米爆弹 | `collect-parts`、`artificer-workshop` | D1/D3/D5/D8/D11/D15/D24 | L2 passed；L3 partial | 维护与多人目标 L2 成立；工坊纳米链有 L3，维护 UI 未逐项覆盖 |
| 灵感突现 / 灵感突现 II | 上半区伤害/合成器；从头构建高级机器人或升级基础机器人 | `eureka`、`artificer-build-from-scratch-choice` | D1/D3/D5/D8/D11/D24 | L2 passed；L3 pending | 选择链命令级成立，缺真实入口 |
| 唤醒机械 / 唤醒机械 II | 小顺子主效果；精密制造获得 5 合成器 | `activate-bots`、`ACTIVATE_BOTS_2` | D1/D3/D8/D11/D12 | L2 passed；L3 pending | 命令级成立，缺真实入口 |
| 超频运行 / 超频运行 II | 纳米爆弹、不可防御伤害、激活至多 2 个不同机器人；II 施加 3 纳米爆弹 | `overclock`、`artificer-activate-bots` | D1/D3/D5/D8/D11/D22/D24/D55 | L2/L4(domain) partial；L3 pending | 后续选择链有状态收口测试；不可防御真实 UI / 防御窗口未单独 E2E |
| 电能脉冲 / 电能脉冲 III | 施加纳米爆弹、9 伤害、激活 1 机器人；机械大军按机器人种类加伤 | `shock-bot`、`artificer-activate-bots`、`artificer-mechanical-army` | D1/D3/D5/D8/D11/D12/D22/D24 | L2/L4(domain) partial；L3 pending | 命令级和后续选择成立，缺真实入口 |
| 稍作调整 / 稍作调整 II | 防御掷 4/5；合成器、反击、纳米爆弹 | `tinker`、`artificer-tinker-defense`、`artificer-tinker-2-defense` | D1/D3/D5/D8/D10/D22 | L2 passed；L3 pending | 防御结果命令级成立，缺真实防御入口 |
| 真本能量 | 2 合成器、纳米爆弹、10 伤害、激活至多 2 个不同机器人 | `maximum-power`、`artificer-activate-bots` | D1/D3/D5/D8/D11/D22/D24 | L2/L4(domain) partial；L3 pending | 二段选择和不重复选择有状态测试，缺真实终极入口 |
| 合成器 | 上限 7；制造/升级/激活机器人；4 合成器施加纳米爆弹 | `TOKEN_IDS.SYNTH`、`artificer-workshop` | D1/D3/D5/D11/D12/D15/D20 | L1/L2 passed；L3 partial | 资源消耗和目标链有测试；真实 UI 只覆盖纳米机器人按钮 |
| 纳米爆弹 | 上限 3；维护投骰移除；被纳米机器人引爆后按层数伤害并清空 | `STATUS_IDS.NANOBOMB`、`flowHooks`、`artificer-nanobot-detonate` | D1/D3/D8/D12/D14/D15/D22 | L2 passed；L3 partial | 工坊引爆有 E2E；维护移除真实入口未逐项覆盖 |
| 纳米机器人 | 维护阶段激活并引爆纳米爆弹；基础/高级成本 2/1 合成器 | `TOKEN_IDS.NANOBOT`、`artificer-workshop` | D1/D3/D5/D8/D11/D12/D15 | L2/L3 passed for sampled chain | 当前唯一有真实入口完整链的机器人 |
| 电能机器人 | 攻击后可激活，攻击伤害 +3；基础/高级成本 2/1 合成器 | `TOKEN_IDS.SHOCK_BOT`、`activeUse.beforeDamageDealt` | D1/D3/D5/D8/D11/D22 | L2 passed；L3 pending | 命令级成立，缺真实攻击后入口 |
| 治疗机器人 | 至少 6 点攻击伤害后可激活，投骰治疗 1/2；基础/高级成本 2/1 合成器 | `TOKEN_IDS.HEAL_BOT`、`artificer-heal-bot-use` | D1/D3/D5/D8/D11/D22 | L2/L4(domain) partial；L3 pending | 命令级治疗与后续收口成立，缺真实防御入口 |
| 工匠工坊 | 9 个被动动作：引爆、施加纳米爆弹、制造/升级三类机器人 | `ARTIFICER_PASSIVE_ABILITIES` | D3/D5/D10/D11/D15/D24 | L2 passed；L3 partial | action index 与成本被 closeout 测试锁定；只 E2E 了纳米机器人激活 |
| 专属行动牌：合成大师、超高电压、纳米袭击、万能电流、这玩意儿真棒 | 投骰分支、合成器、纳米爆弹、多目标敌方选择 | `ARTIFICER_CARDS`、对应 custom action | D1/D3/D5/D8/D10/D11/D12/D24/D47 | L2 passed；L3 pending | 行为测试覆盖，未逐张真实手牌打出 E2E |
| 专属响应牌：机械的反击、电弧盾 | 受击响应、防伤、伤害护盾、纳米爆弹、可选花费合成器 | `card-artificer-mechanical-strike`、`upgrade-artificer-shock-bot-2`、`artificer-arc-shield` | D1/D3/D5/D8/D10/D11/D22/D24 | L2 passed；L3 pending | 响应窗口命令级成立，缺真实响应 UI 截图链 |
| 专属升级牌：稍作调整 II、超频运行 II、电能脉冲 III、唤醒机械 II、灵感突现 II、电路图 II、扳手攻击 II、收集配件 II | replaceAbility 或响应型升级；替换后能力语义生效 | `replaceAbility(...)`、`ARTIFICER_ABILITIES` 升级定义 | D1/D3/D8/D10/D23/D52 | L1/L2 passed；L3 pending | replace 壳和下游行为有测试，缺真实打出升级牌后入口 |

## 6. 对象级层级矩阵

| 分组 | L0 | L1 | L2 | L3 | L4 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 静态角色 / 资源 / atlas / 骰面 | passed | passed | n/a | partial: 开局可见 | n/a | 结构审计通过 |
| 玩家板能力 | passed | passed | passed | pending: 多数能力缺真实入口 | partial: 后续链仅命令级证明 | 仍有残余范围 |
| 状态 / Token / 工坊 | passed | passed | passed | partial: 纳米机器人链通过，其他机器人缺真实入口 | partial: 状态清理有命令级证据 | 仍有残余范围 |
| 专属行动牌 | passed | passed | passed | pending: 缺逐牌真实手牌打出 | partial: 多目标/投骰仅命令级证据 | 仍有残余范围 |
| 专属响应 / 升级牌 | passed | passed | passed | pending: 缺真实响应窗口和升级打出截图链 | partial | 仍有残余范围 |

## 7. 共享链判等矩阵

| 对象族 | 共享链名称 | 代表对象 | 是否满足“仅配置不同” | 判等依据 | 剩余差异 / 风险 |
| --- | --- | --- | --- | --- | --- |
| 工坊制造机器人 | `artificer-build-*` | 纳米机器人 / 电能机器人 / 治疗机器人 | 是，制造基础机器人仅 tokenId 不同 | `artificer-closeout.test.ts` 锁定 action 集；custom action 均为 token 类 | 真实 UI 只覆盖纳米机器人激活，制造按钮未逐个 E2E |
| 工坊升级机器人 | `artificer-upgrade-*` | 纳米机器人 / 电能机器人 / 治疗机器人 | 是，升级基础机器人仅 tokenId 不同 | custom action 元数据均为 token；L2 测试覆盖无基础机器人不扣费 | 未逐个 E2E |
| 攻击后激活机器人 | `artificer-activate-bots` | 超频运行 / 电能脉冲 / 真本能量 | 否 | 共享选择壳相同，但剩余次数、是否可跳过、后续伤害/治疗/引爆语义不同 | 不能用一条 E2E 代表全部；当前只有命令级收口 |
| 奖励骰行动牌 | `rollDie` / custom roll | 合成大师、万能电流、这玩意儿真棒 | 否 | 都有奖励骰壳，但分支消费者分别是抽牌/合成器/治疗/纳米爆弹 | 不能复用同一 L3/L4；缺逐牌真实入口 |
| 响应型防伤牌 | pendingDamage response | 机械的反击、电弧盾 | 否 | 都在受击窗口，但一个授予伤害护盾并施加纳米爆弹，一个选择防 2/防 3 且可花费合成器 | 必须分别补真实响应窗口截图链 |

## 8. 验证证据

### L1 结构证据

- `src/games/dicethrone/__tests__/artificer-intake.test.ts`
- 当前覆盖：角色完成态、AI 可选、骰面、卡牌 atlas、状态图集、关键资源路径、压缩资源存在。

### L2 领域行为证据

- `src/games/dicethrone/__tests__/artificer-mechanics.test.ts`
- 当前覆盖：40 个工匠核心机制用例，包括合成器、纳米爆弹、三类机器人、工坊动作、多人敌方目标选择、响应牌、奖励骰牌、升级能力、攻击后机器人选择链、防御技和终极后续链。
- 本轮实跑命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/artificer-intake.test.ts src/games/dicethrone/__tests__/artificer-closeout.test.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 本轮实跑结果：3 个测试文件通过，50 个用例通过。
- 追加实跑命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/artificer-intake.test.ts src/games/dicethrone/__tests__/artificer-closeout.test.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 追加实跑结果：4 个测试文件通过，80 个用例通过。

### 选择锚点修复证据

- 本轮发现：攻击后机器人 simple-choice 弹窗能扣除合成器和机器人，但没有追加真实伤害 / 治疗事件，也没有把攻击后续收口到 `readyToResolve`。现实含义是“玩家点了机器人按钮，资源花掉了，但机器人效果没有真正进入攻击结算”。
- 直接原因：simple-choice 响应事件进入 DiceThrone 系统时，交互系统可能已经把当前交互弹窗关闭，导致核心状态里的当前选择来源锚点不可用；系统层只看核心锚点，不看响应事件自带的交互快照，所以跳过了 followup。
- 修复：`src/games/dicethrone/domain/systems.ts` 仍优先使用核心锚点；当核心锚点已被交互系统关闭时，必须由同一 `SYS_INTERACTION_RESOLVED` 事件携带的交互快照同时证明 `sourceId`、`optionId` 和 `customId` 对齐，才允许触发 followup。
- 回归保护：`choice-interaction-anchor-contract.test.ts` 新增“真实 simple-choice 交互快照存在时可不依赖 core 锚点生效”，同时保留“只有 source 正确但没有锚点 / 没有交互快照时拒绝”的旧用例。

### Closeout 结构证据

- `src/games/dicethrone/__tests__/artificer-closeout.test.ts`
- 当前覆盖：玩家板能力全集、专属手牌全集、状态 / Token / 工坊动作全集、关键 custom action 与 metadata、工坊资源门禁。

### L3 真实玩法证据

- `e2e/dicethrone/artificer-intake.e2e.ts`
- 当前覆盖：
  - 在线双玩家选择工匠开局，看到玩家板、技能槽、手牌和状态栏。
  - 工坊按钮激活纳米机器人，引爆纳米爆弹后状态和 HP 收口。
- `e2e/dicethrone/artificer-full-audit.e2e.ts`
  - 已新增覆盖目标：机械的反击、电弧盾、攻击后电能机器人、攻击后治疗机器人。
  - 场景修正：真实响应窗口用 `playerID=0` 打开测试页，保证底部手牌 DOM 与工匠玩家 0 的状态同源。
  - 当前验证状态：尚未通过完整 E2E；`node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/artificer-full-audit.e2e.ts` 被全局重任务门禁拦截，最近一次阻塞为可用内存 `0.67GB < 1.5GB`，同时存在无关 FantasyRealms E2E runtime。该结果只能记为环境 / 预算阻塞，不能记为 L3 通过。
- 当前缺口：
  - 未逐个覆盖专属手牌真实打出。
  - 未覆盖真实防御响应窗口下的机械的反击 / 电弧盾。
  - 未覆盖攻击后电能机器人 / 治疗机器人 / 多机器人选择真实 UI。
  - 未覆盖升级牌打出后再由新能力真实触发。

## 9. 禁止假阳性检查

| 检查项 | 当前判定 |
| --- | --- |
| 是否误用“选角 / 开局截图”充当玩法收口 | 是风险点：本审计只把开局截图算 L3 静态入口，不算玩法 L3 |
| 是否误用命令级测试充当真实 UI | 已降级：命令级测试只写 L2 或 domain-level L4 partial |
| 是否误用一个机器人 E2E 外推全部机器人 | 已降级：纳米机器人链不能代表电能机器人 / 治疗机器人真实入口 |
| 是否误用旧 closeout 文档充当全面审计完成 | 已降级：旧 closeout 只作为实现 closeout 证据入口 |

## 10. 修订 / 失效记录

| 旧文档 | 旧口径 | 本轮修订结论 |
| --- | --- | --- |
| `evidence/dicethrone/dicethrone-artificer-l2-mechanics-2026-06-23.md` | “当前有效结论就是：工匠规则实现已落地，目录完成态已生效，真实入口证据已经并入本工作目录的未提交改动。” | 该结论只可继续理解为实现 closeout，不等于新版全面审计完成 |
| `src/games/dicethrone/rule/工匠真相源表.md` | “当前工作目录 main 上，工匠已完成 closeout” | closeout 口径保留，但需补充：全面审计完成态以本文为准，当前仍有 L3/L4 残余范围 |
| `src/games/dicethrone/rule/工匠录入核对.md` | 多处写“真实入口待 L3/L4”，但文首又写 closeout 完成 | 本文把两者拆清：实现 closeout 已有证据；全面审计仍不能写完成 |
| `src/games/dicethrone/rule/工匠卡牌录入核对.md` | 多数专属牌仍写 L2 / 真实 UI 待 L3 | 与本轮审计一致，不能升级为全面审计完成 |

## 11. 对外汇报口径

允许说：

- “工匠已有实现 closeout 证据，且当前审计已经建立对象全集和证据分层。”
- “工匠 L1/L2 证据较完整，真实入口目前只覆盖开局和工坊纳米机器人链。”
- “按新版全面审计口径，工匠当前仍有 L3/L4 残余范围。”

禁止说：

- “工匠已经全面审计完成。”
- “已有 closeout evidence，所以所有对象都已 L3/L4。”
- “纳米机器人 E2E 可以代表所有工匠机器人和所有手牌。”

## 12. 后续必须补的审计项

| 优先级 | 待补项 | 验收口径 |
| --- | --- | --- |
| P0 | 真实响应窗口：机械的反击、电弧盾 | 至少各 1 条真实 E2E 截图链，覆盖响应入口、执行、HP/护盾/纳米爆弹状态收口 |
| P0 | 攻击后机器人选择链 | 至少覆盖电能机器人和治疗机器人真实入口，证明成本、消耗、效果和 pendingAttack 收口 |
| P1 | 专属行动牌真实手牌打出 | 合成大师 / 万能电流 / 这玩意儿真棒至少分别覆盖奖励骰分支或明确共享链判等 |
| P1 | 升级牌真实打出后能力替换 | 至少覆盖 1 张 replaceAbility 升级牌和 1 张响应型升级牌，证明升级壳与后续能力本体都成立 |
| P1 | 状态图标 DOM 断言 | 证明合成器、纳米爆弹、三类机器人命中 `status-icons-atlas` sprite，而不是纯色 fallback |
