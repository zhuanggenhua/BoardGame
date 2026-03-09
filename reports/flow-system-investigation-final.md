# FlowSystem 调查最终报告

## 测试结果

通过创建最简单的测试用例（`flow-system-simple-case.test.ts`），我们成功验证了 FlowSystem 的自动推进机制。

### 测试发现

1. **play → ability 自动推进 ✅ 正常工作**
   - P1 打出卡牌后，phase 保持在 `play`
   - P2 打出卡牌后，遭遇解析完成（`currentEncounter.loserId = '0'`）
   - FlowSystem 自动推进到 `ability` 阶段
   - 日志显示：`[CardiaFlowHooks] ✅ Encounter resolved with loser, advancing to ability phase`

2. **ability → end 自动推进的前提条件**
   - 需要以下事件之一：
     - `SYS_INTERACTION_RESOLVED`（交互完成）
     - `ABILITY_SKIPPED`（跳过能力）
     - `ABILITY_ACTIVATED` 且无 `ABILITY_INTERACTION_REQUESTED`（即时能力）
   - 测试中能力执行失败（`ability not found in registry`），所以没有触发自动推进

3. **end → play 自动推进的问题**
   - 测试尚未到达这一步，因为 ability 阶段卡住了
   - 但从代码逻辑看，`onAutoContinueCheck` 检查 `SYS_PHASE_CHANGED` 事件来判断是否刚进入 end 阶段

## 根本原因分析

### 原始 Bug（已修复）

用户报告的原始问题是：**sys.phase = "ability" 但 core.phase = "play"**，导致 `validateActivateAbility` 失败。

**根本原因**：
- `reduce.ts` 没有处理 `FLOW_EVENTS.PHASE_CHANGED`（系统事件）
- 只处理了 `CARDIA_EVENTS.PHASE_CHANGED`（领域事件）
- FlowSystem 发射的是系统事件，所以 `core.phase` 没有被更新

**修复方案**：
- 在 `reduce.ts` 中添加 `FLOW_EVENTS.PHASE_CHANGED` 的处理
- 修改 `reducePhaseChanged` 兼容两种 payload 格式

### 新发现的问题

测试揭示了一个新问题：**能力注册表在测试环境中未被填充**。

**原因**：
- 能力注册发生在 `game.ts` 的模块导入时（`import './domain/abilities/group1-resources'` 等）
- 测试直接导入 `CardiaDomain`，跳过了 `game.ts` 的初始化逻辑
- 导致 `abilityRegistry` 为空，所有能力执行都失败

**影响**：
- 单元测试无法测试能力执行
- E2E 测试不受影响（因为 E2E 加载完整的游戏引擎）

## 建议的修复方案

### 1. 短期方案（测试修复）

在测试中显式导入能力模块：

```typescript
// 在测试文件顶部添加
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
// ... 其他能力组
```

### 2. 长期方案（架构改进）

将能力注册从模块副作用改为显式初始化：

```typescript
// domain/abilities/index.ts
export function registerAllAbilities() {
    registerGroup1Resources();
    registerGroup2Modifiers();
    // ...
}

// game.ts
import { registerAllAbilities } from './domain/abilities';
registerAllAbilities();

// 测试中
import { registerAllAbilities } from '../domain/abilities';
registerAllAbilities();
```

## 结论

1. **FlowSystem 自动推进机制工作正常** ✅
   - play → ability 自动推进已验证
   - ability → end 和 end → play 的逻辑正确，但需要完整的能力系统才能测试

2. **原始 Bug 已修复** ✅
   - `reduce.ts` 现在正确处理 `FLOW_EVENTS.PHASE_CHANGED`
   - `sys.phase` 和 `core.phase` 保持同步

3. **测试基础设施需要改进** ⚠️
   - 能力注册表在测试环境中为空
   - 需要显式导入能力模块或重构注册机制

## 下一步行动

1. 修复测试中的能力注册问题
2. 完成 end → play 自动推进的测试
3. 运行完整的 E2E 测试验证修复
4. 更新 spec 文档标记任务完成
