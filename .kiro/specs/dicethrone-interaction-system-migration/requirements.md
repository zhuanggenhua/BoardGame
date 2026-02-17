# DiceThrone 交互系统迁移规范

## 1. 背景与动机

### 1.1 当前问题

DiceThrone 存在两套交互系统并存的历史债务：

1. **遗留系统**（`PendingInteraction` in `core`）
   - 交互状态存储在 `core.pendingInteraction`
   - 违反"core 只存领域状态"原则
   - UI 层直接读取 core 状态
   - 命令执行层手动管理交互生命周期
   - 数据流混乱：UI → Board → resolveMoves → dispatch → execute → reducer

2. **新系统**（`InteractionSystem` in `sys`）
   - 交互状态存储在 `sys.interaction`
   - 引擎层自动管理生命周期
   - 支持多种交互类型（choice/prompt/custom）
   - 已在 SummonerWars/SmashUp 中使用

### 1.2 具体症状

以圣骑士 Token 授予为例：

```typescript
// ❌ 当前实现：需要 6 个步骤
1. 创建 PendingInteraction 对象（定义 tokenGrantConfig）
2. UI 层读取并渲染选择界面
3. UI 层收集 selectedPlayerId
4. 通过 confirmInteraction 传递 3 个参数
5. execute 层读取 tokenGrantConfig + selectedPlayerId
6. 手动生成 TOKEN_GRANTED 事件

// ✅ 理想实现：1 个步骤
createInteraction({
    type: 'selectPlayer',
    options: ['0', '1'],
    onResolve: (playerId) => [
        { type: 'TOKEN_GRANTED', payload: { targetId: playerId, tokenId, amount } }
    ]
});
```

### 1.3 迁移目标

- **统一交互模式**：所有游戏使用 `InteractionSystem`
- **简化数据流**：execute → createInteraction → InteractionSystem → UI → resolve
- **减少代码量**：预计删除 500+ 行遗留代码
- **提升可维护性**：新增交互类型只需修改 1 处

---

## 2. 用户故事

### 2.1 作为开发者

**US-1**: 新增卡牌交互时，我希望只需在 execute 层调用 `createInteraction()`，而不需要修改 UI 层、命令层、类型定义

**验收标准**：
- 新增"选择玩家授予 Token"交互，只需修改 `customActions/*.ts` 文件
- 不需要修改 `Board.tsx`、`InteractionOverlay.tsx`、`commands.ts`、`types.ts`
- 不需要添加新的命令类型（如 `CONFIRM_INTERACTION`）

**US-2**: 修复交互相关 bug 时，我希望只需检查 1 个文件，而不是 5 个文件

**验收标准**：
- 交互逻辑集中在 `domain/interactions/` 目录
- UI 层只负责渲染，不包含业务逻辑
- 命令层不包含交互相关命令

**US-3**: 阅读代码时，我希望能快速理解交互流程，而不是追踪 4 层调用链

**验收标准**：
- 交互创建和解决逻辑在同一个文件中
- 数据流清晰：execute → InteractionSystem → UI → resolve
- 不存在"UI 层收集数据 → 传递给 execute 层 → execute 层再处理"的反向依赖

---

## 3. 功能需求

### 3.1 支持的交互类型

迁移后需要支持以下交互类型（覆盖当前所有 `PendingInteraction` 用例）：

#### 3.1.1 选择骰子（selectDie）
- **用例**：强制重投、修改骰面
- **配置**：`{ type: 'selectDie', count: number, allowedDiceIds?: number[] }`
- **解决**：返回 `selectedDiceIds: number[]`

#### 3.1.2 修改骰子（modifyDie）
- **用例**：将骰子改为指定面
- **配置**：`{ type: 'modifyDie', dieId: number, allowedValues: number[] }`
- **解决**：返回 `{ dieId: number, newValue: number }`

#### 3.1.3 选择状态效果（selectStatus）
- **用例**：移除负面状态、转移状态
- **配置**：`{ type: 'selectStatus', targetPlayerIds: string[], filter?: (statusId) => boolean }`
- **解决**：返回 `{ playerId: string, statusId: string }`

#### 3.1.4 选择玩家（selectPlayer）
- **用例**：授予 Token、造成伤害、治疗
- **配置**：`{ type: 'selectPlayer', count: number, targetPlayerIds?: string[] }`
- **解决**：返回 `selectedPlayerIds: string[]`

