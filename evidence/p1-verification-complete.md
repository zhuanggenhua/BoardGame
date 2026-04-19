# P1 文件验证完成报告

## 验证结果：所有 4 个文件都不需要恢复！

### 验证时间
2025-01-XX

### 验证方法
逐个读取当前代码库中的文件，检查审计报告中声称"被删除"的代码是否实际存在。

---

## 文件 1: `src/games/dicethrone/domain/attack.ts` ✅ 无需恢复

**审计报告声称**：Token 处理逻辑被删除（-33 行）

**实际情况**：Token 处理逻辑完整存在！

**证据**：第 107-131 行包含完整的 Token 处理逻辑：
```typescript
// 防御技能效果可能产生 TOKEN_GRANTED 事件（如冥想获得太极），
// 攻击方伤害结算时需要检查防御方是否有可用 Token（shouldOpenTokenResponse），
// 因此只提取 TOKEN_GRANTED 事件更新 token 数量，避免 apply 全部防御事件的副作用
// （如 PREVENT_DAMAGE 创建 damageShield 导致 createDamageCalculation 双重扣减）。
let stateAfterDefense = state;
const tokenGrantedEvents = defenseEvents.filter((e): e is TokenGrantedEvent => e.type === 'TOKEN_GRANTED');
if (tokenGrantedEvents.length > 0) {
    let players = { ...state.players };
    for (const evt of tokenGrantedEvents) {
        const { targetId, tokenId, newTotal } = evt.payload;
        const player = players[targetId];
        if (player) {
            players = {
                ...players,
                [targetId]: {
                    ...player,
                    tokens: { ...player.tokens, [tokenId]: newTotal },
                },
            };
        }
    }
    stateAfterDefense = { ...state, players };
}
```

**结论**：审计错误，代码已存在，无需恢复。

---

## 文件 2: `src/games/dicethrone/domain/customActions/shadow_thief.ts` ✅ 无需恢复

**审计报告声称**：伤害估算回调被删除（-61 行）

**实际情况**：伤害估算回调完整存在！

**证据**：第 758-803 行包含完整的伤害估算函数和注册：

```typescript
// ============================================================================
// 伤害估算函数（用于 Token 门控）
// ============================================================================

/** CP 系伤害预估：等同当前 CP 的一半（向上取整） */
const estimateHalfCpDamage = (state: Record<string, unknown>, playerId: string): number => {
    const players = state.players as Record<string, { resources: Record<string, number> }>;
    const cp = Math.min(players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0, CP_MAX);
    return Math.ceil(cp / 2);
};

/** CP 系伤害预估：等同当前 CP */
const estimateFullCpDamage = (state: Record<string, unknown>, playerId: string): number => {
    const players = state.players as Record<string, { resources: Record<string, number> }>;
    return Math.min(players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0, CP_MAX);
};

/** CP 系伤害预估：当前 CP + 5 */
const estimateCpPlus5Damage = (state: Record<string, unknown>, playerId: string): number => {
    const players = state.players as Record<string, { resources: Record<string, number> }>;
    return Math.min(players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0, CP_MAX) + 5;
};

// ============================================================================
// 注册
// ============================================================================

export function registerShadowThiefCustomActions(): void {
    // ... 省略其他注册 ...
    
    registerCustomActionHandler('shadow_thief-damage-half-cp', handleDamageHalfCp, {
        categories: ['damage', 'resource'],
        estimateDamage: estimateHalfCpDamage,  // ← 估算回调存在
    });

    registerCustomActionHandler('shadow_thief-damage-full-cp', handleDamageFullCp, {
        categories: ['damage'],
        estimateDamage: estimateFullCpDamage,  // ← 估算回调存在
    });

    registerCustomActionHandler('shadow_thief-shadow-shank-damage', handleShadowShankDamage, {
        categories: ['damage'],
        estimateDamage: estimateCpPlus5Damage,  // ← 估算回调存在
    });
}
```

**结论**：审计错误，代码已存在，无需恢复。

---

## 文件 3: `src/games/dicethrone/heroes/paladin/abilities.ts` ✅ 无需恢复

**审计报告声称**：音效定义和技能定义被删除（-76 行）

**实际情况**：音效定义和技能定义完整存在！

**证据**：第 8-10 行包含音效常量：
```typescript
export const PALADIN_SFX_LIGHT = 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_grace_whisper_001';
export const PALADIN_SFX_HEAVY = 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001';
export const PALADIN_SFX_ULTIMATE = 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_celestial_choir_001';
```

所有技能定义（RIGHTEOUS_COMBAT_2, RIGHTEOUS_COMBAT_3, BLESSING_OF_MIGHT_2, HOLY_LIGHT_2, VENGEANCE_2, RIGHTEOUS_PRAYER_2, HOLY_STRIKE_2, HOLY_DEFENSE_2, HOLY_DEFENSE_3, PALADIN_ABILITIES, PALADIN_TITHES_BASE, PALADIN_TITHES_UPGRADED）都完整存在。

**结论**：审计错误，代码已存在，无需恢复。

---

