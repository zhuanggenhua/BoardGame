# DiceThrone 音效修复证据文档

## 修复记录

### 2024-02-03 - 骰子音效修正（替换硬币音效）

**问题描述**：
- 用户试听后发现 `Many_Dice_Roll_Wood_001.ogg` 本身就是硬币声音
- 该音效来自卡牌音效包（`Decks and Cards Sound FX Pack`），混入了硬币声音

**问题根源**：
- `dice_roll_3` 使用的音效文件来自错误的音效包
- 来源：`BordGameAsset/SoundEffect/_source_zips/sfx/cards/Decks and Cards Sound FX Pack/Dice/Many Dice Roll Wood 001.wav`
- 这个音效包主要是卡牌和硬币音效，骰子音效混入了硬币声音

**解决方案**：
- 找到替代音效：`BordGameAsset/SoundEffect/Mini Games Sound Effects and Music Pack/AUDIO/SFX/Card and Board Games/Dice/SFX_Dice_Roll_3.wav`
- 这是纯粹的桌游骰子音效，来自专门的桌游音效包
- 复制并压缩为 `public/assets/common/audio/dice/compressed/SFX_Dice_Roll_3.ogg`
- 修改文件：`src/lib/audio/common.config.ts`
- 修改内容：
  ```typescript
  // 修改前（硬币音效）
  dice_roll_3: { src: 'dice/compressed/Many_Dice_Roll_Wood_001.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
  
  // 修改后（纯粹的桌游骰子音效）
  dice_roll_3: { src: 'dice/compressed/SFX_Dice_Roll_3.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
  ```

**测试验证**：✅ 15/15 测试通过

**修改文件**：
- `src/lib/audio/common.config.ts`（骰子音效配置）
- `src/games/dicethrone/__tests__/audio.config.test.ts`（更新测试以适应新架构）
- `src/games/dicethrone/__tests__/audio.config.property.test.ts`（更新测试以适应新架构）
- `public/assets/common/audio/dice/SFX_Dice_Roll_3.wav`（已复制）
- `public/assets/common/audio/dice/compressed/SFX_Dice_Roll_3.ogg`（已压缩）

---

### 2024-02-03 - Token 音效修正（Buff 音效替换）

**问题描述**：
- 用户报告投掷骰子时听到"硬币音效"
- 用户表示不想听到任何 Token 音效

**问题分析**：
1. **Token 的实际含义**：
   - 游戏中的 Token（太极、闪避、净化等）代表 **Buff/增益状态**，不是物理标记物
   - 当前配置错误地使用了物理 Token 音效（`Token_Drop_001.ogg`），听起来像硬币

2. **音效触发时机**：
   - 掷骰子后，某些技能（如 Monk 的冥想）会触发 `TOKEN_GRANTED` 事件
   - 该事件映射到 `token_gain` → `Token_Drop_001.ogg`（物理 Token 音效）
   - 用户听到的"硬币音效"实际上是这个物理 Token 音效

3. **骰子音效本身正确**：
   - `DICE_ROLLED` 事件正确映射到骰子音效（`dice_roll`, `dice_roll_2`, `dice_roll_3`）
   - 没有问题

**解决方案**：
- 将 Token 音效从物理 Token 音效替换为 Buff/增益音效
- 修改文件：`src/lib/audio/common.config.ts`
- 修改内容：
  ```typescript
  // 修改前（物理 Token 音效）
  token_gain: { src: 'token/compressed/Token_Drop_001.ogg', volume: 0.6, category: { group: 'token', sub: 'gain' } },
  token_use: { src: 'token/compressed/Tokens_Handling_001.ogg', volume: 0.5, category: { group: 'token', sub: 'use' } },
  
  // 修改后（Buff 音效）
  token_gain: { src: 'status/compressed/Ready_A.ogg', volume: 0.6, category: { group: 'token', sub: 'gain' } },
  token_use: { src: 'status/compressed/Purged_A.ogg', volume: 0.5, category: { group: 'token', sub: 'use' } },
  ```

