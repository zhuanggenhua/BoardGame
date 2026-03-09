# Cardia E2E 测试失败报告

**生成时间**: 2026-03-05  
**任务**: Task 17.3 - 记录所有失败的测试  
**Spec**: `.kiro/specs/cardia-full-audit/`  
**数据来源**: `reports/audit-phase4-e2e-results.md`

---

## 执行摘要

### 失败统计
- **总测试文件数**: 41
- **导入错误**: 4 个文件（P0）
- **测试失败**: 1 个测试（P1）
- **总失败数**: 5
- **失败率**: 12.2%

### 优先级分布
- **P0（阻塞）**: 4 个 - 导入错误阻止测试运行
- **P1（功能）**: 1 个 - 测试失败表明功能问题
- **P2（质量）**: 0 个

### 影响范围
- **阻塞测试**: 4 个测试文件无法运行
- **功能问题**: 1 个基础流程测试失败
- **覆盖率影响**: 9.8% 的测试无法执行

---

## Import Errors (P0)

### PHASE4-001: cardia-debug-basic-flow.e2e.ts - Missing readGameState

**优先级**: P0（阻塞测试运行）  
**维度**: D47（E2E 测试覆盖完整性）  
**文件**: `e2e/cardia-debug-basic-flow.e2e.ts`

#### 错误详情
```typescript
// 导入语句
import { readGameState } from './helpers/cardia';

// 错误信息
Error: Module '"./helpers/cardia"' has no exported member 'readGameState'.
```

#### 使用位置
测试文件中 6 处使用：
1. **Line 37**: `const hostState = await readGameState(hostPage);`
2. **Line 38**: `const guestState = await readGameState(guestPage);`
3. **Line 61**: `const hostStateAfterPlay = await readGameState(hostPage);`
4. **Line 70**: `const guestStateAfterPlay = await readGameState(guestPage);`
5. **Line 78**: `const hostStateAfterEncounter = await readGameState(hostPage);`
6. **Line 113**: `const state = await readGameState(hostPage);`

#### 根因分析
- **问题**: `e2e/helpers/cardia.ts` 未导出 `readGameState` 函数
- **影响**: 测试文件无法编译，阻止测试运行
- **历史**: 可能是重构时遗漏的导出，或测试使用了已废弃的 API

#### 修复建议

**方案 1（推荐）**: 使用现有的 `readCoreState` 替代
```typescript
// 修改导入
import { readCoreState } from './helpers/cardia';

// 修改所有使用位置
const hostState = await readCoreState(hostPage);
const guestState = await readCoreState(guestPage);
// ... 其他 5 处类似修改
```

**方案 2**: 在 `e2e/helpers/cardia.ts` 中添加 `readGameState` 导出
```typescript
// 如果 readGameState 是 readCoreState 的别名
export { readCoreState as readGameState };

// 或者如果需要不同的实现
export async function readGameState(page: Page) {
  return await readCoreState(page);
}
```

**推荐**: 方案 1，因为 `readCoreState` 已存在且功能完整，避免重复代码。

#### 验证步骤
1. 修改导入和使用位置
2. 运行 `npx tsc --noEmit` 确认无类型错误
3. 运行测试: `npm run test:e2e -- cardia-debug-basic-flow.e2e.ts`
4. 确认测试可以正常执行

---

### PHASE4-002: cardia-ui-markers.e2e.ts - Missing waitForTestHarness

**优先级**: P0（阻塞测试运行）  
**维度**: D47（E2E 测试覆盖完整性）  
**文件**: `e2e/cardia-ui-markers.e2e.ts`

#### 错误详情
```typescript
// 导入语句
import { setupOnlineMatch, waitForTestHarness } from './helpers/cardia';

// 错误信息
Error: Module '"./helpers/cardia"' has no exported member 'waitForTestHarness'.
```

