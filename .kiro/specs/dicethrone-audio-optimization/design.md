# 设计文档：DiceThrone 音效优化

## 概述

本设计文档基于已批准的需求文档，详细规划如何优化 DiceThrone 游戏的音效系统。核心目标是：
1. 为 CP（战斗点数）系统选择更合适的能量类音效
2. 为 Monk 技能选择拳脚风格的音效
3. 优化音效配置结构，提升可维护性

## 架构

### 音效资源来源

**音效列表文档**：`BordGameAsset/SoundEffect/音效列表_完整.md`
- 包含项目所有可用音效的完整清单
- 按类别组织（战斗/魔法/状态/UI 等）
- 提供音效文件名和路径信息
- 本设计中所有音效选择均基于此文档

### 当前架构分析

**配置文件**：`src/games/dicethrone/audio.config.ts`
- 使用 `GameAudioConfig` 类型定义音效配置
- 包含 `sounds`（音效资源）、`eventSoundMap`（事件映射）、`eventSoundResolver`（动态解析）三层结构
- 支持通过 `sfxKey` 在卡牌/技能定义中指定自定义音效

**技能定义**：`src/games/dicethrone/monk/abilities.ts`
- 使用 `AbilityDef` 类型定义技能
- 支持在技能或变体级别通过 `sfxKey` 字段指定音效
- 当前仅部分技能有自定义音效

**音效触发流程**：
1. 游戏事件触发 → `eventSoundMap` 查找默认音效
2. 若事件需要动态解析 → `eventSoundResolver` 处理
3. 若技能/卡牌有 `sfxKey` → 使用自定义音效，否则使用默认音效

### 设计决策

**决策 1：CP 音效替换策略**
- **问题**：当前 CP 增减使用 `Small_Coin_Drop_001.ogg`，听感偏向金币/货币，不符合"能量"概念
- **方案**：从音效列表中选择能量类音效，区分"获得"和"消耗"两种场景
- **理由**：能量类音效更符合战斗点数的概念定位，且能通过不同音效强化正负反馈

**决策 2：Monk 技能音效分级策略**
- **问题**：当前所有技能共用通用音效，缺乏个性化
- **方案**：为关键技能（终极技能、高伤害技能）配置专属音效，普通技能保持通用音效
- **理由**：平衡音效丰富度与配置复杂度，避免过度配置

**决策 3：音效配置组织方式**
- **问题**：当前所有音效平铺在 `sounds` 对象中，缺乏分类
- **方案**：保持现有结构（已通过 `category` 字段分类），仅更新音效资源路径
- **理由**：现有结构已足够清晰，避免破坏性重构

**决策 4：音效获取和分类的通用性设计（跨游戏复用）**
- **问题**：音效选择和分类逻辑当前耦合在 DiceThrone 配置中，其他游戏难以复用
- **方案**：建立通用的音效分类体系和选择指南，支持跨游戏复用
- **理由**：项目包含多个游戏，统一的音效管理可提升开发效率和用户体验一致性

### 通用音效分类体系设计

为支持跨游戏复用，建立以下通用音效分类体系：

#### 分类维度

**主分类（category.group）**：
- `dice` - 骰子相关（掷骰、锁定、确认）
- `card` - 卡牌相关（抽牌、打出、弃牌、洗牌）
- `combat` - 战斗相关（攻击、防御、伤害、格挡）
- `token` - 标记/资源相关（获得、使用、转换）
- `status` - 状态效果相关（增益、减益、治疗、护盾）
- `ui` - 界面交互（点击、悬停、确认、取消）
- `system` - 系统事件（回合变化、阶段变化、资源变化）
- `stinger` - 结果音效（胜利、失败、达成）
- `magic` - 魔法效果（施法、充能、爆发）
- `weapon` - 武器音效（挥砍、射击、装填）

**子分类（category.sub）**：
- 根据主分类细化，如 `combat.punch`、`combat.kick`、`combat.hit`
- 支持游戏特定子分类，如 `system.cp_gain`、`system.taiji_gain`

#### 音效选择指南

**能量/资源类音效**：
- **获得/充能**：使用 `Charged_A.ogg`、`Magic_Spell_Buff_Positive_A.ogg` 等正向音效
- **消耗/释放**：使用 `Purged_A.ogg`、`Magic_Spell_Buff_Negative_A.ogg` 等负向音效
- **适用场景**：CP、法力值、能量条、充能标记等抽象资源

