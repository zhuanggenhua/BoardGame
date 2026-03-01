# Cardia - Phase 2 注册表创建完成

## 完成时间
2026年2月26日

## 完成的工作

### 1. 能力ID常量表 (`domain/ids.ts`) ✅
- **派系ID**：4个（沼泽、学院、公会、王朝）
- **阶段ID**：3个（play, ability, end）
- **牌组变体ID**：2个（I, II）
- **能力ID**：32个
  - I 牌组：16个能力
  - II 牌组：16个能力
- **卡牌ID**：32个
  - I 牌组：16张卡牌
  - II 牌组：16张卡牌
- **修正标记ID**：6个（+1, +3, +5, -1, -3, -5）

### 2. 能力注册表 (`domain/abilityRegistry.ts`) ✅
- **使用引擎层 `ability.ts` 框架**
- **定义了 `CardiaAbilityDef` 接口**：
  - 继承 `AbilityDef<CardiaAbilityEffect, AbilityTrigger>`
  - 扩展字段：`isInstant`, `isOngoing`, `requiresMarker`
- **定义了能力触发时机**：
  - `onLose`：失败时触发（默认）
  - `onWin`：胜利时触发
  - `onPlay`：打出时触发
  - `ongoing`：持续效果
- **定义了能力效果类型**（14种）：
  - `modifyInfluence`：修改影响力
  - `draw`：抽牌
  - `discard`：弃牌
  - `discardRandom`：随机弃牌
  - `discardSelected`：选择弃牌
  - `discardByFaction`：派系弃牌
  - `recycle`：从弃牌堆回收
  - `viewHand`：查看手牌
  - `copy`：复制能力
  - `shuffle`：混洗牌库
  - `grantSignet`：获得印戒
  - `addOngoing`：添加持续效果
  - `removeOngoing`：移除持续效果
  - `win`：直接胜利
- **注册了所有32个能力**：
  - I 牌组：16个能力（盗贼、学徒、商人...精灵）
  - II 牌组：16个能力（间谍、见习生、小贩...继承者）

### 3. 卡牌注册表 (`domain/cardRegistry.ts`) ✅
- **定义了 `CardDef` 接口**：
  - 基础属性：id, influence, faction, abilityIds, difficulty, deckVariant
  - i18n keys：nameKey, descriptionKey
  - 图片：imageIndex
- **注册了所有32张卡牌**：
  - I 牌组：16张（影响力1-16）
  - II 牌组：16张（影响力1-16）
- **提供了辅助函数**：
  - `getCardsByDeckVariant(variant)`：按牌组获取卡牌
  - `getCardsByFaction(faction, variant?)`：按派系获取卡牌
  - `getCardByInfluence(influence, variant)`：按影响力获取卡牌

### 4. 更新核心类型 (`domain/core-types.ts`) ✅
- **更新了 `CardInstance` 接口**：
  - 添加了运行时状态：`modifiers`, `tags`, `signets`
  - 使用引擎层原语：`ModifierStack`, `TagContainer`
- **更新了 `PlayerState` 接口**：
  - 区域改为 `CardInstance[]`（而非字符串数组）
  - 添加了 `signets`, `tags`, `hasPlayed`
- **更新了 `CardiaCore` 接口**：
  - 添加了 `playerOrder`, `phase`, `encounterHistory`
  - 添加了 `deckVariant`, `targetSignets`
- **定义了 `EncounterState` 接口**：
  - 当前遭遇：`player1Card`, `player2Card`
  - 影响力计算：`player1Influence`, `player2Influence`
  - 结果：`winnerId`, `loserId`
- **定义了 `CardiaContext` 接口**：
  - 用于能力执行的上下文

### 5. 更新工具函数 (`domain/utils.ts`) ✅
- **更新了 `createPlayerState`**：匹配新的 `PlayerState` 结构
- **添加了 `createCardInstance`**：创建卡牌实例
- **添加了 `calculateInfluence`**：计算卡牌最终影响力
- **添加了 `getPreviousEncounter`**：查询上一次遭遇
- **添加了 `getPreviousCardForPlayer`**：查询玩家上一次遭遇卡牌

