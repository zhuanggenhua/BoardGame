# SmashUp 自动反馈 `6a241d8cdb108bca6c5fa5f7` 收口证据

## 反馈对象

- 反馈 ID：`6a241d8cdb108bca6c5fa5f7`
- 游戏：`smashup`
- 来源：前端自动报错 `client-unhandled-rejection`
- 线上文案：`[auto][unhandledrejection] Maximum call stack size exceeded`

## 真实证据

- 生产库原始记录只包含前端报错栈，不包含 `stateSnapshot` / `actionLog`
- 栈顶指向旧前端资源：
  - `game-BNNPMel1.js`
  - `context-DQaPuQjR.js`
  - `useGameNamespaceReady-DHxXK1UM.js`
  - `MatchRoom-aXONMNFE.js`
- 同时期可回放的同根因 SmashUp 反制链快照，命中：
  - `smashup_action_counter_choose`
  - `time_travelers_its_astounding`
  - `SYS_INTERACTION_RESPOND pipeline_error: Maximum call stack size exceeded`

## 当前树复核

### 1. 当前线上首页资源名

命令：

```powershell
Invoke-WebRequest -UseBasicParsing https://easyboardgame.top
```

结果：

- 当前首页实际下发的是：
  - `/assets/index-1iuIMvYp.js`
  - `/assets/index-BD0NnIdb.css`
  - `/assets/vendor-howler-Bp1HXCiM.js`
  - 其他当前资源
- 已经不再包含 `game-BNNPMel1.js` / `MatchRoom-aXONMNFE.js`

这说明该反馈命中的前端包已经不是当前线上首页在用的资源版本。

### 2. 当前代码对同根因快照的回放

使用 `temp/feedback-closeout/remaining-open-samples-2026-06-04.clean.json` 中同根因的 SmashUp 反制链真实快照，直接跑当前代码的 AI 合法动作构建：

```bash
npx tsx -
```

回放结果：

```json
{
  "ok": true,
  "playerId": "0",
  "matchId": "tEFkjNkcYlt",
  "legalActionCount": 0,
  "legalActions": []
}
```

结果是正常返回 `0` 个合法动作，没有再出现 `buildLegalActions` 栈溢出。

### 3. 当前树已有同根因回归

命令：

```bash
pnpm vitest run src/engine/transport/__tests__/server.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native -t "online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress|tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进|buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 option id/disabled 相同但 value 漂移时，也必须变化|极客的力量链式反制会为下一位响应者刷新新的维尔候选"
```

结果：

- `1 file passed`
- `3 passed`
- `1 file skipped`

其中 transport 回归日志已证明：

- visible simple-choice 的候选值变化时，watchdog 会继续沿新 prompt 收口
- 不会再把“新候选 prompt”误判成“原地没推进”

## 结论

- 这条 `6a241d8cdb108bca6c5fa5f7` 没有独立快照可直接复现，只有旧前端 bundle 栈。
- 当前线上首页已经不再下发该旧 bundle。
- 当前代码对同根因的真实 SmashUp 反制链快照已不再出现 `buildLegalActions` 栈溢出。
- 因此本条应按 **当前树已恢复 / 旧前端包残留噪音** 收口，不再继续作为现存 bug 挂在未关闭队列。

## 收口口径

- 建议状态：`closed`
- 建议说明：`当前树已恢复；该条命中旧前端 bundle 栈，当前线上首页已不再下发该资源，且当前代码对同根因真实快照未再复现 buildLegalActions 栈溢出。`