**物理货币类音效**：
- **获得**：使用 `Small_Coin_Drop_001.ogg`、`Small_Reward_001.ogg` 等金币音效
- **消耗**：使用相同音效（金币音效通常不区分正负）
- **适用场景**：金币、宝石、商店购买等具象货币

**战斗类音效**：
- **轻攻击**：`WHSH_Punch_Whooosh_01.ogg`、`SFX_Weapon_Melee_Swoosh_Small_1.ogg`
- **重攻击**：`FGHTImpt_Special_Hit_01.ogg`、`FGHTImpt_Versatile_Punch_Hit_02.ogg`
- **连击**：`SFX_Fight_Kick_Swoosh_2.ogg`、快速音效序列
- **终极技能**：`FGHTImpt_Special_Hit_02.ogg`、高音量高冲击力音效
- **适用场景**：所有战斗类游戏的攻击/技能系统

**状态效果类音效**：
- **增益**：`Charged_A.ogg`、`Ready_A.ogg`、`Healed_A.ogg`
- **减益**：`Purged_A.ogg`、`Poisoned_A.ogg`
- **护盾**：`Water_Shield.ogg`、`Shield_Impact_A.ogg`
- **适用场景**：Buff/Debuff 系统、状态效果管理

#### 通用音效配置模板

为新游戏提供配置模板，减少重复工作：

```typescript
// src/lib/audio/templates/commonSounds.ts（建议新增）
export const COMMON_SOUND_TEMPLATES = {
  // 资源系统音效模板
  resource: {
    energy_gain: { src: 'status/compressed/Charged_A.ogg', volume: 0.6, category: { group: 'system', sub: 'resource_gain' } },
    energy_spend: { src: 'status/compressed/Purged_A.ogg', volume: 0.5, category: { group: 'system', sub: 'resource_spend' } },
    coin_gain: { src: 'card/compressed/Small_Coin_Drop_001.ogg', volume: 0.7, category: { group: 'system', sub: 'coin_gain' } },
    coin_spend: { src: 'card/compressed/Small_Coin_Drop_001.ogg', volume: 0.7, category: { group: 'system', sub: 'coin_spend' } },
  },
  
  // 战斗系统音效模板
  combat: {
    light_attack: { src: 'fight/compressed/WHSH_Punch_Whooosh_01.ogg', volume: 0.8, category: { group: 'combat', sub: 'light' } },
    heavy_attack: { src: 'fight/compressed/FGHTImpt_Special_Hit_01.ogg', volume: 0.9, category: { group: 'combat', sub: 'heavy' } },
    ultimate: { src: 'fight/compressed/FGHTImpt_Special_Hit_02.ogg', volume: 1.0, category: { group: 'combat', sub: 'ultimate' } },
    hit: { src: 'fight/compressed/FGHTImpt_Versatile_Punch_Hit_01.ogg', volume: 0.9, category: { group: 'combat', sub: 'hit' } },
    block: { src: 'fight/compressed/Shield_Impact_A.ogg', volume: 0.75, category: { group: 'combat', sub: 'block' } },
  },
  
  // 状态效果音效模板
  status: {
    buff_apply: { src: 'status/compressed/Charged_A.ogg', volume: 0.6, category: { group: 'status', sub: 'buff' } },
    debuff_apply: { src: 'status/compressed/Purged_A.ogg', volume: 0.5, category: { group: 'status', sub: 'debuff' } },
    heal: { src: 'status/compressed/Healed_A.ogg', volume: 0.7, category: { group: 'status', sub: 'heal' } },
    shield: { src: 'status/compressed/Water_Shield.ogg', volume: 0.75, category: { group: 'status', sub: 'shield' } },
  },
  
  // UI 交互音效模板
  ui: {
    click: { src: 'ui/compressed/UIClick_Accept_Button_01.ogg', volume: 0.4, category: { group: 'ui', sub: 'click' } },
    hover: { src: 'ui/compressed/UIClick_Mouseover_Dialog_Option_01.ogg', volume: 0.2, category: { group: 'ui', sub: 'hover' } },
    confirm: { src: 'ui/compressed/Signal_Positive_Spring_A.ogg', volume: 0.5, category: { group: 'ui', sub: 'confirm' } },
    cancel: { src: 'ui/compressed/Signal_Negative_Wood_Chimes_A.ogg', volume: 0.5, category: { group: 'ui', sub: 'cancel' } },
  },
};
```

#### 使用方式

新游戏可直接引用模板，减少配置工作：

