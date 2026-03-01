# Cardia Phase 6.5 - E2E 测试结果报告

## 测试执行摘要

**执行时间**：2026-02-26 22:15
**测试模式**：隔离模式（端口 5173/19000/19001）
**测试场景**：3 个
**测试结果**：❌ 全部失败（0/3 通过）

## 测试结果详情

### Test 1: Complete Full Turn Cycle
**状态**：❌ 失败
**执行时间**：14.2秒
**失败原因**：国际化文本不匹配

**错误信息**：
```
Error: expect(locator).toContainText(expected) failed
Expected substring: "打牌阶段"
Received string:    "PhasePlay Card"
```

**分析**：
- 游戏界面成功加载（日志显示 "✅ 游戏界面已就绪"）
- 对局创建成功（日志显示 "✅ 对局创建成功"）
- 但阶段指示器显示英文而非中文
- 说明 i18n 系统在 E2E 测试环境中未正确初始化为中文

### Test 2: Handle Ability Activation
**状态**：❌ 失败
**执行时间**：30.3秒（超时）
**失败原因**：命令验证失败 + 超时

**错误信息**：
```
[WebServer] [Pipeline] 命令验证失败: {
  commandType: 'PLAY_CARD',
  playerId: '0',
  error: undefined,
  payload: { cardUid: 'deck_i_card_07_1772115732690_3oad41u2k' }
}

Error: locator.click: Test ended.
Timeout: 30000ms
waiting for locator('[data-testid="cardia-end-turn-btn"]')
```

**分析**：
- P1 尝试打出卡牌，但命令验证失败
- 验证失败导致游戏状态未推进
- 测试等待 "结束回合" 按钮出现，但因状态未推进而超时
- 可能原因：validate.ts 中的验证逻辑有问题

### Test 3: End Game When Player Reaches 5 Signets
**状态**：❌ 失败
**执行时间**：30.3秒（超时）
**失败原因**：命令验证失败 + 超时

**错误信息**：
```
[WebServer] [Pipeline] 命令验证失败: {
  commandType: 'PLAY_CARD',
  playerId: '0',
  error: undefined,
  payload: { cardUid: 'deck_i_card_13_1772115764663_ss2dwugyi' }
}

Error: locator.click: Test ended.
Timeout: 30000ms
waiting for locator('[data-testid="cardia-end-turn-btn"]')
```

**分析**：
- 与 Test 2 相同的问题
- TestHarness 状态注入可能成功，但后续打牌命令失败
- 同样因验证失败导致超时

## 发现的核心问题

### 问题 1: 国际化未正确初始化（P1）
**严重程度**：P1（影响测试断言）
**现象**：
- 阶段指示器显示 "PhasePlay Card" 而非 "打牌阶段"
- 说明 i18n 系统默认使用英文或未正确加载中文资源

**可能原因**：
1. E2E 测试环境中 `i18next` 未正确初始化
2. 语言检测逻辑在测试环境中失效
3. 中文资源文件未正确加载

**建议修复**：
- 在 E2E 测试中显式设置语言为中文
- 或修改测试断言使用英文文本
- 或在 `setupOnlineMatch` 中添加语言设置逻辑

### 问题 2: 卡牌影响力显示为 NaN（P0）
**严重程度**：P0（核心数据错误）
**现象**：
- 手牌显示为 "NaN Guild Mechanics ⚡" 而非 "3 Guild Mechanics ⚡"
- 说明 `calculateInfluence` 函数返回 NaN

**可能原因**：
1. `calculateInfluence(card, core)` 计算逻辑有误
2. 卡牌数据结构不完整（缺少 `baseInfluence` 字段）
3. `core` 状态传递有误

**建议修复**：
- 检查 `calculateInfluence` 函数实现
- 验证卡牌初始化时 `baseInfluence` 是否正确设置
- 添加防御性编程（NaN 检查和默认值）

### 问题 3: PLAY_CARD 命令验证失败（P0）
**严重程度**：P0（阻塞核心流程）
**现象**：
- 服务器日志显示命令验证失败，但 `error` 字段为 `undefined`
- 导致游戏状态无法推进

**可能原因**：
1. `validate.ts` 中 `PLAY_CARD` 验证逻辑返回错误但未设置错误消息
2. 验证条件过于严格（如检查了不应该检查的条件）
3. 状态不一致（如 `currentPhase` 不是 `PLAY_CARD`）

