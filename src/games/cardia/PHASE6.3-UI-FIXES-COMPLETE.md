# Cardia Phase 6.3 - UI Fixes Complete

## 修复完成时间
2025-02-26 21:44

## 修复内容

### P0 Issue #2: E2E 测试缺少 data-testid 属性
**状态**: ✅ 已修复

**问题描述**:
E2E 测试 (`e2e/cardia-basic-flow.e2e.ts`) 使用了多个 `data-testid` 属性，但 Board.tsx 中没有定义这些属性，导致测试无法定位 UI 元素。

**修复内容**:
1. 添加了所有 E2E 测试需要的 `data-testid` 属性：
   - `cardia-phase-indicator` - 阶段指示器
   - `cardia-turn-number` - 回合数显示
   - `cardia-hand-area` - 手牌区域
   - `cardia-battlefield` - 战场区域
   - `cardia-skip-ability-btn` - 跳过能力按钮
   - `cardia-end-turn-btn` - 结束回合按钮
   - `cardia-signet-display` - 印戒计数显示
   - `card-${card.uid}` - 单个卡牌按钮

2. 添加了回合数显示 UI：
   - 在阶段指示器下方添加了回合数显示面板
   - 使用 `core.turnNumber` 显示当前回合数
   - 添加了 i18n 翻译 key `"turn"` (中文: "回合", 英文: "Turn")

**修改文件**:
- `src/games/cardia/Board.tsx` - 添加 data-testid 属性和回合数显示
- `public/locales/zh-CN/game-cardia.json` - 添加 "turn" 翻译
- `public/locales/en/game-cardia.json` - 添加 "turn" 翻译

---

### P1 Issue #3: CardDisplay 未使用 calculateInfluence()
**状态**: ✅ 已修复

**问题描述**:
`CardDisplay` 组件直接显示 `card.baseInfluence`，没有使用 `calculateInfluence()` 函数计算最终影响力（包含修正和持续效果）。这导致 UI 显示的影响力与实际计算的影响力不一致。

**修复内容**:
1. 修改 `CardDisplay` 组件：
   - 添加 `core?: CardiaCore` 可选参数
   - 使用 `calculateInfluence(card, core)` 计算最终影响力
   - 显示计算后的影响力值而非基础值

2. 更新所有 `CardDisplay` 调用点：
   - 传递 `core` 参数到所有 `CardDisplay` 组件
   - 包括手牌、战场卡牌、对手卡牌等所有位置

3. 添加 import：
   - 从 `./domain/utils` 导入 `calculateInfluence` 函数

**修改文件**:
- `src/games/cardia/Board.tsx` - 修改 CardDisplay 组件和所有调用点

**影响**:
- UI 现在正确显示包含修正和持续效果的最终影响力
- 德鲁伊（每张牌+1影响力）和行会长（每张牌+2影响力）的持续效果现在会正确显示在 UI 上
- 修正标记（如 +1/-1 影响力）也会正确反映在显示值中

---

## 测试结果

### 单元测试
```bash
npm test -- src/games/cardia/__tests__
```

**结果**: ✅ 全部通过
- 4 个测试文件
- 34 个测试用例
- 0 个失败

**测试覆盖**:
- `validate.test.ts` - 13 个测试 ✅
- `execute.test.ts` - 9 个测试 ✅
- `reduce.test.ts` - 9 个测试 ✅
- `smoke.test.ts` - 3 个测试 ✅

### TypeScript 编译检查
```bash
npx tsc --noEmit src/games/cardia/Board.tsx
```

**结果**: ✅ 无错误

---

## 剩余问题

### P2 Issues (已推迟到 Phase 6.4)
1. **边界检查不完整** - 数组访问、索引越界、空数组处理
2. **类型转换不安全** - `as any` 类型断言、缺少类型守卫
3. **混合 import/require** - 部分文件使用 CommonJS require

这些问题不影响核心功能，将在 Phase 6.4 优化阶段统一处理。

---

## 下一步

### Phase 6.4: E2E 测试与功能验证
1. **修复 E2E 测试 fixture**:
   - E2E 测试导入了不存在的 `setupOnlineMatch` 和 `waitForGameReady`
   - 需要创建或修复这些 fixture 函数
   - 参考其他游戏的 E2E 测试实现

2. **运行 E2E 测试**:
   ```bash
   npm run test:e2e -- e2e/cardia-basic-flow.e2e.ts
   ```

3. **验证交互系统**:
   - 测试能力激活流程（discard/recycle/draw/boost/ongoing）
   - 测试交互链（多步骤交互）
   - 测试 continuationContext 传递
   - 测试 sourceId 一致性

4. **处理 P2 问题**（可选）:
   - 添加边界检查
   - 改进类型安全
   - 统一 import 风格

---

## 总结

Phase 6.3 成功修复了所有 P0 和 P1 问题：
- ✅ P0 #1: sourceId 生成不一致（Phase 6.3 已修复）
- ✅ P0 #2: E2E 测试缺少 data-testid（本次修复）
- ✅ P1 #1: 交互 ID 冲突风险（Phase 6.3 已修复）
- ✅ P1 #2: interactionData 传递链数据丢失（Phase 6.3 已修复）
- ✅ P1 #3: CardDisplay 未使用 calculateInfluence（本次修复）

所有单元测试通过，代码质量良好，可以进入 E2E 测试阶段。