```typescript
// src/games/newgame/audio.config.ts
import { COMMON_SOUND_TEMPLATES } from '../../lib/audio/templates/commonSounds';

export const NEWGAME_AUDIO_CONFIG: GameAudioConfig = {
  basePath: 'newgame/audio',
  sounds: {
    // 复用通用模板
    ...COMMON_SOUND_TEMPLATES.resource,
    ...COMMON_SOUND_TEMPLATES.combat,
    ...COMMON_SOUND_TEMPLATES.ui,
    
    // 游戏特定音效
    special_ability: { src: 'custom/special.ogg', volume: 0.8, category: { group: 'combat', sub: 'special' } },
  },
  // ... 其他配置
};
```

#### 通用性设计的好处

1. **开发效率**：新游戏可快速复用成熟的音效配置，减少选择和测试时间
2. **用户体验一致性**：相似的游戏机制使用相同的音效，降低学习成本
3. **维护成本**：统一的分类体系便于管理和更新音效资源
4. **扩展性**：模板化设计支持灵活扩展和覆盖，不限制游戏特色

#### 实施计划

1. **本次优化**：在 DiceThrone 中应用新的音效选择逻辑，验证分类体系
2. **后续工作**：提取通用模板到 `src/lib/audio/templates/`，供其他游戏使用
3. **文档化**：在 `docs/audio-guide.md` 中记录音效选择指南和分类规范

## 组件和接口

### 音效资源选择

#### CP 音效方案

基于音效列表分析，推荐以下方案：

**方案 A：能量充能/释放风格（推荐）**
```typescript
// CP 获得：能量充能音效
cp_gain: { 
  src: 'status/compressed/Charged_A.ogg',  // 充能音效，正向反馈
  volume: 0.6, 
  category: { group: 'system', sub: 'cp_gain' } 
}

// CP 消耗：能量释放音效
cp_spend: { 
  src: 'status/compressed/Purged_A.ogg',  // 净化/释放音效，消耗感
  volume: 0.5, 
  category: { group: 'system', sub: 'cp_spend' } 
}
```

**方案 B：魔法能量风格（备选）**
```typescript
// CP 获得：魔法充能
cp_gain: { 
  src: 'magic/compressed/Magic_Spell_Buff_Positive_A.ogg',
  volume: 0.6, 
  category: { group: 'system', sub: 'cp_gain' } 
}

// CP 消耗：魔法释放
cp_spend: { 
  src: 'magic/compressed/Magic_Spell_Buff_Negative_A.ogg',
  volume: 0.5, 
  category: { group: 'system', sub: 'cp_spend' } 
}
```

**最正确方案：方案 A（能量充能/释放风格）**

**理由**：
1. **架构正确性**：`Charged_A` 和 `Purged_A` 已在项目中用于状态效果，语义明确且一致
2. **可维护性**：复用现有音效资源，减少资源管理复杂度
3. **用户体验**：充能/净化音效对比度强，正负反馈清晰
4. **风险最低**：无需引入新音效文件，避免资源冲突

#### Monk 技能音效方案

基于技能特性和音效列表，推荐以下配置：

**终极技能：超凡入圣 (Transcendence)**
```typescript
// 技能定义中添加
sfxKey: 'transcendence_ultimate'

// audio.config.ts 中添加
transcendence_ultimate: { 
  src: 'fight/compressed/FGHTImpt_Special_Hit_02.ogg',  // 特殊重击音效
  volume: 1.0, 
  category: { group: 'combat', sub: 'ultimate' } 
}
```

**高伤害技能：雷霆一击 (Thunder Strike)**
```typescript
// 技能定义中添加
sfxKey: 'thunder_strike'

// audio.config.ts 中添加
thunder_strike: { 
  src: 'fight/compressed/FGHTImpt_Versatile_Punch_Hit_02.ogg',  // 多功能拳击重击
  volume: 0.9, 
  category: { group: 'combat', sub: 'heavy_attack' } 
}
```

**连击技能：太极连击 (Taiji Combo)**
```typescript
// 技能定义中添加
sfxKey: 'taiji_combo'

// audio.config.ts 中添加
taiji_combo: { 
  src: 'fight/compressed/SFX_Fight_Kick_Swoosh_2.ogg',  // 踢击呼啸音效
  volume: 0.85, 
  category: { group: 'combat', sub: 'combo' } 
}
```

**其他技能**：保持使用默认 `ability_activate` 音效，避免过度配置

### 配置结构更新

#### 音效资源定义

在 `audio.config.ts` 的 `sounds` 对象中更新/新增以下条目：

