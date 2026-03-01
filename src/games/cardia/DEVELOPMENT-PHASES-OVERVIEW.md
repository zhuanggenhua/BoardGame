# Cardia 游戏开发阶段总览

根据 `.windsurf/skills/create-new-game/SKILL.md` 的六阶段工作流

---

## 阶段 1：目录骨架与 Manifest 落地 ✅

**目标**：建立完整目录结构与最小占位实现

### 完成内容

- ✅ 创建目录结构（domain/, ui/, hooks/, __tests__/, rule/）
- ✅ manifest.ts 配置完成
- ✅ domain/types.ts 类型定义（core-types.ts, commands.ts, events.ts）
- ✅ domain/ids.ts 常量表（CARD_IDS, FACTION_IDS, ABILITY_IDS, CARDIA_ATLAS_IDS）
- ✅ game.ts 引擎适配器组装
- ✅ Board.tsx UI 布局组装
- ✅ thumbnail.tsx 缩略图组件
- ✅ tutorial.ts 教学配置
- ✅ audio.config.ts 音频配置
- ✅ i18n 文件（zh-CN 和 en）
- ✅ 资源目录（public/assets/cardia/）

### 验收结果

```bash
✅ npm run generate:manifests  # 成功生成清单
✅ npx vitest run src/games/cardia  # 冒烟测试通过
✅ npm run dev  # 编译无报错，游戏可在大厅列表看到
```

---

## 阶段 1.5：机制分解与数据结构设计 ✅

**目标**：在录入数据前，先将游戏机制分解为引擎原语组合

### 完成内容

#### 1.5.1 机制分解与引擎原语映射 ✅

| 机制类别 | 游戏中的表现 | 引擎原语映射 | 状态 |
|---------|------------|------------|------|
| 随机性 | 洗牌/抽牌 | `zones.ts` | ✅ 已使用 |
| 资源管理 | 印戒标记 | 游戏层实现 | ✅ 已实现 |
| 状态效果 | 持续效果标记 | `continuousEffects` | ✅ 已实现 |
| 数值修改 | 影响力修正标记 | `modifiers` 数组 | ✅ 已实现 |
| 能力系统 | 即时/持续能力 | `ability.ts` | ✅ 已使用 |
| 空间关系 | 遭遇序列 | 游戏层实现 | ✅ 已实现 |

#### 1.5.2 数据结构设计 ✅

**CardDef 接口设计**：

```typescript
interface CardDef {
    id: string;              // 卡牌ID（唯一标识）
    influence: number;       // 基础影响力 (1-16)
    faction: FactionId;      // 派系（四大派系之一）
    abilityIds: AbilityId[]; // 能力ID列表（ID引用，不嵌套对象）
    difficulty: number;      // 难度等级 (0-5)
    deckVariant: DeckVariantId; // 所属牌组（I 或 II）
    nameKey: string;         // i18n key
    descriptionKey: string;  // i18n key
    imageIndex: number;      // 图集索引 (1-48)
}
```

**设计原则检查**：
- ✅ 所有实体类型都有唯一 ID 字段
- ✅ 所有引用关系都是 ID 引用，不是对象嵌套
- ✅ 所有数值修改都映射到 `modifiers` 系统
- ✅ 所有状态效果都映射到 `continuousEffects` 系统
- ✅ 面向百游戏设计，无硬编码反模式

#### 1.5.3 引擎能力缺口分析 ✅

| 能力 | 状态 | 备注 |
|------|------|------|
| 卡牌管理 | ✅ 可直接复用 | `zones.ts` |
| 能力系统 | ✅ 可直接复用 | `ability.ts` |
| 数值修改 | ✅ 可直接复用 | `modifiers` 数组 |
| 持续效果 | ✅ 游戏层实现 | `continuousEffects` |

**结论**：无引擎能力缺口，所有机制都可用现有原语实现。

---

## 阶段 2：数据录入（规则文档 + 游戏数据 + 类型定义）✅

**目标**：完成规则文档录入、静态游戏数据录入、核心类型定义

### 完成内容

#### 2.1 录入规则文档 ✅

