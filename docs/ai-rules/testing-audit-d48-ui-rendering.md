# D48：UI 交互渲染模式完整性审计（通用）

> **新增维度**：补充 `testing-audit.md` 中缺失的 UI 渲染正确性检查
> 
> **适用范围**：所有游戏、所有交互创建方式（`createSimpleChoice`/`createInteraction`/自定义交互）

---

## 问题根源

**历史教训**：SmashUp 传送门交互显示按钮而非卡牌预览，全项目 86 处缺失 `displayMode` 声明，审计未发现。

**根本原因**：
1. **D34 维度不够具体**：只检查"是否有 displayMode"，未检查"所有应该有的地方是否都有"
2. **缺少静态扫描**：没有工具自动检查所有交互选项的 UI 渲染元数据
3. **缺少 UI 渲染测试**：E2E 测试只验证功能，不验证 UI 渲染方式

---

## D48：UI 交互渲染模式完整性审计

### 触发条件
- 新增任何交互能力（任何游戏、任何交互创建方式）
- 修复"UI 显示不对"/"预览不显示"/"渲染模式错误"类 bug
- 全面审计（如派系审计、游戏审计）

### 核心原则

**显式声明 > 自动推断**：所有交互选项必须显式声明 UI 渲染元数据（如 `displayMode`、`targetType`、`renderHint` 等），不依赖 UI 层的自动推断逻辑。

**通用原因**：
1. **自动推断脆弱**：UI 根据 `value` 字段推断渲染方式，但业务语义可能不同
2. **维护困难**：自动推断规则变化时，所有依赖推断的交互都可能破坏
3. **可读性差**：代码中看不出 UI 渲染方式，需要查看 UI 组件代码才能理解
4. **跨游戏不一致**：不同游戏的自动推断规则可能不同，导致相同代码在不同游戏中表现不一致

### 审查方法

#### 1. 识别游戏的交互创建模式

**第一步：确定游戏使用的交互创建方式**

不同游戏可能使用不同的交互创建方式，审查前必须先识别：

```bash
# 搜索游戏的交互创建方式
grep -r "createSimpleChoice\|createInteraction\|queueInteraction" src/games/<gameId>/
```

**常见模式**：
- **SmashUp**：`createSimpleChoice` + `displayMode` 字段
- **DiceThrone**：`createInteraction` + `targetType` 字段
- **SummonerWars**：`createInteraction` + `targetType` 字段
- **自定义交互**：直接构建 interaction 对象

#### 2. 静态扫描（自动化，需按游戏定制）

**通用检查原则**：
1. 所有交互选项必须有 UI 渲染元数据（字段名因游戏而异）
2. 元数据值必须与业务语义一致
3. 相同类型的交互必须使用相同的元数据声明方式

**SmashUp 示例**：
```bash
# 检查所有缺失 displayMode 的交互选项
node scripts/check-displaymode.mjs
```

**DiceThrone/SummonerWars 示例**：
```bash
# 检查所有缺失 targetType 的交互
grep -r "createInteraction" src/games/<gameId>/ | grep -v "targetType"
```

**通用扫描脚本模板**：
```javascript
// scripts/check-interaction-metadata.mjs
import { readFileSync } from 'fs';
import { glob } from 'glob';

const gameId = process.argv[2]; // 'smashup' | 'dicethrone' | 'summonerwars'
const metadataField = {
  smashup: 'displayMode',
  dicethrone: 'targetType',
  summonerwars: 'targetType'
}[gameId];

const files = glob.sync(`src/games/${gameId}/**/*.ts`);
// ... 检查逻辑
```

#### 3. 代码审查（手动，按游戏定制）

**通用检查清单**：

1. **识别选项类型**：
   - 实体选择（卡牌/单位/格子/基地）
   - 操作按钮（跳过/完成/取消/确认）
   - 决策按钮（是/否/选择 A/选择 B）

2. **验证元数据声明**：
   - 实体选择 → 必须声明实体类型元数据
   - 操作按钮 → 必须声明按钮类型元数据
   - 决策按钮 → 根据是否涉及实体选择判断

3. **验证元数据一致性**：
   - 同一游戏中相同类型的交互必须使用相同的元数据声明方式
   - 元数据值必须与业务语义一致

**SmashUp 示例**：