#### 3.1.5 转移状态（transferStatus）
- **用例**：将自己的状态转移给对手
- **配置**：`{ type: 'transferStatus', sourcePlayerId: string, statusId: string }`
- **解决**：返回 `targetPlayerId: string`

### 3.2 交互生命周期

```
1. [execute] 调用 createInteraction() → 返回 INTERACTION_REQUESTED 事件
2. [reducer] 将事件写入 sys.interaction
3. [InteractionSystem] 自动管理交互状态
4. [UI] 读取 sys.interaction.current 并渲染
5. [UI] 用户操作后 dispatch(INTERACTION_COMMANDS.RESPOND, { data })
6. [InteractionSystem] 调用 onResolve(data) → 生成后续事件
7. [InteractionSystem] 自动清理 sys.interaction.current
```

### 3.3 向后兼容性

**不需要向后兼容**：
- 这是内部重构，不影响存档格式
- 不影响网络协议（命令/事件结构保持不变）
- 可以一次性完成迁移

---

## 4. 非功能需求

### 4.1 性能要求

- 交互创建开销 < 1ms
- UI 渲染延迟 < 16ms（60fps）
- 不增加内存占用

### 4.2 可维护性要求

- 新增交互类型只需修改 1 个文件
- 交互逻辑集中在 `domain/interactions/` 目录
- 删除所有 `PendingInteraction` 相关代码

### 4.3 测试要求

- 所有现有 E2E 测试必须通过（不修改测试代码）
- 新增交互系统单元测试（覆盖率 > 90%）
- 新增交互链完整性审计测试

---

## 5. 技术约束

### 5.1 必须遵守的规则

1. **core 状态准入**：`core` 不得包含交互状态（`pendingInteraction` 必须删除）
2. **单一数据源**：交互状态只存在于 `sys.interaction`
3. **引擎层管理**：交互生命周期由 `InteractionSystem` 自动管理
4. **UI 层无逻辑**：UI 只负责渲染和收集用户输入，不包含业务逻辑

### 5.2 禁止的做法

1. ❌ 在 `core` 中存储 `pendingInteraction`
2. ❌ UI 层直接读取 `core.pendingInteraction`
3. ❌ 新增 `CONFIRM_INTERACTION` / `CANCEL_INTERACTION` 命令
4. ❌ 在 `execute.ts` 中手动管理交互状态
5. ❌ 在 UI 层收集数据后传递给 execute 层处理

---

## 6. 迁移范围

### 6.1 需要修改的文件（预计 15-20 个）

#### 核心领域层
- `src/games/dicethrone/domain/types.ts` - 删除 `PendingInteraction` 类型
- `src/games/dicethrone/domain/commands.ts` - 删除 `CONFIRM_INTERACTION` / `CANCEL_INTERACTION`
- `src/games/dicethrone/domain/events.ts` - 删除 `InteractionRequestedEvent` 等
- `src/games/dicethrone/domain/execute.ts` - 删除交互命令处理逻辑
- `src/games/dicethrone/domain/reducer.ts` - 删除交互事件处理逻辑
- `src/games/dicethrone/domain/commandValidation.ts` - 删除交互命令验证

#### 交互处理（新增）
- `src/games/dicethrone/domain/interactions/` - 新增目录
- `src/games/dicethrone/domain/interactions/types.ts` - 交互配置类型
- `src/games/dicethrone/domain/interactions/factory.ts` - 交互工厂函数
- `src/games/dicethrone/domain/interactions/resolvers.ts` - 交互解决器

#### Custom Actions（50+ 处修改）
- `src/games/dicethrone/domain/customActions/*.ts` - 所有创建交互的地方
- `src/games/dicethrone/heroes/*/cards.ts` - 所有卡牌交互

#### UI 层
- `src/games/dicethrone/Board.tsx` - 简化交互处理逻辑
- `src/games/dicethrone/ui/InteractionOverlay.tsx` - 可能删除或大幅简化
- `src/games/dicethrone/ui/resolveMoves.ts` - 删除 `confirmInteraction` / `cancelInteraction`
- `src/games/dicethrone/hooks/useInteractionState.ts` - 可能删除

#### 测试
- `src/games/dicethrone/__tests__/interaction-*.test.ts` - 更新测试
- `e2e/dicethrone-*-interaction.e2e.ts` - 验证 E2E 测试仍然通过

### 6.2 预计代码变化