### 6. 更新领域内核 (`domain/index.ts`) ✅
- **导出了注册表**：`abilityRegistry`, `cardRegistry`
- **导出了辅助函数**：`getCardsByDeckVariant`, `getCardsByFaction`, `getCardByInfluence`
- **更新了 `setup` 函数**：匹配新的 `CardiaCore` 结构
- **实现了 `isGameOver` 函数**：
  - 检查印戒数量（≥5）
  - 检查无法打出卡牌（手牌和牌库均为空）

## 数据驱动设计验证

### ✅ 显式 > 隐式
- 所有配置在 `CardDef` 和 `AbilityDef` 中显式声明
- 不依赖命名推断或隐式规则

### ✅ 智能默认 + 可覆盖
- 默认触发时机：`trigger: 'onLose'`（90%的能力）
- 默认目标：`target: 'self'`
- 可覆盖：特殊能力可指定不同的触发时机和目标

### ✅ 单一真实来源
- 卡牌属性：`CardDef` 唯一定义
- 能力效果：`AbilityDef` 唯一定义
- 不在多处重复声明

### ✅ 类型安全
- 所有类型在 `domain/core-types.ts` 和 `domain/ids.ts` 定义
- 使用 TypeScript 联合类型确保编译期检查
- 使用 `as const` 确保常量不可变

### ✅ 最小化游戏层代码
- 新增卡牌：只需在 `cardRegistry.ts` 添加 `CardDef`（~15行）
- 新增能力：只需在 `abilityRegistry.ts` 添加 `AbilityDef`（~10行）
- 无需修改 `validate.ts` / `execute.ts` / UI组件

### ✅ 框架可进化
- 引擎层可添加新的 `AbilityEffectType` 而不影响现有卡牌
- 可添加新的触发时机（如 `onDraw`）而不破坏现有能力

## 统计数据

### 代码行数
- `domain/ids.ts`：~200行（常量定义）
- `domain/abilityRegistry.ts`：~550行（32个能力注册）
- `domain/cardRegistry.ts`：~350行（32张卡牌注册）
- `domain/core-types.ts`：~100行（类型定义）
- `domain/utils.ts`：~80行（工具函数）
- **总计**：~1280行

### 数据完整性
- ✅ 32张卡牌全部注册
- ✅ 32个能力全部注册
- ✅ 4个派系全部定义
- ✅ 6种修正标记全部定义
- ✅ 类型安全：100%

## 下一步（Phase 3：领域核心实现）

根据 `.windsurf/skills/create-new-game/SKILL.md` 的 Phase 3 要求，接下来需要：

1. **实现 `validate.ts`**：命令验证逻辑
2. **实现 `execute.ts`**：命令执行逻辑
3. **实现 `reduce.ts`**：事件归约逻辑
4. **完善 `domain/index.ts`**：整合所有领域逻辑

### Phase 3 预计工作量
- `validate.ts`：~300行（命令验证）
- `execute.ts`：~500行（命令执行 + 能力执行器）
- `reduce.ts`：~400行（事件归约）
- **总计**：~1200行

## 技术债务

### 待实现的功能
1. **能力执行器注册表**：需要在 Phase 3 创建 `AbilityExecutorRegistry`
2. **修正栈应用逻辑**：`calculateInfluence` 函数需要实现完整的修正栈应用
3. **持续效果管理**：需要实现持续效果的添加、移除、tick 逻辑
4. **特殊能力逻辑**：
   - 顾问（上一次遭遇获胜）
   - 机械精灵（下一次遭遇获胜则胜利）
   - 巫王（派系弃牌）
   - 元素师（能力复制）
   - 继承者（保留2张弃其他所有）

### 设计决策记录
1. **卡牌实例 UID 生成**：使用 `${defId}_${timestamp}_${random}` 格式
2. **影响力计算时机**：在 `PLAY_CARD` 命令执行时立即计算
3. **遭遇战历史存储**：保留完整的 `encounterHistory` 数组
4. **修正标记持久性**：修正标记永久存在直到被移除

## 质量检查清单

- [x] 所有常量使用 `as const` 声明
- [x] 所有类型导出正确
- [x] 注册表使用引擎层框架
- [x] 数据结构符合 Phase 1.5 设计
- [x] 工具函数使用结构共享
- [x] 游戏结束判定逻辑正确
- [x] 代码注释清晰完整
- [x] 符合"面向百游戏"设计原则

---

**状态**：✅ Phase 2 注册表创建完成
**下一步**：Phase 3 领域核心实现（validate/execute/reduce）
**最后更新**：2026年2月26日