```typescript
// ❌ 错误：缺少 displayMode
const options = minions.map(c => ({
    id: `minion-${i}`,
    label: name,
    value: { cardUid: c.uid, defId: c.defId }
}));

// ✅ 正确：显式声明
const options = minions.map(c => ({
    id: `minion-${i}`,
    label: name,
    value: { cardUid: c.uid, defId: c.defId },
    displayMode: 'card' as const  // 显式声明
}));
```

**DiceThrone 示例**：

```typescript
// ❌ 错误：缺少 targetType
const interaction = createInteraction({
    id: 'select_target',
    playerId,
    title: '选择目标',
    options: targets.map(t => ({ id: t.uid, label: t.name, value: t }))
});

// ✅ 正确：显式声明
const interaction = createInteraction({
    id: 'select_target',
    playerId,
    title: '选择目标',
    targetType: 'opponent',  // 显式声明
    options: targets.map(t => ({ id: t.uid, label: t.name, value: t }))
});
```

**通用判定标准表**：

| 游戏 | 元数据字段 | 实体选择值 | 按钮选择值 | 示例 |
|------|-----------|-----------|-----------|------|
| SmashUp | `displayMode` | `'card'` | `'button'` | 卡牌选择 vs 跳过按钮 |
| DiceThrone | `targetType` | `'opponent'`/`'self'` | `'generic'` | 选择对手 vs 确认按钮 |
| SummonerWars | `targetType` | `'unit'`/`'cell'` | `'action'` | 选择单位 vs 跳过按钮 |

#### 4. UI 渲染验证（E2E，通用）

**通用测试模板**：

```typescript
test('实体选择交互应显示实体预览', async ({ page }) => {
    // 1. 触发交互
    await triggerInteraction(page);
    
    // 2. 验证 UI 渲染方式（根据游戏调整选择器）
    const entityPreviews = page.locator('[data-testid="entity-preview"]');
    await expect(entityPreviews.count()).toBeGreaterThan(0);
    
    // 3. 验证不是通用按钮
    const genericButtons = page.locator('button:has-text("选项")');
    await expect(genericButtons).toHaveCount(0);
});

test('操作按钮应显示为按钮', async ({ page }) => {
    // 1. 触发交互
    await triggerInteraction(page);
    
    // 2. 验证按钮存在
    const actionButton = page.locator('button:has-text("跳过")');
    await expect(actionButton).toBeVisible();
    
    // 3. 验证不是实体预览
    const entityPreview = page.locator('[data-testid="entity-preview"]:has-text("跳过")');
    await expect(entityPreview).toHaveCount(0);
});
```

**游戏特定选择器**：
- **SmashUp**：`[data-testid="card-preview"]`
- **DiceThrone**：`[data-testid="unit-card"]` 或 `.hero-portrait`
- **SummonerWars**：`[data-testid="unit-preview"]` 或 `.board-cell`

### 典型缺陷模式（通用）

#### 模式 1：缺少 UI 渲染元数据

**SmashUp 示例**：
```typescript
// ❌ 错误：缺少 displayMode
const options = actionCards.map((c, i) => ({ 
    id: `card-${i}`, 
    label: c.label, 
    value: { cardUid: c.uid, defId: c.defId } 
}));

// 症状：UI 可能显示按钮而非卡牌预览（取决于自动推断逻辑）
```

**DiceThrone 示例**：
```typescript
// ❌ 错误：缺少 targetType
const interaction = createInteraction({
    id: 'select_target',
    playerId,
    title: '选择目标',
    options: targets.map(t => ({ id: t.uid, label: t.name, value: t }))
    // 缺少 targetType
});

// 症状：UI 可能显示为通用按钮而非单位卡牌
```

#### 模式 2：元数据与业务语义不符

**SmashUp 示例**：
```typescript
// ❌ 错误：传送门选择随从应该显示卡牌预览，不是按钮
const options = minions.map(c => ({
    id: `minion-${i}`,
    label: name,
    value: { cardUid: c.uid, defId: c.defId },
    displayMode: 'button' as const  // 错误！应该是 'card'
}));

// 症状：UI 显示按钮而非卡牌预览
```

**DiceThrone 示例**：
```typescript
// ❌ 错误：选择对手单位应该用 'opponent'，不是 'generic'
const interaction = createInteraction({
    id: 'select_target',
    playerId,
    title: '选择目标',
    targetType: 'generic',  // 错误！应该是 'opponent'
    options: opponentUnits.map(u => ({ id: u.uid, label: u.name, value: u }))
});

// 症状：UI 可能不高亮对手单位，或显示为通用按钮
```

#### 模式 3：类型定义中缺少元数据字段