- **删除**：~500 行（遗留交互系统）
- **新增**：~200 行（统一交互工厂）
- **修改**：~300 行（custom actions 迁移）
- **净减少**：~300 行

---

## 7. 迁移策略

### 7.1 阶段划分

#### 阶段 1：准备工作（1-2 小时）
1. 创建 `domain/interactions/` 目录结构
2. 实现交互工厂函数（`createSelectPlayerInteraction` 等）
3. 编写单元测试验证工厂函数

#### 阶段 2：迁移 Custom Actions（2-3 小时）
1. 迁移 `customActions/paladin.ts`（vengeance, consecrate）
2. 迁移 `customActions/monk.ts`
3. 迁移 `customActions/pyromancer.ts`
4. 迁移 `customActions/shadow_thief.ts`
5. 迁移 `customActions/barbarian.ts`
6. 迁移 `customActions/moon_elf.ts`

#### 阶段 3：迁移卡牌交互（3-4 小时）
1. 迁移所有 `heroes/*/cards.ts` 中的交互
2. 统一使用交互工厂函数

#### 阶段 4：清理遗留代码（1-2 小时）
1. 删除 `PendingInteraction` 类型定义
2. 删除 `CONFIRM_INTERACTION` / `CANCEL_INTERACTION` 命令
3. 删除 `execute.ts` 中的交互处理逻辑
4. 删除 `reducer.ts` 中的交互事件处理
5. 简化 `Board.tsx` 交互处理
6. 删除或简化 `InteractionOverlay.tsx`

#### 阶段 5：测试验证（1-2 小时）
1. 运行所有单元测试
2. 运行所有 E2E 测试
3. 手动测试所有交互场景
4. 性能测试（确保无性能退化）

### 7.2 回滚计划

如果迁移失败，可以通过 Git 回滚到迁移前的状态：
```bash
git checkout <commit-before-migration>
```

---

## 8. 验收标准

### 8.1 功能完整性

- [ ] 所有现有交互功能正常工作（骰子选择、状态选择、玩家选择等）
- [ ] 所有 E2E 测试通过（不修改测试代码）
- [ ] 手动测试所有交互场景无异常

### 8.2 代码质量

- [ ] `core` 中不存在 `pendingInteraction` 字段
- [ ] `commands.ts` 中不存在 `CONFIRM_INTERACTION` / `CANCEL_INTERACTION`
- [ ] `execute.ts` 中不存在交互命令处理逻辑
- [ ] 所有交互逻辑集中在 `domain/interactions/` 目录
- [ ] TypeScript 编译无错误
- [ ] ESLint 检查无错误

### 8.3 性能指标

- [ ] 交互创建开销 < 1ms
- [ ] UI 渲染延迟 < 16ms
- [ ] 内存占用无明显增加

### 8.4 可维护性

- [ ] 新增交互类型只需修改 1 个文件
- [ ] 代码行数净减少 > 200 行
- [ ] 交互逻辑可读性提升（主观评估）

---

## 9. 风险评估

### 9.1 高风险项

1. **E2E 测试失败**
   - 概率：中
   - 影响：高
   - 缓解：迁移前运行所有测试，确保基线正常

2. **遗漏交互场景**
   - 概率：中
   - 影响：高
   - 缓解：使用 grep 搜索所有 `PendingInteraction` 引用，逐一迁移

### 9.2 中风险项

1. **性能退化**
   - 概率：低
   - 影响：中
   - 缓解：迁移后运行性能测试

2. **UI 渲染异常**
   - 概率：低
   - 影响：中
   - 缓解：手动测试所有交互场景

### 9.3 低风险项

1. **类型错误**
   - 概率：低
   - 影响：低
   - 缓解：TypeScript 编译检查

---

## 10. 后续优化

迁移完成后，可以进一步优化：

1. **统一 UI 组件**：所有交互使用同一个 `InteractionModal` 组件
2. **交互动画**：添加交互出现/消失的过渡动画
3. **交互历史**：记录交互历史用于回放和调试
4. **交互预览**：在交互确认前预览效果

---

## 11. 参考资料

- `docs/ai-rules/engine-systems.md` - 引擎系统规范
- `src/engine/systems/InteractionSystem.ts` - InteractionSystem 实现
- `src/games/summonerwars/domain/interactions/` - SummonerWars 交互实现示例
- `src/games/smashup/domain/interactions/` - SmashUp 交互实现示例
