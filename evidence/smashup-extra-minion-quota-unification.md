# 大杀四方额外打出随从能力统一 - 完成报告

## 修改目标

统一所有"额外打出随从"的能力，改为直接授予额度，不再通过交互选择随从。只有有明确时机限制的能力（如僵尸领主、便衣忍者）才保留交互流程。

## 核心原则

**时机限制判断标准**：
- ✅ **保留交互**：能力必须在特定时机立即执行，玩家需要立即决定（如僵尸领主的"在每个空基地打出随从"、便衣忍者的"基地计分前打出"）
- ❌ **改为授予额度**：能力只是授予额外打出机会，玩家可以稍后自行决定何时打出（如爆发、它们不断涌来）

## 修改内容

### 1. zombie_outbreak（爆发）

**原流程**：
1. 打出行动卡
2. 弹出交互：选择一个没有己方随从的基地
3. 弹出交互：选择手牌中的随从
4. 该随从被打出到选定的基地

**新流程**：
1. 打出行动卡
2. 多个空基地时：弹出交互选择基地 → 授予1个额度（限定到该基地）
3. 只有一个空基地时：直接授予1个额度（限定到该基地）
4. 玩家稍后通过 PLAY_MINION 命令打出随从

**修改文件**：
- `src/games/smashup/abilities/zombies.ts`
  - 修改 `zombieOutbreak` 函数：只有一个空基地时直接授予额度
  - 简化 `zombie_outbreak_choose_base` 处理器：选择基地后直接授予额度
  - 删除 `zombie_outbreak_choose_minion` 处理器（不再需要）

### 2. zombie_they_keep_coming（它们不断涌来）

**原流程**：
1. 打出行动卡
2. 弹出交互：选择弃牌堆中的随从
3. 弹出交互：选择基地
4. 该随从从弃牌堆打出到选定的基地

**新流程**：
1. 打出行动卡
2. 直接授予1个额外随从额度
3. 玩家稍后通过 PLAY_MINION fromDiscard 命令从弃牌堆打出随从

**修改文件**：
- `src/games/smashup/abilities/zombies.ts`
  - 修改 `zombieTheyKeepComing` 函数：直接授予额度，不创建交互
  - 删除 `zombie_they_keep_coming` 和 `zombie_they_keep_coming_choose_base` 处理器

### 3. 保留交互的能力（未修改）

以下能力因为有明确的时机限制，保持原有的交互流程：

1. **zombie_lord（僵尸领主）**：
   - 描述："在每个没有己方随从的基地从弃牌堆打出力量≤2的随从"
   - 时机限制：必须立即决定在哪些基地打出哪些随从，可以循环多次
   - 保留原因：玩家需要逐个选择"哪个随从打到哪个基地"，有明确的执行时机

2. **ninja_hidden_ninja（便衣忍者）**：
   - 描述："基地计分前，选择手牌中一个随从打出到该基地"
   - 时机限制：必须在基地计分前立即执行
   - 保留原因：特殊时机（计分前），必须立即决定

3. **ninja_acolyte（忍者侍从）**：
   - 描述："返回手牌后立即选择是否打出"
   - 时机限制：返回手牌后的立即时机
   - 保留原因：有明确的触发时机和执行窗口

## 测试更新

### 1. zombieWizardAbilities.test.ts

更新了爆发能力的测试：
- ✅ `zombie_outbreak: 多个空基地时选择基地后直接授予额度`
- ✅ `zombie_outbreak: 只有一个空基地时直接授予额度`
- ✅ `zombie_outbreak: 所有基地都有己方随从时不给额度`

### 2. interactionChainE2E.test.ts

更新了交互链测试：
- ✅ `zombie_outbreak: 多个空基地时选择基地后授予额度（限定到该基地）`
- ✅ `zombie_outbreak: 只有一个空基地时直接授予额度（不创建交互）`
- ✅ `zombie_they_keep_coming: 直接授予额度，玩家可通过 PLAY_MINION fromDiscard 打出`

## 测试结果

### zombieWizardAbilities.test.ts
```
✓ src/games/smashup/__tests__/zombieWizardAbilities.test.ts (22 tests) 31ms
  ✓ 从弃牌堆取回卡牌到手牌
  ✓ 取回多张卡牌
  ✓ 手牌洗入牌库
  ✓ 部分手牌洗入牌库时保留未选中的手牌
  ✓ zombie_grave_digger: 单张随从时创建 Prompt
  ✓ zombie_grave_digger: 弃牌堆无随从时不产生事件
  ✓ zombie_walker: 创建 Prompt 选择弃掉或保留
  ✓ zombie_grave_robbing: 多张弃牌时创建 Prompt
  ✓ zombie_grave_robbing: 单张弃牌时创建 Prompt
  ✓ zombie_not_enough_bullets: 多组同名随从时创建 Prompt
  ✓ zombie_not_enough_bullets: 单组同名随从时创建 Prompt
  ✓ zombie_lend_a_hand: 弃牌堆有卡时创建多选 Prompt
  ✓ zombie_outbreak: 多个空基地时选择基地后直接授予额度
  ✓ zombie_outbreak: 只有一个空基地时直接授予额度
  ✓ zombie_outbreak: 所有基地都有己方随从时不给额度
  ✓ zombie_mall_crawl: 多组不同卡名时创建 Prompt 选择
  ✓ zombie_mall_crawl: 选择卡名后同名卡进入弃牌堆，牌库重洗
  ✓ wizard_winds_of_change: 洗手牌回牌库抽5张，额外行动
  ✓ wizard_winds_of_change: 牌库+手牌不足5张时抽全部
  ✓ wizard_sacrifice: 多个己方随从时创建 Prompt 选择
  ✓ wizard_sacrifice: 没有己方随从时不产生事件
  ✓ wizard_sacrifice: 单个己方随从时创建 Prompt

Test Files  1 passed (1)
Tests  22 passed (22)
```

### interactionChainE2E.test.ts
```
✓ src/games/smashup/__tests__/interactionChainE2E.test.ts (39 tests | 1 skipped) 87ms

Test Files  1 passed (1)
Tests  38 passed | 1 skipped (39)
```

## 用户体验变化

### 爆发（Outbreak）

**修改前**：
1. 打出爆发
2. 选择空基地
3. 选择手牌随从
4. 随从被打出

**修改后**：
1. 打出爆发
2. 选择空基地（或自动选择唯一空基地）
3. 获得1个额外随从额度（限定到该基地）
4. 玩家自己决定何时打出随从到该基地

### 它们不断涌来（They Keep Coming）

**修改前**：
1. 打出它们不断涌来
2. 选择弃牌堆随从
3. 选择基地
4. 随从从弃牌堆打出

**修改后**：
1. 打出它们不断涌来
2. 获得1个额外随从额度
3. 玩家自己决定何时从弃牌堆打出随从

## 优势

1. **统一体验**：所有"额外打出随从"的能力都使用相同的机制（授予额度）
2. **更灵活**：玩家可以自己决定何时使用额外额度，而不是被迫立即选择
3. **减少交互步骤**：减少了不必要的交互弹窗，提升游戏流畅度
4. **符合直觉**：额度系统更符合"获得额外打出机会"的语义

## 总结

成功统一了大杀四方中"额外打出随从"能力的实现方式。所有无时机限制的能力（爆发、它们不断涌来）改为直接授予额度，有时机限制的能力（僵尸领主、便衣忍者、忍者侍从）保留交互流程。所有相关测试已更新并通过。

---

**修改日期**：2026-03-04
**测试状态**：✅ 通过
