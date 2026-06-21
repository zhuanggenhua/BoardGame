# FantasyRealms 本地 AI 往返 E2E 证据

## 场景

- 测试文件：`e2e/fantasyrealms/fantasyrealms-test-route-local-ai.e2e.ts`
- 入口：`/play/fantasyrealms?players=2&playerID=0&seat1=local-ai&seat1Delay=0`
- 目标：验证双人本地 AI 在 `seat1Delay=0` 时，玩家弃牌后能真实接手，并把回合交回给玩家；同时不再出现“玩家3”或原始错误键/误报 toast。
- 本次实测往返耗时：`96ms`

## 关键截图

### 1. 自动开局后进入弃牌阶段

- 绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-test-route-local-ai.e2e\合法测试入口里显式-seat1Delay=0-时，seat1-local-ai-会在无最小等待预算下真实接手并把回合交回\合法测试入口里显式-seat1Delay=0-时，seat1-local-ai-会在无最小等待预算下真实接手并把回合交回-test-route-local-ai-opening.png`
- 肉眼观察：
  - 顶部已经进入 `你的回合`，阶段按钮显示 `弃一张牌`，说明“只有一个合法选择时自动摸牌”已经生效。
  - 画面上只有两名玩家对应的信息，没有第三名玩家提示。
  - 右上角没有错误提示。

### 2. 玩家弃牌后，AI 接手并把回合交回

- 绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-test-route-local-ai.e2e\合法测试入口里显式-seat1Delay=0-时，seat1-local-ai-会在无最小等待预算下真实接手并把回合交回\合法测试入口里显式-seat1Delay=0-时，seat1-local-ai-会在无最小等待预算下真实接手并把回合交回-test-route-local-ai-roundtrip-back-to-human.png`
- 肉眼观察：
  - 顶部再次显示 `你的回合`，并且轮次已经推进到 `第3轮`，说明 AI 的一整轮已经真实完成。
  - 中央公开牌与底部手牌都正常更新，没有额外的“玩家3”信息。
  - 右上角没有 `notInDrawStage` 原始错误键，也没有翻译后的误报 toast。

## 结论

- 本地 AI `seat1Delay=0` 配置已生效。
- 玩家结束操作后，AI 往返回到玩家的实测时间为 `96ms`。
- 这条真实页面链路上，之前看到的原始错误键与误报 toast 均已消失。