```typescript
sounds: {
  // ... 现有音效 ...
  
  // ============ CP 系统音效（更新）============
  cp_gain: { 
    src: 'status/compressed/Charged_A.ogg', 
    volume: 0.6, 
    category: { group: 'system', sub: 'cp_gain' } 
  },
  cp_spend: { 
    src: 'status/compressed/Purged_A.ogg', 
    volume: 0.5, 
    category: { group: 'system', sub: 'cp_spend' } 
  },
  
  // ============ Monk 技能音效（新增）============
  transcendence_ultimate: { 
    src: 'fight/compressed/FGHTImpt_Special_Hit_02.ogg', 
    volume: 1.0, 
    category: { group: 'combat', sub: 'ultimate' } 
  },
  thunder_strike: { 
    src: 'fight/compressed/FGHTImpt_Versatile_Punch_Hit_02.ogg', 
    volume: 0.9, 
    category: { group: 'combat', sub: 'heavy_attack' } 
  },
  taiji_combo: { 
    src: 'fight/compressed/SFX_Fight_Kick_Swoosh_2.ogg', 
    volume: 0.85, 
    category: { group: 'combat', sub: 'combo' } 
  },
}
```

#### 技能定义更新

在 `monk/abilities.ts` 中为关键技能添加 `sfxKey`：

```typescript
// 超凡入圣
{
  id: 'transcendence',
  name: abilityText('transcendence', 'name'),
  type: 'offensive',
  description: abilityText('transcendence', 'description'),
  tags: ['ultimate'],
  sfxKey: 'transcendence_ultimate',  // 新增
  trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.LOTUS]: 5 } },
  // ... effects ...
}

// 雷霆一击
{
  id: 'thunder-strike',
  name: abilityText('thunder-strike', 'name'),
  type: 'offensive',
  description: abilityText('thunder-strike', 'description'),
  sfxKey: 'thunder_strike',  // 新增
  trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.PALM]: 3 } },
  // ... effects ...
}

// 太极连击
{
  id: 'taiji-combo',
  name: abilityText('taiji-combo', 'name'),
  type: 'offensive',
  description: abilityText('taiji-combo', 'description'),
  sfxKey: 'taiji_combo',  // 新增
  trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 3, [DICE_FACE_IDS.PALM]: 1 } },
  // ... effects ...
}
```

## 数据模型

### 音效配置类型

现有类型定义已足够支持本次优化，无需修改：

```typescript
// src/lib/audio/types.ts（无需修改）
interface SoundConfig {
  src: string;           // 音效文件路径
  volume: number;        // 音量（0-1）
  category: {            // 分类标签
    group: string;       // 主分类
    sub: string;         // 子分类
  };
}

interface GameAudioConfig {
  basePath: string;                          // 资源基础路径
  sounds: Record<string, SoundConfig>;       // 音效资源映射
  eventSoundMap: Record<string, string>;     // 事件到音效的静态映射
  eventSoundResolver?: (event, context) => string | null | undefined;  // 动态解析
  // ... 其他字段 ...
}
```

### 技能定义类型

现有类型定义已支持 `sfxKey` 字段，无需修改：

```typescript
// src/systems/presets/combat.ts（无需修改）
interface AbilityDef {
  id: string;
  name: string;
  type: 'offensive' | 'defensive';
  description: string;
  sfxKey?: string;  // 可选的自定义音效键
  // ... 其他字段 ...
}
```

## 正确性属性

### 属性反思

在将接受标准转换为正确性属性之前，我需要识别并消除冗余：

**可测试属性清单**：
1. CP 增加时播放 cp_gain 音效（1.1）
2. CP 减少时播放 cp_spend 音效（1.2）
3. 超凡入圣技能播放 transcendence_ultimate 音效（2.1）
4. 雷霆一击技能播放 thunder_strike 音效（2.2）
5. 太极连击技能播放 taiji_combo 音效（2.3）
6. 其他 Monk 技能播放默认音效（2.4）
7. 所有音效资源路径有效（3.1）
8. 技能 sfxKey 引用存在于配置中（3.2）
9. 音效分类标签符合规范（3.3）
10. 音效音量在合理范围（3.4）

**冗余分析**：
- **属性 1 和 2** 可以合并为一个综合属性："CP 变化事件根据正负值触发正确音效"
- **属性 3、4、5、6** 可以合并为一个综合属性："技能激活事件根据技能配置触发正确音效"
- **属性 7、8、9、10** 都是配置完整性检查，可以合并为一个综合属性："音效配置结构完整且有效"

