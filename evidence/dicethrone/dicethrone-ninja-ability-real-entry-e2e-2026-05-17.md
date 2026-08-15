# DiceThrone Ninja 技能本体真实入口 E2E（2026-05-17）

> 2026-06-05 当前有效口径：本文只保留 Ninja 基础/升级技能本体“真实槽位入口”对象级证据，不代表 Ninja 整英雄或 Treant/Ninja 整批当前完成态。当前若要判断 Ninja 对象级残余、兄弟能力补审范围或整批发布口径，应以 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`、`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 为准。
>
> 2026-06-04 失效回写：本文是**真实槽位入口 L3 证据**，不是当前忍者升级技能的最终实现结论。文内若把 `going-forward-2`、`slash-2`、`shadow-fang-2` 写成旧数值/旧语义，或把“能从槽位进入”外推成“对象级已收口”，这些口径都已失效。当前应以 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 最新矩阵为准。
>
> 2026-06-05 补记：截至当前代码状态，Ninja 升级技能对象级 `L3` 与关键 `L4` 已较本文当轮入口证据大幅前推；Ninja 当前**不再单列对象级 residual**。本文现在更适合作为“真实槽位入口历史证据”，实时残余应改读为批次级 `L4` 判等治理、旧文档统一回写与最终口径统一，而不是对象级还没实施完。

## 范围

- 目标：补 Ninja 基础/升级技能本体的真实玩家板入口证据，避免只用升级卡打出或 token 代表链外推技能本体。
- 主真相源：`src/games/dicethrone/rule/ninja录入核对.md`、本地 Ninja 玩家板图片与当前能力定义。
- 实现修复：
  - `shadow-step` 不再被全局别名误改成 Moon Elf 的 `elusive-step`；只有当前玩家没有 `shadow-step` 且拥有 `elusive-step` 时才保留旧兼容别名。
  - `offensiveRoll` 可用技能筛选允许 `utility` 类型，修复 Ninja `smoke-screen` / Treant `tend-care` 这类非伤害骰面技能无法从真实槽位选择的问题。

## 验证命令

```powershell
node node_modules/eslint/bin/eslint.js e2e/dicethrone/dicethrone-ninja-ability-real-entry.e2e.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/domain/rules.ts
npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/moon-elf-abilities.test.ts --configLoader native --maxWorkers 1
npm run test:e2e:ci -- e2e/dicethrone/dicethrone-ninja-ability-real-entry.e2e.ts
```

结果：

- ESLint：通过。
- Vitest：`2 passed / 40 tests passed`。
- E2E：`3 passed`。

## 逐项矩阵

