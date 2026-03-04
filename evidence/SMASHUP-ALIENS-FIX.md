# 外星人派系卡牌数量修复

## 问题发现

用户指出外星人派系的卡牌数量与实际牌组不符：
- **麦田怪圈（Crop Circles）**：实际应该是 1 张，代码中错误地设置为 2 张
- **分解者（Disintegrator）**：实际应该是 2 张，代码中错误地设置为 1 张

## Wiki 验证

根据 [Smash Up Wiki](https://smashup.fandom.com/wiki/Collector) 的官方描述：

**外星人派系行动卡（10 张）**：
- Abduction (1x) - 绑架
- Beam Up (2x) - 光束捕捉
- **Crop Circles (1x)** - 麦田怪圈 ✅
- **Disintegrator (2x)** - 分解者 ✅
- Invasion (1x) - 入侵
- Jammed Signal (1x) - 糟糕的信号
- Probe (1x) - 探究
- Terraforming (1x) - 适居化

## 修复内容

### 文件：`src/games/smashup/data/factions/aliens.ts`

1. **麦田怪圈（Crop Circles）**：`count: 2` → `count: 1`
2. **分解者（Disintegrator）**：`count: 1` → `count: 2`
3. **光束捕捉（Beam Up）**：确认 `count: 2` ✅
4. **糟糕的信号（Jammed Signal）**：`count: 2` → `count: 1`

### 修复后的卡牌总数

**随从（10 张）**：
- Supreme Overlord (1x) - 外星霸主
- Invader (2x) - 侵略者
- Scout (3x) - 侦察兵
- Collector (4x) - 收集者

总计：1 + 2 + 3 + 4 = 10 ✅

**行动（10 张）**：
- Invasion (1x) - 入侵
- Disintegrator (2x) - 分解者 ✅ 修复
- Beam Up (2x) - 光束捕捉
- Probe (1x) - 探究
- Crop Circles (1x) - 麦田怪圈 ✅ 修复
- Terraforming (1x) - 适居化
- Abduction (1x) - 绑架
- Jammed Signal (1x) - 糟糕的信号 ✅ 修复

总计：1 + 2 + 2 + 1 + 1 + 1 + 1 + 1 = 10 ✅

**派系总计**：10 + 10 = 20 ✅

## 建议后续行动

### 优先级 1：系统性审查所有派系

建议对所有已实现的派系进行系统性审查，确保每张卡的数量与 Wiki 一致：

1. **核心版（8 个派系）**：
   - ✅ Aliens（外星人）- 已修复
   - ⚠️ Dinosaurs（恐龙）- 待审查
   - ⚠️ Ninjas（忍者）- 待审查
   - ⚠️ Pirates（海盗）- 待审查
   - ⚠️ Robots（机器人）- 待审查
   - ⚠️ Tricksters（捣蛋鬼）- 待审查
   - ⚠️ Wizards（巫师）- 待审查
   - ⚠️ Zombies（丧尸）- 待审查

2. **Awesome Level 9000（4 个派系）**：
   - ⚠️ Bear Cavalry（熊骑兵）- 待审查
   - ⚠️ Ghosts（幽灵）- 待审查
   - ⚠️ Killer Plants（食人花）- 待审查
   - ⚠️ Steampunks（蒸汽朋克）- 待审查

3. **The Obligatory Cthulhu Set（4 个派系）**：
   - ⚠️ Elder Things（远古物种）- 待审查
   - ⚠️ Innsmouth（印斯茅斯）- 待审查
   - ⚠️ Minions of Cthulhu（克苏鲁仆从）- 待审查
   - ⚠️ Miskatonic University（米斯卡塔尼克）- 待审查

4. **Monster Smash（4 个派系）**：
   - ⚠️ Giant Ants（巨蚁）- 待审查
   - ⚠️ Vampires（吸血鬼）- 待审查
   - ⚠️ Werewolves（狼人）- 待审查
   - ⚠️ Frankenstein（科学怪人）- 待审查（Wiki 中未找到对应派系）

### 优先级 2：建立自动化验证

建议创建自动化测试，验证每个派系的卡牌总数：

```typescript
describe('Faction Card Count Validation', () => {
  it('should have exactly 20 cards per faction', () => {
    const factions = [
      ALIEN_CARDS,
      PIRATE_CARDS,
      NINJA_CARDS,
      // ... 其他派系
    ];
    
    factions.forEach((factionCards, index) => {
      const totalCount = factionCards.reduce((sum, card) => sum + card.count, 0);
      expect(totalCount).toBe(20);
    });
  });
});
```

### 优先级 3：Wiki 数据源

建议参考以下 Wiki 页面进行验证：
- 派系总览：https://smashup.fandom.com/wiki/Category:Factions
- 各派系详细页面：https://smashup.fandom.com/wiki/{FactionName}
- Smash Up Randomizer（第三方工具，数据准确）：https://smash-up-randomizer.com/

## 教训

1. **不能假设卡牌数量**：即使是同类型的卡牌，数量也可能不同（如 Disintegrator 2 张，Crop Circles 1 张）
2. **必须逐张核对**：不能只验证总数，必须核对每张卡的具体数量
3. **Wiki 是权威来源**：实体卡牌和 Wiki 是最可靠的数据源
4. **用户反馈很重要**：实际玩家最清楚卡牌配置

## 相关文件

- 修复文件：`src/games/smashup/data/factions/aliens.ts`
- 核对报告：`SMASHUP-CARD-COUNT-AUDIT.md`
- Wiki 参考：https://smashup.fandom.com/wiki/Aliens