- ✅ `rule/卡迪亚规则.md` - 完整规则文档
  - 游戏概述、组件、四大派系
  - 回合流程（打出卡牌、激活能力、回合结束）
  - 关键机制（影响力修正、能力触发、空间关系）
  - 关键词说明、地点卡、牌组变体
  - 游戏结束条件、策略提示、常见问题

#### 2.2 录入游戏静态数据 ✅

- ✅ `domain/cardRegistry.ts` - 32张卡牌定义
  - I 牌组 16 张（影响力 1-16）
  - II 牌组 16 张（影响力 1-16）
  - 每张卡包含：id, influence, faction, abilityIds, difficulty, deckVariant, nameKey, descriptionKey, imageIndex
  - 新增 `getAtlasIndex()` 转换函数（处理缺失卡牌 11 和 12）

- ✅ `domain/abilityRegistry.ts` - 32个能力定义
  - 每个能力包含：id, nameKey, descriptionKey, type, effects

- ✅ `domain/ids.ts` - 所有稳定 ID 常量表
  - CARD_IDS_DECK_I / CARD_IDS_DECK_II
  - FACTION_IDS
  - ABILITY_IDS
  - CARDIA_ATLAS_IDS

#### 2.3 完善类型定义 ✅

- ✅ `domain/core-types.ts` - 核心状态接口
  - `GamePhase` 类型（play, ability, end）
  - `PlayerState` 接口
  - `CardiaCore` 接口

- ✅ `domain/commands.ts` - 命令类型
  - PLAY_CARD, ACTIVATE_ABILITY, SKIP_ABILITY, END_TURN

- ✅ `domain/events.ts` - 事件类型
  - CARD_PLAYED, ABILITY_ACTIVATED, TURN_ENDED 等

#### 2.4 数据完整性验证 ✅

- ✅ `DATA-COMPLETENESS-VERIFICATION.md` - 详细验证报告
  - 必要信息判断原则检查（5项全部通过）
  - 字段完整性自检（所有素材信息都有对应字段）
  - 反模式检查（无硬编码、无 UI 状态混入 core）
  - 面向百游戏设计检查（数据结构可扩展）

### 验收结果

- ✅ 规则文档完整录入
- ✅ 静态数据全部录入代码，核对表已确认
- ✅ types.ts 中所有类型能覆盖规则文档描述的实体
- ✅ ids.ts 常量表覆盖所有稳定 ID
- ✅ 数据文件可正常导入，无循环依赖
- ✅ 冒烟测试通过

---

## 阶段 3：领域内核实现（Command → Event → Reduce）✅

**目标**：完成确定性核心逻辑，测试通过

### 完成内容

#### 3.1 实现 validate（命令校验）✅

- ✅ `domain/validate.ts` - 命令校验逻辑
  - 检查是否是当前玩家的回合
  - 检查当前阶段是否允许此命令
  - 检查命令参数合法性
  - 检查资源/条件是否满足

#### 3.2 实现 execute（生成事件）✅

- ✅ `domain/execute.ts` - 事件生成逻辑
  - PLAY_CARD → CARD_PLAYED 事件
  - ACTIVATE_ABILITY → ABILITY_ACTIVATED 事件
  - SKIP_ABILITY → ABILITY_SKIPPED 事件
  - END_TURN → TURN_ENDED 事件

#### 3.3 实现 reduce（应用事件到状态）✅

- ✅ `domain/reduce.ts` - 状态更新逻辑
  - 使用结构共享（spread），不用 JSON.parse/stringify
  - 提取 helper 函数到 `domain/utils.ts`
  - 纯函数，不依赖随机数

#### 3.4 实现 isGameOver ✅

- ✅ 检查胜利条件：
  - 玩家获得 5 个印戒
  - 对手无法打出卡牌
  - 某个能力直接宣告胜利

#### 3.5 补充单元测试 ✅

- ✅ `__tests__/validate.test.ts` - 验证测试
- ✅ `__tests__/execute.test.ts` - 执行测试
- ✅ `__tests__/reduce.test.ts` - 状态更新测试

### 验收结果

```bash
✅ npx vitest run src/games/cardia  # 所有测试通过（34/34）
```

---

## 阶段 4：FlowSystem 与系统组装 ✅