#### 根因分析
- **问题**: `waitForTestHarness` 从错误的模块导入
- **实际位置**: 该函数存在于 `e2e/helpers/common.ts`
- **影响**: 测试文件无法编译，阻止测试运行

#### 修复建议

**方案（唯一正确）**: 从正确的模块导入
```typescript
// 修改前
import { setupOnlineMatch, waitForTestHarness } from './helpers/cardia';

// 修改后
import { setupOnlineMatch } from './helpers/cardia';
import { waitForTestHarness } from './helpers/common';
```

#### 验证步骤
1. 修改导入语句
2. 运行 `npx tsc --noEmit` 确认无类型错误
3. 运行测试: `npm run test:e2e -- cardia-ui-markers.e2e.ts`
4. 确认测试可以正常执行

---

### PHASE4-003: cardia-void-mage-no-markers.e2e.ts - Missing activateAbility/skipAbility

**优先级**: P0（阻塞测试运行）  
**维度**: D47（E2E 测试覆盖完整性）  
**文件**: `e2e/cardia-void-mage-no-markers.e2e.ts`

#### 错误详情
```typescript
// 导入语句
import { setupOnlineMatch, waitForPhase, playCard, activateAbility, skipAbility } from './helpers/cardia';

// 错误信息
Error: Module '"./helpers/cardia"' has no exported member 'activateAbility'.
Error: Module '"./helpers/cardia"' has no exported member 'skipAbility'.
```

#### 使用位置
测试文件中 4 处使用：
1. **Line 31**: `await skipAbility(player2Page);`
2. **Line 52**: `await activateAbility(player1Page);`
3. **Line 77**: `await activateAbility(player1Page);`
4. **Line 125**: `await activateAbility(player1Page);`

#### 根因分析
- **问题**: `e2e/helpers/cardia.ts` 未导出这两个辅助函数
- **影响**: 测试文件无法编译，阻止测试运行
- **历史**: 这些函数可能是测试特定的辅助函数，未被提取到公共 helpers

#### 修复建议

**方案（推荐）**: 在测试文件内定义本地辅助函数

参考 `cardia-basic-flow.e2e.ts` 的实现：
```typescript
// 在测试文件顶部添加辅助函数
async function activateAbility(page: Page) {
  await page.locator('[data-testid="cardia-activate-ability-btn"]').click();
  await page.waitForTimeout(500); // 等待动画
}

async function skipAbility(page: Page) {
  await page.locator('[data-testid="cardia-skip-ability-btn"]').click();
  await page.waitForTimeout(500); // 等待动画
}

// 移除导入中的这两个函数
import { setupOnlineMatch, waitForPhase, playCard } from './helpers/cardia';
```

**备选方案**: 将这些函数添加到 `e2e/helpers/cardia.ts` 并导出（如果多个测试需要）

#### 验证步骤
1. 在测试文件内定义辅助函数
2. 修改导入语句
3. 运行 `npx tsc --noEmit` 确认无类型错误
4. 运行测试: `npm run test:e2e -- cardia-void-mage-no-markers.e2e.ts`
5. 确认测试可以正常执行

---

### PHASE4-004: cardia-deck1-card04-mediator-single-encounter.e2e.ts - Missing clickEndTurn

**优先级**: P0（阻塞测试运行）  
**维度**: D47（E2E 测试覆盖完整性）  
**文件**: `e2e/cardia-deck1-card04-mediator-single-encounter.e2e.ts`

#### 错误详情
```typescript
// 导入语句
import { setupCardiaTestScenario, playCard, waitForPhase, clickEndTurn } from './helpers/cardia';

// 错误信息
Error: Module '"./helpers/cardia"' has no exported member 'clickEndTurn'.
```

#### 根因分析
- **问题**: `e2e/helpers/cardia.ts` 未导出 `clickEndTurn` 函数
- **影响**: 测试文件无法编译，阻止测试运行
- **历史**: 可能是测试特定的辅助函数，未被提取到公共 helpers

