# 山屋惊魂《蜘蛛！》PC / 移动开放叠层同构验收

## 当前结论

- 结论时间：2026-07-22 08:52。
- 当前结论：PASS。
- 本轮撤回旧口径：事件选择面板里不再保留 `地图 / 门厅` 代理目标块，也不再出现 `点门厅 / 已选门厅` 这类可见代理标签；目标选择只由地图上的真实房间本体承接。
- 图面结论：PC 与移动横屏均保留开放桌面叠层，不隐藏左侧探索者 HUD、阶段、右侧牌堆/弃牌、底部行动栏；移动端没有专属黑底或另一套弹窗。
- 交互结论：确认按钮不是移动端独有；当前 PC 基线同样存在确认按钮。双端流程均为 `选择速度 → 点击地图上的门厅房间本体 → 确认按钮可用 → 结算 → 关闭后回牌桌`。

## 验证命令

- `npx eslint src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：0 errors；21 warnings，均为既有 React compiler / hook / 未用函数告警。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000`
  - 结果：74 passed。
- `node scripts/infra/run-e2e-single.mjs isolated e2e/betrayal/event-choice-coverage.e2e.ts "移动端横屏蜘蛛事件保持 PC 弹窗同构完整链路"`
  - 结果：1 passed。
- `node scripts/infra/run-e2e-single.mjs isolated e2e/betrayal/event-choice-coverage.e2e.ts "蜘蛛真实链路从探索翻牌到已有检定再选择结算关闭"`
  - 结果：1 passed。

## 截图读法

| 顺序 | 截图 | 玩家视角读法 | 结论 |
| --- | --- | --- | --- |
| 1 | `蜘蛛-完整链路-04-选择速度后目标房间候选.jpg` | PC：玩家已选速度；地图上的门厅房间本体显示候选高亮，事件选择面板内没有 `地图 / 门厅` 代理目标块，确认仍不可用。 | PASS |
| 2 | `移动端横屏-蜘蛛-PC同构弹窗-03-选择速度后目标房间候选.jpg` | 移动横屏：同样保留事件牌、骰盘结果、属性选项和周边 HUD；门厅候选在地图本体上可见，确认仍不可用。 | PASS |
| 3 | `蜘蛛-完整链路-05-已选目标房间确认可用.jpg` | PC：玩家点击门厅房间本体后，确认按钮可用；没有额外房间文字按钮或说明正文。 | PASS |
| 4 | `移动端横屏-蜘蛛-PC同构弹窗-04-已选目标房间确认可用.jpg` | 移动横屏：同样点击门厅房间本体后确认才可用；没有移动端独有确认语义或代理目标块。 | PASS |
| 5 | `蜘蛛-完整链路-06-结算后.jpg` | PC：确认后事件选择层退场，结算结果显示速度 +1、放置到门厅。 | PASS |
| 6 | `移动端横屏-蜘蛛-PC同构弹窗-05-结算结果可读.jpg` | 移动横屏：结算结果可读，事件牌和骰盘结果仍在开放叠层内，周边 HUD 保留。 | PASS |
| 7 | `蜘蛛-完整链路-07-关闭后.jpg` | PC：关闭结算后回到牌桌，探索者 token 留在门厅。 | PASS |
| 8 | `移动端横屏-蜘蛛-PC同构弹窗-06-关闭后回牌桌.jpg` | 移动横屏：关闭后阻塞层退场，牌桌恢复，探索者 token 留在门厅。 | PASS |

## 自动门禁补齐

- PC 与移动端都断言事件选择面板里不存在 `betrayal-event-choice-rooms` 和 `betrayal-event-choice-room-hallway`，防止再次出现 `地图 / 门厅` 代理目标块。
- PC 与移动端都断言地图目标上不存在 `点门厅 / 已选门厅` 这类代理标签，也不存在房间说明正文。
- PC 与移动端都断言真实地图房间候选可见、点击前未选中、点击后选中、确认按钮才可用。
- PC 与移动端都断言开放叠层没有专属黑底：事件层、事件面板、骰盘区、结果区背景均为透明。
- PC 与移动端都断言周边 UI 仍在：阶段、探索者属性面板、牌堆/弃牌、底部行动栏不被隐藏。
- PC 与移动端都断言后续效果真实触发：速度轨道前进 1 格、UI 属性快照同步真实速度、探索者真实放置到门厅、关闭后 token 留在门厅。

## 规范更新

- `.spec/knowledge/standards/ui-ux.md`：新增事件目标选择不得加代理文字标签或目标块；目标必须由真实对象本体承接。
- `D:\codex-home\skills\mobile-responsiveness\SKILL.md`：补充移动端不得新增 PC 没有的代理目标块，例如事件面板里的 `地图 / 某房间`。

## AI 图面裁决

- verdict: PASS
- score: 94 / 100
- hard_failures: []
- 观察：PC 与移动端仍是同一套开放桌面叠层。移动端只按横屏空间做尺寸压缩，没有把弹窗改成另一套黑底 UI；PC 没有被反向压成移动端布局。目标选择由地图房间本体承接，确认按钮只提交已经完成的选择。