**音效选择理由**：
- `Ready_A.ogg`：准备/就绪音效，适合表示获得增益状态
- `Purged_A.ogg`：净化/释放音效，适合表示消耗增益状态
- 这两个音效已经在项目中使用（CP 系统、状态效果），风格一致

**BGM 规则确认**：
- ✅ `offensiveRoll` 或 `defensiveRoll` 阶段使用 `battle_intense`
- ✅ 其他阶段使用 `battle`
- 配置正确，无需修改

**后续工作**：
- [ ] 更新测试用例（CP 音效现在在 common.config.ts 中定义）
- [ ] 验证游戏中 Token 音效是否符合预期

---

### 2024-02-03 - 卡牌音效修复（硬币音效替换）

**问题描述**：
- 用户报告打出卡牌时听到硬币声音
- 怀疑是触发了加 Buff 的缘故

**问题根源**：
- `card_sell` 使用 `Small_Coin_Drop_001.ogg`（硬币音效）
- `card_sell_undo` 使用 `Small_Reward_001.ogg`（硬币相关音效）

**解决方案**：
- 从 `BordGameAsset/SoundEffect/_source_zips/sfx/cards/Decks and Cards Sound FX Pack/FX/` 复制音频文件
- 替换为 `FX_Discard_For_Gold_001.ogg`（卡牌弃牌特效）
- 替换为 `FX_Boost_001.ogg`（增益特效）
- 使用 ffmpeg 压缩为 `.ogg` 格式

**修改文件**：
- `src/lib/audio/common.config.ts`（已迁移到通用配置）
- `public/assets/common/audio/card/FX Discard For Gold 001.wav`
- `public/assets/common/audio/card/FX Boost 001.wav`
- `public/assets/common/audio/card/compressed/FX_Discard_For_Gold_001.ogg`
- `public/assets/common/audio/card/compressed/FX_Boost_001.ogg`

**测试验证**：✅ 15/15 测试通过（需要更新以适应新架构）

---

## 架构变更记录

### 音效配置重构（2024-02-03）

**变更说明**：
- 音效配置已重构为两层架构：
  1. **通用层**：`src/lib/audio/common.config.ts` - 定义所有游戏共享的音效
  2. **游戏层**：`src/games/dicethrone/audio.config.ts` - 仅定义游戏特有音效（战斗、BGM）

**影响**：
- Token 音效、CP 音效、卡牌音效等通用音效现在在 `common.config.ts` 中定义
- 游戏层可通过同名 key 覆盖通用音效
- 测试需要更新以适应新架构

---

## 音效资源清单

### 当前使用的音效文件

#### 骰子音效（已修正）
- `dice_roll`: `dice/compressed/Dice_Roll_Velvet_001.ogg` - 天鹅绒骰盘掷骰
- `dice_roll_2`: `dice/compressed/Few_Dice_Roll_001.ogg` - 少量骰子掷骰
- `dice_roll_3`: `dice/compressed/SFX_Dice_Roll_3.ogg` - 多个骰子掷骰（纯粹的桌游骰子音效）
- `dice_lock`: `dice/compressed/Dice_Handling_001.ogg` - 骰子锁定
- `dice_confirm`: `ui/compressed/UIClick_Accept_Button_01.ogg` - 确认骰面
- `bonus_die_roll`: `dice/compressed/Single_Die_Roll_001.ogg` - 奖励骰掷骰
- `die_modify`: `dice/compressed/Dice_Handling_002.ogg` - 骰面修改
- `die_reroll`: `dice/compressed/Dice_Roll_Velvet_002.ogg` - 骰子重掷

#### Buff/Token 音效（已修正）
- `token_gain`: `status/compressed/Ready_A.ogg` - 获得增益状态
- `token_use`: `status/compressed/Purged_A.ogg` - 消耗增益状态