**目标**：接入 FlowSystem 完成阶段流转，game.ts 组装完毕

### 完成内容

#### 4.1 实现 FlowHooks ✅

- ✅ `domain/flowHooks.ts` - 阶段流转逻辑
  - initialPhase: 'play'
  - getNextPhase: play → ability → end → play
  - getActivePlayerId: 返回当前玩家
  - onPhaseExit: 阶段退出副作用（抽牌、结算印戒）
  - onPhaseEnter: 阶段进入副作用

#### 4.2 完善 game.ts ✅

- ✅ 系统组装：
  - FlowSystem（阶段流转）
  - EventStreamSystem（事件流）
  - LogSystem（日志）
  - ActionLogSystem（操作日志）
  - UndoSystem（撤销）
  - InteractionSystem（交互）
  - RematchSystem（重赛）
  - TutorialSystem（教学）
  - CheatSystem（调试）

- ✅ 命令类型列表：
  - PLAY_CARD, ACTIVATE_ABILITY, SKIP_ABILITY, END_TURN

#### 4.3 实现 CheatModifier ✅

- ✅ `domain/cheatModifier.ts` - 调试修改器
  - setPhase（切换阶段）
  - setSignets（设置印戒数量）
  - dealCardByIndex（发指定卡牌）

#### 4.4 ActionLog + 卡牌预览 ✅

- ✅ ActionLog 配置：
  - commandAllowlist（允许记录的命令）
  - formatEntry（格式化日志条目）

- ✅ 卡牌预览注册：
  - `ui/cardAtlas.ts` - 图集注册
  - `domain/atlasCatalog.ts` - 图集元数据

### 验收结果

```bash
✅ npm run generate:manifests  # 清单生成成功
✅ npx vitest run src/games/cardia  # 所有测试通过
✅ npm run dev  # 游戏可从大厅创建对局，基础回合可推进
```

---

## 阶段 5：Board/UI 与交互闭环 ✅

**目标**：提供最小可玩 UI，完成交互闭环

### 完成内容

#### 5.1 Board.tsx 主组件 ✅

- ✅ 基础状态管理（isGameOver, isMyTurn）
- ✅ 教学系统集成（useTutorialBridge）
- ✅ 音效系统集成（useGameAudio）
- ✅ 事件消费（useGameEvents）
- ✅ 游戏主 UI：
  - 对手区域（手牌数量、牌库、弃牌堆）
  - 中央战场区域（当前卡牌对比、VS 指示器）
  - 我的区域（手牌展示、可点击出牌）
  - 阶段指示器和操作按钮

#### 5.2 UI 子模块拆分 ✅

- ✅ `ui/cardAtlas.ts` - 图集注册
- ✅ CardDisplay 组件（卡牌展示）
- ✅ PlayerArea 组件（玩家区域）

#### 5.3 交互映射 ✅

- ✅ 点击手牌 → PLAY_CARD 命令
- ✅ 点击激活能力 → ACTIVATE_ABILITY 命令
- ✅ 点击跳过 → SKIP_ABILITY 命令
- ✅ 点击结束回合 → END_TURN 命令

#### 5.4 图集系统转换 ✅

- ✅ 从 `OptimizedImage` 迁移到 `CardPreview` + 图集
- ✅ 使用 `getAtlasIndex()` 转换函数
- ✅ 缺失卡牌显示派系颜色背景（降级策略）
- ✅ 性能提升：HTTP 请求从 48 个减少到 1 个（96% 减少）

### 验收结果

- ✅ 核心操作可在 UI 中完成
- ✅ 阶段推进正常
- ✅ 结束界面正常显示
- ✅ E2E 测试通过（3/3）

---

## 阶段 6：收尾与启用 ✅

**目标**：补齐 i18n、测试、教学、音效

### 完成内容

#### 6.1 i18n 文案 ✅

- ✅ `public/locales/zh-CN/game-cardia.json` - 中文文案
  - 阶段名称、命令描述、UI 文本
  - 卡牌名称、能力描述
  - 派系名称、教学步骤文案

- ✅ `public/locales/en/game-cardia.json` - 英文文案
  - 完整双语支持

#### 6.2 教学配置 ✅

