# Dice Throne 离线提示与移动端偏移修复验证

## 本轮目标

- 修正联机 HUD 在加载 / sync 前就把真人或 AI 座位显示成“离线”的误报。
- 修正 Dice Throne v2 玩家板（武士 / 枪手）在移动端窄横屏下继续向右偏移的问题。

## 代码变更

- `src/pages/matchHudPresence.ts`
  - 新增在线 HUD 展示态归一化逻辑。
  - 连接未就绪时，把 `players[].isConnected` 统一降为 `undefined`，避免在加载中误显示红点 / 离线横幅。
  - 游戏传输层就绪后，优先采用 `GameProvider` 的 `matchPlayers`。
  - AI 座位在 HUD 展示层按常在线处理，避免出现“AI 2 号位离线 xx 秒”的假提示。
- `src/pages/MatchRoom.tsx`
  - 在线模式 HUD 改为放到 `GameProvider` 内，通过 `OnlineGameHudBridge` 读取真实传输态。
- `src/components/game/framework/widgets/GameHUD.tsx`
  - `isConnected === undefined` 时显示中性状态，不再当成离线。
  - 只有 `presenceReady=true` 后才渲染 `OpponentOfflineBanner`。
- `src/games/dicethrone/ui/CenterBoard.tsx`
  - 仅在移动窄视口下撤掉 v2 玩家板的额外 `translateX`，保留桌面端原有布局。

## 自动化验证

### 1. Vitest

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --maxWorkers 1
```

结果：

- `30 passed`
- 新增覆盖：
  - 传输未就绪时不应把玩家误标成离线
  - 传输就绪后应优先采用在线同步状态
  - AI 座位在 HUD 中视作常在线

### 2. Playwright E2E（移动端右漂）

命令：

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"
```

结果：

- `1 passed`

该用例本身覆盖：

- Dice Throne 手机窄横屏
- `samurai` / `gunslinger` 这套 v2 玩家板
- 主棋盘、玩家板、提示板、弃牌堆的移动端边界断言
- 主棋盘中心组合区（玩家板 + 提示板）的横向中心点断言，防止整体继续右漂

### 3. Playwright E2E（HUD 离线横幅）

命令 1：

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online HUD: transport 未就绪时不应误报离线横幅"
```

结果：

- `1 passed`

命令 2：

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online HUD: 对手真实断开后应显示离线横幅"
```

结果：

- `1 passed`

这两条用例覆盖：

- 在线 Dice Throne 双人房间，双方都已完成真实占座并进入联机角色选择页。
- `transport` 被人为阻断时，页面停留在“连接中 / 正在加载对局资源...”，但顶部不应提前出现“已离线 xx 秒”红色横幅。
- 对手页面真实断开后，房主页顶部应在延迟后出现红色离线横幅，而不是在加载阶段误报。

## 产物截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\11-mobile-player-board-surface-magnify-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\12-mobile-tip-board-surface-magnify-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\13-mobile-player-board-button-magnify-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\14-mobile-discard-pile-inspect-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-HUD-transport-未就绪时不应误报离线横幅\20-online-hud-loading-no-offline-banner.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-HUD-对手真实断开后应显示离线横幅\21-online-hud-real-disconnect-offline-banner.png`

## HUD 截图人工复核结论

- `20-online-hud-loading-no-offline-banner.png`
  - 画面只有居中的“连接中 / 正在加载对局资源...”加载态，没有顶部红色离线横幅。
  - 按钮文案为“连接服务器...”，说明此时确实处于 transport 未就绪阶段，不是已经连上后被断开。
  - 图中不存在“等待对手加入...”或“已离线 xx 秒”文案，符合“加载中不误报离线”的目标。
- `21-online-hud-real-disconnect-offline-banner.png`
  - 顶部中央出现红色横幅，文案为 `Guest-... 已离线 0秒`，证明真实断开后 HUD 已进入离线提示态。
  - 红色横幅和角色选择主界面同时存在，说明这是 HUD 层提示，不是页面整体错误兜底。
  - 房主与对手底部座位胶囊仍保留，页面主界面未塌陷，符合“只补正确离线提示，不破坏正常 UI”的目标。
