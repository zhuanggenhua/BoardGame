# SmashUp 便衣忍者 UI 状态冲突 Bug 分析

## 问题描述

用户在 Me First! 响应窗口中打出便衣忍者（Hidden Ninja）后，点击基地创建了手牌选择交互，但手牌中的随从卡无法点击（全部置灰）。

## 根本原因

**UI 状态冲突**：两个独立的 UI 门控系统同时作用于手牌区，产生了冲突：

1. **Me First! 门控系统**（`meFirstDisabledUids`）：在 Me First! 响应窗口期间，禁用所有非 special 卡和非 `beforeScoringPlayable` 随从
2. **交互系统门控**（`InteractionSystem.playerView`）：当有手牌选择交互时，应该由交互系统控制哪些卡牌可选

**冲突场景**：
- 便衣忍者是 special 卡，可以在 Me First! 窗口中打出
- 打出后创建了手牌选择交互（`targetType: 'hand'`）
- 但 `isMeFirstResponse` 仍然为 `true`（响应窗口未关闭）
- `meFirstDisabledUids` 继续禁用所有非 `beforeScoringPlayable` 随从
- 交互系统想让某些随从可选，但被 Me First! 门控覆盖

## 代码位置

`src/games/smashup/Board.tsx` 第 496-522 行：

```typescript
const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
    if (!isMeFirstResponse || !myPlayer) return undefined;
    // ❌ 缺少这个检查：
    // if (isHandDiscardPrompt) return undefined;
    
    const disabled = new Set<string>();
    for (const card of myPlayer.hand) {
        if (card.type === 'minion') {
            const mDef = getMinionDef(card.defId);
            if (!mDef?.beforeScoringPlayable) {
                disabled.add(card.uid);  // ← 禁用了交互需要的随从
            }
            continue;
        }
        // ...
    }
    return disabled.size > 0 ? disabled : undefined;
}, [isMeFirstResponse, myPlayer]);
```

## 修复方案

在 `meFirstDisabledUids` 计算中添加交互优先级检查：

```typescript
const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
    if (!isMeFirstResponse || !myPlayer) return undefined;
    // ✅ 有手牌选择交互时，不应用 Me First! 禁用规则（交互自己控制可选项）
    if (isHandDiscardPrompt) return undefined;
    
    const disabled = new Set<string>();
    // ... 原有逻辑
}, [isMeFirstResponse, myPlayer, isHandDiscardPrompt]);
```

## 为什么审计维度没有捕获？

### 现有审计维度的盲区

1. **D15 UI 状态同步**：关注"UI 是否与 core 状态一致"，但没有关注"多个 UI 门控系统之间的优先级冲突"
2. **D5 交互完整**：关注"是否有对应 UI"，但没有关注"UI 是否被其他系统误禁用"
3. **D8 时序正确**：关注"事件触发顺序"，但没有关注"UI 状态机的并发冲突"

### 缺失的审计维度

**D38: UI 门控系统优先级冲突（新增）**

**触发条件**：新增/修改任何 UI 交互门控逻辑（`disabled`/`disabledCardUids`/`isSelectable` 等）时触发

**核心问题**：多个独立的 UI 门控系统同时作用于同一 UI 元素时，是否存在优先级冲突？

**审查方法**：

1. **识别所有 UI 门控系统**：
   - grep 所有计算 `disabled*`/`*DisabledUids`/`isSelectable` 的 useMemo
   - 列出每个门控系统的触发条件和作用范围
   - 标注哪些门控系统可能同时激活

2. **绘制状态机交叉矩阵**：
   ```
   状态 A（Me First! 响应）× 状态 B（手牌选择交互）
   → 哪个门控系统应该优先？
   → 是否有显式的优先级检查？
   ```

3. **检查优先级声明**：
   - 高优先级门控是否在计算开始时检查低优先级状态并提前返回？
   - 是否有文档说明优先级规则？

4. **典型冲突场景**：
   - 响应窗口门控 × 交互系统门控
   - 教学模式门控 × 正常游戏门控
   - 阶段限制门控 × 能力授予的额外行动门控
   - 全局禁用（游戏结束/加载中）× 局部交互

5. **判定标准**：
   - ✅ 正确：交互系统激活时，其他门控系统检查 `isHandDiscardPrompt` 并返回 `undefined`
   - ❌ 错误：两个门控系统同时返回 `Set<string>`，UI 层取并集导致过度禁用

**输出格式**：
```
门控系统 A: meFirstDisabledUids (Me First! 响应窗口)
门控系统 B: handPromptDisabledUids (手牌选择交互)
冲突场景: 便衣忍者在 Me First! 窗口中打出后创建手牌选择交互
当前行为: A 和 B 同时激活，A 禁用所有非 beforeScoringPlayable 随从
预期行为: B 激活时 A 应该退让（返回 undefined）
修复: A 的计算中添加 `if (isHandDiscardPrompt) return undefined;`
```

**常见优先级规则**：
1. **交互系统 > 响应窗口**：有交互时，交互控制可选项
2. **教学模式 > 正常游戏**：教学模式的限制覆盖正常游戏规则
3. **全局禁用 > 局部门控**：游戏结束/加载中时，所有交互都应禁用
4. **能力授予 > 阶段限制**：能力明确授予额外行动时，阶段限制应放宽

**自动化检查**：
- 静态分析：grep 所有 `disabled*` 计算，检查是否有交叉引用（如 `if (isHandDiscardPrompt) return undefined`）
- 运行时检查：在 HandArea 组件中添加 warning，当多个 `disabledCardUids` 同时非空时打印警告

## 历史背景

- **Commit 7cb4050**：引入 `meFirstDisabledUids` 逻辑，但从一开始就缺少 `isHandDiscardPrompt` 检查
- **用户误记**：用户认为"修过一次"，但 git 历史显示这是首次修复
- **为什么没被发现**：
  1. 便衣忍者是唯一在 Me First! 窗口中打出后需要选择手牌的 special 卡
  2. 其他 special 卡（影舞者等）要么不需要选择手牌，要么不在 Me First! 窗口中打出
  3. E2E 测试覆盖了便衣忍者的基本功能，但没有覆盖"在 Me First! 窗口中打出"这个特殊场景

## 教训

1. **UI 门控系统需要显式优先级声明**：不能假设"不会同时激活"
2. **交互系统应该是最高优先级**：有交互时，其他门控应该退让
3. **E2E 测试需要覆盖状态组合**：不仅测试功能本身，还要测试在特殊上下文（响应窗口/教学模式/游戏结束等）中的行为
4. **审计维度需要关注"并发冲突"**：不仅关注"单个系统是否正确"，还要关注"多个系统同时激活时是否冲突"

## 相关文件

- `src/games/smashup/Board.tsx` (meFirstDisabledUids 计算)
- `src/games/smashup/abilities/ninjas.ts` (便衣忍者能力实现)
- `src/engine/systems/InteractionSystem.ts` (交互系统 playerView 过滤)
- `src/engine/systems/ResponseWindowSystem.ts` (响应窗口锁定逻辑)
