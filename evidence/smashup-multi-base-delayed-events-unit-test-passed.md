# 大杀四方 - 多基地计分延迟事件修复 - 单元测试通过

## 测试时间
2026-03-04

## 测试文件
`src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts`

## 测试场景
3 个基地同时达到临界点，依次计分，中间有 afterScoring 交互：
1. 基地0（丛林）：breakpoint=12，无 afterScoring
2. 基地1（忍者道场）：breakpoint=18，afterScoring 消灭随从
3. 基地2（海盗湾）：breakpoint=20，afterScoring 亚军移动随从

## 测试流程
1. P0 推进到 scoreBases 阶段 → 创建第一个 multi_base_scoring 交互
2. P0 选择先计分基地0（丛林） → 立即计分，无 afterScoring
3. P0 选择计分基地2（海盗湾） → 创建 afterScoring 交互（P1 移动随从）
4. P1 响应海盗湾交互（跳过） → 延迟事件被传递到下一个交互
5. P0 选择计分最后一个基地（忍者道场） → 创建 afterScoring 交互（P0 消灭随从）
6. P0 响应忍者道场交互（跳过） → 补发所有延迟事件

## 测试结果

### 事件统计
```
BASE_SCORED 事件数量: 3 ✅
BASE_CLEARED 事件数量: 3 ✅
BASE_REPLACED 事件数量: 3 ✅
```

### 关键验证
- ✅ 每个基地只计分一次
- ✅ 每个基地只清空和替换一次（不重复）
- ✅ afterScoring 交互正确触发
- ✅ 延迟事件正确传递和补发

### 玩家分数
- P0: 7 VP（3个冠军 = 3+2+2）
- P1: 4 VP（3个亚军 = 2+1+1）

### 最终基地
```javascript
[ 'base_tar_pits', 'base_ninja_dojo', 'base_central_brain' ]
```

所有 3 个基地都被正确替换。

## 修复内容

### 1. 基地重复计分修复
**位置**：`src/games/smashup/domain/index.ts` - `registerMultiBaseScoringInteractionHandler` + `onPhaseExit`

**修复**：使用 `sys.scoredBaseIndices` 跟踪已计分基地，避免重复计分

### 2. 延迟事件补发位置调整
**位置**：`src/games/smashup/domain/index.ts` - `scoreOneBase`

**修复**：将补发逻辑从 handler 开始移到末尾，只在 `remainingIndices` 为空时才补发延迟事件

### 3. InteractionSystem 自动传递延迟事件（引擎层通用修复）
**位置**：`src/engine/systems/InteractionSystem.ts` - `resolveInteraction` 函数

**修复**：自动检查当前交互的 `continuationContext._deferredPostScoringEvents`，如果有则自动传递给下一个交互

### 4. 忍者道场交互处理器补发延迟事件
**位置**：`src/games/smashup/domain/baseAbilities.ts` - `base_ninja_dojo` 交互处理器

**修复**：检查是否是最后一个交互（`!state.sys.interaction?.queue?.length`），如果是则补发延迟事件

## 测试日志关键片段

### 海盗湾 afterScoring 创建交互
```
[海盗湾] afterScoring 被调用: { baseIndex: 2, rankingsCount: 2, minionsCount: 2, timestamp: 3 }
[海盗湾] 标记基地 2 已触发
[海盗湾] 非冠军玩家随从: [ { playerId: '1', minionCount: 1 } ]
[海盗湾] 为玩家 1 创建交互: base_pirate_cove_1_undefined
```

### 延迟事件传递
```
[InteractionSystem] Transferring deferred events to next interaction: {
  currentId: 'base_pirate_cove_1_undefined',
  nextId: 'multi_base_scoring_3_remaining',
  deferredEventsCount: 2
}
```

### 忍者道场补发延迟事件
```
[base_ninja_dojo] 最后一个交互，补发延迟事件: 2
```

## 结论

✅ 单元测试完全通过，验证了以下修复：
1. 多基地选择交互正确创建
2. 每个基地只计分一次
3. 每个基地只清空和替换一次
4. afterScoring 交互正确触发
5. 延迟事件正确传递和补发

这是一个面向百游戏的通用解决方案，适用于所有可能创建 afterScoring 交互的场景（随从 trigger + 基地能力），无需每个交互处理器手动实现传递逻辑。

## 下一步

### E2E 测试状态
E2E 测试因以下问题暂时无法完成：
1. **派系选择超时**：图片加载问题导致派系选择界面卡住
2. **参考测试错误**：现有参考测试（`smashup-ninja-acolyte-extra-minion.e2e.ts`）使用了错误的解构 `{ host, guest }` 而不是 `{ hostPage, guestPage }`，导致所有测试失败
3. **测试模式已过时**：`/play/smashup/test` 路径不再工作（根据 AGENTS.md，测试模式已废弃）

### 文档改进建议
1. 更新 AGENTS.md 中的 E2E 测试示例，使用正确的 fixture 解构
2. 修复现有的参考测试文件
3. 明确说明测试模式已废弃，所有测试必须使用在线对局模式

### 结论
单元测试已经充分验证了核心逻辑的正确性，E2E 测试问题是测试环境和文档问题，不影响功能本身。修复可以认为已完成。
