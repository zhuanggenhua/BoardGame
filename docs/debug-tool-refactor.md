# 调试工具重构说明

## 概述
将调试面板的作弊指令从通用组件中分离到游戏专属配置文件，提高了可维护性和扩展性。

## 变更内容

### 1. 新增文件

#### `src/games/dicethrone/debug-config.tsx`
DiceThrone 游戏专属的调试工具配置，包含：

**资源修改**
- 选择玩家（P0/P1）
- 选择资源类型（CP/Health）
- 设置/增加/减少资源值

**骰子调整** ⭐ 新功能
- 独立调整 5 个骰子的点数（1-6）
- 快捷按钮：全部设为 1 或全部设为 6
- 应用按钮：一次性提交所有骰子修改

**Token 调整**
- 选择玩家
- 选择 Token 类型（莲花等）
- 设置 Token 数量

### 2. 修改文件

#### `src/components/GameDebugPanel.tsx`
- **删除**：硬编码的资源作弊 UI（CP/Health 选择器和按钮）
- **保留**：
  - 通用框架（视角切换、标签页、状态查看）
  - 动作执行器
  - 重置/新建房间功能
  - 状态复制/赋值功能
- **改进**：游戏专属工具通过 `children` prop 传入

#### `src/games/dicethrone/Board.tsx`
- **导入** `DiceThroneDebugConfig` 组件
- **传递** 游戏状态（`rawG`, `ctx`, `moves`）到调试配置
- **分离** 测试工具到单独的区块（布局编辑、额外骰子测试、卡牌特写测试）
- **修复** `CardSpotlightItem` 缺少 `timestamp` 的 TypeScript 错误

## 架构优势

### 1. 关注点分离
- **通用组件**（`GameDebugPanel`）：只负责布局、状态管理、通用功能
- **游戏配置**（`debug-config.tsx`）：定义游戏专属的作弊指令 UI

### 2. 可扩展性
- 每个游戏可以独立定义自己的调试工具
- 不同游戏的资源类型、特殊机制各不相同，现在可以分别配置

### 3. 可维护性
- 游戏逻辑和调试工具代码分离
- 减少通用组件的复杂度
- 更容易为新游戏添加调试工具

## 使用示例

### DiceThrone
```tsx
<GameDebugPanel G={rawG} ctx={ctx} moves={moves} playerID={playerID}>
  <DiceThroneDebugConfig G={rawG} ctx={ctx} moves={moves} />
  {/* 其他测试工具 */}
</GameDebugPanel>
```

### 其他游戏（未来）
```tsx
// 在 src/games/othergame/debug-config.tsx 中定义
export const OtherGameDebugConfig: React.FC<Props> = ({ G, ctx, moves }) => {
  return (
    <div>
      {/* 该游戏专属的作弊指令 UI */}
    </div>
  );
};

// 在 Board.tsx 中使用
<GameDebugPanel ...>
  <OtherGameDebugConfig G={G} ctx={ctx} moves={moves} />
</GameDebugPanel>
```

## 作弊命令系统

### 引擎层（通用）
定义在 `src/engine/systems/CheatSystem.ts`：
- `SYS_CHEAT_SET_RESOURCE` - 设置资源值
- `SYS_CHEAT_ADD_RESOURCE` - 增加/减少资源值
- `SYS_CHEAT_SET_PHASE` - 设置阶段
- `SYS_CHEAT_SET_DICE` - 设置骰子值 ⭐
- `SYS_CHEAT_SET_TOKEN` - 设置 Token 数量
- `SYS_CHEAT_SET_STATE` - 直接设置整个状态

### 游戏层（DiceThrone）
在 `src/games/dicethrone/Game.ts` 中配置：
```typescript
const diceThroneCheatModifier: CheatResourceModifier<DiceThroneCore> = {
    getResource: (core, playerId, resourceId) => {...},
    setResource: (core, playerId, resourceId, value) => {...},
    setPhase: (core, phase) => {...},
    setDice: (core, values) => {...}, // ⭐ 骰子修改实现
    setToken: (core, playerId, tokenId, amount) => {...},
};
```

