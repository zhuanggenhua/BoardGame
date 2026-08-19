# DiceThrone 飞行临时骰确认与正式骰恢复 E2E 证据（2026-08-18）

## 结论等级

- 结论：`目标真实入口 E2E 已验证`
- 对象：炽天使「飞行」产生的临时奖励骰，以及防御响应窗口中确认临时骰后继续用「抬一手」修改正式防御骰。
- 当前边界：本文件重点证明飞行临时骰确认、正式骰恢复、响应窗口内抬一手目标归属这条链路；完整 DiceThrone 单测已另行补跑通过，但仍不能把它扩大解释为“树精最终完全没掉血”已复现。

## 原始症状

- 用户原话目标：使用飞行奖励骰时没有确认按钮；使用「抬一手」修改对方防御骰时直接无法打出；正式骰和临时骰需要严格区分，至少暴露确认按钮，让确认后能回到正式骰；端到端要补充并跑通。
- 保真断言：
  - 飞行临时骰是独立临时骰，不能替代或吞掉正式进攻 / 防御骰。
  - 临时骰等待确认时，骰主必须能看到并点击确认按钮。
  - 确认临时骰后，系统必须恢复被挂起的正式骰。
  - 防御响应窗口仍然打开时，确认临时骰不能挡住响应者继续打「抬一手」，且「抬一手」必须命中防御方的正式防御骰。

## 根因分层

| 层级 | 本轮证据 |
| --- | --- |
| 现实故障现象 | 玩家在飞行临时骰后看不到确认入口，或确认后无法继续针对正式防御骰使用改骰牌。 |
| 直接触发条件 | 右侧奖励骰确认 UI 曾在响应窗口存在时隐藏；响应窗口只按当前响应者放行命令，误挡临时骰骰主确认自己的临时骰。 |
| 错误执行动作 | 临时骰确认后旧逻辑可能停在奖励骰回看，不恢复挂起的正式骰；旧存档 / 代表态缺显式父上下文时，防御阶段父骰 owner 可能被推成当前进攻方。 |
| 根本机制 | 正式骰与临时骰的父子关系没有被所有消费者一致执行：UI、响应窗口门控、临时骰确认 reducer 和旧状态恢复推断没有共同尊重“临时骰挂起正式骰，确认后回到正式骰”的生命周期。 |

## 本轮改动

| 文件 | 改动 | 现实效果 |
| --- | --- | --- |
| `src/games/dicethrone/Board.tsx` | 右侧奖励骰确认按钮不再因为响应窗口存在而隐藏。 | 飞行临时骰期间，骰主能看到并点击确认。 |
| `src/engine/systems/ResponseWindowSystem.ts` | 响应窗口普通白名单检查前允许游戏侧声明当前活跃交互的合法命令。 | 响应窗口不会误挡临时骰骰主确认 / 重掷自己的临时骰。 |
| `src/games/dicethrone/game.ts` | DiceThrone 为 `dt:bonus-dice` 放行骰主的确认 / 重掷 / 跳过奖励骰重掷命令。 | 飞行临时骰即使发生在对方响应窗口中，也能正常确认收口。 |
| `src/games/dicethrone/domain/reducer.ts` | 临时骰只要有挂起父骰，确认后恢复父正式骰，不因 `complete` 续跑语义停在奖励骰回看。 | 确认飞行临时骰后回到正式进攻 / 防御骰。 |
| `src/games/dicethrone/domain/rollContext.ts` | 缺显式父上下文时按阶段、pending attack 和骰主推断正式父骰，不再硬套当前行动方。 | 防御阶段恢复的是防御方正式骰，而不是进攻方或 effect 骰。 |
| `src/games/dicethrone/__tests__/roll-context.test.ts` | 增加 complete 临时骰、旧状态进攻父骰、旧状态防御父骰恢复断言。 | 锁住正式骰 / 临时骰分离与确认后恢复。 |
| `src/games/dicethrone/__tests__/tianshi-behavior.test.ts` | 扩展防御阶段飞行失败后恢复正式防御骰，并继续打出「抬一手」修改防御骰。 | 领域层覆盖用户指出的防御响应窗口链。 |
| `e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts` | 新增两条真实入口 E2E：飞行临时骰确认回正式进攻骰；防御响应窗口内确认飞行临时骰后「抬一手」命中正式防御骰。 | 浏览器层覆盖玩家真实可见按钮、确认和改骰目标。 |

## 关键截图与观察

