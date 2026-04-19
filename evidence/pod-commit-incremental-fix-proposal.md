# POD 提交增量修复提案（完整版）

## 背景

- **问题**: POD 提交（`6ea1f9f`）包含了 92.5% 的非 POD 相关修改（**311/336 个文件**）
- **现状**: Phase 1-6 和 Phase 8 只审计了 **19 个文件**（引擎层 18 + 存储层 1），还有 **292 个文件未审计**
- **约束**: 用户已经在当前代码基础上做了修改，不能直接回滚
- **目标**: 通过增量比对，系统性地审计和恢复所有遗漏的功能

---

## 审计覆盖情况

### ✅ 已审计（19 个文件）

**Phase 3: 引擎层**（18 个文件）
- `src/engine/pipeline.ts`
- `src/engine/hooks/useEventStreamCursor.ts`
- `src/engine/primitives/actionLogHelpers.ts`
- `src/engine/transport/server.ts`
- `src/engine/transport/client.ts`
- `src/engine/transport/react.tsx`
- `src/engine/transport/protocol.ts`
- `src/engine/systems/InteractionSystem.ts`
- `src/engine/systems/FlowSystem.ts`
- `src/engine/systems/SimpleChoiceSystem.ts`
- `src/engine/systems/UndoSystem.ts`
- `src/engine/adapter.ts`
- `src/engine/fx/useFxBus.ts`
- `src/engine/types.ts`
- `src/engine/hooks/index.ts`
- `src/engine/transport/latency/optimisticEngine.ts`
- `src/engine/transport/storage.ts`
- `src/engine/primitives/damageCalculation.ts`

**Phase 3 补充: 存储层**（1 个文件）
- `src/server/storage/MongoStorage.ts`

### ❌ 未审计（292+ 个文件）

#### 1. DiceThrone 模块（105 个文件）

**严重程度**: 🔴 严重

**文件清单**:
- `src/games/dicethrone/Board.tsx` - 161 行变更 ⚠️ **部分审计**（只审计了 Board.tsx，其他 104 个文件未审计）
- `src/games/dicethrone/game.ts` - 258 行变更
- `src/games/dicethrone/domain/` - 50+ 个文件
- `src/games/dicethrone/__tests__/` - 30+ 个测试文件
- `src/games/dicethrone/ui/` - 20+ 个 UI 文件
- `src/games/dicethrone/heroes/` - 所有英雄文件

**已知问题**（仅 Board.tsx）:
1. ✅ hasDivergentVariants effect 类型比较 - 已修复
2. ❌ 自动响应功能 - 未恢复
3. ❌ 响应窗口视角自动切换 - 已注释
4. ❌ 太极令牌本回合限制 - 未恢复
5. ❌ 变体排序逻辑 - 未恢复

**未知问题**（其他 104 个文件）:
- ❓ `game.ts` 258 行变更包含什么？
- ❓ `domain/` 50+ 个文件有哪些功能被删除？
- ❓ `ui/` 20+ 个 UI 文件有哪些组件被修改？
- ❓ `heroes/` 所有英雄文件有哪些能力被删除？

---

#### 2. 引擎层（剩余文件）

**严重程度**: 🔴 严重

**已审计**: 18 个文件
**未审计**: 可能还有其他引擎层文件

**需要确认**:
```bash
git show --name-only 6ea1f9f | grep "^src/engine/" | wc -l
```

---

#### 3. 框架层（10+ 个文件）

**严重程度**: 🟡 中等

**文件清单**:
- `src/components/game/framework/widgets/GameHUD.tsx` - 118 行变更
- `src/components/game/framework/widgets/RematchActions.tsx` - 177 行变更
- `src/components/game/framework/hooks/useAutoSkipPhase.ts` - 24 行变更
- `src/components/game/framework/CharacterSelectionSkeleton.tsx` - 2 行变更
- `src/components/game/framework/widgets/GameDebugPanel.tsx` - 7 行变更

**审计状态**: ❌ 完全未审计

---

#### 4. SummonerWars 模块（18 个文件）

**严重程度**: 🔴 严重

**文件清单**:
- `src/games/summonerwars/Board.tsx` - 53 行变更
- `src/games/summonerwars/game.ts` - 2 行变更
- `src/games/summonerwars/domain/` - 7 个文件
- `src/games/summonerwars/ui/` - 7 个文件
- `src/games/summonerwars/__tests__/` - 2 个测试文件

