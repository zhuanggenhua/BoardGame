# DiceThrone：human 持可响应牌时，自动 watchdog 收口 E2E 证据

## 范围

- 目标：验证当 **AI 当前阶段** 卡在 **human 对手可响应的响应窗口** 时，服务端 watchdog 不再无效空转，而是会**自动关闭响应窗口并把控制权交还给真人**。
- 真实链路要求：
  1. 给 human 手牌注入稳定响应牌 `card-surprise`；
  2. 构造 `afterCardPlayed` 响应窗口，当前响应者为 human；
  3. 不点击悬浮球，直接等待服务端 watchdog 自动收口。

## 本轮执行

### 静态检查

```bash
npx eslint src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/pages/MatchRoom.tsx src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/pages/onlineAiForceSkip.ts e2e/dicethrone/dicethrone-simple-start.e2e.ts
```

结果：0 errors，仅既有 warnings。

### 单测

```bash
npx vitest run src/engine/transport/__tests__/server.test.ts --config vitest.config.ts
npx vitest run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --config vitest.config.ts
```

结果：

- `server.test.ts`：35 tests passed
- `onlineAiRecovery-gameover.test.ts`：7 tests passed

### E2E

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 当前阶段遇到 human 可响应卡时，服务端 watchdog 应自动关闭响应窗口并推进阶段"
```

结果：1 passed。

## 关键截图

### 1. 自动 watchdog 介入前

- 路径：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-当前阶段遇到-human-可响应卡时，服务端-watchdog-应自动关闭响应窗口并推进阶段\20-online-ai-watchdog-human-response-before.png`

#### 我实际看到什么

1. 左侧阶段条停在 **主赛阶段(1)**，说明当前还在 AI 阶段中。
2. 画面中央下方有 **“可以响应 / 跳过”** 按钮，说明 human 响应窗口确实打开了，不是空场景。
3. 左下手牌区能看到 human 侧确实持有一张牌，符合“对手持可响应牌”的真实前置。

#### 是否达到前置验收标准

- **达到。**
- 这张图证明自动测试覆盖的是“AI 当前阶段 + human 真响应窗口”的真实卡死链路。

### 2. 自动 watchdog 收口后

- 路径：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-当前阶段遇到-human-可响应卡时，服务端-watchdog-应自动关闭响应窗口并推进阶段\20-online-ai-watchdog-human-response-after.png`

#### 我实际看到什么

1. 画面中间已经看不到 **“可以响应 / 跳过”** 按钮，说明 human 响应窗口已被自动关闭。
2. 左侧阶段条回到了 **主赛阶段(1)**，结合 E2E 状态断言，说明 watchdog 没停在 AI 阶段，而是已经把控制权交还给真人回合。
3. 右上角没有出现 **“强制结束 AI 回合未成功”** 或 **“AI 强制结束失败”** 之类失败提示。

#### 是否达到验收标准

- **达到。**
- 能证明三件事：
  1. 自动 watchdog 对 human 响应窗口场景已经生效；
  2. 它不是无效地空发 `ADVANCE_PHASE`，而是真的把卡死窗口收掉了；
  3. 收口后没有残留失败提示，用户不需要每次再手动点“强制结束 AI 阶段”。

## 结论

- 本轮已经补上 **“AI 当前阶段 + human 响应窗口”** 这条自动恢复缺口。
- 服务端 watchdog 在该场景下会先强制关闭响应窗口，再继续收口，最终把控制权交还给真人。
- 这解决了用户反馈的核心问题：**自动强制结束之前对这个场景无效，现在已经能自动修复，不再只能靠手动按钮兜底。**
