# Fantasy Realms live 动作入口修复证据（2026-06-23）

## 本轮范围

- 开局当唯一合法动作只有摸牌时，直接自动推进，不再停留一级摸牌按钮。
- 主按钮固定在右侧偏下，不压住手牌区。
- 弃牌阶段保留灰态 `弃牌` 锚点，真正弃牌由手牌本体承接。

## 关键截图

### 1. 开局自动摸牌后，直接进入待弃牌

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-live-flow.e2e\抓牌弃牌关键阶段截图链保持同一套正式-UI\01-开局自动摸牌后-待弃牌.png`

观察：
- 画面没有单独的 `摸牌` 一级按钮，说明开局唯一合法动作已自动执行。
- 右侧只保留灰态 `弃牌` 锚点，没有“像卡死一样无入口”的空桌面。
- 两张手牌已经出现在底部手牌区，下一步可直接点手牌弃置。

结论：
- 达到本轮“开局自动摸牌”的验收标准。

### 2. 中盘有公开弃牌时，主按钮固定在右侧偏下

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-live-flow.e2e\右侧偏下主按钮只承接摸牌，拿中央牌与弃牌由卡牌本体承接\live-action-right-dock-draw-only.png`

观察：
- `摸牌（或拿中央牌）` 按钮位于右侧偏下，没有跑到顶部。
- 按钮底边明显高于底部手牌区，没有压住手牌。
- 中央公开牌仍可直点，说明主按钮只承接摸牌，不和中央牌入口重复。

结论：
- 达到本轮“主按钮位置统一且不挡手牌”的验收标准。

### 3. 从中央拿牌后，进入待弃牌

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-live-flow.e2e\抓牌弃牌关键阶段截图链保持同一套正式-UI\04-点击中央牌拿取后-待弃牌.png`

观察：
- 从中央牌直点拿牌后，右侧回到灰态 `弃牌` 锚点。
- 底部 8 张手牌保持同一套底部手牌区，没有因为中途动作把按钮挤进手牌。
- 当前页面仍能一眼看出下一步是“弃牌”，没有消失的入口或重复说明。

结论：
- 达到本轮“拿中央牌后仍回到同一套正式 UI”的验收标准。

## 本轮验证

- `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - `49 passed`
- `npm run test:e2e:file -- e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts "抓牌弃牌关键阶段截图链保持同一套正式 UI"`
  - `passed`
- `npm run test:e2e:file -- e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts "右侧偏下主按钮只承接摸牌，拿中央牌与弃牌由卡牌本体承接"`
  - `passed`