**合并后的属性**：
1. CP 变化音效正确性（合并 1.1、1.2）
2. 技能音效正确性（合并 2.1、2.2、2.3、2.4）
3. 配置完整性（合并 3.1、3.2、3.3、3.4）

这样可以减少冗余，同时保持全面的验证覆盖。

### 正确性属性定义

*属性是一种特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

**属性 1：CP 变化音效正确性**

*对于任意* CP 变化事件，当 CP 增加时应触发 'cp_gain' 音效且该音效指向能量充能类资源，当 CP 减少时应触发 'cp_spend' 音效且该音效指向能量释放类资源。

**验证：需求 1.1、1.2**

**属性 2：技能音效正确性**

*对于任意* Monk 技能激活事件，当技能定义包含 sfxKey 时应触发对应的自定义音效，当技能定义不包含 sfxKey 时应触发默认的 'ability_activate' 音效。

**验证：需求 2.1、2.2、2.3、2.4**

**属性 3：配置完整性**

*对于任意* 音效配置项，应满足以下条件：
1. 音效资源路径指向的文件存在且可访问
2. 技能定义中的 sfxKey 引用在配置中存在
3. 音效分类标签符合既定规范（group 和 sub 值在允许范围内）
4. 音效音量值在 0 到 1 之间

**验证：需求 3.1、3.2、3.3、3.4**

## 错误处理

### 音效资源缺失

**场景**：配置中引用的音效文件不存在

**处理策略**：
1. **开发时检测**：通过配置完整性测试在构建时发现问题
2. **运行时降级**：AudioManager 应捕获加载失败，记录警告日志，但不中断游戏流程
3. **用户体验**：静默失败，游戏继续运行但无音效

**实现要点**：
```typescript
// AudioManager 中的错误处理（已有机制，无需修改）
try {
  await sound.load();
} catch (error) {
  console.warn(`Failed to load sound: ${soundKey}`, error);
  // 继续执行，不抛出异常
}
```

### 技能音效引用不一致

**场景**：技能定义中的 sfxKey 在配置中不存在

**处理策略**：
1. **开发时检测**：通过配置完整性测试在构建时发现问题
2. **运行时降级**：eventSoundResolver 返回 undefined，触发默认音效
3. **用户体验**：使用默认技能音效，不影响游戏体验

**实现要点**：
```typescript
// eventSoundResolver 中的降级逻辑（已有机制）
const explicitKey = match?.variant?.sfxKey ?? match?.ability?.sfxKey;
return explicitKey ?? 'ability_activate';  // 降级到默认音效
```

### 音效配置格式错误

**场景**：音量超出范围、分类标签不规范等

**处理策略**：
1. **开发时检测**：通过配置完整性测试在构建时发现问题
2. **运行时保护**：AudioManager 应对音量值进行边界检查
3. **用户体验**：自动修正到合理范围，记录警告日志

**实现要点**：
```typescript
// AudioManager 中的音量保护（建议增强）
const safeVolume = Math.max(0, Math.min(1, config.volume));
if (safeVolume !== config.volume) {
  console.warn(`Volume out of range for ${soundKey}: ${config.volume}, clamped to ${safeVolume}`);
}
```

## 测试策略

### 双重测试方法

本功能采用**单元测试**和**属性测试**相结合的策略：

**单元测试**：
- 验证特定音效配置的正确性（如 CP 音效路径、技能音效键）
- 测试边界情况（如音量边界值、空 sfxKey）
- 测试集成点（如 eventSoundResolver 的分支逻辑）

**属性测试**：
- 验证所有音效配置的通用属性（如音量范围、路径有效性）
- 验证所有技能的音效解析逻辑（如 sfxKey 存在性、降级行为）
- 通过随机生成测试数据覆盖更广泛的场景

### 测试用例设计

#### 单元测试用例

**测试文件**：`src/games/dicethrone/__tests__/audio.config.test.ts`