**审计状态**: ❌ 完全未审计

---

#### 5. TicTacToe 模块（2 个文件）

**严重程度**: 🔴 严重

**文件清单**:
- `src/games/tictactoe/domain/index.ts` - 19 行变更
- `src/games/tictactoe/domain/types.ts` - 2 行删除

**审计状态**: ❌ 完全未审计

---

#### 6. 通用组件（10+ 个文件）

**严重程度**: 🟡 中等

**文件清单**:
- `src/components/common/animations/FlyingEffect.tsx` - 33 行变更
- `src/components/common/media/CardPreview.tsx` - 12 行变更
- `src/components/common/overlays/BreakdownTooltip.tsx` - 3 行变更
- `src/components/lobby/` - 5 个文件
- `src/components/social/` - 5 个文件
- `src/components/system/` - 3 个文件

**审计状态**: ❌ 完全未审计

---

#### 7. 全局 Context（3 个文件）

**严重程度**: 🟡 中等

**文件清单**:
- `src/contexts/RematchContext.tsx` - 1 行删除
- `src/contexts/SocialContext.tsx` - 3 行变更
- `src/contexts/ToastContext.tsx` - 3 行变更

**审计状态**: ❌ 完全未审计

---

#### 8. 服务端代码（6 个文件）

**严重程度**: 🔴 严重

**文件清单**:
- `src/server/storage/HybridStorage.ts` - 298 行变更
- `src/server/models/MatchRecord.ts` - 9 行变更
- `src/server/claimSeat.ts` - 12 行变更
- `src/server/storage/__tests__/` - 2 个测试文件

**已审计**: `MongoStorage.ts`（1 个文件）
**未审计**: 6 个文件

---

#### 9. 全局工具和配置（10+ 个文件）

**严重程度**: 🟡 中等

**文件清单**:
- `src/App.tsx` - 17 行变更
- `src/main.tsx` - 6 行删除
- `src/index.css` - 34 行删除
- `src/lib/utils.ts` - 48 行删除
- `src/lib/audio/AudioManager.ts` - 4 行变更
- `src/lib/audio/useGameAudio.ts` - 61 行变更
- `src/lib/i18n/zh-CN-bundled.ts` - 16 行变更
- `src/core/AssetLoader.ts` - 11 行变更
- `src/assets/audio/registry-slim.json` - 2 行变更

**审计状态**: ❌ 完全未审计

---

#### 10. SmashUp 已有派系（非 POD）

**严重程度**: 🟡 中等到严重

**文件清单**:
- `src/games/smashup/abilities/aliens.ts` - 10 行变更
- `src/games/smashup/abilities/dinosaurs.ts` - 217 行变更
- `src/games/smashup/abilities/ninjas.ts` - 316 行变更
- `src/games/smashup/abilities/pirates.ts` - 282 行变更
- `src/games/smashup/abilities/robots.ts` - 25 行变更
- 其他已有派系的能力文件

**审计状态**: ❌ 完全未审计

---

#### 11. i18n 文件（16 个文件）

**严重程度**: 🟢 低

**文件清单**:
- `public/locales/zh-CN/game-dicethrone.json` - 191 行变更
- `public/locales/zh-CN/game-smashup.json` - 777 行变更
- `public/locales/zh-CN/game-summonerwars.json` - 1 行删除
- `public/locales/en/game-dicethrone.json` - 178 行变更
- `public/locales/en/game-smashup.json` - 12 行变更
- 其他 i18n 文件

**审计状态**: ❌ 完全未审计

---

## 修复策略

### 原则

1. **保留已恢复的功能**：Phase 1-6 已恢复的代码不动
2. **只修复遗漏的功能**：基于 `tmp/phase2-dicethrone-board.md` 审计报告
3. **逐个比对验证**：每个修改都要对比 `6ea1f9f` 前后的代码
4. **测试驱动**：每个修复后运行相关测试验证

### 方法

1. **使用 git show 比对**：`git show 6ea1f9f:path/to/file` 查看删除的代码
2. **使用 git diff 确认**：`git diff 6ea1f9f^..6ea1f9f -- path/to/file` 查看具体变更
3. **手动恢复**：使用 `strReplace` 或 `editCode` 精确恢复
4. **测试验证**：运行单元测试和 E2E 测试

