# 召唤师战争 - 自定义牌组选择界面 - 任务列表

## 1. 准备工作

- [x] 1.1 添加国际化文案（中英文）
  - 文件: `public/locales/zh-CN/game-summonerwars.json`
  - 文件: `public/locales/en/game-summonerwars.json`
  - 新增 keys: `factionSelection.editDeck`, `newDeck`, `loadingDecks`, `loadDeckFailed`

- [x] 1.2 创建辅助函数文件
  - 文件: `src/games/summonerwars/ui/helpers/customDeckHelpers.ts`
  - 函数: `getSummonerAtlasIdByFaction(factionId: FactionId): string`
  - 函数: `isCustomDeckSelection(selection: string): boolean`
  - 函数: `extractCustomDeckId(selection: string): string | null`

## 2. 创建 CustomDeckCard 组件

- [x] 2.1 创建组件文件和类型定义
  - 文件: `src/games/summonerwars/ui/CustomDeckCard.tsx`
  - 定义 `CustomDeckCardProps` 接口
  - 导入必要的依赖（framer-motion, CardSprite, i18n 等）

- [x] 2.2 实现基础渲染逻辑
  - 使用 `motion.div` 包装卡片
  - 渲染召唤师精灵图（CardSprite）
  - 渲染底部渐变遮罩 + 牌组名称
  - 渲染 DIY 徽章（左上角）

- [x] 2.3 实现交互功能
  - 点击卡片触发 `onSelect` 回调
  - Hover 显示编辑按钮（右上角）
  - 点击编辑按钮触发 `onEdit` 回调（阻止事件冒泡）
  - 实现选中状态样式（金色边框 + ring 效果）

- [x] 2.4 实现动画效果
  - 入场动画：`initial={{ opacity: 0, y: 15 }}`
  - 显示动画：`animate={{ opacity: 1, y: 0 }}`
  - Hover 动画：`whileHover={{ scale: 1.02, y: -4 }}`
  - 点击动画：`whileTap={{ scale: 0.98 }}`
  - 动画延迟：基于 `index` prop

## 3. 修改 FactionSelectionAdapter 组件

- [x] 3.1 添加状态管理
  - 导入 `useAuth` Hook 获取 token
  - 导入 `listCustomDecks`, `getCustomDeck` API
  - 新增状态: `savedDecks: SavedDeckSummary[]`
  - 新增状态: `selectedCustomDeckId: string | null`
  - 新增状态: `editingDeckId: string | null`

- [x] 3.2 实现自定义牌组列表加载
  - 添加 `useEffect` 监听 token 变化
  - 调用 `listCustomDecks` API 获取牌组列表
  - 更新 `savedDecks` 状态
  - 错误处理：静默失败，不阻塞界面

- [x] 3.3 保持布局网格不变
  - 保持 `grid-cols-4` 不变
  - 保持 `max-w` 和卡片间距不变
  - 确保总共最多 8 个卡片位置（6 个默认 + 2 个自定义槽位）

- [x] 3.4 渲染自定义牌组卡片
  - 在默认阵营卡片之后渲染 `CustomDeckCard`
  - 使用 `savedDecks.slice(0, 2)` 限制最多显示 2 个
  - 传递正确的 props（deck, index, isSelectedByMe, t, onSelect, onEdit, onMagnify）
  - 计算正确的 `index`（`availableFactions.length + index`）

- [x] 3.5 实现自定义牌组选择逻辑
  - 实现 `handleSelectCustomDeck` 函数
  - 调用 `getCustomDeck` API 获取完整牌组数据
  - 更新 `selectedCustomDeckId` 状态
  - 更新 `customDeckInfoMap` 状态
  - 调用 `onSelectCustomDeck` 回调通知父组件
  - 错误处理：显示错误提示（TODO: 集成 Toast）

- [x] 3.6 实现"+"按钮条件显示
  - 提取为独立组件 `NewDeckButton`（可选）
  - 仅当 `savedDecks.length < 2` 时显示"+"按钮
  - 调整 `transition.delay` 计算（基于实际卡片数量）
  - 确保按钮显示在自定义牌组卡片之后

