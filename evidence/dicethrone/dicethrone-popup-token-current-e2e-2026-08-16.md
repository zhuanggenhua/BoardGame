# DiceThrone 弹窗回归与 Token 响应截图证据

> 2026-08-17 更新：本文中“月精灵闪避使用后由共享响应提示确认”的截图口径已被取代，只能作为历史弹窗位置 / Token 高亮证据。当前闪避临时骰确认合同见 `evidence/dicethrone/dicethrone-token-evasion-right-tray-confirm-2026-08-17.md`：闪避骰进入右侧骰盘后，共享响应提示保留为无按钮状态层，必须由右侧骰盘普通“确认”按钮收口。

## 结论

历史验收状态：PASS；闪避确认入口部分已被 2026-08-17 新证据取代。

本轮只覆盖三条当前重新运行的 E2E：

- `e2e/dicethrone/dicethrone-ai-ultimate-response.e2e.ts`：真人响应提示固定在手牌抬起区上方，悬浮手牌不漂移，跳过后关闭。
- `e2e/dicethrone/dicethrone-token-response-window.e2e.ts`：武僧太极 Token 使用前可见可点，使用后通过共享响应提示收口并按 4 点伤害结算。
- `e2e/dicethrone/dicethrone-token-response-window.e2e.ts`：月精灵闪避 Token 使用前可见可点，使用后闪避骰进入右侧骰盘，确认后免伤收口回主阶段。

本证据不使用全流程合集图，也不使用旧 `_labeled-for-pureref` 目录。最终用户验收图组为：

`test-results/evidence-screenshots/dicethrone/dicethrone-popup-token-current-e2e-20260816-1958/_labeled-for-pureref-utf8`

## 自动断言

- 响应提示使用视口固定锚点和历史手牌抬起槽位，不挂在玩家座位、手牌 hover、骰盘或右栏下面。
- 响应提示不遮挡右侧骰盘；悬浮手牌后提示位置不漂移。
- Token 使用前必须有可点击高亮：中等边缘流光、2px 描边、轻呼吸、Token 本体轻亮度和投影；禁止恢复大面积强光圈，也禁止弱到只有发丝线。
- 旧 Token 弹窗、旧内嵌响应条、奖励骰旧覆盖层和奖励骰旧确认按钮都不存在。
- 太极使用后当前伤害从 5 降到 4，跳过后按 4 点伤害结算。
- 闪避使用后闪避骰在右侧骰盘等待确认，共享响应提示保留为状态层但不承担确认；点击右侧骰盘确认后免伤并回到主阶段。

## 截图清单

| 顺序 | 原图 | 图面结论 |
| --- | --- | --- |
| 01 | `test-results/evidence-screenshots/dicethrone/dicethrone-ai-ultimate-response.e2e/真人响应提示更显眼且可跳过并关闭响应窗口/01-真人响应固定在手牌抬起区上方.jpg` | 响应提示在手牌抬起区上方，未进入右侧骰盘，也不是牌桌中央大弹窗。 |
| 02 | `test-results/evidence-screenshots/dicethrone/dicethrone-ai-ultimate-response.e2e/真人响应提示更显眼且可跳过并关闭响应窗口/02-悬浮手牌时响应提示位置不漂移.jpg` | 手牌悬浮后响应提示仍固定在同一 HUD 槽位，位置没有跟着手牌漂移。 |
| 03 | `test-results/evidence-screenshots/dicethrone/dicethrone-ai-ultimate-response.e2e/真人响应提示更显眼且可跳过并关闭响应窗口/03-真人跳过响应后提示关闭.jpg` | 点击跳过后响应提示关闭，画面没有残留隐藏弹窗入口。 |
| 04 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/武僧太极减伤走共享响应框并在跳过后结算血量/太极响应-使用前共享提示贴近手牌且Token可点.jpg` | 太极 Token 在玩家面板原位可见，当前高亮为中等边缘流光，能看出可点但没有盖住 Token 本体。 |
| 05 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/武僧太极减伤走共享响应框并在跳过后结算血量/太极响应-减伤后仍由共享提示跳过收口.jpg` | 点击太极后仍由手牌上方共享响应提示继续收口，没有恢复旧 Token 弹窗。 |
| 06 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/武僧太极减伤走共享响应框并在跳过后结算血量/太极响应-跳过后按四点伤害扣血收口.jpg` | 跳过响应后按 4 点伤害正式扣血，太极减伤效果已经落地。 |
| 07 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由共享响应框确认收口到-main2，不再卡在-defensiveRoll/闪避响应-使用前共享提示贴近手牌且Token可点.jpg` | 闪避 Token 在玩家面板原位可见，当前高亮为中等边缘流光，能看出可点但没有变成大光圈。 |
| 08 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由共享响应框确认收口到-main2，不再卡在-defensiveRoll/闪避响应-成功后闪避骰在右侧骰盘等待确认.jpg` | 历史坏基线：点击闪避后，闪避骰进入右侧骰盘等待确认；共享提示不占骰盘，但旧图仍让共享提示承担确认。当前正确合同是共享提示只做状态层，右侧骰盘确认。 |
| 09 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由共享响应框确认收口到-main2，不再卡在-defensiveRoll/闪避响应-确认后免伤收口回到主阶段.jpg` | 确认闪避骰后响应窗口收口、免伤生效并回到主阶段。 |

## 验证命令

- `npx vitest run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx --reporter dot`
- `npm run typecheck`
- `npm run spec:lint`
- `node scripts/infra/run-e2e-single.mjs isolated e2e/dicethrone/dicethrone-token-response-window.e2e.ts "武僧太极减伤走共享响应框并在跳过后结算血量"`
- `node scripts/infra/run-e2e-single.mjs isolated e2e/dicethrone/dicethrone-token-response-window.e2e.ts "月精灵闪避成功后由共享响应框确认收口到 main2，不再卡在 defensiveRoll"`
- `node scripts/infra/run-e2e-single.mjs isolated e2e/dicethrone/dicethrone-ai-ultimate-response.e2e.ts "真人响应提示更显眼且可跳过并关闭响应窗口"`

## 规范落点

规范主源已更新在 `.spec/knowledge/standards/ui-change-gates.md`：多个同层候选对象同时可用时，应使用中等强度的边缘提示，必须一眼可辨认，但不能盖住对象本体；禁止在强光圈和几乎看不见的发丝线之间来回摆动。