**SmashUp 示例**：
```typescript
// ❌ 错误：类型定义中没有 displayMode 字段
const options: Array<{
    id: string;
    label: string;
    value: { skip: true } | { cardUid: string; defId: string };
}> = [
    { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }
    //                                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                                                    TypeScript 报错：类型中没有 displayMode
];

// 修复：在类型定义中添加 displayMode 字段
const options: Array<{
    id: string;
    label: string;
    value: { skip: true } | { cardUid: string; defId: c.defId };
    displayMode: 'button' | 'card';  // 添加这一行
}> = [
    { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }
];
```

#### 模式 4：跨游戏不一致

**问题**：
```typescript
// SmashUp 中使用 displayMode
const smashupOptions = cards.map(c => ({
    id: c.uid,
    label: c.name,
    value: { cardUid: c.uid },
    displayMode: 'card' as const
}));

// DiceThrone 中使用 targetType
const diceOptions = units.map(u => ({
    id: u.uid,
    label: u.name,
    value: { unitId: u.uid }
    // 缺少 targetType
}));

// 症状：相同的"选择实体"交互在不同游戏中表现不一致
```

**修复**：每个游戏必须有自己的元数据字段规范，并在该游戏的所有交互中一致使用。

### 修复策略（通用）

#### 策略 1：创建游戏特定的扫描工具（推荐）

**步骤**：
1. 识别游戏的交互创建模式和元数据字段
2. 创建游戏特定的扫描脚本
3. 运行扫描并生成报告
4. 创建自动修复脚本（可选）
5. 验证修复完整性

**SmashUp 示例**：
```bash
# 1. 运行检查脚本
node scripts/check-displaymode.mjs

# 2. 运行自动修复脚本
node scripts/fix-all-displaymode.mjs

# 3. 手动修复内联选项
node scripts/fix-inline-skip-options.mjs

# 4. 验证修复完整性
node scripts/check-displaymode.mjs
```

**DiceThrone/SummonerWars 示例**：
```bash
# 1. 创建检查脚本
node scripts/check-targettype.mjs dicethrone

# 2. 手动修复（根据报告）
# 添加 targetType: 'opponent' 或 targetType: 'self'

# 3. 验证
npx eslint src/games/dicethrone/**/*.ts
```

#### 策略 2：逐个文件手动修复

**步骤**：
1. 查看具体文件的问题
2. 根据业务语义添加正确的元数据
3. 验证语法和类型正确性
4. 运行 E2E 测试验证 UI 渲染

**示例**：
```bash
# 1. 查看具体文件的问题
git diff src/games/<gameId>/abilities/xxx.ts

# 2. 手动修复
# 添加正确的元数据字段

# 3. 验证
npx eslint src/games/<gameId>/abilities/xxx.ts

# 4. E2E 测试
npm run test:e2e -- xxx.e2e.ts
```

#### 策略 3：添加 CI 门禁（长期）

**目的**：防止未来再次引入同样问题

**实现**：
```yaml
# .github/workflows/ci.yml
- name: Check interaction metadata completeness
  run: |
    node scripts/check-displaymode.mjs  # SmashUp
    node scripts/check-targettype.mjs dicethrone  # DiceThrone
    node scripts/check-targettype.mjs summonerwars  # SummonerWars
  # 如果发现缺失，CI 失败
```

### 审计输出格式（通用模板）

```markdown
## D48 审计报告：UI 交互渲染模式完整性

### 游戏信息
- 游戏：<gameId>
- 交互创建方式：<createSimpleChoice | createInteraction | 自定义>
- 元数据字段：<displayMode | targetType | renderHint | ...>

### 扫描范围
- 文件数：<N>
- 交互选项总数：<M>

### 发现问题
- 缺少元数据：<X> 处
  - 实体选择选项：<Y> 处
  - 操作按钮选项：<Z> 处
- 元数据错误：<W> 处
  - 具体错误列表...

### 修复建议
1. 批量修复：运行 `node scripts/check-<metadata>.mjs`
2. 手动修复：<具体修复项>
3. 验证：运行 E2E 测试确认 UI 渲染正确

### 影响评估
- 安全性：✅ 只添加 UI 元数据，不改变业务逻辑
- 兼容性：✅ 向后兼容
- 效果：✅ 所有交互正确显示预期的 UI 渲染方式
```

