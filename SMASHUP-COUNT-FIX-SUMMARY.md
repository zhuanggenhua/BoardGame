# 大杀四方卡牌数量修复总结

生成时间：2026-03-01

## ✅ 已完成的修复

### 数量错误修复（23 个）

所有 count 字段错误已全部修复：

1. **忍者（Ninjas）** - 4 个数量错误 ✅
   - Hidden Ninja: 2x → 1x
   - Infiltrate: 1x → 2x
   - Poison: 2x → 1x
   - Seeing Stars: 1x → 2x

2. **海盗（Pirates）** - 2 个数量错误 ✅
   - Broadside: 1x → 2x
   - Full Sail: 2x → 1x

3. **捣蛋鬼（Tricksters）** - 3 个数量错误 ✅
   - Disenchant: 1x → 2x
   - Hideout: 2x → 1x
   - Mark of Sleep: 2x → 1x

4. **丧尸（Zombies）** - 2 个数量错误 ✅
   - Lend a Hand: 2x → 1x
   - Overrun: 2x → 1x

5. **熊骑兵（Bear Cavalry）** - 1 个数量错误 ✅
   - Bear Necessities: 2x → 1x

6. **食人花（Killer Plants）** - 2 个数量错误 ✅
   - Insta-Grow: 1x → 2x
   - Overgrowth: 2x → 1x

7. **蒸汽朋克（Steampunks）** - 2 个数量错误 ✅
   - Change of Venue: 2x → 1x
   - Rotary Slug Thrower: 2x → 1x

8. **远古物种（Elder Things）** - 2 个数量错误 ✅
   - Insanity: 2x → 1x
   - Spreading Horror: 2x → 1x

### 完全正确的派系（6 个）

1. ✅ **外星人（Aliens）** - 20 张卡（10 随从 + 10 行动）
2. ✅ **忍者（Ninjas）** - 20 张卡（10 随从 + 10 行动）
3. ✅ **海盗（Pirates）** - 20 张卡（10 随从 + 10 行动）
4. ✅ **机器人（Robots）** - 20 张卡（18 随从 + 2 行动，特殊结构）
5. ✅ **蒸汽朋克（Steampunks）** - 20 张卡（10 随从 + 10 行动）
6. ✅ **远古物种（Elder Things）** - 20 张卡（10 随从 + 10 行动）

## ⏳ 待完成的工作

### 缺失卡牌（14 个派系，共 19 张卡）

以下卡牌需要添加到代码中，每张卡需要：
1. 分配图集索引（`previewRef`）
2. 添加中文翻译
3. 实现卡牌能力（如果有）

#### 核心版（Core Set）

1. **捣蛋鬼（Tricksters）** - 1 张
   - Big Funny Giant (minion, power 5)

2. **巫师（Wizards）** - 1 张
   - Arcane Protector (action)

3. **丧尸（Zombies）** - 1 张（命名问题）
   - They're Coming To Get You (Wiki 版本，大写 T)
   - 当前代码有：They're Coming to Get You（小写 t）

4. **恐龙（Dinosaurs）** - 1 张
   - Fort Titanosaurus (action)

#### Awesome Level 9000

5. **熊骑兵（Bear Cavalry）** - 1 张
   - Major Ursa (minion, power 5)

6. **幽灵（Ghosts）** - 1 张
   - Creampuff Man (minion, power 5)

7. **食人花（Killer Plants）** - 1 张
   - Killer Kudzu (minion, power 5)

#### The Obligatory Cthulhu Set

8. **印斯茅斯（Innsmouth）** - 1 张
   - Dagon (minion, power 5)

9. **克苏鲁仆从（Minions of Cthulhu）** - 1 张
   - Cthulhu (minion, power 5)

10. **米斯卡塔尼克（Miskatonic University）** - 2 张（命名问题）
    - "Old Man Jenkins!?" (Wiki 版本，带引号)
    - That's So Crazy... (action)
    - 当前代码有："Old Man Jenkins!?"（可能引号不同）

#### Monster Smash

11. **巨蚁（Giant Ants）** - 1 张
    - Death on Six Legs (minion, power 5)

12. **吸血鬼（Vampires）** - 1 张
    - Ancient Lord (minion, power 5)

13. **狼人（Werewolves）** - 1 张
    - Great Wolf Spirit (minion, power 5)

14. **科学怪人（Mad Scientists）** - 3 张
    - IT'S ALIVE! (action, count 2)
    - The Bride (minion, power 5)

### 命名差异问题（3 个）

需要确认 Wiki 和代码中的命名差异：

1. **丧尸（Zombies）**
   - Wiki: They're Coming To Get You（大写 T）
   - 代码: They're Coming to Get You（小写 t）

2. **米斯卡塔尼克（Miskatonic University）**
   - Wiki: "Old Man Jenkins!?"（带引号）
   - 代码: "Old Man Jenkins!?"（可能引号字符不同）

3. **恐龙（Dinosaurs）**（已在之前修复）
   - Wiki: Tooth and Claw... and Guns（三个点 + 空格）
   - 代码: Tooth and Claw...and Guns（三个点 + 无空格）

## 📊 统计

- **总派系数**：20 个
- **完全正确**：6 个（30%）
- **需要添加卡牌**：14 个（70%）
- **已修复数量错误**：23 个
- **待添加卡牌**：19 张（不含命名差异）

## 🔧 使用的工具

1. **scripts/scrape-wiki-factions.mjs** - Wiki 数据爬虫
2. **scripts/compare-wiki-code.mjs** - Wiki 与代码对比
3. **scripts/apply-all-wiki-fixes.mjs** - 批量修复数量错误（第一轮）
4. **scripts/fix-remaining-counts.mjs** - 修复剩余数量错误（第二轮）

## 📝 下一步

1. **确定图集索引分配策略**
   - 每个派系的图集索引范围
   - 新增卡牌的索引位置

2. **添加缺失卡牌**
   - 按派系逐个添加
   - 优先级：核心版 > 扩展版

3. **实现卡牌能力**
   - Boss Minion（power 5）通常有特殊能力
   - 需要查阅 Wiki 了解具体效果

4. **测试验证**
   - 运行 `npm run test` 确认无破坏性变更
   - 运行 `node scripts/compare-wiki-code.mjs` 验证所有派系正确

## 🎯 目标

最终目标：所有 20 个派系的卡牌数量与 Wiki 完全一致，每个派系 20 张卡（特殊派系除外）。