#### 修复建议

**方案（推荐）**: 在测试文件内定义本地辅助函数
```typescript
// 在测试文件顶部添加辅助函数
async function clickEndTurn(page: Page) {
  await page.locator('[data-testid="cardia-end-turn-btn"]').click();
  await page.waitForTimeout(500); // 等待阶段切换
}

// 移除导入中的 clickEndTurn
import { setupCardiaTestScenario, playCard, waitForPhase } from './helpers/cardia';
```

**备选方案**: 将函数添加到 `e2e/helpers/cardia.ts` 并导出（如果多个测试需要）

#### 验证步骤
1. 在测试文件内定义辅助函数
2. 修改导入语句
3. 运行 `npx tsc --noEmit` 确认无类型错误
4. 运行测试: `npm run test:e2e -- cardia-deck1-card04-mediator-single-encounter.e2e.ts`
5. 确认测试可以正常执行

---

## Test Failures (P1)

### PHASE4-005: cardia-basic-flow.e2e.ts - Phase advancement stuck in ability phase

**优先级**: P1（功能问题）  
**维度**: D8（引擎批处理时序与 UI 交互对齐）  
**文件**: `e2e/cardia-basic-flow.e2e.ts`  
**测试名称**: `should complete a full turn cycle`

#### 失败详情

**错误信息**:
```
Error: expect(locator).toContainText(expected)

Locator: locator('[data-testid="cardia-phase-indicator"]')
Expected substring: "End"
Received string:    "PhaseActivate Ability"
Call log:
  - expect.toContainText with timeout 10000ms
  - waiting for locator('[data-testid="cardia-phase-indicator"]')
```

**失败位置**: `e2e/cardia-basic-flow.e2e.ts:169:84`

**超时**: 10000ms

#### 页面状态

**调试信息**（测试失败时的状态）:
```javascript
{
  phase: 'ability',           // 卡在能力阶段
  myPlayerId: '0',
  loserId: '0',               // 玩家 0 已输
  hasCurrentCard: true,
  currentCardId: 'deck_i_card_03',  // 外科医生
  hasAbility: true,
  abilityId: 'ability_i_surgeon',
  turnNumber: 1,
  playedCardsCount: 1
}
```

**关键观察**:
1. 游戏停留在 `ability` 阶段，未推进到 `end` 阶段
2. 当前卡牌是 `deck_i_card_03`（外科医生）
3. 能力是 `ability_i_surgeon`（外科医生能力）
4. 玩家 0 已经输了（`loserId: '0'`）
5. 回合数是 1

#### 截图证据

**截图路径**:
1. `test-results/cardia-basic-flow.e2e.ts-C-e6f3e--complete-a-full-turn-cycle-chromium/test-failed-1.png`
2. `test-results/cardia-basic-flow.e2e.ts-C-e6f3e--complete-a-full-turn-cycle-chromium/test-failed-2.png`

**截图内容**（推测）:
- 阶段指示器显示 "Activate Ability"
- 外科医生卡牌在场上
- 可能有"激活能力"或"跳过能力"按钮
- 游戏未推进到结束阶段

#### 根因分析

**可能原因 1（最可能）**: 跳过能力按钮未正确点击
- 测试代码可能调用了 `skipAbility()` 或类似函数
- 按钮可能未正确响应点击（动画延迟、z-index 遮挡、disabled 状态）
- 点击后未等待足够时间让阶段推进

**可能原因 2**: 阶段推进逻辑问题
- `ability` 阶段的 `onPhaseExit` 可能未正确返回
- FlowSystem 可能未正确处理阶段切换
- 游戏结束检测可能干扰了阶段推进（`loserId: '0'` 表明玩家已输）

**可能原因 3**: 游戏结束与阶段推进冲突
- 玩家 0 已经输了，但游戏未立即结束
- 阶段推进逻辑可能在游戏结束时被阻塞
- 可能需要先处理游戏结束，再推进阶段