```typescript
describe('DiceThrone Audio Config', () => {
  describe('CP Sound Effects', () => {
    it('should use energy charge sound for CP gain', () => {
      const config = DICETHRONE_AUDIO_CONFIG.sounds.cp_gain;
      expect(config.src).toBe('status/compressed/Charged_A.ogg');
      expect(config.category.group).toBe('system');
      expect(config.category.sub).toBe('cp_gain');
    });

    it('should use energy release sound for CP spend', () => {
      const config = DICETHRONE_AUDIO_CONFIG.sounds.cp_spend;
      expect(config.src).toBe('status/compressed/Purged_A.ogg');
      expect(config.category.group).toBe('system');
      expect(config.category.sub).toBe('cp_spend');
    });

    it('should resolve CP_CHANGED event based on delta', () => {
      const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
      const mockContext = { G: {}, ctx: {}, meta: {} };
      
      // CP 增加
      const gainEvent = { type: 'CP_CHANGED', payload: { delta: 2 } };
      expect(resolver(gainEvent, mockContext)).toBe('cp_gain');
      
      // CP 减少
      const spendEvent = { type: 'CP_CHANGED', payload: { delta: -1 } };
      expect(resolver(spendEvent, mockContext)).toBe('cp_spend');
    });
  });

  describe('Monk Ability Sound Effects', () => {
    it('should configure transcendence with ultimate sound', () => {
      const ability = MONK_ABILITIES.find(a => a.id === 'transcendence');
      expect(ability?.sfxKey).toBe('transcendence_ultimate');
      
      const config = DICETHRONE_AUDIO_CONFIG.sounds.transcendence_ultimate;
      expect(config.src).toBe('fight/compressed/FGHTImpt_Special_Hit_02.ogg');
      expect(config.category.sub).toBe('ultimate');
    });

    it('should configure thunder-strike with heavy attack sound', () => {
      const ability = MONK_ABILITIES.find(a => a.id === 'thunder-strike');
      expect(ability?.sfxKey).toBe('thunder_strike');
      
      const config = DICETHRONE_AUDIO_CONFIG.sounds.thunder_strike;
      expect(config.src).toBe('fight/compressed/FGHTImpt_Versatile_Punch_Hit_02.ogg');
    });

    it('should configure taiji-combo with combo sound', () => {
      const ability = MONK_ABILITIES.find(a => a.id === 'taiji-combo');
      expect(ability?.sfxKey).toBe('taiji_combo');
      
      const config = DICETHRONE_AUDIO_CONFIG.sounds.taiji_combo;
      expect(config.src).toBe('fight/compressed/SFX_Fight_Kick_Swoosh_2.ogg');
    });

    it('should use default sound for abilities without sfxKey', () => {
      const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
      const mockContext = {
        G: { /* mock game state */ },
        ctx: {},
        meta: { currentPlayerId: 'player1' }
      };
      
      // 模拟没有 sfxKey 的技能激活
      const event = {
        type: 'ABILITY_ACTIVATED',
        payload: { playerId: 'player1', abilityId: 'fist-technique' }
      };
      
      expect(resolver(event, mockContext)).toBe('ability_activate');
    });
  });
});
```

#### 属性测试用例

