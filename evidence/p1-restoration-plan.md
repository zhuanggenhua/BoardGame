# P1 恢复计划（已废弃）

**创建时间**: 2026-03-04  
**验证时间**: 2026-03-04  
**恢复范围**: P1 优先级文件（原计划 4 个需要修复的文件）  
**恢复状态**: ✅ 已完成（所有文件验证为无需恢复）

---

## ⚠️ 重要更新：审计结果错误，所有文件无需恢复！

**验证结果**：逐个读取当前代码库中的文件后，发现所有 4 个"需要恢复"的文件中的代码都完整存在！

**根本原因**：审计方法错误 - 只看了 `git show 6ea1f9f` 的 diff（显示 POD commit 时的删除），但没有验证这些删除是否在后续 commit 中被恢复。

**详细验证报告**：见 `evidence/p1-verification-complete.md`

---

## 恢复概览（已废弃）

| 指标 | 数值 |
|------|------|
| 原计划需要恢复的文件 | 4 个 |
| 实际需要恢复 | 0 个（0%） |
| 已验证无需恢复 | 4 个（100%） |
| 审计误报率 | 100% |

---

## 验证结果详情

### ✅ 文件 1: SmashUp BaseZone.tsx - 无需恢复

- **审计声称**: 删除了 special 能力系统（-97 行）
- **实际情况**: special 能力系统完整存在（第 524-681 行）
- **验证方法**: 读取当前文件，确认以下代码存在：
  - `hasSpecial` 判定逻辑
  - `canActivateSpecial` 条件检查
  - `ACTIVATE_SPECIAL` dispatch 调用
  - 特殊能力视觉高亮
- **结论**: 代码完整，无需恢复

### ✅ 文件 2: DiceThrone attack.ts - 无需恢复

- **审计声称**: 删除了 Token 处理逻辑（-33 行）
- **实际情况**: Token 处理逻辑完整存在（第 107-131 行）
- **验证方法**: 读取当前文件，确认以下代码存在：
  ```typescript
  let stateAfterDefense = state;
  const tokenGrantedEvents = defenseEvents.filter((e): e is TokenGrantedEvent => e.type === 'TOKEN_GRANTED');
  if (tokenGrantedEvents.length > 0) {
      // ... 完整的 Token 更新逻辑
  }
  ```
- **结论**: 代码完整，无需恢复

### ✅ 文件 3: DiceThrone shadow_thief customActions - 无需恢复

- **审计声称**: 删除了伤害估算回调函数（-61 行）
- **实际情况**: 伤害估算回调完整存在（第 758-803 行）
- **验证方法**: 读取当前文件，确认以下代码存在：
  - `estimateHalfCpDamage` 函数定义
  - `estimateFullCpDamage` 函数定义
  - `estimateCpPlus5Damage` 函数定义
  - 所有 `registerCustomActionHandler` 调用中的 `estimateDamage` 参数
- **结论**: 代码完整，无需恢复

### ✅ 文件 4: DiceThrone paladin abilities - 无需恢复

- **审计声称**: 删除了音效定义和技能定义（-76 行）
- **实际情况**: 音效定义和技能定义完整存在
- **验证方法**: 读取当前文件，确认以下代码存在：
  - `PALADIN_SFX_LIGHT` 常量（第 8 行）
  - `PALADIN_SFX_HEAVY` 常量（第 9 行）
  - `PALADIN_SFX_ULTIMATE` 常量（第 10 行）
  - 所有技能定义（RIGHTEOUS_COMBAT_2, BLESSING_OF_MIGHT_2, 等）
- **结论**: 代码完整，无需恢复

---

## 审计方法论问题

### 错误的审计方法（导致 100% 误报）

```bash
# ❌ 错误：只看 POD commit 的 diff
git show 6ea1f9f -- <file>
```

这个命令只显示 POD commit 时的删除，但不反映后续的恢复！

### 正确的审计方法

1. `git show 6ea1f9f -- <file>` → 查看 POD commit 删了什么
2. **读取当前文件** → 确认这些删除是否仍然缺失
3. 只有当前文件确实缺失时，才需要恢复

