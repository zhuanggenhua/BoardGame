# Cardia 代码审查与审计报告

## 审查日期
2026-02-27

## 审查范围
- 领域层核心文件（types, commands, events, execute, validate, reduce）
- 游戏引擎配置（game.ts）
- 图片资源映射系统
- 数据注册表（cardRegistry, locationRegistry）

---

## 一、通用实现缺陷检查（D1-D24 维度）

### ✅ D1: 语义保真
**状态**: 良好
- 命令、事件、状态转换逻辑清晰
- 遭遇战解析逻辑正确（影响力比较 → 判定胜负 → 授予印戒）
- 阶段流转符合游戏规则（play → ability → end → play）

### ✅ D2: 边界完整
**状态**: 良好
- validate.ts 中有完整的边界检查：
  - 回合归属检查（`playerId !== core.currentPlayerId`）
  - 阶段检查（`core.phase !== 'play'`）
  - 卡牌归属检查（`player.hand.find(c => c.uid === cardUid)`）
  - 重复操作检查（`player.hasPlayed`）

### ⚠️ D3: 数据流闭环
**状态**: 部分完整，有改进空间

**已完成**:
- ✅ 卡牌定义 → cardRegistry → setupDeck → createCardInstance
- ✅ 地点卡定义 → locationRegistry
- ✅ 命令定义 → 验证 → 执行 → 事件 → 归约
- ✅ 图片路径映射完整（imagePath 字段已修复）

**缺失**:
- ❌ **i18n 文案未添加**：卡牌名称和描述的 i18n key 已定义但文案未添加
  - 需要添加：`public/locales/zh-CN/game-cardia.json`
  - 需要添加：`public/locales/en/game-cardia.json`
- ❌ **能力注册表未完整**：abilityRegistry.ts 存在但能力定义可能不完整
- ❌ **测试覆盖缺失**：未找到 E2E 测试或单元测试

**建议**:
1. 补充 i18n 文案（32 张卡牌 + 8 张地点卡）
2. 审查 abilityRegistry.ts 确保所有能力都已定义
3. 添加基础测试覆盖

### ⚠️ D4: 查询一致性
**状态**: 良好，但需确认

**已实现**:
- ✅ `calculateInfluence(card, core)` 统一查询影响力（包含修正和持续效果）
- ✅ Board.tsx 中使用 `calculateInfluence` 而非直接读 `card.baseInfluence`

**需确认**:
- ⚠️ 能力执行器中是否所有影响力查询都走 `calculateInfluence`？
- ⚠️ 是否有其他可被 buff 修改的属性需要统一查询入口？

### ❌ D5: 交互完整
**状态**: 不完整

**问题**:
1. **交互命令未实现**：
   - `executeChooseCard` 返回空数组（TODO 注释）
   - `executeChooseFaction` 返回空数组（TODO 注释）
   - `validateChooseCard` 只返回 `{ valid: true }`（无实际验证）
   - `validateChooseFaction` 只返回 `{ valid: true }`（无实际验证）

2. **能力执行中的交互缺失**：
   - 能力定义中可能需要玩家选择（如选择弃牌、选择派系）
   - 但交互系统未完整实现

**建议**:
1. 实现 `CHOOSE_CARD` 和 `CHOOSE_FACTION` 命令的执行逻辑
2. 集成 InteractionSystem
3. 在 abilityExecutor.ts 中使用交互系统

### ✅ D6: 副作用传播
**状态**: 良好
- 遭遇战解析 → 印戒授予 → 游戏结束检测（在 domain/index.ts 的 isGameOver 中）
- 能力激活 → 能力效果 → 状态变更

### ⚠️ D7: 资源守恒
**状态**: 基本正确，需确认

**已实现**:
- ✅ 抽牌时检查牌库是否为空（`if (player.deck.length > 0)`）
- ✅ 弃牌时从手牌/牌库移除并加入弃牌堆
- ✅ 回收卡牌时从弃牌堆移除并加入手牌

**需确认**:
- ⚠️ 能力执行中的资源消耗是否正确？（需审查 abilityExecutor.ts）
- ⚠️ 修正标记的添加/移除是否有数量限制？

