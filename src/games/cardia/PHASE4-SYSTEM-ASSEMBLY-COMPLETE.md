# Cardia - Phase 4 系统组装完成

## 完成时间
2026年2月26日

## 完成的工作

### 1. FlowHooks 实现 ✅
**文件**：`domain/flowHooks.ts`

**功能**：
- 定义了阶段流转逻辑：`play → ability → end → play`
- 实现了 `getNextPhase`：根据当前阶段返回下一个阶段
- 实现了 `getActivePlayerId`：在能力阶段返回失败者ID，其他阶段返回当前玩家ID
- 提供了 `onPhaseEnter` 和 `onPhaseExit` 钩子（预留扩展）

**代码行数**：~70行

### 2. CheatModifier 实现 ✅
**文件**：`domain/cheatModifier.ts`

**功能**：
- 实现了调试作弊命令
- 支持的作弊命令：
  - `setPhase`：设置游戏阶段
  - `setSignets`：设置玩家印戒数量
  - `addCardToHand`：添加卡牌到手牌
  - `clearHand`：清空手牌
  - `drawCards`：抽指定数量的牌
  - `setInfluence`：设置卡牌影响力

**代码行数**：~100行

### 3. 牌库初始化 ✅
**文件**：`domain/setupDeck.ts`

**功能**：
- 实现了 `createInitialDeck`：根据 deckVariant 创建初始牌库
  - `'I'`：I 牌组（16张）
  - `'II'`：II 牌组（16张）
  - `'mixed'`：混合牌组（32张）
- 实现了 `shuffleArray`：洗牌算法（Fisher-Yates）
- 实现了 `drawCards`：从牌库抽牌到手牌

**代码行数**：~100行

### 4. 能力执行器 ✅
**文件**：`domain/abilityExecutor.ts`

**功能**：
- 实现了 `executeAbility`：根据能力定义执行能力效果
- 实现了14种能力效果类型的执行器：
  - ✅ `draw`：抽牌
  - ✅ `discardRandom`：随机弃牌
  - ⚠️ `discardSelected`：选择弃牌（需要交互，待实现）
  - ⚠️ `discard`：弃牌（需要交互，待实现）
  - ✅ `modifyInfluence`：修改影响力（添加修正标记）
  - ⚠️ `recycle`：回收卡牌（需要交互，待实现）
  - ✅ `viewHand`：查看手牌
  - ✅ `addOngoing`：添加持续效果
  - ✅ `win`：胜利条件检查
  - ⚠️ `discardByFaction`：派系弃牌（需要交互，待实现）
  - ✅ `shuffle`：混洗牌库
  - ⚠️ `copy`：复制能力（需要交互，待实现）
  - ❌ `removeOngoing`：移除持续效果（未使用）
  - ❌ `grantSignet`：授予印戒（未使用，由遭遇战解析处理）

**代码行数**：~300行

### 5. 修正栈应用 ✅
**文件**：`domain/utils.ts`

**功能**：
- 完善了 `calculateInfluence` 函数
- 应用卡牌上的所有修正标记
- 确保影响力不为负数

**代码行数**：~15行

### 6. 事件 timestamp 修复 ✅
**文件**：`domain/execute.ts`

**功能**：
- 修复了所有事件创建缺少 `timestamp` 字段的问题
- 所有事件现在都包含 `timestamp: Date.now()`

### 7. game.ts 组装 ✅
**文件**：`game.ts`

**功能**：
- 整合了 FlowSystem、CheatSystem 和 BaseSystems
- 配置了命令类型列表
- 创建了游戏适配器

**代码行数**：~40行

### 8. domain/index.ts 更新 ✅
**文件**：`domain/index.ts`

**功能**：
- 更新了 `setup` 函数，集成牌库初始化
- 创建初始牌库（16张，根据 deckVariant）
- 洗牌
- 双方玩家各抽5张牌

## 代码统计

### Phase 4 新增代码
- `domain/flowHooks.ts`：~70行
- `domain/cheatModifier.ts`：~100行
- `domain/setupDeck.ts`：~100行
- `domain/abilityExecutor.ts`：~300行
- `domain/utils.ts`（修正栈）：~15行
- `domain/execute.ts`（timestamp 修复）：~20行
- `game.ts`：~40行
- **Phase 4 总计**：~645行

### 累计代码行数
- Phase 2（注册表）：~1280行
- Phase 3（领域核心）：~1250行
- Phase 4（系统组装）：~645行
- **总计**：~3175行

## 技术债务

### 已完成 ✅
- [x] FlowHooks 实现
- [x] CheatModifier 实现
- [x] 牌库初始化
- [x] 能力执行器框架
- [x] 修正栈应用
- [x] 事件 timestamp 修复
- [x] game.ts 组装

### 待实现 ⚠️

#### 1. 交互系统集成（高优先级）
需要实现的交互类型：
- **选择弃牌**：见习生、元素师、继承者
- **选择回收**：猎人、占卜师、游侠、预言家
- **选择派系**：巫王
- **选择能力**：元素师（复制能力）

**预计工作量**：~200行

**实现方案**：
```typescript
// 使用 InteractionSystem 创建交互
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';

// 示例：选择弃牌
const interaction = createSimpleChoice(
    'discard_card',
    playerId,
    '选择要弃掉的卡牌',
    player.hand.map(card => ({
        id: card.uid,
        label: getCardName(card.defId),
        value: card.uid,
    }))
);
```

