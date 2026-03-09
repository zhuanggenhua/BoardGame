# Card15 发明家 UI 优化完成

## 任务目标
在发明家的第二次交互中，显示所有卡牌（包括第一次选择的卡牌），但将第一次选择的卡牌标记为禁用（覆盖阴影 + "已选择"文字），方便玩家辨别当前战场情况。

## 实现方案

### 1. UI 层修改（CardSelectionModal.tsx）✅
- 添加 `disabledCardUids` 属性，接收禁用卡牌 UID 列表
- 修改 `handleCardClick` 函数，禁用的卡牌不可点击
- 为禁用的卡牌添加视觉效果：
  - 阴影覆盖层（`bg-black/60 backdrop-blur-[2px]`）
  - "已选择"文字提示（中英文 i18n）
  - `cursor-not-allowed` 和 `opacity-60` 样式
- 修改 `CardDisplay` 组件，添加 `isDisabled` 属性

### 2. 交互接口修改（interactionHandlers.ts）✅
- 在 `CardSelectionInteraction` 接口中添加 `disabledCards?: string[]` 字段

### 3. 系统层修改（systems.ts）✅
- 在创建第二次交互时：
  - 包含所有卡牌（不过滤第一张）
  - 设置 `secondInteraction.disabledCards = [firstCardId]`
- 在 `wrapCardiaInteraction` 函数中：
  - 将 `disabledCards` 传递到 `interaction.data.disabledCardUids`
  - 修改默认值从 `[]` 改为 `undefined`（避免不必要的空数组）

### 4. Board 层修改（Board.tsx）✅
- 传递 `disabledCardUids` 属性到 `CardSelectionModal`

### 5. i18n 翻译（game-cardia.json）✅
- 中文：`"alreadySelected": "已选择"`
- 英文：`"alreadySelected": "Already Selected"`

## 测试验证 ✅

运行 E2E 测试：
```bash
npx playwright test cardia-deck1-card15-inventor-fixed.e2e.ts --headed
```

测试结果：
- ✅ 第二次交互包含所有 4 张卡牌（包括第一张）
- ✅ 第一张卡牌被标记为禁用（`disabledCardUids` 包含第一张卡牌 UID）
- ✅ 第二次交互可以正常选择其他卡牌
- ✅ +3 和 -3 修正标记在不同的卡牌上

## 用户体验改进

### 优化前
- 第二次交互只显示 3 张卡牌（过滤掉第一张）
- 玩家无法看到完整的战场情况
- 需要记住第一次选择了哪张卡牌

### 优化后
- 第二次交互显示所有 4 张卡牌
- 第一张卡牌覆盖阴影 + "已选择"文字，清晰标识
- 玩家可以看到完整的战场情况，方便做出决策
- 禁用的卡牌不可点击（`cursor-not-allowed`）

## 技术亮点

1. **数据驱动**：通过 `disabledCards` 字段声明禁用状态，UI 层自动渲染
2. **类型安全**：在接口层添加 `disabledCards?: string[]` 字段，编译期检查
3. **视觉反馈**：阴影覆盖 + 文字提示 + 鼠标样式，多重视觉反馈
4. **国际化**：支持中英文"已选择"文字
5. **向后兼容**：`disabledCards` 为可选字段，不影响其他交互

## 相关文件

- `src/games/cardia/ui/CardSelectionModal.tsx` - UI 组件
- `src/games/cardia/domain/interactionHandlers.ts` - 交互接口
- `src/games/cardia/domain/systems.ts` - 系统层逻辑
- `src/games/cardia/Board.tsx` - Board 层传递
- `public/locales/zh-CN/game-cardia.json` - 中文翻译
- `public/locales/en/game-cardia.json` - 英文翻译
- `e2e/cardia-deck1-card15-inventor-fixed.e2e.ts` - E2E 测试

## 完成时间
2025-01-03