---

## 修复清单

### ✅ 已修复（当前对话）

#### 1. hasDivergentVariants effect 类型比较逻辑

**文件**: `src/games/dicethrone/Board.tsx`

**状态**: ✅ 已恢复（第 88-113 行）

**验证**: 需要测试"炽热波纹 II"技能是否能正确弹出变体选择

---

### ⏳ 待修复（基于 phase2 审计报告）

#### 2. 自动响应功能

**文件**: `src/games/dicethrone/Board.tsx`

**状态**: ❌ 未恢复（搜索结果显示无 `autoResponse` 相关代码）

**需要恢复的代码**（约 30 行）:
```typescript
// 1. 状态管理
const [autoResponseEnabled, setAutoResponseEnabled] = React.useState(() => 
    getAutoResponseEnabled()
);

// 2. 自动跳过逻辑
React.useEffect(() => {
    if (isResponseWindowOpen && autoResponseEnabled) {
        // 自动跳过响应窗口
        engineMoves.skipResponse();
    }
}, [isResponseWindowOpen, autoResponseEnabled, engineMoves]);

// 3. 回调传递到 LeftSidebar
<LeftSidebar
    // ... 其他 props
    onAutoResponseToggle={setAutoResponseEnabled}
/>
```

**比对命令**:
```bash
git show 6ea1f9f^:src/games/dicethrone/Board.tsx | grep -A 10 "autoResponse"
```

**优先级**: 中等（影响用户体验，但不影响游戏规则）

---

#### 3. 响应窗口视角自动切换

**文件**: `src/games/dicethrone/Board.tsx`

**状态**: ❌ 已注释（第 448-464 行显示代码被注释掉）

**需要恢复的代码**（约 25 行）:
```typescript
// 响应窗口视角自动切换
const prevResponseWindowRef = React.useRef<boolean>(false);
React.useEffect(() => {
    const wasOpen = prevResponseWindowRef.current;
    const isOpen = isResponseWindowOpen;
    prevResponseWindowRef.current = isOpen;

    if (isOpen && isResponseAutoSwitch) {
        setViewMode('opponent'); // 切换到对手视角
    } else if (isOpen && !isResponseAutoSwitch) {
        setViewMode('self'); // 切换回自己视角
    } else if (wasOpen && !isOpen) {
        if (currentPhase !== 'defensiveRoll') {
            setViewMode('self'); // 响应窗口关闭，切回自己视角
        }
    }
}, [isResponseWindowOpen, isResponseAutoSwitch, currentPhase, setViewMode]);
```

**比对命令**:
```bash
git show 6ea1f9f^:src/games/dicethrone/Board.tsx | grep -A 20 "prevResponseWindowRef"
```

**优先级**: 高（影响用户体验，响应窗口触发时不自动切换视角）

---

#### 4. 太极令牌本回合限制逻辑

**文件**: `src/games/dicethrone/Board.tsx`

**状态**: ❌ 未恢复（需要搜索确认）

**需要恢复的代码**（约 15 行）:
```typescript
// 太极本回合限制：攻击方加伤时，可用数量 = 持有量 - 本回合获得量
const tokenUsableOverrides = React.useMemo(() => {
    if (!pendingDamage || pendingDamage.responseType !== 'beforeDamageDealt') return undefined;
    const pid = pendingDamage.responderId;
    const gainedThisTurn = G.taijiGainedThisTurn?.[pid] ?? 0;
    if (gainedThisTurn <= 0) return undefined;
    const total = G.players[pid]?.tokens[TOKEN_IDS.TAIJI] ?? 0;
    const usable = Math.max(0, total - gainedThisTurn);
    return usable < total ? { [TOKEN_IDS.TAIJI]: usable } : undefined;
}, [G, pendingDamage]);
```

**比对命令**:
```bash
git show 6ea1f9f^:src/games/dicethrone/Board.tsx | grep -A 10 "tokenUsableOverrides"
```

**优先级**: 高（影响游戏规则，玩家可以使用本回合刚获得的太极 Token）

---

#### 5. 变体排序逻辑

**文件**: `src/games/dicethrone/Board.tsx`