### ⚠️ D8: 时序正确
**状态**: 基本正确，有潜在问题

**已实现**:
- ✅ 阶段流转顺序正确：play → ability → end → play
- ✅ 遭遇战解析在双方都打出卡牌后触发
- ✅ 能力激活在遭遇战解析后（ability 阶段）

**潜在问题**:
1. **双方同时打出卡牌的时序**：
   - 当前实现：第一个玩家打出卡牌 → 等待 → 第二个玩家打出卡牌 → 解析遭遇战
   - 问题：如果第一个玩家打出卡牌后断线，游戏会卡住
   - 建议：添加超时机制或允许撤销

2. **能力执行顺序**：
   - 只有失败者可以激活能力（正确）
   - 但如果有多个能力，激活顺序如何？（需确认规则）

3. **回合结束时的清理顺序**：
   - 当前：抽牌 → 回合结束 → 阶段变化
   - 需确认：持续效果何时清理？修正标记何时清理？

### ✅ D9: 幂等与重入
**状态**: 良好
- 命令验证防止重复操作（`player.hasPlayed` 检查）
- 事件归约使用结构共享，不会产生副作用

### ⚠️ D10: 元数据一致
**状态**: 需确认

**需检查**:
- ⚠️ 能力定义中的 `categories`/`tags` 是否与实际行为匹配？
- ⚠️ 卡牌定义中的 `difficulty` 是否正确？

### ⚠️ D11-D14: Reducer 消耗路径、写入-消耗对称、多来源竞争、回合清理完整
**状态**: 需深入审查

**需确认**:
1. **修正标记的消耗**：
   - `reduceModifierAdded` 使用 `addModifier` 添加到 `card.modifiers`
   - `calculateInfluence` 使用 `applyModifiers` 消耗
   - 需确认：消耗路径是否正确？是否有遗漏？

2. **持续效果的消耗**：
   - `reduceOngoingAdded` 添加到 `player.tags`
   - `calculateInfluence` 中手动检查 `player.tags.tags[druidTag]`
   - 问题：这种手动检查不够通用，如果有更多持续效果会很难维护
   - 建议：使用统一的持续效果查询函数

3. **回合清理**：
   - `reduceTurnEnded` 重置 `hasPlayed` 和 `currentCard`
   - 问题：修正标记何时清理？持续效果何时清理？
   - 需确认：游戏规则中哪些状态是临时的，哪些是永久的

### ⚠️ D15: UI 状态同步
**状态**: 基本正确，需确认

**已实现**:
- ✅ Board.tsx 使用 `calculateInfluence` 显示最终影响力
- ✅ 显示印戒数量（`card.signets`）
- ✅ 显示能力图标（`card.abilityIds.length > 0`）

**需确认**:
- ⚠️ 修正标记是否在 UI 上显示？
- ⚠️ 持续效果是否在 UI 上显示？
- ⚠️ 弃牌堆、牌库数量是否正确显示？

### ✅ D16-D20: 其他维度
**状态**: 暂无明显问题，需在实际测试中验证

---

## 二、架构层面审查

### 1. 三层模型遵循情况
**状态**: ✅ 良好

- ✅ 领域层（`domain/`）：纯业务逻辑，无 UI 依赖
- ✅ 引擎层（`engine/`）：通用系统，可复用
- ✅ UI 层（`Board.tsx`）：只负责展示和交互

### 2. 数据驱动原则
**状态**: ✅ 良好

- ✅ 卡牌定义在 `cardRegistry.ts` 中，数据驱动
- ✅ 地点卡定义在 `locationRegistry.ts` 中，数据驱动
- ✅ 命令和事件使用常量表（`CARDIA_COMMANDS`, `CARDIA_EVENTS`）

**无硬编码问题**：
- ✅ 没有 `switch-case` 硬编码技能逻辑（使用 `abilityExecutor.ts`）
- ✅ 没有 `if-else` 硬编码卡牌逻辑

### 3. 类型安全
**状态**: ✅ 优秀

