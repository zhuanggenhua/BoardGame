# Plateau of Leng 实现历史

## 问题
用户询问："所以是哪次提交移除的"（指"直接授予额度"实现）

## 调查结果

### 关键发现：从未存在过"直接授予额度"实现

通过 git 历史调查，Plateau of Leng 的实现历史如下：

#### `grantExtraMinion` 函数演进

1. **dc3558e** (2026-02-08) - 首次引入 `grantExtraMinion`
   - 签名：`grantExtraMinion(playerId, reason, now)`
   - 只有 3 个参数，生成全局随从额度

2. **c752c4c** (feat: FX序列引擎、SmashUp技能修复) - 添加 `restrictToBase` 参数
   - 签名：`grantExtraMinion(playerId, reason, now, restrictToBase?)`
   - 支持限定额度到特定基地

3. **afad8dc** (feat: 光标系统 + 三游戏功能迭代) - 添加 `options` 参数
   - 签名：`grantExtraMinion(playerId, reason, now, restrictToBase?, options?)`
   - `options` 包含 `sameNameOnly` 和 `sameNameDefId`
   - **此时已具备 Plateau of Leng 所需的全部功能**

#### Plateau of Leng 实现历史

1. **6ea1f9f** (feat: add Smash Up POD faction support)
   - 首次实现 Plateau of Leng
   - 使用"创建交互"方式（`createSimpleChoice` + `registerInteractionHandler`）
   - 检查手牌中是否有同名随从，有则弹出交互让玩家选择

2. **ba22e07** (feat: 通用系统层抽取 + SmashUp 派系能力与提示重构)
   - 继续使用"创建交互"方式
   - 使用 `requestChoice` + `registerPromptContinuation`

3. **b9c5be3** (feat(engine): 新增 primitives)
   - 继续使用"创建交互"方式
   - 使用 `createSimpleChoice` + `registerInteractionHandler`

4. **c752c4c** (feat: FX序列引擎、SmashUp技能修复)
   - 继续使用"创建交互"方式
   - **虽然 `grantExtraMinion` 已支持 `restrictToBase`，但未使用**

5. **afad8dc** (feat: 光标系统 + 三游戏功能迭代)
   - 继续使用"创建交互"方式
   - **虽然 `grantExtraMinion` 已支持 `sameNameOnly`，但未使用**
   - **此时框架已完全支持"直接授予额度"方式，但 Plateau of Leng 仍未改用**

6. **0d70ef9** (chore: update SmashUp abilities and tests)
   - 继续使用"创建交互"方式
   - 添加了详细的 console.log 调试日志
   - 添加了"首次打出"检查（`playedAtBase === 1`）

7. **0857e28** (fix: update SmashUp ability helpers and base abilities) ✅ **当前版本**
   - **首次改为"直接授予额度"方式**
   - 使用 `grantExtraMinion()` 函数
   - 移除了交互处理器 `registerInteractionHandler('base_plateau_of_leng')`

### 结论

**"直接授予额度"实现从未被移除，因为它从未存在过。**

- **afad8dc (约 2026-02-XX)** 提交时，`grantExtraMinion` 函数已经具备了 Plateau of Leng 所需的全部功能（`restrictToBase` + `sameNameOnly` + `sameNameDefId`）
- 但从 6ea1f9f（首次实现）到 0d70ef9，Plateau of Leng 一直使用"创建交互"方式，**从未使用过"直接授予额度"方式**
- **0857e28 是首次引入**"直接授予额度"的正确实现，而不是"改回去"

### 为什么框架支持了但没有使用？

这是一个典型的"框架演进快于业务迁移"的案例：

1. **afad8dc** 提交时，引擎层已经提供了完整的额度系统支持（`sameNameOnly` 等参数）
2. 但 Plateau of Leng 的实现没有同步更新，仍然使用旧的"创建交互"方式
3. 直到 **0857e28** 才完成迁移，使用了正确的"直接授予额度"方式

这说明：
- ✅ 框架设计是正确的（早在 afad8dc 就支持了）
- ❌ 业务代码没有及时跟进框架能力
- ✅ 0857e28 完成了这次"技术债务清理"

## 实现对比

### 旧实现（创建交互）
```typescript
// 检查手牌中是否有同名随从
const sameNameMinions = player.hand.filter(
    c => c.defId === ctx.minionDefId && c.type === 'minion'
);

// 无同名随从，不生成 Prompt
if (sameNameMinions.length === 0) return { events: [] };

// 创建交互让玩家选择
const interaction = createSimpleChoice(
    `base_plateau_of_leng_${ctx.now}`, ctx.playerId,
    `冷原高地：是否打出同名随从 ${minionName}？`,
    options, 'base_plateau_of_leng'
);
```

**问题**：
- ❌ 强制玩家立即决定是否打出
- ❌ 无法处理动态获得的同名随从（如本地人的 onPlay 能力）
- ❌ 不符合规则语义（"可以额外打出" = 给予额度，而非强制选择）

### 新实现（直接授予额度）
```typescript
// 直接授予1个同名随从额度，限定到此基地
return {
    events: [
        grantExtraMinion(
            ctx.playerId,
            'base_plateau_of_leng',
            ctx.now,
            ctx.baseIndex, // 限定到此基地
            { sameNameOnly: true, sameNameDefId: ctx.minionDefId }
        )
    ]
};
```

**优势**：
- ✅ 玩家可以自由选择何时使用额度
- ✅ 自动处理动态获得的同名随从
- ✅ 符合规则语义（"可以额外打出"）
- ✅ 验证层和 UI 层自动处理额度约束

## 时间线

```
dc3558e (首次引入 grantExtraMinion) → c752c4c (添加 restrictToBase) → afad8dc (添加 sameNameOnly) → 0857e28 (Plateau of Leng 迁移) ✅
    ↓                                      ↓                              ↓                              ↓
grantExtraMinion(3参数)                grantExtraMinion(4参数)        grantExtraMinion(5参数)        Plateau of Leng 首次使用
全局额度                                支持限定基地                    支持同名限制                    直接授予额度方式
                                                                      ⚠️ 框架已支持但未使用
```

```
6ea1f9f (POD faction) → ba22e07 (系统重构) → b9c5be3 (primitives) → c752c4c (FX引擎) → afad8dc (光标系统) → 0d70ef9 (调试日志) → 0857e28 (迁移) ✅
    ↓                      ↓                      ↓                      ↓                  ↓                      ↓                      ↓
创建交互                创建交互                创建交互                创建交互            创建交互                创建交互                直接授予额度
(首次实现)              (重构)                  (重构)                  (未使用框架)        (未使用框架)            (添加日志)              (首次正确实现)
                                                                                          ⚠️ 框架已完全支持
```

## 用户误解的来源

用户可能认为：
1. 之前存在过"直接授予额度"实现
2. 后来被改成了"创建交互"
3. 现在需要改回去

**实际情况**：
1. 从未存在过"直接授予额度"实现
2. 一直都是"创建交互"方式（从首次实现到 0d70ef9）
3. 0857e28 是**首次引入**正确的"直接授予额度"实现

## 参考

- 完整修复文档：`evidence/plateau-locals-fix-complete.md`
- 测试文件：`src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
- 实现文件：`src/games/smashup/domain/baseAbilities_expansion.ts`
