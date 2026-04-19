# DiceThrone 新角色添加进度

## 概述
正在添加两个新角色：Gunslinger（枪手）和 Samurai（武士）

## 已完成工作

### 1. 图片资源重命名 ✅
已将图片文件重命名为符合项目规范的格式：

**Gunslinger:**
- `panel.jpg` → `player-board.png`
- `tip.jpg` → `tip.png`
- `dice.jpg` → `dice.png`
- `card.jpg` → `ability-cards.png`

**Samurai:**
- `panel.jpg` → `player-board.png`
- `tip.jpg` → `tip.png`
- `dice.jpg` → `dice.png`
- `card.jpg` → `ability-cards.png`

### 2. Gunslinger 数据录入 ✅

#### 骰子配置（已完成）
从图片中提取的骰子面配置：
- 1, 2, 3 → 子弹（bullet）
- 4, 5 → 冲刺（dash）
- 6 → 准心（bullseye）

已更新文件：
- ✅ `src/games/dicethrone/domain/ids.ts`：添加了 `GUNSLINGER_DICE_FACE_IDS`
- ✅ `src/games/dicethrone/heroes/gunslinger/diceConfig.ts`：完整的骰子定义

#### Token 系统（已完成）
从图片中提取的 Token 定义：

1. **闪避（evasive_gunslinger）** - 正面状态，堆叠限制：3
   - 花费指示物并掷1颗骰子，点数结果为1或2点来闪避攻击
   
2. **装填弹药（loaded）** - 正面状态，堆叠限制：2
   - 花费指示物并掷1骰，增加½点数伤害
   
3. **击倒（knockdown）** - 负面状态，堆叠限制：1
   - 对手花费2CP或跳过掷骰攻击阶段
   
4. **赏金（bounty）** - 负面状态，堆叠限制：1
   - 对手获得+1伤害且攻击方获得1CP（持续性效果）

已更新文件：
- ✅ `src/games/dicethrone/domain/ids.ts`：添加了 `EVASIVE_GUNSLINGER`、`LOADED`、`BOUNTY` 到 `TOKEN_IDS`
- ✅ `src/games/dicethrone/heroes/gunslinger/tokens.ts`：完整的 Token 定义

#### 状态图标图集配置（已完成）
- ✅ `public/assets/i18n/zh-CN/dicethrone/images/gunslinger/status-icons-atlas.json`
  - 闪避和击倒可复用其他角色的图标
  - 装填弹药和赏金需要新图标（待设计）

### 3. 基础代码结构创建 ✅

#### Gunslinger 文件结构
```
src/games/dicethrone/heroes/gunslinger/
├── index.ts          # 导出入口
├── abilities.ts      # 技能定义（待补充）
├── tokens.ts         # Token 定义（待补充）
├── cards.ts          # 卡牌定义（待补充）
├── diceConfig.ts     # 骰子配置（待补充）
└── TODO.md           # 待办事项清单
```

#### Samurai 文件结构
```
src/games/dicethrone/heroes/samurai/
├── index.ts          # 导出入口
├── abilities.ts      # 技能定义（待补充）
├── tokens.ts         # Token 定义（待补充）
├── cards.ts          # 卡牌定义（待补充）
├── diceConfig.ts     # 骰子配置（待补充）
└── TODO.md           # 待办事项清单
```

### 3. 类型系统更新 ✅
- ✅ `src/games/dicethrone/domain/ids.ts`：添加了 `GUNSLINGER` 和 `SAMURAI` 到图集 ID
- ✅ `src/games/dicethrone/domain/core-types.ts`：添加了 `'gunslinger'` 和 `'samurai'` 到 `IMPLEMENTED_DICETHRONE_CHARACTER_IDS`
- ✅ `src/games/dicethrone/domain/characters.ts`：
  - 添加了 import 语句
  - 在 `CHARACTER_DATA_MAP` 中注册了两个新角色（使用占位数据）
- ✅ `src/games/dicethrone/domain/index.ts`：注册了两个新角色的骰子定义

### 4. 代码质量检查 ✅
- ✅ ESLint 检查通过（0 errors, 4 warnings 为已存在的 `any` 警告）

## 待补充信息

### Gunslinger（枪手）
已完成数据录入：
- ✅ 角色名称：Gunslinger（枪手）
- ✅ 骰子配置：1-3 子弹，4-5 冲刺，6 准心
- ✅ Token 系统：闪避、装填弹药、击倒、赏金
- ✅ 状态图标图集配置

仍需补充：
- [ ] 起始 HP 和 CP（需要更清晰的 tip.png）
- [ ] 被动能力完整描述
- [ ] 所有技能卡牌的详细信息
- [ ] 状态图标图集图片（复用现有 + 新增）
- [ ] 骰子精灵图

### Samurai（武士）
需要清晰图片补充：
- [ ] 起始 HP 和 CP
- [ ] 完整的骰子 6 个面配置
- [ ] 所有技能的完整描述和数值
- [ ] Token 系统的详细定义
- [ ] 被动能力的完整描述

## 下一步工作

### 1. 数据录入（等待清晰图片）
收到清晰的 `tip.png` 和 `dice.png` 后：
1. 提取基础数据（HP、CP、被动能力）
2. 确认骰子 6 个面的完整配置
3. 更新 `tokens.ts` 和 `diceConfig.ts`

收到清晰的 `ability-cards.png` 后：
1. 提取所有技能卡牌的完整信息
2. 更新 `abilities.ts` 和 `cards.ts`
3. 补充 `initialAbilityLevels` 配置

### 2. 资源配置
- [ ] 创建 `resourceConfig.ts`（如果需要特殊资源）
- [ ] 生成 `status-icons-atlas.json`
- [ ] 生成 `dice-sprite.png`

### 3. 游戏逻辑实现
- [ ] 实现技能效果（`abilities.ts`）
- [ ] 实现 Token 效果（`tokens.ts`）
- [ ] 实现 Custom Actions（如果需要）
- [ ] 添加 i18n 翻译

### 4. 测试
- [ ] 单元测试（技能、Token、骰子）
- [ ] 集成测试（完整对局流程）
- [ ] E2E 测试（UI 交互）

### 5. UI 集成
- [ ] 角色选择界面添加新角色
- [ ] 确认图片资源加载正常
- [ ] 测试游戏内显示效果

## 技术债务
无

## 注意事项
1. 所有 TODO 标记的地方都需要在收到清晰图片后补充
2. 骰子配置必须准确，否则会影响游戏逻辑
3. Token 系统需要与现有角色保持一致的设计模式
4. 技能效果实现需要遵循引擎层的规范（使用 `createDamageCalculation` 等）