- [x] 3.7 实现编辑牌组功能
  - 修改 `DeckBuilderDrawer` 的 `isOpen` 状态管理
  - 新增状态: `editingDeckId: string | null`
  - 点击编辑按钮时设置 `editingDeckId` 并打开构建器
  - 传递 `editingDeckId` 给 `DeckBuilderDrawer`

## 4. 修改 DeckBuilderDrawer 组件

- [x] 4.1 扩展 Props 接口
  - 新增 prop: `initialDeckId?: string`
  - 用于编辑模式时加载指定牌组

- [x] 4.2 实现编辑模式逻辑
  - 添加 `useEffect` 监听 `isOpen` 和 `initialDeckId`
  - 如果 `initialDeckId` 存在，调用 `loadDeck(initialDeckId)`
  - 如果 `initialDeckId` 不存在，调用 `resetDeck()`
  - 确保打开构建器时正确加载或重置状态

- [x] 4.3 实现保存后刷新
  - 新增 prop: `onDeckSaved?: () => void`
  - 包装 `saveDeck` 和 `deleteDeck` 函数，成功后调用 `onDeckSaved`
  - 在 `FactionSelectionAdapter` 中实现 `refreshDeckList` 函数
  - 传递 `refreshDeckList` 给 `DeckBuilderDrawer`

## 5. 修改 PlayerStatusCard 组件

- [x] 5.1 扩展自定义牌组显示逻辑
  - 判断 `customDeckInfo` 是否存在
  - 如果存在，显示"自定义牌组"标签 + DIY 徽章
  - 显示召唤师阵营信息作为子文本

- [x] 5.2 调整样式
  - 确保 DIY 徽章与卡片样式一致（紫色主题）
  - 确保文本截断和布局不会因内容变化而错位

## 6. 精灵图处理

- [x] 6.1 实现精灵图预加载
  - 在 `FactionSelectionAdapter` 中添加 `useEffect`
  - 遍历 `savedDecks`，预加载每个牌组的召唤师精灵图
  - 使用 `getSummonerAtlasIdByFaction` 获取 atlasId
  - 使用 `getSpriteAtlasSource` 获取图片 URL
  - 创建 `Image` 对象预加载

- [x] 6.2 测试精灵图显示
  - 验证每个阵营的召唤师精灵图正确显示
  - 验证精灵图缓存机制正常工作

## 7. 错误处理和用户反馈

- [x] 7.1 加载状态显示
  - 在加载牌组列表时显示 loading 状态（可选）
  - 使用 skeleton 或 spinner

- [x] 7.2 错误提示
  - 集成 Toast 组件（如果项目中已有）
  - 加载牌组失败时显示错误提示
  - 选择牌组失败时显示错误提示

## 8. 测试

- [x] 8.1 单元测试 - CustomDeckCard
  - 文件: `src/games/summonerwars/ui/__tests__/CustomDeckCard.test.tsx`
  - 测试: 正确渲染牌组名称和 DIY 徽章
  - 测试: 点击卡片触发 onSelect
  - 测试: 点击编辑按钮触发 onEdit
  - 测试: 选中状态样式正确应用

- [x] 8.2 单元测试 - FactionSelectionAdapter
  - 文件: `src/games/summonerwars/ui/__tests__/FactionSelectionAdapter.test.tsx`
  - 测试: 正确加载自定义牌组列表
  - 测试: 4列网格布局保持不变
  - 测试: 卡片顺序正确（默认阵营 → 自定义牌组 → "+"按钮）
  - 测试: "+"按钮仅在自定义牌组数量 < 2 时显示
  - 测试: 选择自定义牌组后状态更新

- [x] 8.3 E2E 测试 - 显示已保存的自定义牌组
  - 文件: `e2e/summonerwars-custom-deck-selection.e2e.ts`
  - 场景: 用户已有 2 个已保存牌组
  - 验证: 界面显示 6 个默认阵营 + 2 个自定义牌组 + 1 个"+"按钮
  - 验证: 自定义牌组卡片显示正确信息（名称、DIY 徽章）
  - 注意: 部分测试需要测试数据，已创建手动测试指南

