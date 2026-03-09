# Card07 和 Card09 修复完成

## 修复内容

### 1. COURT_GUARD (Card07) - 宫廷卫士
- ✅ 更新 executor 创建派系选择交互
- ✅ 注册交互处理函数
- ✅ 测试通过

### 2. AMBUSHER (Card09) - 伏击者
- ✅ 更新 executor 创建派系选择交互
- ✅ 注册交互处理函数
- ✅ 测试通过

### 3. WITCH_KING - 巫王（顺带修复）
- ✅ 更新 executor 创建派系选择交互
- ✅ 注册交互处理函数

## 修改的文件

1. `src/games/cardia/domain/abilities/group2-modifiers.ts`
   - 添加 `createFactionSelectionInteraction` import
   - 更新 COURT_GUARD executor 创建交互
   - 在 `registerModifierInteractionHandlers` 中注册 COURT_GUARD 交互处理函数

2. `src/games/cardia/domain/abilities/group7-faction.ts`
   - 添加 `createFactionSelectionInteraction` 和 `registerInteractionHandler` import
   - 更新 AMBUSHER executor 创建交互
   - 更新 WITCH_KING executor 创建交互
   - 新增 `registerFactionInteractionHandlers` 函数注册交互处理函数

3. `src/games/cardia/domain/abilityExecutor.ts`
   - 在 `initializeAbilityExecutors` 中调用 `registerModifierInteractionHandlers` 和 `registerFactionInteractionHandlers`

4. `src/games/cardia/game.ts`
   - 添加 `group7-faction` import
   - 添加 `registerFactionInteractionHandlers` import 和调用

## 测试结果

```bash
# Card07 测试
✓ 影响力7 - 宫廷卫士：选择派系后创建交互 (15.8s)
1 passed (26.1s)

# Card09 测试
✓ 影响力9 - 伏击者：选择派系后创建交互 (14.2s)
1 passed (22.5s)
```

## 关键修复点

1. **交互创建模式**：从自动选择派系改为创建交互让玩家选择
2. **交互处理函数**：注册处理函数处理玩家选择后的逻辑
3. **初始化顺序**：确保在 game.ts 中正确导入和调用注册函数

## 下一步

继续审计其他 E2E 测试（特别是 card02）
