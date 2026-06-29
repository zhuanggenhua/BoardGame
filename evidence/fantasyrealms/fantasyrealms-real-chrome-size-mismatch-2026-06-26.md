# Fantasy Realms 真实 Chrome 尺寸不一致排查 2026-06-26

## 结论

- 用户指出的“真实浏览器里的牌大小和端到端不一致”成立，但**不是当前代码天然仍然分叉**。
- 直接原因分成两段：
  1. 旧的真实 Chrome 牌桌 tab 仍挂着**旧 bundle / 旧尺寸链**。
  2. 当前开发环境新开的真实 Chrome 房间，已经吃到**新尺寸链**，并且在同一真实会话、同一视口、同一中央 2 张牌状态下，与 E2E `tight` 档读数一致。

## 真相源

### A. 旧真实 tab：确实还是旧尺寸链

- 旧 tab URL：
  - `http://127.0.0.1:4275/play/fantasyrealms/match/1vI42LCPqYL?playerID=0`
- 旧 tab 真实截图：
  - [fantasyrealms-real-chrome-4275-current-live.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-4275-current-live.png)
- 旧 tab 真实读数：
  - [fantasyrealms-real-chrome-4275-current-live.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-4275-current-live.json)

旧 tab 读到的运行时变量仍是旧公式：

- `centerRowWidth = min(1360px, 82vw)`
- `handRowWidth = min(1500px, calc(100vw - 136px))`
- `handHeaderWidth = min(1520px, calc(100vw - 140px))`

这证明用户看到的“真实页面和 E2E 不一致”不是错觉，而是旧真实 tab 还没吃到当前代码。

### B. 新真实房间：已吃到当前尺寸链

- 新真实房间 URL：
  - `http://127.0.0.1:4275/play/fantasyrealms/match/9PYIIzxm0We?playerID=0`
- 新真实房间当前截图：
  - [fantasyrealms-real-chrome-new-room-current.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-new-room-current.png)
- 新真实房间当前读数：
  - [fantasyrealms-real-chrome-new-room-current.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-new-room-current.json)

新真实房间读到的运行时变量已经是当前代码：

- `contentWidth = calc(100vw - 32px)`
- `centerRowWidth = min(1360px, calc(calc(100vw - 32px) * 0.86))`
- `handRowWidth = min(1510px, calc(calc(100vw - 32px) - 16px))`
- `handHeaderWidth = calc(100vw - 32px)`
- `actionRightOffset = calc(((100vw - calc(100vw - 32px)) / 2) + 44px)`

### C. 正式诊断脚本复测：同一条真实 Chrome 链可重复得到一致结果

- 诊断脚本：
  - [diagnose-fantasyrealms-real-chrome-size.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/diagnose-fantasyrealms-real-chrome-size.mjs)
- 运行命令：
  - `node scripts/infra/diagnose-fantasyrealms-real-chrome-size.mjs --output-prefix fantasyrealms-real-chrome-diagnose-2026-06-26`
- 正式脚本产物截图：
  - [fantasyrealms-real-chrome-diagnose-2026-06-26.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-diagnose-2026-06-26.png)
- 正式脚本产物读数：
  - [fantasyrealms-real-chrome-diagnose-2026-06-26.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-diagnose-2026-06-26.json)

这条脚本会在当前开发环境中：

1. 创建一个新的 Fantasy Realms 真实房间；
2. 直接把房间打开到带调试端口的真实 Chrome 会话；
3. 注入到“中央 2 张牌 + 8 张手牌”的对照状态；
4. 读取真实会话里的 CSS 变量、关键容器宽度和卡牌宽高；
5. 输出截图和 JSON。

该脚本本次复测结果与前面手工链一致：

- 视口：`1037 x 754`
- `devicePixelRatio = 1.75`
- 中央 2 张牌：`148 x 206`
- 手牌单卡：`115 x 160`
- 顶栏宽：`1005`
- 手牌区宽：`989`
- 主按钮宽：`184`
- 分数条宽：`108`

## 同一真实 Chrome 会话下的中央 2 张牌实测

为了排除“只是变量变了，实际牌还不一样”，把新真实房间直接推进到和 E2E 相同的“中央 2 张牌、8 张手牌、1037x754 / DPR 1.75”状态。

- 真实 Chrome 同状态截图：
  - [fantasyrealms-real-chrome-new-room-two-center-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-new-room-two-center-cards.png)
- 同状态读数来自：
  - [fantasyrealms-real-chrome-new-room-current.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/manual/fantasyrealms-real-chrome-new-room-current.json)

关键实测值：

- 视口：`1037 x 754`
- `devicePixelRatio = 1.75`
- 顶栏宽：`1005`
- 手牌区宽：`989`
- 中央 2 张牌：`148 x 206`
- 手牌单卡：`115 x 160`
- 主按钮宽：`184`
- 分数条宽：`108`

## 与当前 E2E 对照

- E2E `tight` 档读数：
  - [real-online-centered-two-card-widths.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中/real-online-centered-two-card-widths.json)
- E2E `tight` 档截图：
  - [real-online-hand-row-1037w.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持真实居中，不用左侧固定槽位冒充居中/real-online-hand-row-1037w.png)

E2E `tight` 档关键值：

- 中央 2 张牌：`148 x 206`
- 手牌单卡：`115 x 160`
- 顶栏宽：`1005`
- 手牌区宽：`989`
- 主按钮宽：`184`
- 分数条宽：`108`

与新真实房间完全对上。

## 当前可下结论的边界

- **可以确认**：
  - 旧真实 tab 的确会让人看到“牌大小和 E2E 不一致”。
  - 当前开发环境新开的真实 Chrome 房间，已经和 E2E `tight` 档尺寸一致。
  - 同样的结论已经被正式诊断脚本重复跑出，不是一次性手工现场。
- **不能偷换成的结论**：
  - 不能说“任何仍开着的旧 tab 都会自动变对”。
  - 不能说“所有历史房间、所有旧会话、所有缓存态都已经统一”。

## 涉及文件

- 当前 live 尺度链实现：
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/Board.tsx:1439)
- 当前在线尺寸回归：
  - [fantasyrealms-online-ai.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts:42)
