# Fantasy Realms live 手牌尺寸一致性证据（2026-06-26）

## 本轮问题

用户指出的重点不是“中央牌有没有居中”，而是：

- 同一台 PC、同一类正式牌桌里，真实 Chrome 看到的牌本体大小和端到端截图不一致
- 尤其是双人对局早期，手里只剩 2 张牌时，手牌看起来会比正常 8 张手牌阶段更大

本轮只处理这一条真实症状，不把其他首页链、旧 tab 漂移问题混成同一个结论。

## 真实现场证据

在用户带调试端口的真实 Chrome 会话里，先前直接读取到：

- 同一窗口 `1037x754`
- 同一 live 桌面尺寸变量
- `2 张手牌` 现场曾为 `133x185`
- `8 张手牌` 现场为 `115x160`

对应现场抓取：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\chrome-open-phfcLsMc8Yh_playerID_0.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\chrome-open-phfcLsMc8Yh_playerID_0.json`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\chrome-open-9PYIIzxm0We_playerID_0.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\chrome-open-9PYIIzxm0We_playerID_0.json`

读取结果说明当时并不是“E2E 假图”，而是正式 live 桌面里手牌尺寸链确实会因为状态切换而变档。

## 根因

根因收敛到 Fantasy Realms live 桌面手牌槽位预算：

- 双人变体弃牌阶段，手牌槽位数原先可能仍按基础 `7 槽` 预算
- 同样的手牌区宽度下，`2 张手牌` 落进 `7 槽` 时，每列更宽，牌本体随之放大
- 正常 `8 张手牌` 阶段则按 `8 槽` 分配，牌宽回到较小档

这不是浏览器缩放问题，也不是中心线本身的问题，而是 live 手牌尺寸链没有单一来源。

## 本轮修改

- [src/games/fantasyrealms/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/Board.tsx:700)
  - 双人变体进入弃牌阶段时，live 桌面手牌槽位预算至少按 `8 槽` 走
- [src/games/fantasyrealms/__tests__/Board.foundation.test.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/__tests__/Board.foundation.test.tsx:936)
  - 新增单测：同一桌面视口下，`2 张手牌弃牌态` 与 `8 张手牌弃牌态` 宽高必须一致
- [e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts:369)
  - 现有真实在线尺寸合同追加断言：`1037x754` 下 `2 张手牌弃牌态` 与 `8 张手牌弃牌态` 同宽同高

## 修后真实 Chrome 证据

我重新在带调试端口的真实 Chrome 会话里新开房间，并分别注入：

- `2 张手牌弃牌态`
- `8 张手牌弃牌态`

修后真实截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-two-hand-discard-1037w.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-eight-hand-discard-1037w.png`

修后真实读数：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-two-hand-discard-1037w.json`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-eight-hand-discard-1037w.json`

关键结果：

- `2 张手牌弃牌态`
  - `visible = 2`
  - `slots = 8`
  - `handCard = 115 x 160`
- `8 张手牌弃牌态`
  - `visible = 8`
  - `slots = 8`
  - `handCard = 115 x 160`

说明同一视口下，真实 Chrome 里的牌本体大小已经收成同一档。

## 自动回归结果

单测：

- `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - `52 passed`

真实在线 E2E：

- `node scripts/infra/run-e2e-command.mjs default e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts --grep "真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中"`
  - `1 passed`

该 E2E 现在同时覆盖：

- 中央 2 张公开弃牌仍保持真实居中
- `1037x754` 下 `2 张手牌弃牌态` 与 `8 张手牌弃牌态` 尺寸一致

## 当前结论

本轮当前可证明的结论是：

- 用户指出的“牌大小和 E2E 不一致”是真问题，不是错觉
- 问题根因已经收敛并修复到 Fantasy Realms live 桌面手牌尺寸链
- 修后真实 Chrome 与正式在线 E2E 在这条 `2 张/8 张手牌同宽` 事实上已一致

本文件不覆盖“旧 tab 长时间挂旧 bundle / 刷新后漂移”的另一条问题；那条需要单独继续追。