**状态**: ❌ 未恢复（需要搜索确认）

**需要恢复的代码**（约 15 行）:
```typescript
// 按变体在 AbilityDef.variants 数组中的定义顺序排列（与卡牌图片顺序一致）
options.sort((a, b) => {
    const ma = findPlayerAbility(G, rollerId, a.abilityId);
    const mb = findPlayerAbility(G, rollerId, b.abilityId);
    if (!ma?.variant || !mb?.variant) return 0;
    const variants = ma.ability.variants ?? [];
    const ia = variants.indexOf(ma.variant);
    const ib = variants.indexOf(mb.variant);
    return ia - ib;
});
```

**比对命令**:
```bash
git show 6ea1f9f^:src/games/dicethrone/Board.tsx | grep -A 10 "options.sort"
```

**优先级**: 中等（影响用户体验，变体选择顺序混乱）

---

## 执行计划

### Phase 1: 确认当前状态（10 分钟）

1. **搜索确认每个功能的当前状态**
   ```bash
   # 太极令牌限制
   grep -n "tokenUsableOverrides" src/games/dicethrone/Board.tsx
   
   # 变体排序
   grep -n "options.sort" src/games/dicethrone/Board.tsx
   
   # 自动响应
   grep -n "autoResponse" src/games/dicethrone/Board.tsx
   ```

2. **读取相关代码段**
   - 使用 `readFile` 读取 Board.tsx 的关键区域
   - 确认哪些功能已恢复，哪些还缺失

### Phase 2: 逐个比对和恢复（30-60 分钟）

对于每个待修复的功能：

1. **比对原始代码**
   ```bash
   git show 6ea1f9f^:src/games/dicethrone/Board.tsx > /tmp/board-before.tsx
   git show 6ea1f9f:src/games/dicethrone/Board.tsx > /tmp/board-after.tsx
   diff -u /tmp/board-before.tsx /tmp/board-after.tsx | grep -A 20 "<关键词>"
   ```

2. **确认恢复位置**
   - 找到代码应该插入的位置
   - 确认周围代码没有冲突

3. **手动恢复**
   - 使用 `strReplace` 或 `editCode` 精确恢复
   - 保持代码风格一致

4. **本地验证**
   - 运行 TypeScript 编译检查
   - 运行相关单元测试

### Phase 3: 集成测试（20-30 分钟）

1. **运行 DiceThrone 单元测试**
   ```bash
   npm run test -- dicethrone
   ```

2. **运行 E2E 测试**
   ```bash
   npm run test:e2e -- dicethrone
   ```

3. **手动测试关键场景**
   - 测试"炽热波纹 II"变体选择
   - 测试太极令牌本回合限制
   - 测试响应窗口视角切换
   - 测试自动响应功能

### Phase 4: 文档更新（10 分钟）

1. **更新审计文档**
   - 标记已修复的功能
   - 记录修复的具体位置和代码

2. **创建修复总结**
   - 列出所有修复的功能
   - 记录测试结果

---

## 风险评估

### 低风险

- ✅ **hasDivergentVariants**: 已修复，逻辑独立
- ✅ **变体排序**: 逻辑独立，只影响 UI 显示顺序

### 中风险

- ⚠️ **自动响应**: 需要确认 `getAutoResponseEnabled()` 函数是否存在
- ⚠️ **响应窗口视角切换**: 需要确认 `setViewMode` 和相关状态是否正确

### 高风险

- ⚠️ **太极令牌限制**: 需要确认 `G.taijiGainedThisTurn` 字段是否存在
- ⚠️ **太极令牌限制**: 需要确认 `tokenUsableOverrides` 如何传递到子组件

---

## 回滚计划

如果修复后出现问题：

1. **单个功能回滚**
   ```bash
   git diff HEAD > /tmp/current-changes.patch
   # 手动编辑 patch 文件，只保留有问题的修改
   git apply -R /tmp/problem-fix.patch
   ```

2. **完整回滚**
   ```bash
   git stash
   # 或
   git reset --hard HEAD
   ```

---

## 成功标准

### 必须满足

1. ✅ TypeScript 编译通过（0 errors）
2. ✅ 所有 DiceThrone 单元测试通过
3. ✅ "炽热波纹 II"变体选择正常工作
4. ✅ 太极令牌本回合限制正常工作

