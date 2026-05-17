# DiceThrone Ninja 烟雾弹失败分支 E2E（2026-05-17）

## 范围与结论

本证据覆盖 Ninja `smoke_bomb` / 烟雾弹在防御方响应窗中的失败骰面分支。

结论：烟雾弹失败骰面会消耗 token，但不会清空 `pendingDamage`，也不会提前扣 HP；随后跳过响应后，原 7 点伤害正常结算，Ninja HP 从 30 降到 23。

## 执行命令

首次执行被全局重任务门禁拦截，原因是启动前 CPU 过高：

```text
CPU 过高：91.4% >= 85%
```

等待后重跑：

```powershell
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者烟雾弹失败骰面应消耗 token 但保留伤害并可继续结算"
```

结果：2026-05-17 实测 `1 passed`。

## 截图与肉眼观察

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算\01-smoke-bomb-failure-token-response-before-use.png`

观察：

- 真实防御方响应窗可见，当前伤害为 7。
- 响应窗内可见烟雾弹 token，按钮为“使用”，说明测试走的是玩家可操作入口。

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算\02-smoke-bomb-failure-after-use-pending-damage.png`

观察：

- UI 明确显示“闪避投掷 5 - 失败”。
- 响应窗显示“没有可用标记”，说明烟雾弹已消耗。
- 当前伤害仍为 7；E2E 同时断言 HP 仍为 30、`pendingDamage` 仍打开。

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算\03-smoke-bomb-failure-after-damage-resolved.png`

观察：

- 画面进入攻击命中特写，证明失败后链路没有卡死在响应窗。
- E2E 状态断言证明 `SKIP_TOKEN_RESPONSE` 后 HP=23，`pendingDamage` 清空。
- 该截图不单独作为 HP 证明；HP 与清理由权威状态断言给出。

## Completion audit

| 验收项 | 证据 | 结论 |
| --- | --- | --- |
| 失败前响应窗可用 | `01-smoke-bomb-failure-token-response-before-use.png` | 通过 |
| 失败骰面消耗 token | `02-smoke-bomb-failure-after-use-pending-damage.png` + `smokeBomb=0` 断言 | 通过 |
| 失败后不免伤、不提前扣 HP | `currentDamage=7`、`pendingDamageOpen=true`、`hp=30` 断言 | 通过 |
| 跳过响应后正常扣伤害 | `hp=23`、`pendingDamageOpen=false` 断言 | 通过 |

残余范围：

- Ninja 基础/升级技能本体仍未逐技能覆盖所有骰面与分支 L3；本文件只证明烟雾弹 token 失败分支闭环。
