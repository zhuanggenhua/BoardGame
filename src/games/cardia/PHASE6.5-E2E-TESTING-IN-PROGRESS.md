# Cardia Phase 6.5 - E2E Testing In Progress

## 当前状态

E2E 测试正在运行中（隔离模式）

## 已完成的修复

### 1. 环境准备
- ✅ Node.js 升级到 20.20.0（通过 `nvm alias default 20` 设置为默认版本）
- ✅ Docker daemon 已确认运行
- ✅ Playwright 浏览器已安装（chromium, ffmpeg, chrome-headless-shell）

### 2. E2E 测试文件修复
- ✅ 修复 `baseURL` 参数传递问题
  - 问题：测试函数调用 `setupOnlineMatch(browser, undefined)` 导致 "Cannot navigate to invalid URL" 错误
  - 解决：添加 `testInfo` 参数并使用 `testInfo.project.use.baseURL` 获取正确的 baseURL
  - 修改文件：`e2e/cardia-basic-flow.e2e.ts`
  - 修改内容：
    ```typescript
    // 修改前
    test('should complete a full turn cycle', async ({ browser }) => {
        const setup = await setupOnlineMatch(browser, undefined);
    
    // 修改后
    test('should complete a full turn cycle', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatch(browser, baseURL);
    ```
  - 应用到所有 3 个测试场景

### 3. 测试运行模式
- 使用隔离模式：`npm run test:e2e:isolated -- e2e/cardia-basic-flow.e2e.ts`
- 端口配置：
  - 前端：5173
  - 游戏服务器：19000
  - API 服务器：19001
- 与开发环境完全隔离（开发环境使用 3000/18000/18001）

## 测试场景

### Test 1: Complete Full Turn Cycle
- P1 打出卡牌 → 能力阶段（跳过）→ 结束回合
- P2 打出卡牌 → 遭遇战解析 → 能力阶段 → 结束回合
- 验证回合循环和印戒计数器更新

### Test 2: Handle Ability Activation
- P1 打出低影响力卡牌（失败）→ 跳过能力 → 结束回合
- P2 打出高影响力卡牌 → 遭遇战解析
- P2 激活失败者能力
- 验证能力激活流程

### Test 3: End Game When Player Reaches 5 Signets
- 使用 TestHarness 设置 P1 印戒数量为 4
- 进行一次遭遇战让 P1 获得第 5 个印戒
- 验证游戏结束界面显示

## 当前进度

**状态**：E2E 测试正在运行（TerminalId: 12）

**预计完成时间**：2-3 分钟（服务器启动 + 测试执行）

**下一步**：
1. 等待测试完成
2. 分析测试结果
3. 如果测试通过：创建 Phase 6 完成报告
4. 如果测试失败：分析失败原因并修复

## 技术细节

### Playwright 配置
- 测试模式：隔离模式（`PW_USE_DEV_SERVERS=false`）
- 浏览器：Chromium
- 并行度：1 worker（串行执行）
- 超时：30秒（单个测试）
- 截图：失败时自动截图
- 输出目录：`test-results/`

### 已知问题（已解决）
1. ❌ Playwright 浏览器未安装 → ✅ 已通过 `npx playwright install chromium` 解决
2. ❌ baseURL 参数为 undefined → ✅ 已通过添加 `testInfo` 参数解决
3. ❌ 服务器启动超时（120秒） → ✅ 已通过使用隔离模式解决

## 参考文档
- E2E 测试文件：`e2e/cardia-basic-flow.e2e.ts`
- 测试辅助函数：`e2e/helpers/cardia.ts`
- Playwright 配置：`playwright.config.ts`
- 自动化测试文档：`docs/automated-testing.md`
