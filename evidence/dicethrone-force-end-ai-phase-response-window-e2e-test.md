# DiceThrone：human 持可响应牌时，手动“强制结束 AI 阶段”E2E 证据

## 范围

- 目标：验证当 **AI 当前阶段** 打开了 **human 对手的响应窗口** 时，悬浮球里的“强制结束 AI 阶段”不再卡死，并且**成功后确认面板会自动收起**。
- 真实链路要求：
  1. E2E 先注入 **可触发响应的稳定牌**（`card-surprise`）到 human 手牌；
  2. 再构造 `afterCardPlayed` 响应窗口，当前响应者为 human；
  3. 最后通过悬浮球入口点击“强制结束 AI 阶段”。

## 本轮执行

### 静态检查

```bash
npx eslint src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/pages/MatchRoom.tsx src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/pages/onlineAiForceSkip.ts e2e/dicethrone/dicethrone-simple-start.e2e.ts
```

结果：0 errors，仅既有 warnings。

### 单测

```bash
npx vitest run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --config vitest.config.ts
```

结果：1 file passed，7 tests passed。

### E2E

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 当前阶段遇到 human 可响应卡时，悬浮球强制结束应先关闭响应窗口再推进阶段"
```

结果：1 passed。

## 关键截图

### 1. 响应窗口打开前态

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-当前阶段遇到-human-可响应卡时，悬浮球强制结束应先关闭响应窗口再推进阶段\20-online-ai-manual-force-end-human-response-before.png`

#### 我实际看到什么

1. 左侧阶段条停在 **主赛阶段(1)**，顶部是 **AI 2 号位**，说明当前仍是 AI 的阶段。
2. 中间出现了响应窗口按钮 **“可以响应 / 跳过”**，这说明当前不是普通 AI 回合，而是真实卡在响应窗口。
3. 画面左下仍有一张手牌，符合“对手持有可响应牌”这一前置场景。

#### 是否达到前置验收标准

- **达到。**
- 这张图证明本次测试不是“空响应场景”，而是已经构造出 human 可响应的真实窗口。

### 2. 点击悬浮球后的收口态

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-当前阶段遇到-human-可响应卡时，悬浮球强制结束应先关闭响应窗口再推进阶段\20-online-ai-manual-force-end-human-response-after.png`

#### 我实际看到什么

1. 左侧阶段条已经从 **主赛阶段(1)** 推进到 **主赛阶段(2)**，说明 AI 阶段确实被推进了。
2. 前一张图中的 **“可以响应 / 跳过”** 按钮已经消失，说明响应窗口已被关闭，不再卡在 human 响应。
3. 右上角出现 **“AI 已强制结束回合”** toast，说明手动入口链路确实执行成功。
4. 右侧只剩悬浮球按钮列，**看不到“强制结束 AI 阶段”的确认面板**，说明本轮新增的“成功后自动收起”已经生效。

#### 是否达到验收标准

- **达到。**
- 能证明两件事：
  1. human 响应窗口已被手动强制关闭；
  2. AI 阶段已继续推进，不再停在原来的卡死点；
  3. 成功后悬浮确认面板会自动收起，不会再残留在画面上。

## 结论

- 本轮已把“手动强制结束 AI 阶段”扩展到 **AI 当前阶段 + human 正在响应** 的真实场景。
- 修复口径不是再用 `ADVANCE_PHASE` 去硬撞打开中的响应窗口，而是先走 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，再做一步后续推进。
- UI 收口也已补齐：手动成功后，悬浮球确认面板会自动收起。
