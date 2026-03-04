# E2E 测试重构方案

## 问题分析

### 当前 E2E 测试的核心问题

1. **启动慢**：每次测试需要启动 3 个服务器（前端 + 游戏服务器 + API 服务器）
2. **设置慢**：派系选择需要 30-60 秒（4 次点击的蛇形选秀）
3. **不稳定**：
   - 网络依赖（WebSocket、HTTP 请求）
   - UI 依赖（按钮位置、动画、选择器）
   - 随机性（骰子、抽牌、洗牌）
   - 竞态条件（异步事件、状态同步）
4. **无法并行**：服务端无 per-test 状态隔离，只能串行执行（`workers: 1`）

### 业界最佳实践（来自 Playwright 官方文档和社区）

1. **测试隔离**：每个测试应该独立运行，不依赖其他测试的状态
2. **状态注入**：跳过冗长的设置步骤，直接注入目标状态
3. **Fixtures**：使用 Playwright fixtures 管理测试数据和环境
4. **并行执行**：stateless 测试应该并行运行以提高效率
5. **分类测试**：
   - **Stateless 测试**：不修改全局状态，可以并行
   - **Stateful 测试**：修改全局状态，需要串行

---

## 方案对比

### 方案 1：专用测试模式（推荐）

**核心思路**：添加一个 `test` 游戏模式，提供测试专用的快捷通道。

#### 实现细节

1. **新增 `test` 游戏模式**（与 `online`/`tutorial` 并列）
   ```typescript
   type GameMode = 'online' | 'tutorial' | 'test';
   ```

2. **测试模式特性**：
   - **跳过派系选择**：直接指定派系，无需 UI 交互
   - **状态注入 API**：通过 URL 参数或 TestHarness 注入初始状态
   - **确定性随机**：固定随机种子，结果可预测
   - **快速启动**：跳过动画、教学提示等

3. **URL 格式**：
   ```
   /play/smashup/test?p0=robots,aliens&p1=zombies,pirates&seed=12345&state=base64...
   ```

4. **TestHarness 增强**：
   ```typescript
   window.__BG_TEST_HARNESS__ = {
     mode: 'test',
     skipFactionSelect: true,
     injectState: (state) => { /* 直接设置游戏状态 */ },
     setDeterministicRandom: (seed) => { /* 固定随机种子 */ },
   };
   ```

#### 优点
- ✅ **最快**：跳过所有冗长的设置步骤
- ✅ **最稳定**：确定性随机 + 状态注入 = 零随机性
- ✅ **可并行**：每个测试独立的状态，互不干扰
- ✅ **易维护**：测试代码简洁，专注于验证逻辑

#### 缺点
- ❌ 需要修改游戏代码（添加 `test` 模式）
- ❌ 测试模式与真实用户体验有差异（但这是 E2E 测试的常见权衡）

#### 实现工作量
- **引擎层**：添加 `test` 模式支持（~100 行）
- **游戏层**：每个游戏添加快速启动逻辑（~50 行/游戏）
- **测试工具**：增强 TestHarness（~200 行）
- **测试迁移**：重写现有 E2E 测试（~500 行）
- **总计**：~1000 行代码，预计 2-3 天

---

### 方案 2：Fixtures + 状态注入（当前方案的改进）

**核心思路**：保持 `online` 模式，通过 Playwright fixtures 和 TestHarness 优化测试。

#### 实现细节

1. **创建测试 Fixtures**：
   ```typescript
   // e2e/fixtures/smashup.ts
   export const smashupTest = base.extend<{
     quickMatch: (factions: [string, string][]) => Promise<Page>;
     injectState: (state: Partial<SmashUpCore>) => Promise<void>;
   }>({
     quickMatch: async ({ page }, use) => {
       const helper = async (factions) => {
         await page.goto('/play/smashup/online');
         // 使用 TestHarness 跳过派系选择
         await page.evaluate((f) => {
           window.__BG_TEST_HARNESS__!.skipFactionSelect(f);
         }, factions);
         return page;
       };
       await use(helper);
     },
     injectState: async ({ page }, use) => {
       const helper = async (state) => {
         await page.evaluate((s) => {
           window.__BG_TEST_HARNESS__!.state.patch(s);
         }, state);
       };
       await use(helper);
     },
   });
   ```

2. **增强 TestHarness**：
   - 添加 `skipFactionSelect(factions)` 方法
   - 添加 `state.patch(partialState)` 方法
   - 添加 `random.setSeed(seed)` 方法

3. **测试示例**：
   ```typescript
   import { smashupTest as test } from './fixtures/smashup';
   
   test('wizard portal should work', async ({ quickMatch, injectState }) => {
     const page = await quickMatch([
       ['wizard', 'robots'],
       ['aliens', 'pirates']
     ]);
     
     // 注入测试状态：手牌有 portal，牌库顶有 zapbot
     await injectState({
       players: {
         '0': {
           hand: [{ uid: 'portal-1', defId: 'wizard_portal' }],
           deck: [{ uid: 'zapbot-1', defId: 'robot_zapbot' }],
         }
       }
     });
     
     // 测试 portal 功能
     await page.click('[data-card-uid="portal-1"]');
     // ...
   });
   ```