- ✅ 所有命令、事件、状态都有完整的 TypeScript 类型定义
- ✅ 使用 `Extract<>` 类型守卫确保类型安全
- ✅ 使用 `as const` 确保常量表类型推断

### 4. 结构共享
**状态**: ✅ 良好

- ✅ `reduce.ts` 中使用 spread 操作符进行结构共享
- ✅ 使用 `updatePlayer` 辅助函数简化更新逻辑
- ✅ 没有使用 `JSON.parse(JSON.stringify())` 深拷贝

### 5. 错误处理
**状态**: ⚠️ 需改进

**已实现**:
- ✅ validate.ts 中有详细的 console.warn 日志
- ✅ 返回明确的错误信息（`{ valid: false, error: '...' }`）

**缺失**:
- ❌ execute.ts 中缺少错误处理（如卡牌不存在时直接返回空数组）
- ❌ reduce.ts 中缺少防御性检查（如 `player.currentCard` 可能为 undefined）

**建议**:
1. 在 execute.ts 中添加防御性检查
2. 在 reduce.ts 中添加更多的边界检查
3. 考虑使用 Result 类型（`{ success: boolean, data?: T, error?: string }`）

---

## 三、图片资源审查

### 1. 图片路径映射
**状态**: ✅ 已修复

- ✅ 所有 `imagePath` 已更新为实际文件名（`1`, `2` 而非 `card_01`, `card_02`）
- ✅ 32 张人物牌路径正确
- ✅ 8 张地点卡路径正确
- ✅ 主题图路径正确（`cardia/cards/title`）

### 2. OptimizedImage 集成
**状态**: ✅ 良好

- ✅ Board.tsx 中正确使用 `OptimizedImage` 组件
- ✅ 有回退机制（`imagePath` 优先，`imageIndex` 回退）
- ✅ 路径格式正确（不含扩展名，不含 compressed/）

### 3. 向后兼容性
**状态**: ✅ 良好

- ✅ 保留了 `imageIndex` 字段
- ✅ CardInstance 接口同时支持 `imagePath` 和 `imageIndex`

---

## 四、关键问题汇总

### 🔴 高优先级问题

1. **交互系统未实现**（D5）
   - `CHOOSE_CARD` 和 `CHOOSE_FACTION` 命令只有占位符
   - 能力执行中需要玩家选择的场景无法处理
   - **影响**：部分能力无法正常工作
   - **建议**：实现交互系统或使用引擎层的 InteractionSystem

2. **i18n 文案缺失**（D3）
   - 32 张卡牌的名称和描述未添加
   - 8 张地点卡的名称和描述未添加
   - **影响**：UI 显示会出现 i18n key 而非实际文本
   - **建议**：补充 `public/locales/zh-CN/game-cardia.json` 和 `public/locales/en/game-cardia.json`

3. **测试覆盖缺失**（D3）
   - 未找到 E2E 测试
   - 未找到单元测试
   - **影响**：无法验证功能正确性
   - **建议**：添加基础测试覆盖（至少覆盖核心流程）

### 🟡 中优先级问题

4. **持续效果查询不够通用**（D11）
   - `calculateInfluence` 中手动检查特定能力的 tag
   - **影响**：新增持续效果时需要修改 `calculateInfluence`
   - **建议**：提取通用的持续效果查询函数

5. **回合清理逻辑不明确**（D14）
   - 修正标记何时清理？
   - 持续效果何时清理？
   - **影响**：可能导致状态泄漏
   - **建议**：明确清理规则并实现

6. **错误处理不完整**（架构层面）
   - execute.ts 中缺少防御性检查
   - reduce.ts 中缺少边界检查
   - **影响**：可能导致运行时错误
   - **建议**：添加防御性编程

### 🟢 低优先级问题

7. **UI 状态显示不完整**（D15）
   - 修正标记未在 UI 上显示
   - 持续效果未在 UI 上显示
   - **影响**：玩家无法看到完整的游戏状态
   - **建议**：添加修正标记和持续效果的 UI 显示