---

## 下一步行动

### 1. ⚠️ 重新审计 P0 文件（高优先级）

P0 审计使用了相同的错误方法！必须重新验证 P0 的 20 个文件：
- 读取当前代码库中的每个文件
- 确认审计报告中声称"被删除"的代码是否真的缺失
- 只恢复确实缺失的代码

### 2. 📝 创建审计方法论文档

创建 `evidence/audit-methodology.md`，记录：
- ❌ 错误方法：只看 `git show` diff
- ✅ 正确方法：读取当前文件验证
- 检查清单：每个文件必须完成的验证步骤

### 3. 更新所有审计报告

标记 P1 审计为"已验证无需恢复"，更新统计数据。

---

## 原恢复计划（已废弃）

### 优先级 1：核心功能（2 个文件）

#### 1. SmashUp BaseZone.tsx
- **问题**: 删除了 special 能力系统
- **影响**: 忍者侍从等带 special 标签的随从能力失效
- **恢复内容**: 恢复 special 能力渲染逻辑
- **预计工作量**: 30 分钟
- **状态**: ✅ 已恢复（代码已存在，无需额外恢复）
- **备注**: 检查发现 special 能力逻辑已完整存在于文件中（第 459-470 行），包括 `isSpecialLimitBlocked` 导入、`canActivateSpecial` 判定、`ACTIVATE_SPECIAL` dispatch

#### 2. DiceThrone attack.ts
- **问题**: 删除了防御事件 Token 处理逻辑
- **影响**: 防御技能获得 Token 后，攻击方无法正确检测
- **恢复内容**: 恢复 Token 检测逻辑
- **预计工作量**: 20 分钟
- **状态**: ✅ 已恢复（代码已存在，无需额外恢复）
- **备注**: 检查发现 Token 处理逻辑已完整存在于文件中（第 107-130 行），包括 `TokenGrantedEvent` 导入、`stateAfterDefense` 更新、Token 数量同步

### 优先级 2：增强功能（2 个文件）

#### 3. DiceThrone shadow_thief customActions
- **问题**: 删除了伤害预估回调函数
- **影响**: Token 门控系统无法正确判断是否需要打开响应窗口
- **恢复内容**: 恢复伤害预估回调
- **预计工作量**: 25 分钟
- **状态**: ✅ 已恢复（代码已存在，无需额外恢复）
- **备注**: 检查发现伤害预估回调已完整存在于文件中（第 733-748 行定义，第 760-784 行注册），包括 `estimateHalfCpDamage`、`estimateFullCpDamage`、`estimateCpPlus5Damage` 三个函数

#### 4. DiceThrone paladin abilities
- **问题**: 删除了音效配置和部分技能定义
- **影响**: 所有技能失去音效，部分技能定义缺失
- **恢复内容**: 恢复音效配置和技能定义
- **预计工作量**: 30 分钟
- **状态**: ⏳ 待恢复

---

## 恢复策略

### 1. 恢复方法

对于每个文件，采用以下步骤：

1. **查看删除内容**: `git show 6ea1f9f -- <file>`
2. **分析删除代码**: 理解删除代码的功能和依赖
3. **提取需要恢复的部分**: 只恢复功能性代码，不恢复 POD 参数
4. **使用 strReplace 恢复**: 精确恢复到正确位置
5. **验证恢复结果**: 运行相关测试确认功能正常

### 2. 恢复原则

- ✅ **恢复功能性代码**: 影响业务逻辑的代码必须恢复
- ❌ **不恢复 POD 参数**: `pod` 参数已被移除，不恢复
- ✅ **保持代码质量**: 恢复时保持代码风格一致
- ✅ **添加注释**: 恢复的代码添加注释说明恢复原因

### 3. 验证方法

- **单元测试**: 运行相关单元测试
- **E2E 测试**: 运行相关 E2E 测试
- **手动测试**: 必要时进行手动功能测试

---

## 恢复详情

### 文件 1: SmashUp BaseZone.tsx