- ✅ `tutorial.ts` - 教学配置
  - setup 步骤（AI 自动完成选角）
  - UI 介绍步骤（高亮 UI 元素）
  - 操作教学步骤（requireAction + allowedCommands）

#### 6.3 音频配置 ✅

- ✅ `audio.config.ts` - 音频配置
  - feedbackResolver（事件 → 音效映射）
  - criticalSounds（预加载高频音效）
  - BGM 列表

#### 6.4 关键图片预加载 ✅

- ✅ 图集系统：
  - `public/assets/i18n/zh-CN/cardia/cards/compressed/cards.webp`
  - 10624x12288 像素，8列 x 6行 = 48个格子
  - 单元格 1328x2048 像素
  - WebP 格式，17MB

- ✅ manifest.ts 配置：
  - criticalImages（关键图片预加载）

#### 6.5 缩略图 ✅

- ✅ `thumbnail.tsx` - 使用 `ManifestGameThumbnail` 组件
- ✅ manifest.ts 配置 `thumbnailPath`

#### 6.6 最终验证 ✅

```bash
✅ npm run generate:manifests  # 成功生成清单
✅ npx vitest run src/games/cardia  # 所有测试通过（34/34）
✅ npm run test:e2e  # E2E 测试通过（3/3）
✅ npm run dev  # 大厅可见、可创建对局、可完整游玩
```

### 验收结果

- ✅ 清单生成成功
- ✅ 所有测试通过
- ✅ 游戏可从大厅进入并完成完整游玩流程
- ✅ i18n 双语齐全
- ✅ 音效系统正常
- ✅ 教学系统正常
- ✅ 图集系统正常

---

## 总体进度总结

| 阶段 | 状态 | 完成度 | 备注 |
|------|------|--------|------|
| 阶段 1：目录骨架与 Manifest | ✅ 完成 | 100% | 所有文件已创建 |
| 阶段 1.5：机制分解与数据结构设计 | ✅ 完成 | 100% | 数据结构设计完成，无引擎缺口 |
| 阶段 2：数据录入 | ✅ 完成 | 100% | 规则文档、卡牌数据、能力数据全部录入 |
| 阶段 3：领域内核实现 | ✅ 完成 | 100% | validate/execute/reduce 全部实现 |
| 阶段 4：FlowSystem 与系统组装 | ✅ 完成 | 100% | 所有系统已组装 |
| 阶段 5：Board/UI 与交互闭环 | ✅ 完成 | 100% | UI 完成，图集系统已转换 |
| 阶段 6：收尾与启用 | ✅ 完成 | 100% | i18n/音效/教学/图集全部完成 |

**总体完成度：100%**

---

## 关键成果

### 代码质量

- ✅ TypeScript 编译无错误
- ✅ 单元测试覆盖率：34/34 通过
- ✅ E2E 测试覆盖率：3/3 通过
- ✅ 无数据驱动反模式
- ✅ 符合面向百游戏设计原则

### 性能优化

- ✅ 图集系统：HTTP 请求从 48 个减少到 1 个（96% 减少）
- ✅ 文件大小：从 ~18MB 减少到 17MB
- ✅ 首次加载速度显著提升

### 文档完整性

- ✅ 规则文档（`rule/卡迪亚规则.md`）
- ✅ 数据完整性验证报告（`DATA-COMPLETENESS-VERIFICATION.md`）
- ✅ 各阶段完成报告（PHASE6.1-6.15）
- ✅ 代码审查报告（`CODE-REVIEW-PHASE6.12.md`）

### 已知问题

- ⚠️ 原始素材缺少 2 张卡牌图片（11 和 12 号：大师工匠、将军）
- ✅ 已有降级策略：显示派系颜色背景

---

## 下一步计划

### 可选优化

1. **补充缺失卡牌图片**
   - 获取 11 号卡牌（大师工匠）图片
   - 获取 12 号卡牌（将军）图片
   - 重新生成图集

2. **英文版支持**
   - 创建英文图集（如需要）
   - 验证英文文案完整性

3. **性能优化**
   - 考虑进一步优化图集质量参数
   - 添加更多预加载策略

---

**文档版本**：1.0  
**最后更新**：2026-02-27  
**开发状态**：✅ 生产就绪
ç