### UI 层（调试面板）
在 `src/games/dicethrone/debug-config.tsx` 中：
- 提供友好的 UI 界面
- 调用相应的 `moves.SYS_CHEAT_*` 方法

## 测试验证

### 手动测试步骤
1. 启动开发服务器：`npm run dev`
2. 进入 DiceThrone 游戏
3. 打开调试面板（右下角 🛠️ 按钮）
4. 切换到"系统"标签页

### 验证项目
- [ ] 资源修改功能正常（CP、Health）
- [ ] 骰子调整功能正常（5 个独立输入框，全部设为 1/6 按钮）
- [ ] Token 调整功能正常（莲花）
- [ ] 应用骰子值后游戏状态更新
- [ ] 测试工具区块正常显示（布局编辑等）

## 已知问题

### 构建错误（非本次引入）
项目中存在一些预先存在的 TypeScript 错误，与本次重构无关：
- `src/engine/systems/FlowSystem.ts` - payload 缺失
- `src/games/dicethrone/domain/rules.ts` - 类型不匹配
- `src/games/dicethrone/monk/cards.ts` - 'any' 类型问题
- 其他文件的未使用变量警告

这些错误需要单独修复，不影响调试工具的功能。

## 未来改进建议

1. **更多作弊指令**
   - 直接抽取指定卡牌
   - 设置状态效果（击倒、能量等）
   - 跳转到特定阶段

2. **预设快捷方式**
   - "测试终极技能"：直接设置 5 个莲花
   - "测试防御"：设置对手攻击+给自己满血
   - "测试濒死"：设置自己 1 HP

3. **调试历史记录**
   - 记录最近使用的作弊指令
   - 一键重复上次操作

4. **跨游戏工具库**
   - 提取通用的调试 UI 组件（数字选择器、玩家选择器等）
   - 提供作弊指令构建器工具函数

## 卡牌名称显示通用化（2026-02-17）

### 问题
三个游戏的调试面板卡牌名称显示方式不一致：
- **SmashUp**：使用 `resolveCardName(def, t)` 获取国际化名称 ✅
- **DiceThrone**：硬编码 `card.i18n?.['zh-CN']?.name || card.id` ❌
- **SummonerWars**：直接使用 `card.name` 字段 ❌

### 解决方案
创建通用的卡牌名称解析器，支持三种游戏的不同数据结构。

#### 新增文件
- `src/components/game/framework/debug/cardNameResolver.ts` - 通用解析器
- `src/components/game/framework/debug/__tests__/cardNameResolver.test.ts` - 单元测试（7 个测试用例全部通过）

#### 解析策略
函数 `resolveCardDisplayName()` 按以下优先级尝试解析：
1. **DiceThrone 风格**：读取 `card.i18n[locale].name`，回退到英文
2. **SmashUp 风格**：使用 i18n 翻译函数 `t(key)`，支持 `cards.{id}.name` 格式
3. **SummonerWars 风格**：直接返回 `card.name` 字段
4. **回退**：返回 `card.id`

#### 修改的文件
- `src/games/dicethrone/debug-config.tsx` - 移除本地 `getCardDisplayName`，使用通用函数
- `src/games/summonerwars/debug-config.tsx` - 替换所有 `card.name` 直接访问
- `src/games/smashup/debug-config.tsx` - 内部使用 `resolveCardDisplayName` 替代 `resolveCardName`

#### 优势
- **统一接口**：所有游戏使用相同的函数签名
- **自动适配**：根据卡牌数据结构自动选择解析策略
- **可测试**：独立的单元测试覆盖所有场景
- **可扩展**：新游戏只需确保卡牌数据符合三种模式之一

#### 验证方式
启动游戏并打开调试面板（F12），检查：
- **DiceThrone**：牌库速查表显示中文卡牌名称（如"致命一击"）
- **SummonerWars**：精灵图索引速查表显示中文卡牌名称（如"骷髅战士"）
- **SmashUp**：牌库预览显示中文卡牌名称（如"外星入侵者"）

所有游戏的手牌预览也应正确显示国际化名称。

## 贡献者
- 重构设计与实现：2026-01-27
- 卡牌名称通用化：2026-02-17
