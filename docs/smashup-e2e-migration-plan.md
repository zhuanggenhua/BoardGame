# 大杀四方 E2E 测试迁移计划

## 目标

将所有 Smash Up E2E 测试迁移到新框架（三板斧模式），统一测试风格，提高可维护性。

## 当前状态（2026-03-10）

### 统计数据
- **总测试数**：73 个
- **已完成**：5 个（7%）
- **半迁移**：7 个（10%）
- **待迁移**：61 个（83%）

### 三板斧标准

所有测试必须遵循"三板斧"模式：

1. **新框架**：`import { test } from './framework'`（获得 `page` 和 `game` fixture）
2. **专用测试模式**：`page.goto('/play/smashup')`（自动启用 TestHarness）
3. **状态注入**：`game.setupScene()`（跳过派系选择，直接构建场景）

**禁止使用**：
- ❌ 旧 API（`setupSmashUpOnlineMatch`、`readCoreState`、`applyCoreState`）
- ❌ Fixture 方式（`import { test } from './fixtures'`、`smashupMatch` fixture）
- ❌ `harness.state.patch()` 手动注入状态
- ❌ `/play/smashup/test` 测试路由

## 迁移分类

### 第一优先级：核心交互测试（8 个）

这些测试验证核心游戏机制，必须优先迁移：

1. `smashup-ninja-infiltrate.e2e.ts` - 忍者渗透能力
2. `smashup-wizard-portal.e2e.ts` - 法师传送门
3. `smashup-multi-base-scoring-complete.e2e.ts` - 多基地计分（完整）
4. `smashup-multi-base-scoring-simple.e2e.ts` - 多基地计分（简单）
5. `smashup-pirate-cove-scoring-bug.e2e.ts` - 海盗湾计分 bug
6. `smashup-innsmouth-locals-reveal.e2e.ts` - 印斯茅斯本地人展示
7. `smashup-base-minion-selection.e2e.ts` - 基地随从选择
8. `smashup-afterscoring-simple-complete.e2e.ts` - afterScoring 简单完整

**迁移策略**：
- 使用 `game.setupScene()` 构建初始场景
- 使用 `page.click()` 模拟用户操作
- 使用 `game.screenshot()` 保存截图
- 验证 UI 显示和状态变更

### 第二优先级：半迁移测试（7 个）

这些测试已经使用新框架，但还有旧痕迹：

1. `smashup-robot-hoverbot-chain.e2e.ts` - 机器人悬浮机器人链
2. `smashup-zombie-lord.e2e.ts` - 僵尸领主
3. `smashup-complex-multi-base-scoring.e2e.ts` - 复杂多基地计分
4. `smashup-phase-transition-simple.e2e.ts` - 阶段转换简单
5. `smashup-response-window-pass-test.e2e.ts` - 响应窗口跳过测试
6. `smashup-robot-hoverbot-new.e2e.ts` - 机器人悬浮机器人新

**迁移策略**：
- 移除 `harness.state.patch()` 直接调用
- 统一使用 `game.setupScene()`
- 清理旧的 helper 函数调用

### 第三优先级：旧 Fixture 测试（18 个）

这些测试还在使用旧的 fixture 方式：

**迁移策略**：
- 替换 `import { test } from './fixtures'` 为 `import { test } from './framework'`
- 移除 `smashupMatch` fixture
- 使用 `game.setupScene()` 替代旧的状态构建方式

### 第四优先级：直接操作 TestHarness 的测试（22 个）

这些测试直接操作 `__BG_TEST_HARNESS__`：

**迁移策略**：
- 使用 `game.setupScene()` 替代 `harness.state.patch()`
- 使用 `game.screenshot()` 替代手动截图
- 使用 `game.waitForTestHarness()` 替代手动等待

### 不需要迁移：页面流/资源验证测试

这些测试验证页面流程或资源加载，不需要迁移到 GameTestContext：

- `smashup.e2e.ts` - 基本页面流程
- `smashup-gameplay.e2e.ts` - 游戏流程
- `smashup-faction-selection-sound.e2e.ts` - 派系选择音效
- `smashup-image-loading.e2e.ts` - 图片加载

## 迁移步骤（标准流程）

### 1. 识别测试类型

```typescript
// 旧 Fixture 方式
import { test } from './fixtures';
test('测试名', async ({ page, smashupMatch }) => { ... });

// 旧 Helper 方式
import { setupSmashUpOnlineMatch } from './helpers/smashup';
await setupSmashUpOnlineMatch(page, ...);

// 直接操作 TestHarness
await page.evaluate(() => {
  (window as any).__BG_TEST_HARNESS__.state.patch(...);
});
```

### 2. 替换为新框架