**测试文件**：`src/games/dicethrone/__tests__/audio.config.property.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { MONK_ABILITIES } from '../monk/abilities';
import * as fs from 'fs';
import * as path from 'path';

describe('DiceThrone Audio Config - Property Tests', () => {
  /**
   * 属性 1：CP 变化音效正确性
   * Feature: dicethrone-audio-optimization, Property 1
   */
  it('should resolve correct sound for any CP change event', () => {
    const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
    const mockContext = { G: {}, ctx: {}, meta: {} };
    
    // 测试多个随机 delta 值
    const testCases = [
      { delta: 1, expected: 'cp_gain' },
      { delta: 5, expected: 'cp_gain' },
      { delta: 0, expected: 'cp_gain' },  // 边界情况：0 视为增加
      { delta: -1, expected: 'cp_spend' },
      { delta: -3, expected: 'cp_spend' },
    ];
    
    testCases.forEach(({ delta, expected }) => {
      const event = { type: 'CP_CHANGED', payload: { delta } };
      const result = resolver(event, mockContext);
      expect(result).toBe(expected);
    });
    
    // 验证音效资源路径
    expect(DICETHRONE_AUDIO_CONFIG.sounds.cp_gain.src).toContain('Charged');
    expect(DICETHRONE_AUDIO_CONFIG.sounds.cp_spend.src).toContain('Purged');
  });

  /**
   * 属性 2：技能音效正确性
   * Feature: dicethrone-audio-optimization, Property 2
   */
  it('should resolve correct sound for any Monk ability activation', () => {
    const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
    
    MONK_ABILITIES.forEach(ability => {
      const mockContext = {
        G: {
          players: {
            player1: {
              heroId: 'monk',
              abilities: [ability]
            }
          }
        },
        ctx: {},
        meta: { currentPlayerId: 'player1' }
      };
      
      const event = {
        type: 'ABILITY_ACTIVATED',
        payload: { playerId: 'player1', abilityId: ability.id }
      };
      
      const result = resolver(event, mockContext);
      
      if (ability.sfxKey) {
        // 有自定义音效的技能应返回自定义键
        expect(result).toBe(ability.sfxKey);
        // 验证该音效在配置中存在
        expect(DICETHRONE_AUDIO_CONFIG.sounds[ability.sfxKey]).toBeDefined();
      } else {
        // 没有自定义音效的技能应返回默认音效
        expect(result).toBe('ability_activate');
      }
    });
  });

  /**
   * 属性 3：配置完整性
   * Feature: dicethrone-audio-optimization, Property 3
   */
  it('should have valid configuration for all sound effects', () => {
    const sounds = DICETHRONE_AUDIO_CONFIG.sounds;
    const basePath = path.join(process.cwd(), 'public/assets', DICETHRONE_AUDIO_CONFIG.basePath);
    
    Object.entries(sounds).forEach(([key, config]) => {
      // 1. 验证音效资源路径存在
      const fullPath = path.join(basePath, config.src);
      expect(fs.existsSync(fullPath), `Sound file not found: ${config.src}`).toBe(true);
      
      // 2. 验证音量在合理范围
      expect(config.volume).toBeGreaterThanOrEqual(0);
      expect(config.volume).toBeLessThanOrEqual(1);
      
      // 3. 验证分类标签符合规范
      const validGroups = ['dice', 'card', 'combat', 'token', 'status', 'ui', 'system', 'stinger'];
      expect(validGroups).toContain(config.category.group);
      expect(config.category.sub).toBeTruthy();
    });
  });

  /**
   * 属性 3（子属性）：技能 sfxKey 引用完整性
   * Feature: dicethrone-audio-optimization, Property 3
   */
  it('should have sound config for all ability sfxKeys', () => {
    const sounds = DICETHRONE_AUDIO_CONFIG.sounds;
    
    MONK_ABILITIES.forEach(ability => {
      if (ability.sfxKey) {
        expect(sounds[ability.sfxKey], 
          `Sound config missing for ability ${ability.id} sfxKey: ${ability.sfxKey}`
        ).toBeDefined();
      }
      
      // 检查变体的 sfxKey
      ability.variants?.forEach(variant => {
        if (variant.sfxKey) {
          expect(sounds[variant.sfxKey],
            `Sound config missing for variant ${variant.id} sfxKey: ${variant.sfxKey}`
          ).toBeDefined();
        }
      });
    });
  });
});
```

### 测试配置

**属性测试配置**：
- 最小迭代次数：100 次（由于配置项数量有限，实际会遍历所有配置）
- 测试库：Vitest（项目已配置）
- 运行命令：`npm run test -- audio.config`

**测试覆盖目标**：
- 单元测试：覆盖所有新增/修改的音效配置
- 属性测试：覆盖所有音效配置项和技能定义
- 集成测试：通过游戏流程验证音效触发（可选，作为手动测试补充）

### 测试执行计划

1. **开发阶段**：每次修改配置后运行单元测试
2. **提交前**：运行完整测试套件（单元测试 + 属性测试）
3. **CI/CD**：自动运行所有测试，确保配置完整性
4. **手动验证**：在游戏中触发关键场景，验证音效听感

## 实现步骤

### 步骤 1：更新 CP 音效配置

**文件**：`src/games/dicethrone/audio.config.ts`

**操作**：
1. 修改 `cp_gain` 音效配置，将 `src` 改为 `'status/compressed/Charged_A.ogg'`
2. 修改 `cp_spend` 音效配置，将 `src` 改为 `'status/compressed/Purged_A.ogg'`
3. 调整音量值（cp_gain: 0.6, cp_spend: 0.5）

**验证**：运行单元测试，确认配置正确

### 步骤 2：新增 Monk 技能音效配置

**文件**：`src/games/dicethrone/audio.config.ts`

**操作**：
1. 在 `sounds` 对象中新增 `transcendence_ultimate` 配置
2. 在 `sounds` 对象中新增 `thunder_strike` 配置
3. 在 `sounds` 对象中新增 `taiji_combo` 配置

**验证**：运行单元测试，确认配置正确

### 步骤 3：更新 Monk 技能定义

**文件**：`src/games/dicethrone/monk/abilities.ts`

**操作**：
1. 为 `transcendence` 技能添加 `sfxKey: 'transcendence_ultimate'`
2. 为 `thunder-strike` 技能添加 `sfxKey: 'thunder_strike'`
3. 为 `taiji-combo` 技能添加 `sfxKey: 'taiji_combo'`

