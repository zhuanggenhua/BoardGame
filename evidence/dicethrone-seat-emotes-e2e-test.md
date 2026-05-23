# DiceThrone 座位表情 E2E 证据

## 审核范围

- 功能：局内 HUD 座位表情。
- 场景：客座玩家从聊天窗口发送表情后，对手能在客座锚点看到座位弹出表情；发送方只保留聊天内本地表情回显，不出现自己的座位弹出表情。
- 用例：`e2e/dicethrone/dicethrone-seat-emotes.e2e.ts`，`客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情`。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/widgets/__tests__/SeatEmoteOverlay.test.tsx --configLoader native`
  - 结果：通过，2 tests passed。
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-seat-emotes.e2e.ts "客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情"`
  - 结果：通过，1 passed。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-seat-emotes.e2e\客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情\客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情-host-sees-player-1-seat-emote.png`
  - 肉眼观察：月精灵表情位于顶部客座信息条下方，主体完整可见。
  - 验收结论：对手视角下，表情未被顶部视口裁切，且能看出与客座锚点的对应关系，达到本轮视觉验收标准。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-seat-emotes.e2e\客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情\客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情-guest-chat-emote-picker-open.png`
  - 肉眼观察：发送方聊天面板已打开表情选择器，可见待发送表情入口。
  - 验收结论：证明发送入口位于聊天窗口内，符合当前交互路径。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-seat-emotes.e2e\客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情\客座从聊天窗口发送表情后只有对方能在客座锚点看到座位弹出表情-guest-chat-local-emote-no-seat-popup.png`
  - 肉眼观察：发送方聊天面板内能看到本地表情回显，画面中没有自己的座位弹出表情。
  - 验收结论：发送方侧只保留聊天内本地回显，不会重复在自己的座位锚点弹出同一表情，符合 spec。

## 修复说明

- `SeatEmoteOverlay` 将外层定位 transform 与内层弹出动画拆开，避免 CSS keyframes 覆盖顶部锚点的 `below` 避让结果。
- `LeftSidebar` 将 self 座位锚点从整条侧栏收窄到左下玩家牌/牌库区域，避免用整屏高度容器作为座位锚点。
- E2E 增加表情 bounding box 必须完整落在视口内的断言，并同时验证发送方不会重复出现自己的座位弹出表情，避免只凭 DOM 可见或局部可见误判通过。
