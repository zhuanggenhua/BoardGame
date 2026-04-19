# 大杀四方行动卡特写在线模式 E2E 验证

## 结论

在线模式下，行动卡特写已经稳定按“只给对手看”的语义工作：

- P0 在自己回合打出 `wizard_mystic_studies` 时，Guest 页面出现特写，Host 页面不出现本地自看特写。
- P1 在自己回合打出同一张行动卡时，Host 页面出现特写，Guest 页面不出现本地自看特写。

这次结论以在线房间为准，本地模式相关文档仅保留为排障记录，不作为最终验收依据。

## 测试方式

- 用例文件：`e2e/smashup-phase-transition-simple.e2e.ts`
- 用例名称：`在线模式对手打出行动卡时应显示特写`
- 场景搭建：在线房间 + 服务端权威状态注入
- 核心断言：
  - 对手页 `smashup-action-spotlight-card` 可见
  - 特写卡 `data-card-def-id='wizard_mystic_studies'`
  - 出牌方自己的 `card-spotlight-queue` 数量为 `0`

执行命令：

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:PW_WORKERS='1'
$env:PW_TEST_MATCH='e2e/smashup-phase-transition-simple.e2e.ts'
node node_modules/playwright/cli.js test -g '在线模式对手打出行动卡时应显示特写' --reporter=line
```

结果：

- `1 passed`

## 截图审查

### P0 出牌，Guest 看到特写

![P0 出牌后 Guest 页特写](../test-results/smashup-phase-transition-simple.e2e.ts-在线模式对手打出行动卡时应显示特写-chromium/action-spotlight-online-p0.png)

审查结论：

- 左上角回合条显示 `OPP / Play`，说明截图来自出牌方的对手视角。
- 画面中央存在特写浮层，右上角可见 `Played!` 标记。
- 右上角记分板显示 `P0 / YOU`，与 Guest 正在观看 P0 行动卡特写的语义一致。
- 卡面素材在这次截图里没有渲染出内容，因此卡牌身份不依赖肉眼判断；该次 E2E 已同时断言 `data-card-def-id='wizard_mystic_studies'`。

### P1 出牌，Host 看到特写

![P1 出牌后 Host 页特写](../test-results/smashup-phase-transition-simple.e2e.ts-在线模式对手打出行动卡时应显示特写-chromium/action-spotlight-online-p1.png)

审查结论：

- 左上角同样显示 `OPP / Play`，说明 Host 正在看对手 P1 的回合。
- 中央特写浮层可见，且带有 `Played!` 标记。
- 右上角记分板显示 `YOU / P1`，与 Host 作为对手观看 P1 特写相符。
- 同样因为截图中的卡面资源为空白框，具体牌名依赖 DOM 断言确认；该次 E2E 已断言 `data-card-def-id='wizard_mystic_studies'`。

## 根因与修复点

- 根因在 [`useEventStreamCursor.ts`](/F:/gongzuo/webgame/BoardGame/src/engine/hooks/useEventStreamCursor.ts)：`consumeOnReconcile=true` 且 reconcile 清空 `entries` 时，游标没有回到基线，导致后续复用较小事件 ID 的在线新事件被误吞。
- 修复后，reconcile 清空事件流时会同步重置游标，后续 `su:action_played` 能再次进入特写队列。
- 对应回归测试位于 [`useEventStreamCursor.test.ts`](/F:/gongzuo/webgame/BoardGame/src/engine/hooks/__tests__/useEventStreamCursor.test.ts)。