```typescript
// 新框架
import { test } from './framework';

test('测试名', async ({ page, game }, testInfo) => {
  test.setTimeout(60000);
  
  // 1. 导航到游戏
  await page.goto('/play/smashup');
  
  // 2. 等待 TestHarness 就绪
  await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 15000 }
  );
  
  // 3. 状态注入
  await game.setupScene({
    gameId: 'smashup',
    player0: {
      hand: [{ uid: 'card-1', defId: 'wizard_portal', type: 'action' }],
      field: [{ uid: 'minion-1', defId: 'ninja_shinobi', baseIndex: 0, power: 3 }]
    },
    player1: {
      field: [{ uid: 'minion-2', defId: 'robot_microbot_alpha', baseIndex: 0, power: 2 }]
    },
    bases: [{ breakpoint: 10, power: 5 }],
    currentPlayer: '0',
    phase: 'playCards',
  });
  
  await page.waitForTimeout(2000);
  
  // 4. 测试逻辑
  await page.click('[data-card-uid="card-1"]');
  await page.waitForTimeout(1000);
  
  // 5. 截图
  await game.screenshot('test-result', testInfo);
});
```

### 3. 验证迁移

- [ ] 测试通过
- [ ] 截图清晰
- [ ] 无旧 API 调用
- [ ] 无 `harness.state.patch()` 直接调用
- [ ] 使用 `game.setupScene()`
- [ ] 使用 `game.screenshot()`

### 4. 清理旧代码

迁移完成后，删除：
- `e2e/fixtures/` 目录
- `e2e/helpers/smashup.ts` 中的旧函数
- 旧的测试模式路由（`/play/smashup/test`）

## 迁移时间表

### 第 1 周：核心交互测试（8 个）
- Day 1-2：迁移 4 个（ninja-infiltrate, wizard-portal, multi-base-scoring-complete, multi-base-scoring-simple）
- Day 3-4：迁移 4 个（pirate-cove-scoring-bug, innsmouth-locals-reveal, base-minion-selection, afterscoring-simple-complete）

### 第 2 周：半迁移测试（7 个）
- Day 1-2：清理 4 个（robot-hoverbot-chain, zombie-lord, complex-multi-base-scoring, phase-transition-simple）
- Day 3：清理 3 个（response-window-pass-test, robot-hoverbot-new）

### 第 3-4 周：批量迁移（40 个）
- 每天迁移 5-6 个测试
- 优先迁移旧 Fixture 测试（18 个）
- 然后迁移直接操作 TestHarness 的测试（22 个）

### 第 5 周：清理和验证
- 删除旧代码（fixtures, helpers）
- 运行所有测试验证
- 更新文档

## 迁移检查清单

每个测试迁移后必须检查：

### 代码质量
- [ ] 使用 `import { test } from './framework'`
- [ ] 使用 `game.setupScene()` 构建场景
- [ ] 使用 `game.screenshot()` 保存截图
- [ ] 无旧 API 调用（`setupSmashUpOnlineMatch`, `readCoreState`, `applyCoreState`）
- [ ] 无 `harness.state.patch()` 直接调用
- [ ] 无 `/play/smashup/test` 路由

### 测试质量
- [ ] 测试通过（`npm run test:e2e:ci -- <测试文件>`）
- [ ] 截图清晰且有意义
- [ ] 测试时间 < 60 秒
- [ ] 无超时错误
- [ ] 无 flaky 行为

### 文档
- [ ] 测试名称清晰
- [ ] 有注释说明测试场景
- [ ] 截图有描述性文件名

## 成功标准

迁移完成后：

1. **所有测试通过**：`npm run test:e2e:ci` 全部通过
2. **统一风格**：所有测试使用三板斧模式
3. **旧代码清理**：删除 fixtures 和旧 helpers
4. **文档更新**：更新 `docs/automated-testing.md`
5. **性能提升**：测试速度提升（60 秒 vs 180 秒）

## 参考示例

### 已完成的纯三板斧测试
- ✅ `smashup-4p-layout-test.e2e.ts`
- ✅ `smashup-alien-terraform.e2e.ts`
- ✅ `smashup-crop-circles.e2e.ts`
- ✅ `smashup-ghost-haunted-house-discard.e2e.ts`
- ✅ `smashup-refresh-base.e2e.ts`

### 迁移模板
参考 `e2e/smashup-4p-layout-test.e2e.ts` 作为标准模板。

## 注意事项

1. **不要一次迁移太多**：每次迁移 2-3 个测试，确保质量
2. **保留旧测试**：迁移完成并验证通过后再删除旧测试
3. **截图对比**：迁移后的截图应该与旧测试一致
4. **测试隔离**：每个测试独立运行，不依赖其他测试
5. **错误处理**：测试失败时有清晰的错误信息

## 进度追踪

创建 `evidence/smashup-e2e-migration-progress.md` 追踪进度：
- 每天更新迁移进度
- 记录遇到的问题和解决方案
- 记录测试截图和验证结果