### 应该满足

1. ✅ 响应窗口视角自动切换正常工作
2. ✅ 自动响应功能正常工作
3. ✅ 变体选择顺序与卡牌图片一致

### 可选

1. ⭕ E2E 测试全部通过（可能有其他无关的失败）

---

## 下一步

请确认是否开始执行：

1. **Phase 1: 确认当前状态**（搜索和读取代码）
2. **Phase 2: 逐个比对和恢复**（手动修复）
3. **Phase 3: 集成测试**（验证修复）
4. **Phase 4: 文档更新**（记录结果）

或者，如果您希望我先：
- 只确认当前状态（Phase 1）
- 只修复特定功能（如太极令牌限制）
- 先看某个功能的详细比对结果

请告诉我您的偏好。


### 原则

1. **系统性审计**：按模块逐个审计，不遗漏任何文件
2. **优先级驱动**：先审计高风险模块（DiceThrone、引擎层、服务端）
3. **增量比对**：每个文件都要对比 `6ea1f9f` 前后的代码
4. **测试验证**：每个模块审计完成后运行相关测试

### 方法

1. **生成完整文件清单**：
   ```bash
   git show --name-status 6ea1f9f > /tmp/pod-commit-files.txt
   ```

2. **按模块分组审计**：
   - 每个模块创建独立的审计文档
   - 记录每个文件的变更类型（删除/修改/新增）
   - 标记需要恢复的功能

3. **使用 git show 比对**：
   ```bash
   git show 6ea1f9f^:path/to/file > /tmp/before.txt
   git show 6ea1f9f:path/to/file > /tmp/after.txt
   diff -u /tmp/before.txt /tmp/after.txt
   ```

4. **手动恢复**：
   - 使用 `strReplace` 或 `editCode` 精确恢复
   - 每次恢复后运行 TypeScript 编译检查
   - 每个模块完成后运行相关测试

---

## 执行计划（分阶段）

### Phase A: 生成完整清单（10 分钟）

**目标**: 生成所有被修改文件的完整清单，按模块分组

**步骤**:
1. 导出所有被修改的文件
   ```bash
   git show --name-status 6ea1f9f | grep -E "^[AMD]" > evidence/pod-commit-all-files.txt
   ```

2. 按模块分组统计
   ```bash
   # DiceThrone
   grep "src/games/dicethrone/" evidence/pod-commit-all-files.txt | wc -l
   
   # SummonerWars
   grep "src/games/summonerwars/" evidence/pod-commit-all-files.txt | wc -l
   
   # 引擎层
   grep "src/engine/" evidence/pod-commit-all-files.txt | wc -l
   
   # 框架层
   grep "src/components/game/framework/" evidence/pod-commit-all-files.txt | wc -l
   
   # 服务端
   grep "src/server/" evidence/pod-commit-all-files.txt | wc -l
   ```

3. 创建审计清单文档
   - `evidence/audit-checklist-dicethrone.md`
   - `evidence/audit-checklist-summonerwars.md`
   - `evidence/audit-checklist-framework.md`
   - `evidence/audit-checklist-server.md`
   - `evidence/audit-checklist-common.md`

**输出**: 完整的文件清单和审计计划

---

### Phase B: DiceThrone 模块审计（2-4 小时）

**优先级**: 🔴 最高（影响游戏规则和用户体验）

**范围**: 105 个文件
- `Board.tsx` - 161 行变更（部分已审计）
- `game.ts` - 258 行变更
- `domain/` - 50+ 个文件
- `ui/` - 20+ 个 UI 文件
- `heroes/` - 所有英雄文件
- `__tests__/` - 30+ 个测试文件

**步骤**:
1. **Board.tsx 完整审计**（30 分钟）
   - 确认 4 个已知问题的当前状态
   - 搜索其他可能遗漏的功能
   - 逐个恢复缺失的功能

2. **game.ts 审计**（30 分钟）
   - 对比 258 行变更
   - 识别被删除的功能
   - 恢复关键逻辑

3. **domain/ 审计**（1-2 小时）
   - 逐个文件对比
   - 识别规则变更
   - 恢复被删除的领域逻辑

4. **ui/ 审计**（30-60 分钟）
   - 对比 UI 组件变更
   - 恢复被删除的 UI 功能