### 飞行临时骰等待确认

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-ability-card-real-entry.e2e\消耗飞行-Token-的临时奖励骰应显示右侧确认，确认后回到正式进攻骰\tianshi-flight-token-right-tray-rolling.jpg`

观察：
- 画面处于「掷骰攻击阶段」，右侧只显示飞行产生的 2 颗临时骰。
- 右侧可见黄色「确认」按钮，「结束攻击」仍是灰色不可用。

结论：达到“临时骰有明确确认入口，且未确认前不推进原攻击阶段”的验收点。

### 飞行临时骰确认后回到正式进攻骰

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-ability-card-real-entry.e2e\消耗飞行-Token-的临时奖励骰应显示右侧确认，确认后回到正式进攻骰\tianshi-flight-token-right-tray-after-confirm-return-main-dice.jpg`

观察：
- 右侧显示 5 颗正式进攻骰，不再是飞行的 2 颗临时骰。
- 临时骰确认按钮已变成已确认状态，攻击阶段的正式操作按钮恢复可用。

结论：达到“确认临时骰后恢复正式进攻骰”的验收点。

### 防御响应窗口中的飞行临时骰等待确认

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-ability-card-real-entry.e2e\防御响应窗口中飞行临时骰确认后，抬一手应继续命中正式防御骰\tianshi-defense-flight-response-window-confirm-ready.jpg`

观察：
- 画面处于「掷骰防御阶段」，右侧显示飞行产生的 2 颗临时骰。
- 右侧黄色「确认」按钮可见，说明响应窗口没有挡住骰主确认临时骰。

结论：达到“防御响应窗口内临时骰仍可由骰主确认”的验收点。

### 确认后「抬一手」命中正式防御骰

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\tianshi-ability-card-real-entry.e2e\防御响应窗口中飞行临时骰确认后，抬一手应继续命中正式防御骰\tianshi-defense-flight-after-confirm-give-hand-targets-defense-dice.jpg`

观察：
- 右侧显示 5 颗正式防御骰，不再是飞行临时骰。
- 画面出现「选择骰子 (0/1)」，正式防御骰可被选择；「天使斗篷」防御技能仍处于已选状态。

结论：达到“确认临时骰后恢复正式防御骰，且抬一手继续命中正式防御骰”的验收点。

## 验证命令

- `npm run typecheck`
  - 结果：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/roll-context.test.ts --configLoader native`
  - 结果：`1 passed / 52 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/damage-tracking-regression.test.ts src/games/dicethrone/__tests__/token-response-window.test.ts src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/monk-faq.test.ts src/games/dicethrone/__tests__/useAnimationEffects.rollback.test.tsx --configLoader native`
  - 结果：`5 passed / 90 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/tianshi-behavior.test.ts --configLoader native -t "防御阶段先选择天使斗篷"`
  - 结果：`1 passed / 53 skipped`。
- `npm run test:dicethrone`
  - 结果：通过。
- `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "消耗飞行 Token 的临时奖励骰应显示右侧确认，确认后回到正式进攻骰"`
  - 结果：`1 passed`。
- `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "防御响应窗口中飞行临时骰确认后，抬一手应继续命中正式防御骰"`
  - 结果：`1 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --configLoader native -t "天使之羽埋葬后下一次事件属性检定|兔脚重掷事件骰后，只在确认最终结果时结算最终分支|Jack’s Spirit 回到尸体房间后"`
  - 结果：`1 passed / 3 passed / 690 skipped`。
- `npm run spec:lint`
  - 结果：通过。
- `openspec validate refactor-authoritative-state-view-boundary --strict --no-interactive`
  - 结果：通过。
- `git diff --check`
  - 结果：通过；仅有工作区换行提示。

## 同类扩审记录

- 搜索 / 审查维度：右侧奖励骰确认、`dt:bonus-dice` 当前交互、响应窗口非当前响应者命令放行、临时骰确认后恢复父骰、旧状态无显式父上下文时的正式骰阶段推断。
- 命中判断：
  - 问题不是飞行单个 token 的 UI 小洞，而是临时骰生命周期在 UI、响应窗口、reducer 和旧状态恢复上的共享职责不一致。
  - 本轮修到共享门控和共享骰区恢复逻辑，而不是只给飞行单独补按钮。
- 未扩大范围：
  - 当前工作区还有其它 DiceThrone 和 UI 改动，本证据不把它们算作本轮飞行临时骰修复成果。
  - 本轮没有宣称整文件 E2E 或 DiceThrone 全量黄金链已全部通过；只声明上述两条点名 E2E 已跑通。
