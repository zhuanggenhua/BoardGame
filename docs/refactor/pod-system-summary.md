# POD 系统完整修复总结

## 修复的问题

### 1. alien_scout_pod 不触发 afterScoring（已修复 ✅）

**问题**：POD 版本侦察兵在基地计分后不触发返回手牌交互

**根因**：POD 版本没有注册 afterScoring 触发器

**解决方案**：
- 实现 POD 能力自动映射系统（`registerPodOngoingAliases()`）
- 自动将基础版的 trigger/restriction/protection 复制给 POD 版本
- 支持选择性覆盖（已注册的 POD 版本不会被覆盖）

**文档**：`docs/refactor/pod-auto-mapping.md`

---

### 2. 多 afterScoring 交互链式传递 bug（已修复 ✅）

**问题**：母舰 + 侦察兵同时触发 afterScoring 时，`_deferredPostScoringEvents` 存储位置错误

**根因**：延迟事件存储在最后一个交互中，而非第一个交互，导致链式传递失败

**解决方案**：
- 修改 `src/games/smashup/domain/index.ts` 第 370 行
- 将 `_deferredPostScoringEvents` 存储到第一个交互中
- 确保链式传递到最后一个交互

**影响范围**：所有多 afterScoring 交互场景（基地能力 + 随从 trigger、多个随从 trigger）

**文档**：`AGENTS.md` 中的教训记录

---

### 3. alien_scout 交互不显示在 UI（已修复 ✅）

**问题**：侦察兵的返回手牌交互创建了，但 UI 不显示 `PromptOverlay`

**根因**：交互使用 `targetType: 'minion'`，导致 Board 组件误判为"点击场上随从"交互，隐藏了 `PromptOverlay`

**解决方案**：
- 将 `targetType: 'minion'` 改为 `targetType: 'generic'`
- 修改位置：`alienScoutAfterScoring` 函数和 `alien_scout_return` 交互处理器

**文档**：对话记录

---

### 4. alien_scout 触发两次（已修复 ✅）

**问题**：侦察兵的 afterScoring 效果触发两次，导致同一个侦察兵被返回手牌两次（复制卡牌）

**根因**：违反不可变更新原则，直接修改 `state.sys` 属性和数组

**解决方案**：
- 修改 `src/games/smashup/domain/index.ts` 中 5 处直接修改为不可变更新
- 使用 `{ ...state.sys, field: newValue }` 和 `[...array, newItem]` 模式

**文档**：对话记录

---

### 5. POD stub 占位符阻塞自动映射（已修复 ✅）

**问题**：50+ POD 卡牌能力失效，因为 stub 占位符覆盖了自动映射的正确实现

**根因**：
- `podStubs.ts` 包含 50+ 空实现的占位符注册
- 注册顺序错误：自动映射先运行，然后 stub 覆盖了正确实现

**解决方案**：
- 删除 `src/games/smashup/abilities/podStubs.ts` 文件
- 从 `index.ts` 移除 `initPodStubRegistrations()` 调用
- 保留唯一的显式覆盖：`zombie_overrun_pod`

**结果**：72 个 POD 版本的 trigger/restriction/protection 自动映射成功

**文档**：`docs/refactor/pod-stub-cleanup.md`

---

### 6. ninja_acolyte_pod 数据定义不一致（已修复 ✅）

**问题**：POD 版本的 `abilityTags` 是 `['talent']`，基础版是 `['special']`，且缺少 `specialLimitGroup`

**根因**：手动维护 POD 数据时，字段值写错

**解决方案**：
- 修改 `src/games/smashup/data/factions/ninjas_pod.ts`
- 将 `abilityTags` 改为 `['special']`
- 添加 `specialLimitGroup: 'ninja_acolyte'`

**文档**：`docs/bugs/ninja-acolyte-pod-ability-tags-fix.md`

---

### 7. POD 数据一致性审计（新增工具 ✅）

**问题**：手动维护 POD 数据容易出错，需要自动化检查

**解决方案**：
- 创建 `scripts/audit-pod-data-consistency.mjs` 审计脚本
- 检查所有 POD 版本与基础版的数据定义是否一致
- 检查字段：power、abilityTags、specialLimitGroup、beforeScoringPlayable、ongoingTarget、subtype

**运行**：
```bash
node scripts/audit-pod-data-consistency.mjs
```

**结果**：检查 70 张 POD 卡牌，所有数据一致 ✅

**文档**：`docs/refactor/pod-system-architecture.md`

---

### 8. 力量修正 POD 版本重复调用（已修复 ✅）

**问题**：`steampunk_steam_man_pod`（蒸汽人 POD 版本）在基地有行动卡时，力量修正为 +2 而不是 +1