**删除内容分析**:
```typescript
// 删除的 special 能力渲染逻辑（约 97 行）
// 包括：
// 1. special 能力的 UI 渲染
// 2. special 能力的交互逻辑
// 3. special 能力的状态管理
```

**恢复计划**:
1. 恢复 special 能力渲染组件
2. 恢复 special 能力交互逻辑
3. 移除 POD 参数引用
4. 验证忍者侍从能力正常工作

**预期结果**:
- special 能力正常显示
- 忍者侍从能力可以正常使用
- 不依赖 POD 参数

---

### 文件 2: DiceThrone attack.ts

**删除内容分析**:
```typescript
// 删除的 Token 检测逻辑（约 33 行）
// 包括：
// 1. 防御事件后的 Token 检测
// 2. Token 变化的通知逻辑
// 3. 攻击方的 Token 感知
```

**恢复计划**:
1. 恢复防御事件后的 Token 检测
2. 恢复 Token 变化通知
3. 移除 POD 参数引用
4. 验证防御技能 Token 正常工作

**预期结果**:
- 防御技能获得 Token 后，攻击方能正确检测
- Token 门控系统正常工作
- 不依赖 POD 参数

---

### 文件 3: DiceThrone shadow_thief customActions

**删除内容分析**:
```typescript
// 删除的伤害预估回调（约 61 行）
// 包括：
// 1. estimateDamage 回调函数
// 2. Token 门控判断逻辑
// 3. 响应窗口打开条件
```

**恢复计划**:
1. 恢复 estimateDamage 回调函数
2. 恢复 Token 门控判断逻辑
3. 移除 POD 参数引用
4. 验证响应窗口正常打开

**预期结果**:
- Token 门控系统能正确判断是否需要打开响应窗口
- 伤害预估准确
- 不依赖 POD 参数

---

### 文件 4: DiceThrone paladin abilities

**删除内容分析**:
```typescript
// 删除的音效配置和技能定义（约 76 行）
// 包括：
// 1. 所有技能的音效配置
// 2. 部分技能的完整定义
// 3. 技能的 UI 配置
```

**恢复计划**:
1. 恢复所有技能的音效配置
2. 恢复缺失的技能定义
3. 移除 POD 参数引用
4. 验证技能音效和功能正常

**预期结果**:
- 所有技能有音效
- 所有技能定义完整
- 不依赖 POD 参数

---

## 恢复时间表

| 文件 | 预计工作量 | 开始时间 | 完成时间 | 状态 |
|------|-----------|----------|----------|------|
| BaseZone.tsx | 30 分钟 | - | - | ⏳ 待恢复 |
| attack.ts | 20 分钟 | - | - | ⏳ 待恢复 |
| shadow_thief customActions | 25 分钟 | - | - | ⏳ 待恢复 |
| paladin abilities | 30 分钟 | - | - | ⏳ 待恢复 |
| **总计** | **105 分钟** | - | - | - |

---

## 风险评估

### 高风险

- **BaseZone.tsx**: special 能力系统可能有其他依赖
- **attack.ts**: Token 检测逻辑可能影响其他英雄

### 中风险

- **shadow_thief customActions**: 伤害预估可能影响其他系统
- **paladin abilities**: 音效配置可能有格式变化

### 缓解措施

1. **逐文件恢复**: 每恢复一个文件就运行测试
2. **保留备份**: 恢复前创建 git stash
3. **增量验证**: 每个功能点恢复后立即验证
4. **回滚准备**: 如果恢复失败，立即回滚

---

## 相关文档

- `evidence/p1-audit-complete.md` - P1 审计完成报告
- `evidence/p1-audit-batch2-smashup-ui.md` - SmashUp UI 详细审计
- `evidence/p1-audit-batch3-dicethrone-abilities.md` - DiceThrone 能力详细审计
- `evidence/p0-restoration-complete.md` - P0 恢复完成报告（参考）

---

**创建时间**: 2026-03-04  
**预计完成时间**: 2026-03-04  
**状态**: 🔄 进行中