5. **heroes/ 审计**（30-60 分钟）
   - 检查英雄能力是否完整
   - 恢复被删除的能力

6. **测试验证**（30 分钟）
   ```bash
   npm run test -- dicethrone
   npm run test:e2e -- dicethrone
   ```

**输出**: `evidence/audit-report-dicethrone.md`

---

### Phase C: 引擎层补充审计（1-2 小时）

**优先级**: 🔴 高（影响所有游戏）

**范围**: 确认是否还有其他引擎层文件未审计

**步骤**:
1. 列出所有引擎层文件
   ```bash
   git show --name-only 6ea1f9f | grep "^src/engine/" > /tmp/engine-files.txt
   ```

2. 对比已审计清单
   - 已审计: 18 个文件
   - 未审计: 待确认

3. 审计未覆盖的文件

4. 测试验证
   ```bash
   npm run test -- engine
   ```

**输出**: `evidence/audit-report-engine-supplement.md`

---

### Phase D: 框架层审计（1-2 小时）

**优先级**: 🟡 中等（影响所有游戏的 UI）

**范围**: 10+ 个文件
- `GameHUD.tsx` - 118 行变更
- `RematchActions.tsx` - 177 行变更
- `useAutoSkipPhase.ts` - 24 行变更
- 其他框架组件

**步骤**:
1. 逐个文件对比
2. 识别被删除的功能
3. 恢复关键 UI 功能
4. 测试验证

**输出**: `evidence/audit-report-framework.md`

---

### Phase E: SummonerWars 模块审计（1-2 小时）

**优先级**: 🔴 高（完全不应该修改）

**范围**: 18 个文件

**步骤**:
1. 逐个文件对比
2. 识别所有变更
3. 恢复所有被删除的功能
4. 测试验证
   ```bash
   npm run test -- summonerwars
   ```

**输出**: `evidence/audit-report-summonerwars.md`

---

### Phase F: 服务端代码审计（1-2 小时）

**优先级**: 🔴 高（影响服务稳定性）

**范围**: 6 个未审计文件
- `HybridStorage.ts` - 298 行变更
- `MatchRecord.ts` - 9 行变更
- `claimSeat.ts` - 12 行变更
- 测试文件

**步骤**:
1. 逐个文件对比
2. 识别被删除的功能
3. 恢复关键服务端逻辑
4. 测试验证

**输出**: `evidence/audit-report-server.md`

---

### Phase G: 其他模块审计（2-3 小时）

**优先级**: 🟡 中等到低

**范围**:
- TicTacToe（2 个文件）
- 通用组件（10+ 个文件）
- 全局 Context（3 个文件）
- 全局工具和配置（10+ 个文件）
- SmashUp 已有派系（非 POD）
- i18n 文件（16 个文件）

**步骤**:
1. 按模块分组审计
2. 识别被删除的功能
3. 恢复关键功能
4. 测试验证

**输出**: 
- `evidence/audit-report-tictactoe.md`
- `evidence/audit-report-common.md`
- `evidence/audit-report-smashup-existing.md`
- `evidence/audit-report-i18n.md`

---

### Phase H: 集成测试（1-2 小时）

**优先级**: 🔴 最高

**步骤**:
1. 运行所有单元测试
   ```bash
   npm run test
   ```

2. 运行所有 E2E 测试
   ```bash
   npm run test:e2e
   ```

3. 手动测试关键场景
   - DiceThrone: 变体选择、太极令牌、响应窗口
   - SummonerWars: 所有核心功能
   - SmashUp: POD 派系 + 已有派系

4. 性能测试
   - 增量同步性能
   - 大状态下的序列化性能

**输出**: `evidence/integration-test-report.md`

---

### Phase I: 文档更新（30 分钟）

**步骤**:
1. 更新所有审计文档
2. 创建最终总结报告
3. 记录所有修复的功能
4. 记录测试结果

**输出**: `evidence/final-audit-complete-report.md`

---

## 时间估算