**根因**：
- 力量修正系统存在两种设计模式混用：
  - 模式 1：修正函数内部处理 POD（`baseId = defId.replace(/_pod$/, '')`）
  - 模式 2：依赖 POD 别名系统（精确匹配 + 自动映射）
- POD 别名系统为已内置 POD 支持的函数创建了重复注册，导致同一个函数被调用两次

**解决方案**：
- 在注册层标记已内置 POD 支持的修正函数：`{ handlesPodInternally: true }`
- POD 别名系统跳过已标记的函数
- 影响的修正函数：
  - `dino_armor_stego`（重装剑龙）
  - `dino_war_raptor`（战争猛禄龙）
  - `robot_microbot_alpha`（微型机阿尔法号）
  - `steampunk_steam_man`（蒸汽人）

**结果**：
- 自动映射 12 个 POD 版本的力量修正
- 跳过 4 个已内置 POD 支持的修正
- 所有力量修正值正确 ✅

**文档**：`docs/bugs/power-modifier-pod-duplicate-fix.md`

---

## POD 系统架构总结

### 数据层：完整定义，不继承

**原则**：POD 版本的卡牌数据必须完整定义所有字段，不自动继承基础版

**原因**：
- POD 版本可能与基础版卡名相同但效果完全不同
- 无法自动判断哪些字段应该继承，哪些不应该
- 完整定义更清晰、更易维护

### 能力层：自动映射 + 选择性覆盖

**原则**：POD 版本的能力注册自动从基础版复制，除非显式覆盖

**原因**：
- 大部分 POD 卡与基础版能力相同，自动映射避免代码重复
- 能力注册按 `defId` 索引，可以精确控制是否覆盖
- 符合 DRY 原则，减少维护成本

### 为什么不统一？

**数据层不能自动映射**：
- POD 版本可能与基础版卡名相同但效果完全不同
- 无法判断哪些字段应该继承（power? abilityTags? specialLimitGroup?）
- 完整定义避免歧义

**能力层可以自动映射**：
- 能力注册按 `defId` 索引，可以精确控制
- 90% 的 POD 卡能力相同 → 自动映射
- 10% 的 POD 卡能力不同 → 显式注册覆盖

## 相关文档

### 核心文档
- `docs/refactor/pod-system-architecture.md` - **POD 系统架构与最佳实践（必读）**
- `docs/refactor/pod-auto-mapping.md` - POD 能力自动映射系统设计
- `docs/refactor/pod-stub-cleanup.md` - POD stub 清理

### Bug 修复记录
- `docs/bugs/ninja-acolyte-pod-ability-tags-fix.md` - Ninja Acolyte 数据不一致修复
- `docs/bugs/power-modifier-pod-duplicate-fix.md` - 力量修正 POD 版本重复调用修复

### 工具
- `scripts/audit-pod-data-consistency.mjs` - 数据一致性审计脚本

## 测试覆盖

- ✅ `src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` - 侦察兵 POD 版本 afterScoring 测试
- ✅ `src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts` - 侦察兵不重复触发测试
- ✅ `src/games/smashup/__tests__/ninja-acolyte-pod-consistency.test.ts` - Ninja Acolyte 数据一致性测试
- ✅ `src/games/smashup/__tests__/steampunk-aggromotive-fix.test.ts` - 蒸汽机车和蒸汽人力量修正测试（包含 POD 版本）

## 教训

1. **自动映射只适用于能力层**：数据层必须完整定义，不能自动继承
2. **不可变更新原则**：禁止直接修改 `state.sys` 属性和数组
3. **占位符必须删除**：空实现的占位符会阻塞自动映射
4. **手动维护需要审计**：创建审计脚本自动检查数据一致性
5. **调用链全面检查**：修 bug 时必须检查整条调用链（存在性、契约、返回值）
6. **证据链优先**：不要乱猜，用户反馈默认就是 bug，立即全链路排查
7. **混用设计模式容易出 bug**：两种模式（内置 POD 支持 vs 外部 POD 别名）混用导致重复调用
8. **显式声明优于隐式行为**：`handlesPodInternally: true` 明确表达设计意图，避免混淆
9. **问题应在源头解决**：在注册层解决问题，而不是在计算层打补丁

## 百游戏自检

✅ **反思是通用处理吗？**
- POD 自动映射系统：通用，适用于所有 POD 版本
- 不可变更新修复：通用，适用于所有状态更新
- 数据一致性审计：通用，适用于所有 POD 卡牌

✅ **配置是否显式声明？**
- 自动映射在控制台输出映射数量
- 审计脚本输出检查结果

✅ **是否提供了智能默认值？**
- 90% POD 卡牌使用自动映射
- 10% 可显式覆盖

✅ **新增游戏需要写多少行代码？**
- POD 卡牌能力：0 行（自动映射）
- POD 卡牌数据：完整定义（必须）
