# Fantasy Realms 中央弃牌真实居中验收 2026-06-25

## 结论

- 以下只针对当前对话。
- 这次修掉的是 Fantasy Realms 真实牌桌里“中央公开弃牌少牌时是假居中”的问题，不是别的首页入口或骨架屏问题。
- 旧真实 DOM 证据里，2 张中央牌的牌组中心相对弃牌区中线偏了 `-337px`，属于明显左挂。
- 当前代码下，真实房间 9 张中央牌 `delta = 0`，2 张中央牌 `delta = -0.01`，已经回到真实中线。
- 这次又补上了之前缺失的一条：中央牌大小不能只拿 `1920x1080` 单档截图验收。当前在线房间回归已经同时覆盖 `1920` 和 `1281 / DPR 1.75` 两档，证明两档都是真居中，但牌宽会随真实窗口缩小。

## 真实房间证据

- 房间页：`http://127.0.0.1:4276/play/fantasyrealms/match/KDytK6gcO1O?playerID=0`
- 真实房间 9 张中央牌截图：
  [fantasyrealms-real-room-nine-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-room-nine-cards.png)
- 真实房间 9 张中央牌 DOM 读数：
  [fantasyrealms-real-room-nine-cards.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-room-nine-cards.json)
- 真实房间 2 张中央牌截图：
  [fantasyrealms-real-room-two-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-room-two-cards.png)
- 真实房间 2 张中央牌 DOM 读数：
  [fantasyrealms-real-room-two-cards.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-room-two-cards.json)

### 我实际看到的画面

- 9 张图里，上下两排中央牌围绕同一条视觉中线展开，不再是上排居中、下排偏一侧。
- 2 张图里，两张中央牌位于弃牌区正中，左右留白基本对称，不再出现“明明牌少却像被拉大并挂在左边”的假象。
- 2 张图的下一步主操作也明确可见：右下角 `摸牌（或拿中央牌）` 按钮仍在，不是靠截图摆拍遮过去。

### 关键数值

- 旧真实 DOM：`groupCenter = 450`，`discardCenter = 787`，`delta = -337`
- 当前真实房间 9 张：`expectedCenter = 787`，`groupCenter = 787`，`delta = 0`
- 当前真实房间 2 张：`expectedCenter = 787`，`groupCenter = 786.99`，`delta = -0.01`
- 在线房间宽桌面 2 张：`viewportWidth = 1920`，`cardWidth = 206`，`cardHeight = 286`，`discardCenterDelta = 0`
- 在线房间窄桌面 2 张：`viewportWidth = 1281`，`devicePixelRatio = 1.75`，`expectedCardWidth = 159.11`，`cardWidth = 159`，`cardHeight = 221`，`discardCenterDelta = 0`
- 在线房间宽桌面主控件：`deckWidth = 96`，`scoreStripWidth = 132`，`actionWidth = 224`
- 在线房间窄桌面主控件：`deckWidth = 85`，`scoreStripWidth = 117`，`actionWidth = 199`

### 大小与占比结论

- 之前用户看到“真实浏览器里的牌比 E2E 大/不一样”，不是错觉。旧 E2E 主要停留在 `1920x1080` 单档，天然会把中央牌看成 `206px` 宽。
- 当前实现下，真实桌面窗口缩到 `1281` 宽时，中央牌会按同一套 CSS 比例公式缩到 `159px`，不是继续维持 `206px`。
- 当前这轮又往前推进了一步：不只是中央牌，牌库、分数条、右下主按钮这些桌面主控件也会跟着窄桌面一起缩，不再只剩中央牌自己在变。
- 因此这次收口不再是“只证明居中”，而是同时证明：`1920` 档更宽、`1281` 档更窄，且两档都围绕弃牌区真实中线居中。

## 回归验证

- 单测：
  `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  结果：`50 passed`
- 隔离态 E2E：
  `node scripts/infra/run-e2e-command.mjs default e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts --grep "低张数公开弃牌保持真实居中，不再用左侧固定槽位冒充居中"`
  结果：`1 passed`
- 真实在线房间 E2E：
  `node scripts/infra/run-e2e-command.mjs default e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts --grep "真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中"`
  结果：`1 passed`

### E2E 关键截图

- 隔离态低张数截图：
  [low-count-real-centered-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-live-flow.e2e/低张数公开弃牌保持真实居中，不再用左侧固定槽位冒充居中/low-count-real-centered-cards.png)
- 在线房间 9 张截图：
  [real-online-centered-nine-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中/real-online-centered-nine-cards.png)
- 在线房间 2 张截图：
  [real-online-centered-two-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中/real-online-centered-two-cards.png)
- 在线房间窄桌面 2 张截图：
  [real-online-centered-two-cards-1281w.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中/real-online-centered-two-cards-1281w.png)
- 在线房间双宽度尺寸读数：
  [real-online-centered-two-card-widths.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中/real-online-centered-two-card-widths.json)

## 规则补强

- 已补到：
  [.spec/knowledge/standards/e2e-verification.md](/D:/gongzuo/webgame/BoardGame/.spec/knowledge/standards/e2e-verification.md)
- 新增的硬规则是：
  1. 几何居中/对齐必须直接量目标对象组中心与承载区中心的偏差，不能再拿“前几个固定槽位坐标差不多”冒充居中。
  2. 几何稳定性至少覆盖两种数量或尺寸状态，防止“只在单一截图里看起来像居中”。
  3. 只要用户质疑“真实窗口里的大小/占比”和 E2E 不一致，就必须补至少两档真实桌面宽度证据，不能继续只拿 `1920x1080` 单档截图交差。
