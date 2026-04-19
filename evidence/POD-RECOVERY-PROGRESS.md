# POD 提交恢复进度

## 已完成（2/5）

### ✅ 1. `src/games/dicethrone/domain/customActions/pyromancer.ts`
- ✅ 恢复 `damagePhase` 字段（7 处）
- ✅ 恢复 `resolveMagmaArmor` 函数签名和条件灼烧逻辑
- ✅ 恢复注册器调用（`burn-down-2-resolve`）

### ✅ 2. `src/games/dicethrone/domain/customActions/moon_elf.ts`
- ✅ 恢复 `damagePhase` 字段（1 处）
- ✅ `DAMAGE_SHIELD_GRANTED` 事件已存在（无需恢复）

---

## 待完成（3/5）

### ⏳ 3. `src/games/dicethrone/heroes/shadow_thief/abilities.ts`

**需要恢复的内容较多（约 50+ 处修改）：**

1. **音效常量**（5 个）
   - `SHADOW_THIEF_SFX_PICKPOCKET`
   - `SHADOW_THIEF_SFX_STEAL`
   - `SHADOW_THIEF_SFX_KIDNEY`
   - `SHADOW_THIEF_SFX_LOOT`
   - （`SHADOW_THIEF_SFX_DAGGER` 已存在）

2. **技能音效引用**（约 20 处）
   - `pickpocket` 技能使用 `SHADOW_THIEF_SFX_PICKPOCKET`
   - `steal` 技能使用 `SHADOW_THIEF_SFX_STEAL`
   - `kidney-shot` 技能使用 `SHADOW_THIEF_SFX_KIDNEY`
   - 等等

3. **`stealLimit` 参数**（约 10 处）
   - `steal` 技能变体中的 `stealLimit: 1`
   - `steal-2` 技能变体中的 `stealLimit: 2`

4. **`bonusCp` 参数**（约 10 处）
   - `pickpocket` 技能中的 `params: { bonusCp: 3 }`
   - `kidney-shot` 技能中的 `params: { bonusCp: 4 }`
   - 等等

**建议**：这个文件改动较多，可能需要 30-50 次 `strReplace` 操作。

---

### ⏳ 4. `src/games/dicethrone/heroes/pyromancer/abilities.ts`

**需要恢复的内容：**

1. **`soul-burn-5` 技能变体**（约 20 行）
   - 完整的技能定义
   - 包含 4 个 effects

2. **变体 `name` 字段**（4 处）
   - `soul-burn-2` 变体
   - `soul-burn-3` 变体
   - `blazing-soul` 变体
   - 等等

3. **`blazing-soul` 的 `priority`**（1 处）
   - 从 `priority: 3` 改回 `priority: 4`

---

### ⏳ 5. `src/engine/hooks/useEventStreamCursor.ts`

**需要恢复的内容较多（约 80+ 行）：**

1. **`didOptimisticRollback` 字段**
   - 在 `ConsumeResult` 接口中添加
   - 在所有返回语句中添加（约 10 处）

2. **乐观引擎回滚逻辑**（约 60 行）
   - `rollback.seq` 变化检测
   - `rollback.watermark` 处理
   - `rollback.reconcileSeq` 处理

3. **调试日志**（约 20 行）
   - `[CURSOR-DIAG:consume]` 日志

**建议**：这个文件改动最多，可能需要 50+ 次 `strReplace` 操作。

---

## 恢复策略建议

由于剩余 3 个文件的改动较多，建议：

1. **优先级排序**：
   - 高优先级：`pyromancer/abilities.ts`（影响游戏平衡）
   - 中优先级：`shadow_thief/abilities.ts`（影响音效和参数）
   - 低优先级：`useEventStreamCursor.ts`（影响乐观引擎，可能已废弃）

2. **分批恢复**：
   - 每次恢复一个文件
   - 恢复后运行测试验证

3. **确认必要性**：
   - `useEventStreamCursor.ts` 的乐观引擎逻辑可能已废弃，建议先确认是否需要恢复

---

## 下一步

请确认：
1. 是否需要继续恢复剩余的 3 个文件？
2. 是否需要优先恢复某个文件？
3. 是否需要跳过某个文件（如 `useEventStreamCursor.ts`）？