8. **能力注册表需审查**（D3）
   - 需确认所有能力都已定义
   - 需确认能力定义与规则一致
   - **建议**：审查 `abilityRegistry.ts` 和 `abilityExecutor.ts`

---

## 五、代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型安全 | ⭐⭐⭐⭐⭐ | TypeScript 类型定义完整，类型守卫使用正确 |
| 架构设计 | ⭐⭐⭐⭐⭐ | 三层模型清晰，数据驱动，结构共享 |
| 代码可读性 | ⭐⭐⭐⭐⭐ | 命名清晰，注释充分，逻辑清晰 |
| 数据完整性 | ⭐⭐⭐⭐☆ | 卡牌和地点卡定义完整，但 i18n 文案缺失 |
| 功能完整性 | ⭐⭐⭐☆☆ | 核心流程完整，但交互系统未实现 |
| 测试覆盖 | ⭐☆☆☆☆ | 缺少测试 |
| 错误处理 | ⭐⭐⭐☆☆ | 验证层完善，但执行层和归约层需改进 |
| 资源管理 | ⭐⭐⭐⭐⭐ | 图片路径映射正确，OptimizedImage 集成良好 |

**总体评分**: ⭐⭐⭐⭐☆ (4/5)

---

## 六、改进建议优先级

### 立即执行（阻塞性问题）

1. **补充 i18n 文案**
   - 文件：`public/locales/zh-CN/game-cardia.json`
   - 文件：`public/locales/en/game-cardia.json`
   - 内容：32 张卡牌 + 8 张地点卡的名称和描述

2. **实现交互系统**
   - 文件：`domain/execute.ts`（`executeChooseCard`, `executeChooseFaction`）
   - 文件：`domain/validate.ts`（`validateChooseCard`, `validateChooseFaction`）
   - 集成：使用引擎层的 InteractionSystem

### 短期执行（1-2 周）

3. **添加基础测试**
   - E2E 测试：核心流程（打出卡牌 → 遭遇战 → 能力激活 → 回合结束）
   - 单元测试：关键函数（`calculateInfluence`, `resolveEncounter`）

4. **改进错误处理**
   - 在 execute.ts 中添加防御性检查
   - 在 reduce.ts 中添加边界检查

5. **明确回合清理规则**
   - 文档化：哪些状态是临时的，哪些是永久的
   - 实现：在 `reduceTurnEnded` 中添加清理逻辑

### 中期执行（1 个月）

6. **优化持续效果系统**
   - 提取通用的持续效果查询函数
   - 重构 `calculateInfluence` 使用通用函数

7. **完善 UI 显示**
   - 显示修正标记
   - 显示持续效果
   - 显示更多游戏状态信息

8. **审查能力系统**
   - 审查 `abilityRegistry.ts` 确保所有能力都已定义
   - 审查 `abilityExecutor.ts` 确保能力执行逻辑正确

---

## 七、总结

### 优点
1. ✅ 架构设计优秀，遵循三层模型和数据驱动原则
2. ✅ 类型安全完善，TypeScript 使用得当
3. ✅ 代码可读性高，命名清晰，注释充分
4. ✅ 图片资源映射系统完整，路径正确
5. ✅ 结构共享实现正确，性能良好

### 缺点
1. ❌ 交互系统未实现，部分能力无法工作
2. ❌ i18n 文案缺失，UI 显示不完整
3. ❌ 测试覆盖缺失，无法验证功能正确性
4. ⚠️ 错误处理不完整，缺少防御性编程
5. ⚠️ 回合清理逻辑不明确，可能导致状态泄漏

### 建议
1. **优先补充 i18n 文案和实现交互系统**，这是阻塞性问题
2. **添加基础测试覆盖**，确保核心流程正确
3. **改进错误处理**，提高代码健壮性
4. **明确回合清理规则**，防止状态泄漏
5. **持续优化**，逐步完善 UI 显示和能力系统

---

**审查者**：Kiro AI Assistant  
**审查日期**：2026-02-27  
**审查结果**：✅ 代码质量良好，有改进空间，建议按优先级逐步完善
