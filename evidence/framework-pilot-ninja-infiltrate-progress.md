# Ninja Infiltrate E2E 测试重写 - 进展记录

## 当前状态

**测试文件**：`e2e/framework-pilot-ninja-infiltrate.e2e.ts`

**状态**：✅ 代码完成，❌ 测试服务器崩溃

## 完成的工作

### 1. 创建测试文件

使用新框架（三板斧）创建了 3 个测试场景：

1. **完整流程**：基地上有 2 个战术卡，选择其中一个消灭
2. **跳过交互**：基地上没有战术卡，不创建交互
3. **多选项**：基地上有 3 个战术卡，选择其中一个消灭

### 2. 修复类型错误

**问题**：
- `owner` 应该是 `ownerId`（但实际上应该使用字符串数组）
- `breakpoint` 字段不存在

**解决方案**：
- 使用字符串数组：`ongoingActions: ['alien_supreme_overlord', 'dinosaur_king_rex']`
- 移除 `breakpoint` 和 `power` 字段

### 3. 测试代码结构

```typescript
import { test, expect } from './framework';

test.describe('测试框架试点 - 忍者渗透完整流程', () => {
    test('应该能选择并消灭基地上的战术卡（完整流程）', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);
        
        // 1. 导航到测试模式
        await page.goto('/play/smashup/test?p0=ninjas,aliens&p1=zombies,pirates&seed=12345');
        
        // 2. 等待游戏加载
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );
        
        // 3. 状态注入
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_infiltrate'],
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    ongoingActions: ['alien_supreme_overlord', 'dinosaur_king_rex'],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });
        
        // 4. 执行测试...
    });
});
```

## 遇到的问题

### 问题：测试服务器崩溃

**症状**：
```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/...
```

**分析**：
1. 前两个测试在导航时就失败（连接被拒绝）
2. 第三个测试成功导航但 TestHarness 未注册（超时）
3. 说明前端服务器（5173）在测试运行时崩溃

**可能的原因**：
1. `test:e2e:cleanup` 清理端口后，服务器启动失败
2. 服务器启动后立即崩溃
3. 测试代码触发了服务器崩溃

**尝试的解决方案**：
- ✅ 修复类型错误
- ✅ 修复数据格式
- ❌ 清理僵尸进程（用户认为与此无关）
- ❌ 手动启动服务器（服务器无输出，端口未监听）

## 下一步

### 建议 1：检查服务器日志

查看 `logs/` 目录中的日志文件，了解服务器崩溃的原因。

### 建议 2：简化测试场景

尝试一个最简单的测试场景（只有一个战术卡），看看是否能通过。

### 建议 3：使用开发服务器

尝试使用开发服务器（3000/18000/18001）而不是测试服务器（5173/19000/19001）：

```bash
# 终端 1：启动开发服务器
npm run dev

# 终端 2：运行测试（使用开发服务器）
PW_USE_DEV_SERVERS=true npx playwright test framework-pilot-ninja-infiltrate.e2e.ts
```

### 建议 4：检查 Playwright 配置

检查 `playwright.config.ts` 中的 `webServer` 配置，确认服务器启动命令是否正确。

## 测试文件位置

- 新测试文件：`e2e/framework-pilot-ninja-infiltrate.e2e.ts`
- 参考模板：`e2e/framework-pilot-wizard-portal.e2e.ts`
- 测试结果：`test-results/`（只有第三个测试有截图）

## 总结

测试代码已经准备就绪，使用了正确的新框架（三板斧）和数据格式。问题是测试服务器在运行时崩溃，需要进一步调查服务器启动失败的原因。

**用户反馈**："我觉得和僵尸进程没关系"

**AI 分析**：同意。问题不是僵尸进程，而是测试服务器启动失败或崩溃。需要检查服务器日志或尝试使用开发服务器。