> 2026-06-05 当前阅读门禁：下表的职责是保存“哪些 Ninja 技能本体曾被真实槽位入口 E2E 直接证明”。它不是当前 Ninja 单英雄 completion matrix，也不是当前对象级 residual 清单。凡行内写明“旧结论失效 / 当前以升级重审文档为准 / 仅保留历史记录”，都只能作为历史入口证据阅读，不能再被用来推导“这个对象现在还没做完”。

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `slash-2` | 斩击 II（当前正确语义为 `4/6/8` 伤害，且 `3` 同点得 `1` 忍术） | `SLASH_2` 变体 `slash-2-5` | `fist` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=slash-2-5` | N/A | 本文件只证明真实槽位入口；对象级主效果以后续合同测试为准 | 防御分支未在本用例展开 | pendingAttack 创建正常 | L3 入口 | 仅证明真实槽位入口；当前对象级 L2 见升级重审 |
| `going-forward-2` | 一往无前 II（主路线 `2` 骰、至多重掷 `1` 次；`刀尖舔血` 为独立分支） | `GOING_FORWARD_2` | `chi` 槽真实可点 | `sourceAbilityId=going-forward` | N/A | 本文件只证明真实槽位入口；对象级主/分支 closeout 以后续升级重审为准 | 防御分支未展开 | pendingAttack 创建正常 | L3 入口 | 仅证明真实槽位入口；当前对象级 L2/L3 以升级重审为准 |
| `shadow-step-2` | 4 面具，烟雾弹 + 慢性中毒 2 + 不可防御 7 | `SHADOW_STEP_2` | `lightning` 槽真实可点 | `sourceAbilityId=shadow-step`，不再误别名到 `elusive-step` | N/A | 对手 HP 30->23，己方烟雾弹 1，对手慢性中毒 2 | 不可防御跳过防御 | pendingAttack 清空，可继续推进 | L3 | 达标 |
| `smoke-screen-2` | 1 忍刀 + 2 手里剑 + 1 面具，烟雾弹 + 忍术 3 + 慢性中毒 | `SMOKE_SCREEN_2`，`type='utility'` | `lotus` 槽真实可点 | `sourceAbilityId=smoke-screen` | N/A | 己方烟雾弹 1、忍术 3，对手慢性中毒 1，HP 不变 | 非伤害 utility 不进入防御 | pendingAttack 清空，可继续推进 | L3 | 达标：修复 utility 被过滤问题 |
| `shadow-fang-2` | 影牙 II（当前主路线为 `1` 烟雾弹 + `2` 忍术 + `8` 伤害；`诳惑` 为独立分支） | `SHADOW_FANG_2` | `calm` 槽真实可点 | `sourceAbilityId=shadow-fang` | N/A | 本文件只证明主路线真实槽位入口；对象级主/分支结论以后续合同测试与升级重审为准 | 防御分支未展开 | pendingAttack 创建正常 | L3 入口 | 仅证明真实槽位入口；当前对象级 L2 见升级重审 |
| `poison-blade-2` | 小顺子；投 1 奖励骰；忍刀=1 慢性中毒；手里剑/面具=2 慢性中毒；造成 5 点伤害 | `POISON_BLADE_2` | `combo` 槽真实可点 | `sourceAbilityId=poison-blade` | N/A | 旧 `30->24 / 1 毒 / 不可防御` 结论已失效；2026-06-04 复核后，本对象需区分“无防御 L2 合同”和“树精 rooted 在线防御链 L3 收口”两种证据 | 旧文未覆盖奖励骰与防御分支；不得再把旧代表链外推成最终规则正确 | `pendingAttack` 清空，可继续推进 | 历史 L3 失效回写 | 仅保留历史记录；当前对象级口径已在升级重审主文档补齐，本文不再把它列作 Ninja 当前 residual |
| `death-blossom-2` | 忍刀=1 伤害、手里剑=2 伤害；1 个面具使攻击不可防御，2 个面具再施加 1 慢性中毒；不授予忍术 | `DEATH_BLOSSOM_2` | `sky` 槽真实可点 | `sourceAbilityId=death-blossom` | N/A | 奖励骰特写出现；收口后 `pendingBonusDiceSettlement` 清空，面具分支不增加忍术 | 使用真实潜行免防路径跳过防御，证明奖励骰本体展示与收口 | pendingAttack 清空 | L3 | 达标：本轮证明奖励骰 UI 与当前 Death Blossom II 面具分支结果，不外推所有骰面组合 |
| `ninja-assassinate` | 终极：慢性中毒 2、烟雾弹、10 伤害 | ultimate 槽 | `ultimate` 槽真实可点 | `sourceAbilityId=ninja-assassinate` | N/A | 对手 HP 30->20，对手慢性中毒 2，己方烟雾弹 1 | 终极不可防御 | pendingAttack 清空，可继续推进 | L3 | 达标 |

## 截图观察

| 截图 | 我实际看到什么 | 是否达标 |
| --- | --- | --- |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\基础与升级技能应从真实玩家板槽位进入正确 sourceAbilityId\03-shadow-step-2-before-click.png` | Ninja 玩家板完整可见，`暗影步 II` 升级卡图叠在右上最右的 `lightning` 槽；右侧骰面为 4 个面具 + 1 忍刀，`终止攻击`按钮处于可操作状态。 | 达标：证明 `shadow-step-2` 不是状态注入 prompt，而是从真实玩家板槽位进入。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\不可防御、utility 与终极技能应从真实槽位结算到权威状态\06-smoke-screen-2-after-resolve.png` | 画面已离开进攻投掷阶段，左侧 Ninja token 区能看到烟雾弹与忍术图标；对手区出现慢性中毒图标，HP 未被扣减。 | 达标：证明 `smoke-screen-2` 作为非伤害 `utility` 技能可真实结算 token，不再被进攻阶段过滤。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\死亡盛放 II 应从真实槽位触发奖励骰特写并收口\03-death-blossom-2-bonus-dice-overlay-detail.png` | 局部图直接看到 5 个奖励骰本体，包含忍刀、手里剑、面具骰面；中间文案为“投掷结果”，右上有真实关闭按钮。 | 达标：证明 Death Blossom II 从真实槽位触发了奖励骰特写，截图不是只截到外围容器。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\死亡盛放 II 应从真实槽位触发奖励骰特写并收口\04-death-blossom-2-after-closeout.png` | 奖励骰特写已关闭，玩家板回到可继续操作画面；当前 E2E 应断言 `pendingBonusDiceSettlement=false`、`pendingAttack=false`、忍术仍为 0，并按面具分支验证不可防御 / 慢性中毒结果。 | 达标：证明奖励骰链路完成收口，且不再沿用“面具给忍术”的旧口径。 |
| `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\不可防御、utility 与终极技能应从真实槽位结算到权威状态\08-assassinate-after-resolve.png` | 终极骰面 5 个面具可见，左侧 Ninja token 区有烟雾弹图标；E2E 同时断言对手 HP 30->20、对手慢性中毒 2。 | 达标：证明终极技从真实槽位结算到权威状态。 |

## 历史边界与当前阅读门禁

- 本轮补的是 Ninja 技能本体 L3 真实入口与代表性结算链，不等于所有可防御攻击的完整防御/响应/减伤组合 L4 已完成。
- `slash-2`、`going-forward-2`、`shadow-fang-2` 本轮证明真实槽位入口与 `sourceAbilityId` 正确；其具体防御后伤害落点仍依赖既有通用攻击结算与 L2 行为覆盖，未在本文件逐技能展开防御链。
- 截至 2026-06-05，Ninja 升级技能对象级 `L3` 与关键 `L4` 已在升级重审主文档中大幅补齐；因此本文剩余不能再读成“这些对象本体仍待补”，而应读成批次级 `L4` 判等治理、旧文档统一回写与最终口径统一。
- 换言之，本文当前没有新的 Ninja 对象级 residual 要继续挂账；它只保留“真实槽位入口曾如何被证明”的历史证据职责。后续若还要判断 Ninja 是否还有未完成项，必须回到总汇总与升级重审主文档，而不是继续从本文各对象行倒推出残余。