**建议修复**：
- 检查 `validate.ts` 中 `PLAY_CARD` 的验证逻辑
- 确保所有验证失败路径都返回明确的错误消息
- 添加详细的服务器日志以便调试

## UI 状态快照分析

从错误上下文文件可以看到：

**玩家状态**：
- P1: Turn 1, Signets: 0, Hand: 5, Deck: 11, Discard: 0
- P2: Turn 0, Signets: 0, Hand: 5, Deck: 11, Discard: 0

**手牌显示**：
- 5 张卡牌全部显示为 "NaN [公会名]"
- 说明所有卡牌的影响力计算都失败

**阶段显示**：
- "Phase Play Card" 和 "Turn 1"
- 说明游戏已进入打牌阶段，但 i18n 未生效

**等待状态**：
- 双方都显示 "Waiting..."
- 说明 UI 正在等待某个操作完成

## 下一步行动计划

### 立即修复（P0）

1. **修复 calculateInfluence 返回 NaN**
   - 文件：`src/games/cardia/Board.tsx` 或相关 helper
   - 检查：`calculateInfluence(card, core)` 实现
   - 验证：卡牌初始化时 `baseInfluence` 字段

2. **修复 PLAY_CARD 验证失败**
   - 文件：`src/games/cardia/domain/validate.ts`
   - 检查：`PLAY_CARD` 命令的验证逻辑
   - 添加：详细的错误消息和日志

3. **修复 i18n 初始化**
   - 文件：`e2e/helpers/cardia.ts` 或测试文件
   - 方案 A：在测试中显式设置语言为中文
   - 方案 B：修改测试断言使用英文文本

### 验证步骤

1. 运行单元测试确认基础逻辑正确
2. 手动测试验证 UI 显示正确
3. 重新运行 E2E 测试

## 测试环境信息

**Node.js**：20.20.0
**Playwright**：1.58.0
**浏览器**：Chromium 145.0.7632.6
**操作系统**：macOS (darwin)

**服务器端口**：
- 前端：5173
- 游戏服务器：19000
- API 服务器：19001

**测试输出目录**：`test-results/`
**截图**：已保存（每个失败测试 2 张截图）

## 附录：完整测试日志

```
✅ E2E 测试模式：独立测试环境（端口 5173/19000/19001）
Running 3 tests using 1 worker

Test 1: should complete a full turn cycle
[Cardia] Host 导航到对局页面...
[Cardia] Guest 导航到对局页面...
[Cardia] 等待双方游戏界面就绪...
[Cardia] 等待游戏界面加载...
[Cardia] ✅ 游戏界面已就绪
[Cardia] 等待游戏界面加载...
[Cardia] ✅ 游戏界面已就绪
[Cardia] ✅ 对局创建成功
✘ Failed (14.2s)

Test 2: should handle ability activation
[Cardia] Host 导航到对局页面...
[Cardia] Guest 导航到对局页面...
[Cardia] 等待双方游戏界面就绪...
[Cardia] 等待游戏界面加载...
[Cardia] ✅ 游戏界面已就绪
[Cardia] 等待游戏界面加载...
[Cardia] ✅ 游戏界面已就绪
[Cardia] ✅ 对局创建成功
[WebServer] [Pipeline] 命令验证失败
✘ Failed (30.3s) - Timeout

Test 3: should end game when player reaches 5 signets
[Cardia] Host 导航到对局页面...
[Cardia] Guest 导航到对局页面...
[Cardia] 等待双方游戏界面就绪...
[Cardia] 等待游戏界面加载...
[Cardia] ✅ 游戏界面已就绪
[Cardia] 等待游戏界面加载...
[Cardia] ✅ 游戏界面已就绪
[Cardia] ✅ 对局创建成功
[WebServer] [Pipeline] 命令验证失败
✘ Failed (30.3s) - Timeout

3 failed / 0 passed
```

## 结论

E2E 测试环境搭建成功，但发现 3 个核心问题需要修复：

1. **P0 - calculateInfluence 返回 NaN**：影响卡牌显示和游戏逻辑
2. **P0 - PLAY_CARD 验证失败**：阻塞核心游戏流程
3. **P1 - i18n 未正确初始化**：影响测试断言

修复这些问题后，E2E 测试应该能够通过。测试框架本身工作正常，问题出在游戏逻辑实现上。
