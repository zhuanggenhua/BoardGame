# 框架迁移：移除旧的 /test 路由

## 重构目标

取消旧的 `/play/<gameId>/test` 路由，全面迁移到新的 TestHarness 框架。

## 背景

项目之前有两套测试框架：

1. **旧框架**：`/play/<gameId>/test?p0=...&p1=...&seed=...&skipFactionSelect=true`
   - 通过 URL 参数配置游戏
   - 使用 `TestMatchRoom` 组件
   - 自动完成派系选择
   - 无法灵活注入状态

2. **新框架**：`/play/<gameId>` + `setupScene()`
   - 使用 TestHarness 状态注入
   - 通过 `setupScene()` 灵活构建测试场景
   - 支持精确控制游戏状态
   - 更快、更可靠

## 迁移内容

### 1. 修改 `openTestGame` 方法

**文件**：`e2e/framework/GameTestContext.ts`

**变更**：
- 移除 URL 参数构建逻辑
- 直接导航到 `/play/<gameId>`
- query 参数已废弃（保留参数签名仅为向后兼容）

```typescript
// 旧代码
const url = `/play/${gameId}/test${search ? `?${search}` : ''}`;

// 新代码
const url = `/play/${gameId}`;
```

### 2. 迁移所有使用旧模式的测试文件

迁移了以下测试文件，将 `page.goto('/play/.../test?...')` 改为 `page.goto('/play/...')`:

1. `e2e/framework-pilot-ninja-infiltrate.e2e.ts` - 3 处
2. `e2e/smashup-ninja-acolyte-extra-minion.e2e.ts` - 3 处
3. `e2e/smashup-innsmouth-locals-reveal-simple.e2e.ts` - 1 处
4. `e2e/smashup-innsmouth-locals-reveal-dev.e2e.ts` - 1 处
5. `e2e/smashup-robot-hoverbot-new.e2e.ts` - 2 处
6. `e2e/framework-pilot-simple.e2e.ts` - 1 处

**总计**：11 处迁移

### 3. 删除旧路由和组件

**文件**：`src/App.tsx`

**变更**：
- 删除 `/play/:gameId/test` 路由
- 删除 `TestMatchRoom` 组件的 import
- 添加注释说明路由已废弃

**文件**：`e2e/test-mode-basic.e2e.ts`

**变更**：
- 删除整个测试文件（专门测试已废弃的功能）

### 4. 保留的文件

**文件**：`src/pages/TestMatchRoom.tsx`

**状态**：保留但不再使用

**原因**：
- 可能有外部引用
- 可以在后续清理中删除
- 添加废弃注释

## 迁移前后对比

### 旧模式

```typescript
// 1. 导航到测试模式
await page.goto('/play/smashup/test?p0=ninjas,aliens&p1=zombies,pirates&seed=12345&skipFactionSelect=true');

// 2. 等待游戏加载
await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 15000 }
);

// 3. 无法灵活注入状态
```

### 新模式

```typescript
// 1. 导航到游戏
await page.goto('/play/smashup');

// 2. 等待 TestHarness
await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 15000 }
);

// 3. 灵活注入状态
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
```

## 优势

1. **更快**：跳过派系选择，直接注入状态
2. **更灵活**：可以精确控制游戏状态的每个字段
3. **更可靠**：状态注入是确定性的，不依赖 UI 交互
4. **更简洁**：不需要复杂的 URL 参数
5. **更易维护**：只有一套测试框架

## 后续工作

1. **删除 `TestMatchRoom.tsx`**：确认无外部引用后删除
2. **更新文档**：更新 E2E 测试文档，移除旧模式的说明
3. **验证所有测试**：运行所有 E2E 测试，确认迁移成功

## 测试验证

迁移后需要运行以下测试验证：

```bash
# 运行所有 E2E 测试
npm run test:e2e:ci

# 或运行特定测试
npm run test:e2e:ci -- framework-pilot-ninja-infiltrate.e2e.ts
npm run test:e2e:ci -- smashup-ninja-acolyte-extra-minion.e2e.ts
```

## 相关文档

- `docs/automated-testing.md` - E2E 测试框架文档
- `docs/e2e-state-injection-guide.md` - 状态注入指南
- `evidence/framework-pilot-phase1-summary.md` - 框架试点总结
