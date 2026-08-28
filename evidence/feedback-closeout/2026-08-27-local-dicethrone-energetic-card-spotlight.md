# 2026-08-27 本地反馈收口：Dice Throne 精力充沛卡牌特写

## 口径

- 本轮口径：本地数据库反馈。
- 真实读写源：本机 MongoDB `mongodb://127.0.0.1:27017/boardgame` 的 `feedbacks` 集合。
- 本地状态镜像：`temp/feedback-closeout/status-board.json`，只作镜像，不替代本地数据库当前状态。
- 统计时间：2026-08-27 11:50:59 +08:00。
- 本轮反馈：`6a8f8416dae4c8df32251a83`，同类本地反馈：`6a8da6725b6a95d4c9d5126a`。

## 原始症状

- `6a8f8416dae4c8df32251a83`：玩家原话是“精力充沛怎么没有弹出特写，奖励骰应该是各自确认吧……”。本轮保真目标是“精力充沛”打出后卡牌本体特写没有显示。
- `6a8da6725b6a95d4c9d5126a`：玩家原话是“效果对不上”。本地日志显示 AI 打出“顿悟！”后紧接奖励骰掷出与确认，属于同一类“卡牌打出后立即产生奖励骰，卡牌本体展示容易被奖励骰显示状态覆盖”的风险链。

## 事实分流

- “奖励骰应该各自确认吧”是玩家在看不到特写和奖励骰快速确认后的建议/困惑，不是本轮已授权的规则改动。
- Dice Throne 当前奖励骰合同保持不变：奖励骰本体、改骰、重投和普通确认仍由右侧 2D 骰盘承接；本轮没有新增奖励骰响应窗口。
- 参考 Smash Up 的特写处理：卡牌特写队列与 reveal/prompt 等后续展示并排渲染，后续交互状态不主动清空卡牌特写队列。

## 根本机制

- 现实故障现象：对手/AI 打出“精力充沛”这类会立即产生奖励骰的卡牌时，玩家可能看不到卡牌本体特写。
- 直接触发条件：奖励骰进入当前骰上下文或存在待结算奖励骰后，Board 会把卡牌特写队列当成需要隐藏的对象。
- 根本机制：`src/games/dicethrone/Board.tsx` 里原先存在 `suppressCardSpotlightForBonusDiceSurface`，它在奖励骰上下文下循环调用 `handleCardSpotlightClose(item.id)` 清空已排队的卡牌特写，并在渲染时把 `cardSpotlightQueue` 传成空数组。这个机制能解释“卡牌已打出、奖励骰显示/确认出现，但精力充沛特写没有弹出”。
- 引入范围：`git blame` 显示这段清空逻辑来自提交 `a627cfceb` 的 Board 特写处理片段；本轮只移除该显示层清空/隐藏逻辑。

## 修复

- `src/games/dicethrone/Board.tsx`
  - 删除奖励骰上下文下主动清空卡牌特写队列的 effect。
  - `CenterBoard` 继续接收真实 `cardSpotlightQueue`，不再因为奖励骰右侧骰盘状态传空数组。
- `src/games/dicethrone/domain/systems.ts`
  - 撤回上一轮错误响应窗口改动；奖励骰请求重新直接进入 `dt:bonus-dice` 右侧骰盘普通确认。
- `docs/games/dicethrone/card-timing-terms.md`
  - 恢复奖励骰与攻击骰分流合同，并补充：打出卡牌本体的可读特写不能因为奖励骰转入右侧骰盘而被清空或隐藏。
- 测试与 E2E 文案
  - 恢复一掷千金、雷霆万钧、万箭齐发和黄金链中“奖励骰不先开响应窗口”的断言。
  - 新增源级护栏，禁止 Board 重新出现该清空/隐藏逻辑。
  - 新增“对手打出精力充沛并路由奖励骰时，卡牌特写仍保留给玩家阅读”的回归测试。

## 验证

- `npx vitest run src/games/dicethrone/__tests__/useCardSpotlight.rollback.test.tsx -t "精力充沛|奖励骰路由|自己打出会投奖励骰" --configLoader native`
  - 结果：1 个测试文件通过，3 个测试通过，5 个未命中测试跳过。
- `npx vitest run src/games/dicethrone/ui/__tests__/compatSource.test.ts -t "奖励骰右侧骰盘" --configLoader native`
  - 结果：1 个测试文件通过，1 个测试通过，5 个未命中测试跳过。
- `npx vitest run src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts --configLoader native`
  - 结果：1 个测试文件通过，4 个测试通过。
- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "一掷千金奖励骰结算前不打开响应窗口" --configLoader native`
  - 结果：1 个测试文件通过，2 个测试通过，144 个未命中测试跳过。
- `npx vitest run src/games/dicethrone/__tests__/volley-5-dice-display.test.ts --configLoader native`
  - 结果：1 个测试文件通过，4 个测试通过。
- `npx vitest run src/games/dicethrone/__tests__/thunder-strike.test.ts --configLoader native`
  - 结果：1 个测试文件通过，6 个测试通过。
- 源码扫描：`src/games/dicethrone`、`docs/games/dicethrone`、`e2e/dicethrone` 已无错误的奖励骰强制响应窗口口径；旧错误字样只保留在撤回 evidence 与源级护栏断言中。

## 同类扩审

- 搜索维度：`suppressCardSpotlightForBonusDiceSurface`、`handleCardSpotlightClose(item.id)`、`cardSpotlightQueue={...}`、`BONUS_DICE_REROLL_REQUESTED`、`afterRollConfirmed-bonus`、`BonusDieOverlay`。
- DiceThrone Board 已消除“奖励骰状态清空卡牌特写队列”的显示层根因。
- Smash Up 参考结论：`src/games/smashup/Board.tsx` 中 `CardSpotlightQueue` 独立接收 `actionSpotlight.queue`，与 reveal/prompt 并排渲染，不用后续交互状态清空卡牌特写。
- 残余风险：本轮没有跑浏览器黄金链；本轮收口依赖低层 hook 测试、Board 源级护栏和奖励骰领域回归。若要证明真实浏览器动画层最终观感，需要另跑 DiceThrone 真实入口截图链。

## 状态回写

- 待回写文案：已修复“精力充沛/顿悟这类卡牌打出后，卡牌本体特写被奖励骰右侧骰盘状态清掉或隐藏”的问题。奖励骰本体仍按原合同在右侧骰盘确认，本轮没有新增奖励骰响应窗口。
