# 山屋惊魂：探索结算顺序与交易端到端 E2E 证据

生成时间：2026-07-18 08:49（Asia/Shanghai）

交换链路补充时间：2026-07-18 10:39（Asia/Shanghai）

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "脑状食品|一条秘密通道|正式探索"`
  - 结果：1 file passed；3 tests passed / 136 skipped。
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/event-choice-coverage.e2e.ts "脑状食品真实链路从探索翻牌到检定后选属性结算关闭" --timeout=120000`
  - 结果：1 passed。
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/first-scenario-trade-interaction.e2e.ts "真实页面可选物品、选目标并确认交易" --timeout=120000`
  - 结果：1 passed。
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/first-scenario-trade-interaction.e2e.ts "狗远距交易真实链路可选择多张持有物、4格内目标并收口" --timeout=120000`
  - 结果：1 passed。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "交易"`
  - 结果：1 file passed；8 tests passed / 141 skipped。
- `$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-command.mjs default e2e/betrayal/first-scenario-trade-interaction.e2e.ts --grep "真实页面可选择换回持有物并完成同意交换"`
  - 结果：1 passed。
- `npx eslint src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts e2e/betrayal/event-choice-coverage.e2e.ts e2e/betrayal/first-scenario-trade-interaction.e2e.ts`
  - 结果：0 errors / 18 warnings；warning 为既有 React Compiler memoization 与未用 helper 警告。
- `npx eslint src/games/betrayal/Board.tsx e2e/betrayal/first-scenario-trade-interaction.e2e.ts`
  - 结果：0 errors / 12 warnings；warning 为既有 React Compiler memoization。
- `npm run i18n:check`
  - 结果：通过；仅剩 `src/games/the-gang/Board.tsx` 的既有 dynamic-key warning。

## 探索 / 事件 / 投骰 / 结算顺序

截图目录：`evidence/山屋惊魂-事件牌页面承接E2E/`

- `脑状食品-完整链路-03-事件牌翻出已有力量检定.jpg`
  - 画面显示“脑状食品”事件牌、力量检定骰盘和属性选择同屏。
  - E2E 同步断言：事件未处理前当前行动者仍为 0 号，背景行动栏隐藏，不能切给下一位。
- `脑状食品-完整链路-05-结算结果可见.jpg`
  - 画面显示结算结果与底部“返回牌桌”按钮。
  - E2E 同步断言：结算结果未关闭前仍锁定 0 号，推荐动作为结束回合，背景行动栏隐藏。
- `脑状食品-完整链路-06-关闭后.jpg`
  - 画面回到牌桌，探索按钮置灰，出现结束回合入口。
  - E2E 同步断言：关闭结算后仍是 0 号，必须由当前玩家主动结束回合。
- `脑状食品-完整链路-07-下一位行动者可移动.jpg`
  - 画面切到 AI 2 号位，行动推荐恢复为移动，旧事件投骰不再残留。
  - E2E 同步断言：`currentPlayer=1`、`currentExplorer=1`、`recommendedAction=move`、`recentRoll=null`。

## 普通交易链

截图目录：`evidence/山屋惊魂-交易完整链路/`

- `01-交易前牌桌可操作.jpg`：牌桌处于交易可操作状态，同房间可交易对象为 1 人。
- `02-物品兔脚本体已选中.jpg`：兔脚被选中并有可见选中轮廓。
- `03-地图队友目标已选中.jpg`：点击地图 / 队友头像后选中 AI 2 号位目标。
- `04-确认交易前.jpg`：交易按钮可点击，流程提示进入“点交易确认”。
- `05-交易结算结果可见.jpg`：兔脚转移到 AI 2 号位，活动反馈显示交易结果。
- `06-交易后回牌桌状态清空.jpg`：交易选择清空，动作区回到可继续牌桌状态。

## 双向交换链

规则真相源：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:797-811`，同房间探索者可在双方同意下互相给/拿任意数量物品与预兆，因此本实现支持普通给出、只拿不交、以及双方各给出一组持有物的交换。

截图目录：`evidence/山屋惊魂-交换完整链路/`

- `01-交换前牌桌可操作.jpg`：牌桌处于当前玩家可操作状态，右侧可见同房间队友，底部交易入口可用。
- `02-选择队友后显示换回区.jpg`：选择兔脚和队友后，右侧队友区域出现可换回持有物，流程条显示“换回”步骤。
- `03-已选择换回地图.jpg`：点击队友的地图后，交易摘要显示“给出兔脚 / 换回地图”，交易按钮可发送请求。
- `04-发送交换请求等待同意.jpg`：发起方发送请求后没有立刻转移持有物，画面显示等待对方同意。
- `05-接收方同意交换前.jpg`：接收方视角出现同意/拒绝交易面板，并能看到给出与换回摘要。
- `06-交换结算结果可见.jpg`：接收方同意后双向结算，发起方得到地图，接收方得到兔脚，活动反馈显示交换结果。
- `07-交换后回牌桌状态清空.jpg`：换回选择区退场，旧选中态清空，牌桌回到可继续行动状态。

## 狗远距交易链

截图目录：`evidence/山屋惊魂-狗远距交易完整链路/`

- `01-狗交易前牌桌可操作.jpg`：显示狗远距交易选择器，状态说明为 4 格内目标，不是同房间交易。
- `02-用狗选择要送的持有物.jpg`：急救包和地图被选中，狗本身不作为送出持有物。
- `03-切到目标楼层看到4格内队友.jpg`：目标楼层可见 4 格内队友。
- `04-选择远距目标并确认前.jpg`：选中 AI 2 号位目标，交易按钮可确认。
- `05-狗交易结算结果可见.jpg`：急救包和地图转移给目标玩家，并记录狗已使用。
- `06-狗交易后回牌桌状态清空.jpg`：狗交易选择器消失，已交易物品不再残留。

## AI 图面核验

使用 `.tmp/betrayal-discovery-trade-validation-contact.jpg` 进行低清联系图核验，仅作为 AI 自检图，不作为用户验收原图。

结论：通过。

- 发现链：事件牌、骰盘、结算结果、底部“返回牌桌”、关闭后结束回合、下一位 AI 2 号位移动态均可见。
- 普通交易：确认前和结算后状态可见，目标为 AI 2 号位，交易后状态清空。
- 狗交易：4 格内目标选择和结算后状态可见，狗交易选择器在结算后退出。
- 双向交换：完整整屏图与关键区域裁图均已核验，能看到选择队友后的换回入口、地图作为换回对象、发请求等待同意、接收方同意面板、结算后状态清空。结论：通过。