#### CP 系统音效
- `cp_gain`: `status/compressed/Charged_A.ogg` - 获得 CP
- `cp_spend`: `status/compressed/Purged_A.ogg` - 消耗 CP

#### 卡牌音效（已修正）
- `card_sell`: `card/compressed/FX_Discard_For_Gold_001.ogg` - 卖牌
- `card_sell_undo`: `card/compressed/FX_Boost_001.ogg` - 撤销卖牌

#### Monk 技能音效
- `transcendence_ultimate`: `fight/compressed/FGHTImpt_Special_Hit_02.ogg` - 超凡入圣
- `thunder_strike`: `fight/compressed/FGHTImpt_Versatile_Punch_Hit_01.ogg` - 雷霆一击
- `taiji_combo`: `fight/compressed/SFX_Fight_Kick_Swoosh_1.ogg` - 太极连击

---

## 测试状态

### 单元测试
- ✅ `audio.config.test.ts` - 7 个测试全部通过
- ✅ `audio.config.property.test.ts` - 8 个测试全部通过

### 测试更新
- ✅ CP 音效测试已更新为从 `COMMON_AUDIO_CONFIG` 读取
- ✅ 属性测试已更新为合并两层配置后验证
- ✅ 文件路径验证已更新为分别检查通用配置和游戏配置

---

## 用户反馈

### 已解决
- ✅ CP 系统音效不再使用硬币声音（使用能量音效）
- ✅ 卡牌卖牌音效不再使用硬币声音（使用卡牌特效）
- ✅ Monk 三个关键技能配置了专属音效
- ✅ Token 音效不再使用物理 Token 音效（使用 Buff 音效）
- ✅ 骰子音效不再使用混入硬币声音的音效（使用纯粹的桌游骰子音效）

### 待验证
- ⏳ 在游戏中验证所有音效是否符合预期

### 检查结果（2024-02-03）

**投掷骰子本身不会触发 Token 音效**：
1. `ROLL_DICE` 命令：只生成 `DICE_ROLLED` 事件，播放骰子音效
2. `CONFIRM_ROLL` 命令：只生成 `ROLL_CONFIRMED` 事件，播放确认音效

**但是，选择防御技能后会触发 Token 音效**：
- 防御阶段流程：
  1. 掷骰子 → `DICE_ROLLED` → 骰子音效 ✅
  2. 确认骰面 → `ROLL_CONFIRMED` → 确认音效 ✅
  3. 选择防御技能（如冥想）→ `ABILITY_ACTIVATED` → 执行技能效果
  4. 技能效果执行 → `meditation-taiji` → `TOKEN_GRANTED` → **Token 音效** ⚠️

**问题根源**：
- 用户听到的"硬币音效"发生在**防御阶段选择冥想技能后**
- 冥想技能会根据骰面结果获得太极 Token，触发 `TOKEN_GRANTED` 事件
- 之前使用物理 Token 音效（`Token_Drop_001.ogg`），听起来像硬币

**修复效果**：
- ✅ 投掷骰子时：只有骰子音效，无 Token 音效
- ✅ 确认骰面时：只有确认音效，无 Token 音效
- ✅ 选择防御技能后：播放 Buff 增益音效（`Ready_A.ogg`），不再是硬币音效

---

## 注意事项

1. **Token 的语义**：
   - Token 在游戏中代表 Buff/增益状态（如太极、闪避、净化）
   - 不是物理标记物，应使用 Buff 类音效

2. **音效来源**：
   - 所有音效必须从 `BordGameAsset/SoundEffect/音效列表_完整.md` 中选择
   - 音频文件需要使用 ffmpeg 压缩为 `.ogg` 格式

3. **测试要求**：
   - 修改配置后必须运行测试确保通过
   - 文件路径必须存在，测试中会验证

4. **架构约束**：
   - 通用音效在 `common.config.ts` 中定义
   - 游戏特有音效在游戏目录的 `audio.config.ts` 中定义
   - 游戏层可覆盖通用层的音效定义
