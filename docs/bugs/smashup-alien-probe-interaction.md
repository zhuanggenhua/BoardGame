# Bug: alien_probe（探究）效果错误

## 问题描述

**游戏**: SmashUp  
**提交者**: 匿名用户  
**时间**: 2026/2/28 14:47:12  
**状态**: ✅ 已修复

## 问题详情

alien_probe（探究）的实现效果与官方规则完全不符。

### 错误的实现（修复前）
1. 查看对手手牌
2. 查看对手牌库顶
3. 选择将牌库顶的牌放回顶部或底部

### 正确的效果（官方规则）
根据 Wiki 和卡牌图片：
> "Look at another player's hand and choose a minion in it. That player discards that minion."
> 
> 中文：查看一个玩家的手牌，选择一张随从卡，该个玩家弃掉这张随从

正确流程：
1. 查看对手手牌
2. 选择其中一张随从卡
3. 对手弃掉那张随从

## 根本原因

代码实现了完全错误的效果，可能是与其他卡牌（如 alien_abduction）混淆了。

## 修复方案

### 代码变更

1. **修改 `src/games/smashup/abilities/aliens.ts`**
   - `alienProbe()` 函数：改为查看手牌并选择随从弃掉
   - 交互处理器 `alien_probe_choose_target`：展示手牌并创建选择随从的交互
   - 交互处理器 `alien_probe`：执行弃牌操作
   - 添加 `getMinionDef` 和 `CardsDiscardedEvent` 导入
   - **审计修复**：
     - 添加 `defId` 到选项 value（D34：UI 渲染模式正确性）
     - 添加 `_source: 'hand'`（D37：交互选项动态刷新完整性）

2. **更新 i18n 文件**
   - `public/locales/zh-CN/game-smashup.json`
   - `public/locales/en/game-smashup.json`
   - 修正卡牌描述和交互提示文本

3. **添加测试**
   - `src/games/smashup/__tests__/alien-probe-bug.test.ts`
   - 覆盖单对手、多对手、无随从等场景

### 审计发现的问题

**D34 交互选项 UI 渲染模式正确性**：
- ❌ 原实现：选项 value 只包含 `{ cardUid, targetPlayerId }`
- ✅ 修复后：添加 `defId` 字段，使 UI 能正确识别为卡牌选项并显示预览

**D37 交互选项动态刷新完整性**：
- ❌ 原实现：缺少 `_source` 字段
- ✅ 修复后：添加 `_source: 'hand'`，支持框架层自动刷新（防止同时触发多个交互时选项过时）

### 测试结果

所有测试通过 ✅
- 单对手场景：打出探究应该创建选择随从的交互
- 选择随从后，对手应该弃掉那张随从
- 对手手牌中没有随从时，效果结束
- 多对手场景：打出探究应该先选择对手

## 验收标准

- [x] 打出探究后，查看对手手牌
- [x] 选项只包含对手手牌中的随从卡
- [x] 选择随从后，对手弃掉该随从
- [x] 对手手牌中没有随从时，效果结束
- [x] 多对手场景下，先选择对手
- [x] 所有测试通过

## UX 改进

✅ **已实现**：参考 `zombieWalker` 模式，优化为单步操作

**改进前**：
1. 展示对手手牌（`RevealOverlay`）→ 点击关闭
2. 弹出选择交互（`PromptOverlay`）→ 选择随从

**改进后**：
1. 直接在 `PromptOverlay` 中展示对手手牌并允许选择（单步完成）

**实现细节**：
- 不使用 `REVEAL_HAND` 事件（避免两步操作）
- 直接创建交互，在 `PromptOverlay` 中以卡牌预览模式展示手牌
- 参考实现：`src/games/smashup/abilities/zombies.ts` 的 `zombieWalker` 函数

## 动态选项刷新修复

✅ **已修复并验证**：防止"暂无可选项"问题

**问题根因**：
- `refreshOptionsGeneric` 默认检查 `interaction.playerId` 的手牌
- 但 alien_probe 的选项是**对手的手牌**（`targetPlayerId`）
- 导致刷新时所有选项被错误过滤，交互变成空选项列表

**解决方案**：
- 为 alien_probe 交互添加自定义 `optionsGenerator`
- 刷新时正确检查 `targetPlayerId` 的手牌，而不是当前玩家的手牌
- 确保即使状态更新，选项也能正确刷新

**验证结果**：
- ✅ 用户确认问题已解决
- ✅ 不再出现"暂无可选项"弹窗
- ✅ 卡牌选择正常显示

## 相关文件

- `src/games/smashup/abilities/aliens.ts` - 能力实现
- `src/games/smashup/__tests__/alien-probe-bug.test.ts` - 测试
- `public/locales/zh-CN/game-smashup.json` - 中文文案
- `public/locales/en/game-smashup.json` - 英文文案
- `src/games/smashup/__tests__/fixtures/wikiSnapshots.ts` - Wiki 参考

## 教训

1. **素材数据录入规范**：根据图片素材提取业务数据时，必须全口径核对、逻辑序列化、关键限定词显式核对
2. **图片文字辨识零猜测原则**：任何文字只要有一点看不清或不确定，必须立即停止并索要更清晰的图片
3. **描述→实现全链路审查**：新增技能时必须对照官方描述逐步验证实现逻辑