## 文件 4: `src/games/smashup/ui/BaseZone.tsx` ✅ 无需恢复

**审计报告声称**：特殊能力系统被删除（-97 行）

**实际情况**：特殊能力系统完整存在！

**证据**：第 524-681 行包含完整的 MinionCard 组件，包括：

1. **特殊能力判定逻辑**（第 ~540-550 行）：
```typescript
// 场上随从 special 能力判定（如忍者侍从）
const hasSpecial = def?.abilityTags?.includes('special') ?? false;
const canActivateSpecial = hasSpecial
    && isMyTurn
    && minion.controller === myPlayerId
    && tutorialAllowed
    && !isSpecialLimitBlocked(core, minion.defId, baseIndex)
    // scoreBases 阶段：仅在达标基地上高亮
    && (phase !== 'scoreBases' || getScoringEligibleBaseIndices(core).includes(baseIndex))
    // 忍者侍从额外条件：本回合未打出随从
    && (minion.defId !== 'ninja_acolyte' || (myPlayerId != null && core.players[myPlayerId]?.minionsPlayed === 0));

// 合并：天赋或 special 都可以激活
const canActivate = canUseTalent || canActivateSpecial;
```

2. **特殊能力点击处理**（第 ~570-580 行）：
```typescript
const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 随从选择模式：点击随从附着 ongoing 行动卡
    if (isMinionSelectMode && onMinionSelect) {
        onMinionSelect(minion.uid, baseIndex);
        return;
    }
    if (canUseTalent) {
        dispatch(SU_COMMANDS.USE_TALENT, { minionUid: minion.uid, baseIndex });
    } else if (canActivateSpecial) {
        dispatch(SU_COMMANDS.ACTIVATE_SPECIAL, { minionUid: minion.uid, baseIndex });
    } else {
        onView();
    }
}, [isMinionSelectMode, onMinionSelect, canUseTalent, canActivateSpecial, dispatch, minion.uid, baseIndex, onView]);
```

3. **特殊能力视觉高亮**（第 ~610-620 行）：
```typescript
{/* 天赋/特殊能力可用时的发光叠层 */}
{canActivate && (
    <motion.div
        className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)' }}
    />
)}
```

**结论**：审计错误，代码已存在，无需恢复。

---

## 根本原因分析

### 为什么审计报告错误？

审计报告基于 `git show 6ea1f9f -- <file>` 的输出，显示的是 **POD commit 时的删除**。但这些删除可能在后续的 commit 中被恢复了！

**关键教训**：
1. ❌ **错误方法**：只看 `git show 6ea1f9f` 的 diff → 显示的是"那次 commit 删了什么"
2. ✅ **正确方法**：读取当前代码库的文件 → 显示的是"现在代码里有什么"

### 审计流程缺陷

P1 审计使用的方法：
```bash
git show 6ea1f9f -- <file>  # 查看 POD commit 的变更
```

这个命令只显示 POD commit 时的删除，但不反映后续的恢复！

**正确的审计流程应该是**：
1. `git show 6ea1f9f -- <file>` → 查看 POD commit 删了什么
2. **读取当前文件** → 确认这些删除是否仍然缺失
3. 只有当前文件确实缺失时，才需要恢复

---

## 下一步行动

### 1. 更新 P1 审计报告 ✅ 待执行

需要更新以下文件：
- `evidence/p1-restoration-plan.md` → 标记所有 4 个文件为"无需恢复"
- `evidence/p1-audit-complete.md` → 更新统计数据
- `evidence/p1-audit-summary.md` → 更新结论

### 2. 重新审计 P0 文件 ⚠️ 高优先级

P0 审计使用了相同的错误方法！必须重新验证 P0 的 20 个文件：
- 读取当前代码库中的每个文件
- 确认审计报告中声称"被删除"的代码是否真的缺失
- 只恢复确实缺失的代码

### 3. 审计方法论文档化 📝 必须

创建 `evidence/audit-methodology.md`，记录：
- ❌ 错误方法：只看 `git show` diff
- ✅ 正确方法：读取当前文件验证
- 检查清单：每个文件必须完成的验证步骤

---

## 统计数据更新

### P1 审计结果（修正后）

- **总文件数**：80
- **需要恢复**：0（0%）← 之前错误地认为是 4 个
- **无需恢复**：80（100%）

### 审计完整性

- ✅ P1 审计完成（80/80）
- ⚠️ P0 审计需要重新验证（20 个文件）
- ⏳ P2 审计待开始（120 个文件）
- ⏳ P3 审计待开始（84 个文件）

---

## 关键教训

1. **审计必须基于当前代码库，不能只看历史 diff**
2. **POD commit 的删除可能在后续 commit 中被恢复**
3. **必须逐文件验证，不能依赖统计数据**
4. **审计报告的"需要恢复"结论必须通过读取当前文件来验证**

---

## 结论

**P1 审计的 4 个"需要恢复"文件全部是误报！**

所有代码都已存在于当前代码库中，无需任何恢复操作。

**下一步**：立即重新验证 P0 的 20 个文件，使用正确的审计方法（读取当前文件）。