**验证**：运行单元测试，确认技能定义正确

### 步骤 4：编写测试用例

**文件**：
- `src/games/dicethrone/__tests__/audio.config.test.ts`（单元测试）
- `src/games/dicethrone/__tests__/audio.config.property.test.ts`（属性测试）

**操作**：
1. 编写 CP 音效测试用例
2. 编写 Monk 技能音效测试用例
3. 编写配置完整性属性测试

**验证**：运行测试套件，确保所有测试通过

### 步骤 5：游戏内验证

**操作**：
1. 启动游戏，进入 DiceThrone 对局
2. 触发 CP 增加/减少场景，验证音效听感
3. 触发超凡入圣、雷霆一击、太极连击技能，验证音效听感
4. 触发其他技能，验证默认音效正常播放

**验证清单**：
- [ ] CP 增加时播放充能音效（非金币音效）
- [ ] CP 减少时播放释放音效（非金币音效）
- [ ] 超凡入圣播放重击音效
- [ ] 雷霆一击播放拳击音效
- [ ] 太极连击播放踢击音效
- [ ] 其他技能播放默认音效
- [ ] 无音效加载错误或警告

### 步骤 6：文档更新（可选）

**文件**：`docs/dicethrone-audio.md`（如果存在）

**操作**：
1. 更新 CP 音效说明
2. 更新 Monk 技能音效说明
3. 补充音效选择理由

## 风险与缓解

### 风险 1：音效文件路径错误

**影响**：音效无法加载，游戏静默失败

**概率**：低（通过属性测试可在开发时发现）

**缓解措施**：
1. 编写配置完整性测试，验证所有文件路径
2. 在 CI/CD 中运行测试，确保提交前发现问题
3. AudioManager 已有错误处理，运行时不会崩溃

### 风险 2：音效听感不符合预期

**影响**：用户体验不佳，需要重新选择音效

**概率**：中（音效选择有主观性）

**缓解措施**：
1. 在设计阶段提供多个备选方案
2. 实现后进行游戏内验证，必要时调整
3. 保持配置灵活性，便于快速替换

### 风险 3：技能音效配置遗漏

**影响**：部分技能使用错误的音效或默认音效

**概率**：低（通过属性测试可发现）

**缓解措施**：
1. 编写属性测试，验证所有技能的音效解析逻辑
2. 在代码审查中检查技能定义和配置的一致性
3. 游戏内手动验证关键技能

### 风险 4：音效冲突或重复使用

**影响**：不同场景使用相同音效，降低辨识度

**概率**：低（当前设计已避免）

**缓解措施**：
1. 在设计阶段明确音效用途，避免重复
2. 通过分类标签（category）管理音效用途
3. 代码审查时检查音效复用情况

## 未来扩展

### 通用音效模板提取（可选）

**目标**：将本次优化中验证的音效选择逻辑提取为通用模板

**实施步骤**：
1. 创建 `src/lib/audio/templates/commonSounds.ts`
2. 定义 `COMMON_SOUND_TEMPLATES` 对象，包含资源、战斗、状态、UI 等类别
3. 更新 DiceThrone 配置以使用模板（可选重构）
4. 编写使用文档 `docs/audio-guide.md`

**优先级**：低（当有第二个游戏需要音效配置时再实施）

### 其他英雄音效优化

当前设计仅针对 Monk 英雄，未来可扩展到其他英雄：

**扩展方式**：
1. 为每个英雄的关键技能配置专属音效
2. 根据英雄风格选择音效类型（如法师用魔法音效、战士用武器音效）
3. 保持配置结构一致，便于维护

**实现成本**：
- 每个英雄约需 3-5 个自定义音效
- 音效选择和配置工作量约 1-2 小时/英雄

### 动态音效系统

未来可考虑更高级的音效系统：

**功能**：
1. 根据伤害值动态选择音效强度
2. 根据连击数播放不同音效
3. 根据游戏阶段切换音效风格

**实现方式**：
- 扩展 `eventSoundResolver` 逻辑
- 增加音效变体配置（如 `attack_hit_light/medium/heavy`）
- 在事件 payload 中传递更多上下文信息

### 音效预加载优化

当前音效按需加载，未来可优化加载策略：

**优化方向**：
1. 在游戏开始时预加载常用音效
2. 根据英雄预加载对应的技能音效
3. 实现音效资源的懒加载和卸载

**实现方式**：
- 在 AudioManager 中增加预加载 API
- 在游戏初始化时调用预加载
- 监控内存使用，必要时卸载不常用音效
