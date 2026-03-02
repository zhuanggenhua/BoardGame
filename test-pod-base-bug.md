# POD 派系基地补充 Bug 分析

## 问题复现

**场景**：选择 `wizards` + `ninjas_pod`

### 执行流程

1. **派系选择完成** (`ALL_FACTIONS_SELECTED`)
   ```typescript
   selectedFactions = ['wizards', 'ninjas_pod']
   ```

2. **基地池构建** (`getBaseDefIdsForFactions`)
   - `matched` = 2 个巫师基地（`base_great_library`, `base_wizard_academy`）
   - `factionsWithoutBases` = `['ninjas_pod']`
   - `supplementBases` = 前 2 个可用基地（例如 `base_the_homeworld`, `base_the_mothership`）
   - **返回**: 4 个基地

3. **基地分配** (`reducer.ts`)
   - `shuffledBasePool` = 洗牌后的 4 个基地
   - `activeBases` = 前 3 个基地放场上
   - `baseDeck` = **剩余 1 个基地**

4. **巫师学院计分** (`base_wizard_academy afterScoring`)
   - `baseDeck.length` = 1
   - `topCount` = Math.min(3, 1) = 1
   - `options.length` = 1
   - **结果**: 只显示 1 个选项

## 根本问题

POD 派系补充逻辑按"每个派系 2 个基地"计算，但没有考虑：
- 2 人游戏需要 3 个基地在场上
- 基地牌库需要足够的牌供后续替换

## 正确的补充逻辑

应该补充足够的基地，确保基地牌库有合理数量：
- 2 人游戏：场上 3 个 + 牌库至少 5 个 = 至少 8 个基地
- 每个派系 2 个基地 × 2 个派系 = 4 个基地（不够！）

## 修复方案

选项 1：为 POD 派系配置专属基地（数据层）
选项 2：补充逻辑改为"确保总数至少 8 个基地"（运行时）
