# 山屋惊魂特殊行动预算 E2E 证据

## 验收对象

- 规则切片：每个可用特殊行动 / 来源每回合各一次；本回合新获得的物品 / 预兆不能立刻执行特殊行动；被动效果不占特殊行动。
- 当前范围：持有物入口、神秘电梯房间效果入口、作祟特殊行动入口的预算读法和玩家可见禁用原因。
- 不外推范围：不证明所有持有物效果、所有房间文字、全部作祟特殊行动、完整怪物系统、攻击声明或 50 个作祟逐条合同完成。

## 执行命令

- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts e2e/betrayal/special-action-budget.e2e.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json`
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "被动持有物|本回合新获得|神秘电梯本回合已用|当前房间是神秘电梯" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "持有物特殊行动预算|作祟特殊行动预算|房间效果" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/special-action-budget.e2e.ts`

## 截图证据

| 截图 | 绝对路径 | 肉眼核验 |
| --- | --- | --- |
| `01-被动持有物不能主动使用.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\special-action-budget\01-被动持有物不能主动使用.jpg` | 真实牌桌处于恶兆前；持有区选中“盔甲”；底部“使用”入口保留但置灰；玩家可见短提示显示“被动效果，不能主动使用”。 |
| `02-本回合新获得下回合可用.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\special-action-budget\02-本回合新获得下回合可用.jpg` | 真实牌桌处于恶兆前；持有区选中“奇怪的药品”；卡牌标记“下回合”；底部“使用”入口置灰，短提示显示“本回合新获得，下回合可用”。 |
| `03-房间效果本回合已用.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\special-action-budget\03-房间效果本回合已用.jpg` | 当前房间为“神秘电梯”；底部“神秘电梯”房间效果入口仍保留但置灰；短提示显示“该房间效果本回合已用”。 |

## 自动断言

- 被动持有物 `armor / 盔甲`：`betrayal-action-use` 保留但禁用，`data-action-disabled-reason` 为“被动效果，不能主动使用”；可见短提示和移动端状态同源。
- 刚获得持有物 `holy-water / 奇怪的药品`：当前持有但不在回合开始快照中，`receivedCardIdsThisTurnByPlayerId` 记录刚获得；使用入口禁用并显示“本回合新获得，下回合可用”。
- 房间效果 `mysticElevator / 神秘电梯`：`usedRoomEffectIdsThisTurn` 含 `mysticElevator`；房间效果入口仍显示“神秘电梯”，禁用原因是“该房间效果本回合已用”。

## AI 图面核验

- 联系图：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\special-action-budget\_ai-audit-contact-sheet.jpg`。
- 结论：通过。三张图均为当前真实牌桌整屏截图，能看到对应持有物 / 房间对象、底部入口和玩家可读禁用短原因；不是只靠隐藏字段或测试断言收口。

## 发布口径

- 当前切片可以证明“特殊行动预算”这条基础规则已经有统一读模型和三类入口的真实页面承接。
- 当前切片不能证明完整山屋规则已经完善；攻击声明、交易牌面禁用、怪物系统、尸体搜刮、障碍物和 50 个作祟逐条合同仍按覆盖矩阵继续推进。