**可能原因 4**: 外科医生能力特殊逻辑
- 外科医生能力可能有特殊的阶段推进要求
- 能力可能需要玩家确认或选择
- 能力可能创建了交互，阻塞了阶段推进

#### 修复建议

**短期修复（测试层面）**:
1. **增加等待时间**
   ```typescript
   await skipAbility(page);
   await page.waitForTimeout(1000); // 增加等待时间
   await waitForPhase(page, 'end');
   ```

2. **显式等待阶段切换**
   ```typescript
   await skipAbility(page);
   await page.waitForFunction(() => {
     const indicator = document.querySelector('[data-testid="cardia-phase-indicator"]');
     return indicator?.textContent?.includes('End');
   }, { timeout: 10000 });
   ```

3. **添加调试日志**
   ```typescript
   console.log('Before skip ability:', await readCoreState(page));
   await skipAbility(page);
   console.log('After skip ability:', await readCoreState(page));
   ```

**长期修复（代码层面）**:
1. **检查 FlowSystem 阶段推进逻辑**
   - 确认 `ability` 阶段的 `onPhaseExit` 正确返回
   - 确认游戏结束不会阻塞阶段推进
   - 添加日志记录阶段切换

2. **检查外科医生能力实现**
   - 确认能力不会创建阻塞性交互
   - 确认跳过能力按钮正确触发阶段推进
   - 添加单元测试覆盖外科医生能力

3. **检查游戏结束逻辑**
   - 确认游戏结束检测不会干扰阶段推进
   - 确认 `loserId` 设置后游戏能正确结束
   - 添加测试覆盖"游戏结束时的阶段推进"场景

#### 验证步骤

**测试层面验证**:
1. 修改测试代码（增加等待/日志）
2. 重新运行测试: `npm run test:e2e -- cardia-basic-flow.e2e.ts`
3. 查看截图和日志，确认问题是否解决
4. 如果仍失败，查看调试日志定位具体问题

**代码层面验证**:
1. 添加单元测试覆盖外科医生能力
2. 添加单元测试覆盖游戏结束时的阶段推进
3. 运行所有测试确认无回归
4. 重新运行 E2E 测试确认修复

#### 影响范围

**直接影响**:
- `cardia-basic-flow.e2e.ts` 测试失败（1/3 测试失败）
- 基础流程测试覆盖不完整

**潜在影响**:
- 其他涉及外科医生的测试可能也会失败
- 其他涉及能力跳过的测试可能也会失败
- 游戏结束逻辑可能影响其他场景

**用户影响**:
- 如果是真实 bug，玩家可能在跳过外科医生能力后卡住
- 游戏无法正常推进到结束阶段
- 影响游戏体验

---

## 修复优先级与行动计划

### 优先级 P0（立即修复）

#### 1. 修复所有导入错误（预计 30 分钟）
- **PHASE4-001**: 使用 `readCoreState` 替代 `readGameState`
- **PHASE4-002**: 从 `./helpers/common` 导入 `waitForTestHarness`
- **PHASE4-003**: 在测试文件内定义 `activateAbility` 和 `skipAbility`
- **PHASE4-004**: 在测试文件内定义 `clickEndTurn`

**验证**: 运行 `npx tsc --noEmit` 确认无类型错误

#### 2. 重新运行完整测试套件（预计 15 分钟）
```bash
npm run test:e2e:ci
```

**预期结果**: 41 个测试文件全部可执行

---

### 优先级 P1（尽快修复）

#### 3. 调查并修复 PHASE4-005（预计 2-4 小时）

**步骤 1**: 本地复现问题
```bash
npm run test:e2e -- cardia-basic-flow.e2e.ts --debug
```

**步骤 2**: 添加调试日志
- 在测试中添加状态打印
- 在 FlowSystem 中添加阶段切换日志
- 在外科医生能力中添加执行日志

