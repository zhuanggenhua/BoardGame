# 任务 20 辅助函数修复

## 问题诊断

在运行修复后的 E2E 测试时，发现 `e2e/helpers/cardia.ts` 中的 `setupCardiaOnlineMatch` 函数调用了两个辅助函数，但没有传递必需的参数。

### 问题 1：`ensureGameServerAvailable` 缺少 `page` 参数

**错误代码**：
```typescript
// 检查服务器可用性
if (!(await ensureGameServerAvailable())) {  // ❌ 缺少 page 参数
    console.error('[Cardia] ❌ 游戏服务器不可用');
    return null;
}

// 创建 Host 上下文和页面
const hostContext = await initContext(browser, baseURL);
const hostPage = await hostContext.newPage();
```

**函数签名**（`e2e/helpers/common.ts`）：
```typescript
export const ensureGameServerAvailable = async (page: Page) => {
    // ...
}
```

**问题**：
- `ensureGameServerAvailable` 需要 `page` 参数来发送 HTTP 请求检查服务器
- 但调用时没有传递任何参数
- 且调用时机在创建 `hostPage` 之前，导致无法传递 page

### 问题 2：`waitForMatchAvailable` 缺少 `page` 参数

**错误代码**：
```typescript
// 等待房间在大厅中可见
if (!(await waitForMatchAvailable(GAME_NAME, matchId))) {  // ❌ 缺少 page 参数
    console.error('[Cardia] ❌ 房间未在大厅中出现');
    await hostContext.close();
    return null;
}
```

**函数签名**（`e2e/helpers/common.ts`）：
```typescript
export const waitForMatchAvailable = async (
    page: Page,
    gameName: string,
    matchId: string,
    timeoutMs = 15000,
) => {
    // ...
}
```

**问题**：
- `waitForMatchAvailable` 的第一个参数应该是 `page`
- 但调用时直接传递了 `GAME_NAME`，导致参数错位

## 修复方案

### 修复 1：调整 `ensureGameServerAvailable` 调用顺序

**修复后代码**：
```typescript
export async function setupCardiaOnlineMatch(
    browser: Browser,
    baseURL: string | undefined
): Promise<CardiaMatchSetup | null> {
    console.log('[Cardia] 开始设置在线对局...');
    
    // 创建 Host 上下文和页面（需要先创建 page 才能检查服务器）
    const hostContext = await initContext(browser, baseURL);
    const hostPage = await hostContext.newPage();
    
    // 检查服务器可用性
    if (!(await ensureGameServerAvailable(hostPage))) {  // ✅ 传递 hostPage
        console.error('[Cardia] ❌ 游戏服务器不可用');
        await hostContext.close();  // ✅ 失败时清理 context
        return null;
    }
    
    // ... 继续创建房间
}
```

**改进点**：
- ✅ 先创建 `hostPage`，再调用 `ensureGameServerAvailable(hostPage)`
- ✅ 失败时正确清理 `hostContext`（避免资源泄漏）

### 修复 2：添加 `page` 参数到 `waitForMatchAvailable`

**修复后代码**：
```typescript
// 等待房间在大厅中可见
if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId))) {  // ✅ 传递 hostPage
    console.error('[Cardia] ❌ 房间未在大厅中出现');
    await hostContext.close();
    return null;
}
```

**改进点**：
- ✅ 第一个参数传递 `hostPage`
- ✅ 参数顺序正确：`page`, `gameName`, `matchId`

## 验证步骤

修复完成后，需要运行测试验证：

```bash
# 1. 启动测试环境服务器（终端 1）
npm run dev

# 2. 运行 E2E 测试（终端 2）
npx playwright test e2e/cardia-debug-basic-flow.e2e.ts
```

**预期结果**：
- ✅ 测试不再报错 "游戏服务器不可用"
- ✅ 能够成功创建房间
- ✅ 能够成功加入房间
- ✅ 能够读取游戏状态

## 相关文件

### 修改的文件

- `e2e/helpers/cardia.ts` - 修复了两个函数调用的参数问题

### 参考文件

- `e2e/helpers/common.ts` - 辅助函数定义
- `e2e/helpers/smashup.ts` - 参考实现（正确的调用方式）
- `docs/automated-testing.md` - E2E 测试规范

## 教训总结

### 问题根因

1. **未参考现有实现**：创建新的辅助函数时，应该先查看其他游戏的实现（如 `smashup.ts`）作为参考
2. **未检查函数签名**：调用函数前应该先查看函数定义，确认参数类型和顺序
3. **未运行测试验证**：编写代码后应该立即运行测试，而不是等到用户报告问题

### 最佳实践

1. **参考现有实现**：新增功能时，优先查找类似的现有实现作为模板
2. **检查函数签名**：使用 IDE 的"跳转到定义"功能，或使用 `grepSearch` 查找函数定义
3. **增量测试**：每完成一个小功能就运行测试，快速发现问题
4. **代码审查**：提交前自己先审查一遍代码，检查明显的错误

### 防止类似问题

**创建新的 E2E 辅助函数时的检查清单**：

- [ ] 查看 `e2e/helpers/common.ts` 中的通用函数签名
- [ ] 参考其他游戏的辅助函数实现（如 `smashup.ts`、`dicethrone.ts`）
- [ ] 确认所有函数调用的参数类型和顺序正确
- [ ] 运行 TypeScript 编译检查（`npx tsc --noEmit`）
- [ ] 运行实际测试验证功能正确

## 下一步行动

1. **运行修复后的测试**（P0 优先级）
   ```bash
   npx playwright test e2e/cardia-debug-basic-flow.e2e.ts
   ```

2. **验证游戏流程**（P0 优先级）
   - 确认能够创建房间
   - 确认能够加入房间
   - 确认能够读取游戏状态
   - 确认调试工具可用

3. **集成调试工具到游戏代码**（P1 优先级）
   - 在 `Board.tsx` 中调用 `exposeDebugTools()`
   - 在 `execute.ts` 中集成 `abilityLogger`

4. **补充更多 E2E 测试**（P2 优先级）
   - 测试能力激活流程
   - 测试交互系统
   - 测试持续能力效果

