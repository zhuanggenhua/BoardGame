# FantasyRealms PC 进行页近终盘代表态核对

- 时间：2026-06-06
- 目标页面：`/play/fantasyrealms/local?players=6`
- 目标语义：PC 桌面进行中对局页，不是终局复盘，不是堆叠态
- 验收视口：`1920x1080`
- 代表态：自动推进到 `9/10` 公开弃牌，仍未结算

## 核对结论

- 仍为进行中：页面已到 `9/10`，但未出现终局结算文案。
- PC 牌桌已按 `1920x1080` 铺满：主牌桌实测为 `1888x1048`，不再受 `1440px` 最大宽度限制。
- 桌面极简进一步收口：未出现 `当前焦点`、`结束进度`、分数拆解、长段规则说明，也未出现 `当前总分 / 公开弃牌堆 / 某某的手牌` 这类区块标题。
- 主视觉仍由牌桌承接：中央公开弃牌河 + 底部手牌带是第一焦点，没有恢复右侧大 dock。
- 顶边信息已切成短标签：左上只保留牌库余量、回合短标签和主操作按钮；右上分数区已收成安静的座位式信息条，不再像一列信息卡片。
- 深色大框已退出 live 主区：公开弃牌区和手牌区不再各自套一整块厚底面板，桌面中央回到“牌直接落在桌面上”的语义。
- 公开弃牌已改成稳定两排：近终盘 9 张明牌不再乱交叉，而是收成规则化 5 + 4 槽位，9 张卡均为 `190x264`，没有末端重叠。
- 手牌带已回到平直可操作态：底部 7 槽保持平铺并放大铺开，首尾卡实测为 `210x292`，主操作按钮也保留在顶边，可读成真实可玩页面而不是纯展示稿。
- 局部描边已再次清退：右侧分数轨道、手牌托盘、中央牌区不再各自长出额外边框或角标装饰，装饰只服务整张牌桌背景。
- 必要 HUD 不再低对比：公开弃牌计数保留为 `74x34` 的中央筹码，字号 `17px`；当前玩家分数为 `34px`，不再淡到需要放大截图确认。
- 计数优先级已按对局语义收口：公开弃牌 `9/10` 直接关系结束进度，保留在中央公共牌区上方；手牌固定 7 槽且可直接数清，已移除常驻 `7/7`。
- 右侧计分名牌已重做对齐：当前玩家点、玩家名和分数改为同一行内布局，当前实测中心线一致为 `cy=180`。

## 证据

- 截图：[fantasyrealms-minimal-live-near-end-desktop-1920x1080-2026-06-06.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-minimal-live-near-end-desktop-1920x1080-2026-06-06.png)
- 自动核对摘要：
  - `viewport = 1920x1080`
  - `board = 1888x1048`
  - `bodyHasNineOfTen = true`
  - `hasGameOver = false`
  - `hasFocusPanel = false`
  - `hasProgressPanel = false`
  - `hasScoreHeader = false`
  - `hasDiscardHeader = false`
  - `hasHandHeader = false`
  - `hasVerboseStatus = false`
  - `liveTable = true`
  - `liveScoreRows = 6`
  - `riverRows = 2`
  - `equalRiverCardSize = true`
  - `overflowX = false`
  - `hasHandCount = false`
  - `riverCount = 74x34 / 17px`
  - `currentScore = 34px`
  - `currentScoreNameDotAligned = true`