- [x] 8.4 E2E 测试 - 选择自定义牌组进入对局
  - 场景: 点击自定义牌组卡片
  - 验证: 卡片高亮显示
  - 验证: 玩家状态区显示牌组信息
  - 验证: 可以点击"准备"按钮
  - 验证: 游戏开始时使用自定义牌组初始化
  - 注意: 需要测试数据，参考手动测试指南

- [x] 8.5 E2E 测试 - 编辑已保存的自定义牌组
  - 场景: Hover 自定义牌组卡片并点击编辑按钮
  - 验证: 牌组构建器打开并加载牌组数据
  - 验证: 修改并保存后，阵营选择界面刷新显示更新后的信息
  - 注意: 需要测试数据，参考手动测试指南

- [x] 8.6 E2E 测试 - 创建新的自定义牌组
  - 场景: 点击"+"按钮
  - 验证: 牌组构建器打开且处于新建模式（空白状态）
  - 验证: 保存新牌组后，阵营选择界面刷新显示新牌组
  - 注意: 需要测试数据，参考手动测试指南

- [ ] 8.5 E2E 测试 - 编辑已保存的自定义牌组
  - 场景: Hover 自定义牌组卡片并点击编辑按钮
  - 验证: 牌组构建器打开并加载牌组数据
  - 验证: 修改并保存后，阵营选择界面刷新显示更新后的信息

- [ ] 8.6 E2E 测试 - 创建新的自定义牌组
  - 场景: 点击"+"按钮
  - 验证: 牌组构建器打开且处于新建模式（空白状态）
  - 验证: 保存新牌组后，阵营选择界面刷新显示新牌组

## 9. 文档更新

- [x] 9.1 更新用户文档
  - 文件: `docs/games/summonerwars/custom-deck-selection-user-guide.md`
  - 说明如何在阵营选择界面查看和选择自定义牌组
  - 说明如何编辑已保存的牌组
  - 包含功能简介、使用步骤、界面说明、常见问题、最佳实践

- [x] 9.2 更新开发文档
  - 文件: `docs/games/summonerwars/custom-deck-selection-dev-guide.md`
  - 记录自定义牌组卡片的设计规范
  - 记录布局调整的原因和考虑因素
  - 包含架构设计、组件详解、API 使用、辅助函数、测试指南、扩展指南

## 10. 优化和收尾

- [x] 10.1 性能优化
  - 实现精灵图并行预加载（Promise.all）
  - 添加错误处理和日志
  - 添加取消机制
  - 创建性能优化文档

- [x] 10.2 代码审查
  - 确保代码符合项目规范（ESLint, TypeScript）
  - 确保所有 TODO 注释已处理
  - 确保错误处理完整

- [ ] 10.3 视觉调整
  - 与设计稿对比，调整间距、颜色、字体大小
  - 确保动画流畅自然
  - 确保 4 列布局在不同屏幕尺寸下正常显示
  - 验证最多 8 个卡片位置的布局效果

- [ ] 10.4 最终测试
  - 手动测试所有用户场景
  - 运行所有自动化测试
  - 修复发现的 bug

## 任务依赖关系

```
1. 准备工作
   ↓
2. 创建 CustomDeckCard 组件
   ↓
3. 修改 FactionSelectionAdapter 组件
   ↓
4. 修改 DeckBuilderDrawer 组件
   ↓
5. 修改 PlayerStatusCard 组件
   ↓
6. 精灵图处理
   ↓
7. 错误处理和用户反馈
   ↓
8. 测试
   ↓
9. 文档更新
   ↓
10. 优化和收尾
```

## 预估工作量

- 准备工作: 0.5 小时
- 组件开发: 3-4 小时
- 测试: 2-3 小时
- 文档和优化: 1 小时
- **总计: 6.5-8.5 小时**

## 注意事项

1. **保持向后兼容**: 确保修改不影响现有的默认阵营选择功能
2. **错误处理**: 所有 API 调用必须有错误处理，不能让错误导致界面崩溃
3. **性能**: 注意精灵图加载的性能影响，使用预加载和缓存策略
4. **测试覆盖**: 确保核心功能有 E2E 测试覆盖，避免回归
5. **国际化**: 所有文案必须支持中英文，不能硬编码