**步骤 3**: 定位根因
- 确认是测试问题还是代码问题
- 确认是外科医生特有问题还是通用问题
- 确认是阶段推进问题还是游戏结束问题

**步骤 4**: 实施修复
- 如果是测试问题，修改测试代码
- 如果是代码问题，修改游戏逻辑
- 添加单元测试覆盖修复场景

**步骤 5**: 验证修复
- 重新运行失败的测试
- 运行所有 Cardia 测试确认无回归
- 运行所有单元测试确认无回归

---

### 优先级 P2（后续优化）

#### 4. 提取公共辅助函数（预计 1 小时）
- 将 `activateAbility`、`skipAbility`、`clickEndTurn` 提取到 `e2e/helpers/cardia.ts`
- 统一所有测试使用公共辅助函数
- 减少代码重复

#### 5. 改进测试稳定性（预计 2 小时）
- 增加智能等待（等待状态变化而非固定时间）
- 添加重试机制
- 改进错误信息（包含更多上下文）

#### 6. 补充测试覆盖（预计 8 小时）
- 添加 Deck II/III/IV 测试
- 添加多回合复杂场景测试
- 添加错误处理测试

---

## 测试质量改进建议

### 1. 辅助函数管理
**问题**: 多个测试文件重复定义相同的辅助函数  
**建议**: 
- 将通用辅助函数提取到 `e2e/helpers/cardia.ts`
- 为测试特定的辅助函数添加注释说明为何不提取
- 定期审查和重构辅助函数

### 2. 等待策略
**问题**: 使用固定时间等待（`waitForTimeout`）不稳定  
**建议**:
- 优先使用 `waitForFunction` 等待状态变化
- 使用 `waitForSelector` 等待 UI 元素出现
- 只在必要时使用固定时间等待，并添加注释说明原因

### 3. 错误信息
**问题**: 测试失败时缺少足够的上下文信息  
**建议**:
- 在关键步骤添加调试日志
- 失败时自动截图和保存状态
- 在断言中包含更多上下文信息

### 4. 测试隔离
**问题**: 测试之间可能存在状态污染  
**建议**:
- 每个测试使用独立的对局
- 测试结束后清理状态
- 避免依赖测试执行顺序

### 5. 测试命名
**问题**: 部分测试名称不够描述性  
**建议**:
- 使用 "should [expected behavior] when [condition]" 格式
- 包含测试的关键场景和预期结果
- 避免使用 "test"、"debug" 等通用名称

---

## 总结

### 当前状态
- ✅ **38/41 测试文件可执行**（92.7%）
- ⚠️ **4 个导入错误**（P0，阻塞测试运行）
- ⚠️ **1 个测试失败**（P1，功能问题）
- ✅ **Deck I 所有 16 张卡牌已覆盖**

### 关键发现
1. **导入错误是主要阻塞因素**：4 个测试文件因导入错误无法运行
2. **阶段推进逻辑存在问题**：基础流程测试在能力阶段卡住
3. **测试辅助函数管理混乱**：多个测试重复定义相同函数
4. **测试覆盖率良好**：Deck I 所有卡牌都有专门测试

### 下一步行动
1. **立即**: 修复 4 个导入错误（30 分钟）
2. **立即**: 重新运行完整测试套件（15 分钟）
3. **尽快**: 调查并修复阶段推进问题（2-4 小时）
4. **后续**: 提取公共辅助函数（1 小时）
5. **后续**: 改进测试稳定性和覆盖率（10+ 小时）

### 风险评估
- **高风险**: 阶段推进问题可能影响实际游戏体验
- **中风险**: 导入错误阻塞测试运行，影响 CI/CD
- **低风险**: 测试质量问题，不影响功能但影响维护性

---

**报告生成**: Task 17.3 执行完成  
**下一任务**: Task 17.4 - 修复失败的测试（如果需要）