#### 优点
- ✅ 不需要修改游戏代码（只增强 TestHarness）
- ✅ 保持 `online` 模式，更接近真实用户体验
- ✅ 可复用的 fixtures，减少重复代码

#### 缺点
- ❌ 仍然需要启动完整的服务器
- ❌ 仍然有网络延迟和 WebSocket 不稳定性
- ❌ 无法完全并行（服务端状态共享）

#### 实现工作量
- **TestHarness 增强**：~300 行
- **Fixtures 创建**：~200 行
- **测试迁移**：~500 行
- **总计**：~1000 行代码，预计 2-3 天

---

### 方案 3：混合方案（最佳平衡）

**核心思路**：结合方案 1 和方案 2 的优点。

#### 分层测试策略

1. **快速冒烟测试**（使用 `test` 模式）：
   - 覆盖核心功能的快乐路径
   - 完全确定性，可并行
   - 运行时间：< 5 分钟

2. **完整 E2E 测试**（使用 `online` 模式 + fixtures）：
   - 覆盖边界情况和复杂交互
   - 更接近真实用户体验
   - 运行时间：10-20 分钟

3. **关键路径测试**（使用真实 UI 流程）：
   - 不使用状态注入，完整走一遍用户流程
   - 每个游戏 1-2 个测试
   - 运行时间：5-10 分钟

#### 配置示例

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'smoke',
      testMatch: '**/*.smoke.e2e.ts',
      use: { gameMode: 'test' },
      fullyParallel: true,
      workers: 4,
    },
    {
      name: 'e2e',
      testMatch: '**/*.e2e.ts',
      testIgnore: '**/*.smoke.e2e.ts',
      use: { gameMode: 'online' },
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'critical',
      testMatch: '**/*.critical.e2e.ts',
      use: { gameMode: 'online', skipStateInjection: true },
      fullyParallel: false,
      workers: 1,
    },
  ],
});
```

#### 优点
- ✅ **最佳平衡**：速度 + 稳定性 + 真实性
- ✅ **灵活性**：根据需求选择合适的测试策略
- ✅ **渐进式迁移**：可以逐步迁移现有测试

#### 缺点
- ❌ 复杂度最高（需要维护 3 种测试类型）
- ❌ 需要团队理解不同测试类型的用途

#### 实现工作量
- **方案 1 实现**：~1000 行
- **方案 2 实现**：~1000 行
- **配置和文档**：~200 行
- **总计**：~2200 行代码，预计 4-5 天

---

## 推荐方案

### 短期（1-2 周）：方案 2（Fixtures + 状态注入）

**理由**：
- 不需要修改游戏代码，风险最低
- 可以立即改善现有测试的稳定性
- 为长期方案打基础

**实施步骤**：
1. 增强 TestHarness（`skipFactionSelect`、`state.patch`、`random.setSeed`）
2. 创建 Playwright fixtures（`quickMatch`、`injectState`）
3. 重写 1-2 个现有测试作为示例
4. 更新文档（`docs/e2e-ui-testing-guide.md`）

### 长期（1-2 月）：方案 3（混合方案）

**理由**：
- 提供最佳的速度 + 稳定性 + 真实性平衡
- 支持并行执行，大幅提升测试效率
- 适合大规模测试套件

**实施步骤**：
1. 实现 `test` 游戏模式
2. 迁移核心功能测试到 `smoke` 项目
3. 保留复杂交互测试在 `e2e` 项目
4. 添加关键路径测试到 `critical` 项目
5. 配置 CI/CD 分阶段运行测试

---

## 参考资料

### 业界最佳实践

1. **Playwright 官方文档**：
   - [Testing in Parallel](https://www.checklyhq.com/learn/playwright/testing-in-parallel/)
   - [Test Fixtures](https://playwright.dev/docs/test-fixtures)
   - [Test Isolation](https://playwright.dev/docs/best-practices#test-isolation)

2. **社区实践**：
   - [Zero-Flake Setup Guide](https://www.testleaf.com/blog/playwright-testing-in-2026-the-zero-flake-setup-guide/)
   - [Mastering Test Data](https://join.momentic.ai/resources/mastering-playwright-test-data-a-comprehensive-guide-to-resilient-e2e-testing)

### 项目现有文档

- `docs/e2e-ui-testing-guide.md` - E2E UI 测试指南
- `docs/ai-testing-strategy.md` - AI 测试策略
- `docs/automated-testing.md` - 自动化测试文档
- `e2e/smashup-debug-helpers.ts` - 现有测试辅助函数

---

## 下一步行动

1. **讨论和决策**：选择短期方案（方案 2）还是直接实施长期方案（方案 3）
2. **原型验证**：实现一个完整的测试示例，验证方案可行性
3. **团队培训**：确保团队理解新的测试策略和工具
4. **逐步迁移**：不要一次性重写所有测试，逐步迁移
