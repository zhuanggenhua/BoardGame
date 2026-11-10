# 奇异博士攻击续接回归排查

2026-11-05 09:31 本地命令 `npx vitest run src/games/dicethrone/__tests__/doctor-strange-lifecycle.test.ts --reporter=dot`：55 通过、6 失败，原始输出 `temp/doctor-current-regression-20261105.log`。该日志和本记录是当时共享代码快照，不证明后续源码仍相同。

| 测试 / 能力 | 期望 | 实际 | 断言位置 |
| --- | --- | --- | --- |
| 预兆：真实骰面、即视感及 8 点攻击 | `ADVANCE_PHASE` 成功，保留攻击候选 | 命令失败 `resolution_blocked` | `doctor-strange-lifecycle.test.ts:932,942`；日志 110 行 |
| 束缚术：深红系带及 9 点攻击 | 阶段进入 `main2` | 留在 `offensiveRoll` | 测试 1003 行；日志 130 行 |
| 瓦图姆魔杖：连续两张后置法术及护盾账本 | 阶段进入 `main2` | 留在 `offensiveRoll` | 测试 1228 行；日志 146 行 |
| 瓦图姆魔杖：深红系带及 5 点不可防御攻击 | 阶段进入 `main2` | 留在 `offensiveRoll` | 测试 1253 行；日志 162 行 |
| 悬浮斗篷：防御减伤及预感 | 阶段进入 `main2` | 留在 `defensiveRoll` | 测试 1365 行；日志 178 行 |
| 悬浮斗篷：曼荼罗与护身符反击 | 阶段进入 `main2` | 留在 `defensiveRoll` | 测试 1399 行；日志 194 行 |

静态对照：`heroes/doctor_strange/abilities.ts` 将预兆、束缚术、瓦图姆魔杖和悬浮斗篷的特殊步骤分别配置为 `strangeOperation`，攻击伤害使用共享伤害链；当前该能力定义没有工作区改动。共享 `domain/attack.ts` 新增按 `preDefense`、`defenseWithDamage`、`attackPostDamage` 等阶段附加效果续接；`domain/systems.ts` 收到 `STRANGE_OPERATION_REQUESTED` 时创建续接，并在交互完成时调用 `resumeCompletedAttackEffectContinuation`。这与六例共同停在结算/阶段推进的症状相关，优先交由共享 attack/effect continuation 路径排查；仅凭静态对照和失败断言尚不能证明具体缺陷位点，也不能排除奇异博士专属系统与续接协议之间的接线问题。

最小复现：执行上述单文件命令；聚焦预兆可加 `-t '预兆用真实骰面触发'`，聚焦防御可加 `-t '悬浮斗篷'`。保留攻击/防御命令后的 `sys.resolution.frames`、`sys.interaction.current`、`core.pendingAttack` 及事件序列，检查 `STRANGE_OPERATION_REQUESTED` 的续接是否被对应操作完成事件解除。无需改角色配置或放宽阶段断言来让测试变绿。

共享结算正在修改，冻结后的当前源码还需复跑定向回归、16 项真实入口并保存对应源码身份；本记录不宣称当前玩家入口已验证。