#### 2. 持续效果管理（中优先级）
需要实现的持续效果：
- **德鲁伊**：每张牌+1影响力
- **大法师**：每回合抽1张
- **行会长**：每张牌+2影响力

**预计工作量**：~150行

**实现方案**：
- 在 `FlowHooks.onPhaseEnter` 中触发持续效果
- 在 `calculateInfluence` 中应用持续效果修正
- 使用 `tags.ts` 原语管理持续效果标记

#### 3. 特殊能力逻辑（中优先级）
需要实现的特殊能力：
- **顾问**：上一次遭遇获胜且对手失败
- **机械精灵**：下一次遭遇获胜则游戏胜利
- **巫王**：派系弃牌+混洗
- **元素师**：能力复制
- **继承者**：保留2张弃其他所有

**预计工作量**：~300行

#### 4. 游戏结束判定完善（低优先级）
当前 `isGameOver` 只检查印戒数量，需要补充：
- 无法打出卡牌（手牌和牌库均为空）
- 特殊能力直接胜利（精灵、机械精灵）

**预计工作量**：~50行

### 总计待实现
- 预计工作量：~700行
- 主要集中在交互系统和特殊能力

## 设计决策记录

### 1. 能力执行器架构
- **决策**：使用单一 `executeAbility` 函数 + 效果类型分发
- **理由**：
  - 简化能力注册（只需定义效果数组）
  - 易于扩展（新增效果类型只需添加 case）
  - 符合数据驱动原则
- **替代方案**：为每个能力实现独立执行器
  - 优点：更灵活，可以处理复杂逻辑
  - 缺点：代码重复，维护成本高

### 2. 交互延迟实现
- **决策**：先实现不需要交互的能力，交互能力返回空数组
- **理由**：
  - 快速完成核心流程
  - 交互系统需要 UI 配合
  - 可以先用作弊命令测试
- **后续计划**：Phase 5 实现交互系统

### 3. 修正栈简化
- **决策**：直接遍历 `modifiers.modifiers` 数组求和
- **理由**：
  - Cardia 的修正逻辑简单（只有加减）
  - 不需要复杂的修正器优先级
  - 性能足够好
- **扩展性**：如果未来需要复杂修正（如乘法、条件修正），可以使用 `modifier.ts` 的 `applyModifiers` 函数

### 4. 持续效果延迟实现
- **决策**：先实现持续效果的添加/移除事件，触发逻辑待实现
- **理由**：
  - 持续效果需要在多个时机触发（回合开始、打出卡牌时）
  - 需要与 FlowHooks 配合
  - 可以先测试非持续能力
- **后续计划**：Phase 4.5 实现持续效果触发

## 质量检查清单

- [x] FlowHooks 定义完整
- [x] CheatModifier 定义完整
- [x] 牌库初始化逻辑正确
- [x] 能力执行器框架完整
- [x] 修正栈应用逻辑正确
- [x] 事件 timestamp 字段完整
- [x] game.ts 组装正确
- [x] TypeScript 编译通过
- [x] 代码注释清晰完整
- [ ] 交互系统集成（待Phase 5）
- [ ] 持续效果管理（待Phase 4.5）
- [ ] 特殊能力逻辑（待Phase 4.5）
- [ ] 单元测试覆盖（待Phase 5）

## 下一步

### Phase 4.5：持续效果与特殊能力（可选）
如果需要完整实现所有能力，可以在 Phase 5 之前完成：
1. 持续效果触发逻辑（~150行）
2. 特殊能力逻辑（~300行）
3. 交互系统集成（~200行）

### Phase 5：UI 实现（必需）
根据 `.windsurf/skills/create-new-game/SKILL.md` 的 Phase 5 要求：
1. 实现 `Board.tsx`：游戏主界面
2. 实现子组件：手牌区、牌库区、弃牌堆、印戒显示
3. 实现交互 UI：选择卡牌、选择派系、能力激活
4. 实现动画：卡牌打出、遭遇战解析、印戒授予
5. 实现音效：卡牌打出、能力激活、遭遇战解析

### Phase 6：测试与优化（必需）
1. 单元测试：领域层逻辑
2. E2E 测试：完整游戏流程
3. 性能优化：减少不必要的渲染
4. 代码审查：清理技术债务

## 百游戏自检

### ✅ 通过的检查
- **显式配置**：所有能力效果在 `abilityRegistry.ts` 中显式声明
- **智能默认**：能力执行器提供通用逻辑，特殊能力可覆盖
- **单一真实来源**：能力定义只在 `abilityRegistry.ts` 中
- **类型安全**：所有类型定义完整，编译期检查
- **最小化游戏层代码**：新增能力只需在 `abilityRegistry.ts` 中添加定义
- **框架可进化**：能力执行器可以添加新效果类型，游戏层无需修改

### ⚠️ 需要改进的地方
- **交互系统**：当前交互能力返回空数组，需要集成 InteractionSystem
- **持续效果**：当前只添加标记，未实现触发逻辑
- **特殊能力**：部分复杂能力（顾问、机械精灵、继承者）需要特殊处理

### 🎯 面向100个游戏的设计
- **新增游戏能力**：只需在 `abilityRegistry.ts` 中添加定义（~10行）
- **新增效果类型**：在 `abilityExecutor.ts` 中添加 case（~30行）
- **新增交互类型**：使用 InteractionSystem 创建交互（~20行）
- **总计**：新增能力 ≤ 60行

---

**状态**：✅ Phase 4 系统组装完成
**下一步**：Phase 5 UI 实现 或 Phase 4.5 持续效果与特殊能力
**最后更新**：2026年2月26日