**SmashUp 实际示例**：
```markdown
## D48 审计报告：UI 交互渲染模式完整性

### 游戏信息
- 游戏：smashup
- 交互创建方式：createSimpleChoice
- 元数据字段：displayMode

### 扫描范围
- 文件数：14
- 交互选项总数：156

### 发现问题
- 缺少 displayMode：86 处
  - 卡牌选项：56 处
  - 按钮选项：30 处
- displayMode 错误：1 处
  - 传送门：'button' → 应为 'card'

### 修复建议
1. 批量修复：运行 `node scripts/fix-all-displaymode.mjs`
2. 手动修复：传送门 displayMode 从 'button' 改为 'card'
3. 验证：运行 E2E 测试确认 UI 渲染正确

### 影响评估
- 安全性：✅ 只添加 UI 提示，不改变业务逻辑
- 兼容性：✅ 向后兼容
- 效果：✅ 所有卡牌选择正确显示卡牌预览
```

---

## 为什么之前的审计没发现？

### 1. D34 维度不够具体

**D34 原文**：
> 交互选项的 `value` 字段是否包含会被 UI 误判为"卡牌选择"的字段（`defId`/`minionDefId`/`baseDefId`）？

**问题**：
- 只关注"误判"场景（value 包含 defId 但不应该显示卡牌）
- 未关注"应该有但没有"场景（value 包含 cardUid 但缺少 displayMode）
- 未要求"所有选项都显式声明"

### 2. 缺少静态扫描工具

**问题**：
- 审计文档只提供检查维度，未提供自动化工具
- 手动检查容易遗漏（14 个文件，156 个选项）

**解决方案**：
- 创建 `scripts/check-displaymode.mjs` 自动扫描
- 创建 `scripts/fix-all-displaymode.mjs` 自动修复

### 3. E2E 测试未覆盖 UI 渲染

**问题**：
- E2E 测试只验证功能（能否选择、能否完成）
- 未验证 UI 渲染方式（显示卡牌还是按钮）

**解决方案**：
- 补充 UI 渲染验证（检查 `data-testid="card-preview"` 存在）

---

## 改进建议

### 1. 更新 D34 维度

**原 D34**：
> 交互选项 UI 渲染模式正确性

**新 D34**：
> **交互选项 UI 渲染模式完整性与正确性**
> 
> - **完整性**：所有交互选项必须显式声明 `displayMode`
> - **正确性**：`displayMode` 必须与业务语义一致
> - **自动化**：使用 `scripts/check-displaymode.mjs` 扫描
> - **测试**：E2E 测试验证 UI 渲染方式

### 2. 添加 D48 维度

将本文档作为 D48 维度，补充到 `testing-audit.md` 中。

### 3. 更新审计流程

**新增步骤**：

```markdown
## 审计流程（更新）

1. **静态扫描**（自动化）
   - 运行 `node scripts/check-displaymode.mjs`
   - 检查所有交互选项的 displayMode 声明

2. **代码审查**（手动）
   - 按 D1-D48 维度逐项检查
   - 重点关注 D34（UI 渲染模式）和 D48（完整性）

3. **测试验证**（自动化）
   - 运行 GameTestRunner 测试（引擎层）
   - 运行 E2E 测试（完整流程 + UI 渲染）
```

### 4. 添加 CI 门禁

```yaml
# .github/workflows/ci.yml
- name: Check displayMode completeness
  run: node scripts/check-displaymode.mjs
  # 如果发现缺失，CI 失败
```

---

## 总结

**问题根源（通用）**：
1. D34 维度不够具体（只关注误判，未关注完整性）
2. 缺少自动化工具（手动检查容易遗漏）
3. E2E 测试未覆盖 UI 渲染（只验证功能）

**解决方案（通用）**：
1. 补充 D48 维度（UI 渲染模式完整性）
2. 为每个游戏创建自动化扫描工具
3. 补充 E2E UI 渲染测试
4. 添加 CI 门禁

**教训（通用）**：
- **审计维度要具体**：不只是"检查是否有"，还要"检查是否全有"
- **自动化优先**：能自动化的检查不要手动做
- **测试要全面**：不只验证功能，还要验证 UI
- **跨游戏一致性**：相同类型的交互在不同游戏中应该有一致的元数据声明方式

**适用范围**：
- ✅ 所有游戏（SmashUp、DiceThrone、SummonerWars、未来新游戏）
- ✅ 所有交互创建方式（`createSimpleChoice`、`createInteraction`、自定义交互）
- ✅ 所有 UI 渲染元数据（`displayMode`、`targetType`、`renderHint` 等）