| Phase | 模块 | 文件数 | 预计时间 | 优先级 |
|-------|------|--------|----------|--------|
| A | 生成清单 | - | 10 分钟 | 🔴 |
| B | DiceThrone | 105 | 2-4 小时 | 🔴 |
| C | 引擎层补充 | ? | 1-2 小时 | 🔴 |
| D | 框架层 | 10+ | 1-2 小时 | 🟡 |
| E | SummonerWars | 18 | 1-2 小时 | 🔴 |
| F | 服务端 | 6 | 1-2 小时 | 🔴 |
| G | 其他模块 | 50+ | 2-3 小时 | 🟡 |
| H | 集成测试 | - | 1-2 小时 | 🔴 |
| I | 文档更新 | - | 30 分钟 | 🟡 |
| **总计** | | **292+** | **10-18 小时** | |

---

## 风险评估

### 高风险模块

1. **DiceThrone**（105 个文件）
   - 风险: 游戏规则错误、用户体验下降
   - 影响: 所有 DiceThrone 玩家
   - 优先级: 🔴 最高

2. **引擎层**（未知数量）
   - 风险: 影响所有游戏
   - 影响: 所有玩家
   - 优先级: 🔴 最高

3. **服务端**（6 个文件）
   - 风险: 服务崩溃、数据丢失
   - 影响: 所有玩家
   - 优先级: 🔴 最高

### 中风险模块

4. **SummonerWars**（18 个文件）
   - 风险: 游戏功能缺失
   - 影响: SummonerWars 玩家
   - 优先级: 🔴 高

5. **框架层**（10+ 个文件）
   - 风险: UI 功能缺失
   - 影响: 所有游戏
   - 优先级: 🟡 中等

### 低风险模块

6. **通用组件**（10+ 个文件）
   - 风险: UI 显示问题
   - 影响: 部分功能
   - 优先级: 🟡 中等

7. **i18n**（16 个文件）
   - 风险: 翻译缺失
   - 影响: 用户体验
   - 优先级: 🟢 低

---

## 成功标准

### 必须满足

1. ✅ TypeScript 编译通过（0 errors）
2. ✅ 所有单元测试通过（或失败数 ≤ 当前失败数）
3. ✅ 所有 E2E 测试通过（或失败数 ≤ 当前失败数）
4. ✅ 所有已知的功能缺失已恢复
5. ✅ 所有游戏的核心功能正常工作

### 应该满足

1. ✅ 所有非 POD 相关的修改已审计
2. ✅ 所有被删除的功能已识别
3. ✅ 所有关键功能已恢复
4. ✅ 所有审计文档已完成

### 可选

1. ⭕ 所有测试 100% 通过（可能有其他无关的失败）
2. ⭕ 所有 UI 细节完全一致（可能有合理的改进）

---

## 回滚计划

如果修复后出现严重问题：

1. **单个模块回滚**
   ```bash
   git diff HEAD -- src/games/dicethrone/ > /tmp/dicethrone-changes.patch
   git apply -R /tmp/dicethrone-changes.patch
   ```

2. **单个文件回滚**
   ```bash
   git checkout HEAD -- path/to/file
   ```

3. **完整回滚**（最后手段）
   ```bash
   git stash
   # 或
   git reset --hard HEAD
   ```

---

## 下一步

**请确认是否开始执行 Phase A（生成完整清单）？**

这将：
1. 导出所有被修改的文件清单
2. 按模块分组统计
3. 创建详细的审计计划
4. 为后续审计工作打下基础

或者，如果您希望我：
- 先看某个具体模块的详细情况
- 调整优先级顺序
- 修改时间估算

请告诉我您的偏好。

---

## 附录：审计模板

### 文件审计模板

```markdown
# [模块名] 审计报告

## 文件清单

| 文件 | 变更行数 | 变更类型 | 优先级 | 状态 |
|------|----------|----------|--------|------|
| file1.ts | +10 -20 | 删除功能 | 高 | ❌ 待审计 |
| file2.ts | +5 -0 | 新增功能 | 低 | ✅ 已审计 |

## 详细审计

### file1.ts

**变更概览**: 删除了 XXX 功能

**对比结果**:
```diff
- 删除的代码
+ 新增的代码
```

**影响分析**:
- 影响范围: XXX
- 严重程度: 高/中/低
- 是否需要恢复: 是/否

**恢复计划**:
1. 步骤 1
2. 步骤 2

## 总结

- 审计文件数: X
- 需要恢复: Y
- 合理修改: Z
```
