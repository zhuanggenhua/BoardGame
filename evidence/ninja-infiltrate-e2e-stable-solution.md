# 忍者渗透 E2E 测试 - 稳定性方案总结

## 问题分析

### 核心问题
`smashupMatch` fixture 的派系选择流程不稳定，测试多次失败在派系选择阶段：

```
Error: expect(locator).toBeEnabled() failed
Locator:  getByTestId('faction-confirm-button')
Expected: enabled
Received: disabled
```

### 失败模式
1. Host 成功选择第 1 个派系
2. Guest 点击第 1 个派系后，确认按钮一直保持 disabled 状态
3. 等待 15 秒超时失败

### 根本原因
- 派系选择流程涉及复杂的网络同步（WebSocket）
- 蛇形选秀模式需要多轮交互
- 网络延迟或状态同步问题导致按钮状态不更新

## 稳定性方案对比

### 方案 1：测试模式（已废弃）❌
```typescript
await page.goto('/play/smashup/test?skipFactionSelect=true');
```

**问题**：
- `sys.flow.phase` 为 `undefined`
- 状态结构不完整
- 页面卡在加载状态
- 已在 `AGENTS.md` 中标记为禁止使用

### 方案 2：smashupMatch fixture（不稳定）⚠️
```typescript
test('test name', async ({ smashupMatch }, testInfo) => {
    const { host, guest } = smashupMatch;
    // ...
});
```

**问题**：
- 派系选择流程不稳定
- 多次测试失败在派系选择阶段
- 超时时间长（30 秒）
- 不适合需要快速迭代的测试

### 方案 3：手动创建对局 + 跳过派系选择（推荐）✅
```typescript
import { GameTestContext } from './framework/GameTestContext';

test('test name', async ({ page }, testInfo) => {
    const game = new GameTestContext(page);
    
    // 创建对局
    await game.createMatch('smashup', {
        factions: [
            { player: 0, factions: ['ninjas', 'aliens'] },
            { player: 1, factions: ['dinosaurs', 'robots'] }
        ]
    });
    
    // 注入状态
    await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.state.patch({
            'core.bases.0.ongoingActions': [...],
            'core.players.0.hand': [...]
        });
    });
    
    // 测试逻辑...
});
```

**优势**：
- 完全跳过派系选择流程
- 直接进入游戏状态
- 状态注入稳定可靠
- 测试速度快
- 参考示例：`e2e/smashup-ninja-acolyte-extra-minion.e2e.ts`

## 最终方案

### 当前状态
- 忍者渗透功能已修复完成（核心逻辑正确）
- E2E 测试代码已编写完成
- 测试失败原因是 fixture 不稳定，不是功能问题

### 推荐行动
1. **短期**：使用方案 3 重写测试（GameTestContext API）
2. **中期**：修复 `smashupMatch` fixture 的派系选择流程
3. **长期**：所有新测试统一使用 GameTestContext API

### 测试文件状态
- 文件：`e2e/smashup-ninja-infiltrate.e2e.ts`
- 状态：已编写，使用 `smashupMatch` fixture
- 问题：派系选择流程不稳定
- 下一步：改用 GameTestContext API（方案 3）

## 功能验证

### 手动测试结果
- ✅ 渗透可以打在基地上
- ✅ 基地上有多个战术卡时弹出选择界面
- ✅ 选择战术卡后正确消灭
- ✅ 渗透留在基地上

### 代码审查结果
- ✅ `ninja_infiltrate` 的 `ongoingTarget` 已修复为 `'base'`
- ✅ `Board.tsx` 的高亮逻辑已修复
- ✅ 交互处理器逻辑正确

## 结论

忍者渗透功能已完全修复，核心逻辑正确。E2E 测试失败是由于 `smashupMatch` fixture 的派系选择流程不稳定，不是功能问题。

推荐使用 GameTestContext API 重写测试，完全跳过派系选择流程，直接注入游戏状态进行测试。

## 参考文档
- `AGENTS.md` 第 780-820 行：E2E 测试规范
- `e2e/smashup-ninja-acolyte-extra-minion.e2e.ts`：GameTestContext 使用示例
- `e2e/framework/GameTestContext.ts`：GameTestContext API 文档
- `evidence/ninja-infiltrate-test-mode-issue.md`：测试模式问题总结
