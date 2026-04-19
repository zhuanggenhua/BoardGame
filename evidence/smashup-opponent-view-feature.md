# 大杀四方对手视角功能实现总结

## 功能概述

为大杀四方游戏添加了对手视角查看功能，参考 DiceThrone 的实现。用户可以：
- 悬浮在计分板对手区域时看到半透明眼睛图标
- 点击对手分数圆圈切换到对手视角
- 对手视角下：手牌显示牌背，弃牌堆可以查看
- 屏幕顶部显示"对手视角"指示器，可点击返回按钮切回自己视角

## 实现细节

### 1. Board.tsx 修改

#### 添加视角状态管理
```typescript
// 对手视角切换状态
const [viewMode, setViewMode] = useState<'self' | 'opponent'>('self');
const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'self' ? 'opponent' : 'self');
}, []);

// 对手玩家数据
const opponentPid = core.turnOrder.find(pid => pid !== playerID) || '1';
const opponentPlayer = core.players[opponentPid];

// 根据视角模式选择显示的玩家数据
const viewPlayer = viewMode === 'opponent' ? opponentPlayer : myPlayer;
const viewPid = viewMode === 'opponent' ? opponentPid : rootPid;
```

#### 计分板添加交互
- 对手分数圆圈添加 `cursor-pointer` 样式
- 点击对手分数圆圈触发 `toggleViewMode()`
- 悬浮时显示半透明眼睛图标（参考 DiceThrone 的 OpponentHeader）
- 当前处于对手视角时，眼睛图标始终显示

#### 视角指示器
- 位置：屏幕顶部中央（top-[120px]）
- 样式：琥珀色背景 + 毛玻璃效果 + 发光边框
- 内容：眼睛图标 + "对手视角"文字 + "返回"按钮
- 动画：进入/退出时垂直滑动 + 淡入淡出

#### 手牌和弃牌堆切换
- 将 `myPlayer` 替换为 `viewPlayer`
- 传递 `isOpponentView={viewMode === 'opponent'}` 给 HandArea
- DeckDiscardZone 自动显示对应玩家的牌库和弃牌堆

### 2. HandArea.tsx 修改

#### 添加对手视角支持
```typescript
type Props = {
    // ... 其他 props
    /** 是否显示为对手视角（显示牌背） */
    isOpponentView?: boolean;
};

type HandCardProps = {
    // ... 其他 props
    /** 是否显示为对手视角（显示牌背） */
    isOpponentView: boolean;
};
```

#### HandCard 组件修改
- 对手视角时使用牌背图片：`cardBackRef = { type: 'atlas', atlasId: 'smashup-card-back', index: 0 }`
- 对手视角时禁用点击交互：`cursor-default`，点击时直接 return
- 对手视角时隐藏放大镜按钮
- CardPreview 根据 `isOpponentView` 切换显示内容

### 3. i18n 翻译

#### 中文 (zh-CN/game-smashup.json)
```json
"opponent_view": "对手视角",
"back_to_self": "返回",
"opponent_card": "对手的牌"
```

#### 英文 (en/game-smashup.json)
```json
"opponent_view": "Opponent View",
"back_to_self": "Back",
"opponent_card": "Opponent's Card"
```

## 技术要点

### 1. 牌背显示
- 使用 SmashUp 的牌背图集：`SMASHUP_CARD_BACK` (定义在 `domain/ids.ts`)
- 通过 CardPreview 的 `previewRef` 属性切换显示内容
- 对手视角时 title 显示为 "对手的牌"

### 2. 交互禁用
- 对手视角下手牌不可点击（`isOpponentView` 检查）
- 对手视角下不显示放大镜按钮
- 对手视角下不触发卡牌选择逻辑

### 3. 弃牌堆查看
- DeckDiscardZone 组件自动根据 `viewPlayer` 显示对应玩家的弃牌堆
- 弃牌堆面板可以正常打开查看（不受视角限制）
- 对手视角下弃牌堆显示 "(查看中)" 标签

### 4. 视觉反馈
- 计分板对手区域悬浮时显示半透明眼睛图标
- 对手视角激活时眼睛图标始终显示
- 顶部显示明显的"对手视角"指示器
- 指示器包含返回按钮，方便快速切回

## 参考实现

参考了 DiceThrone 的对手视角实现：
- `src/games/dicethrone/Board.tsx` - 视角切换逻辑
- `src/games/dicethrone/ui/OpponentHeader.tsx` - 眼睛图标和悬浮效果
- 视角状态管理：`viewMode` / `toggleViewMode`
- 视角计算：`viewPlayer` / `viewPid`

## 测试建议

1. 悬浮在对手分数圆圈上，确认眼睛图标显示
2. 点击对手分数圆圈，确认切换到对手视角
3. 对手视角下，确认手牌显示为牌背
4. 对手视角下，点击弃牌堆，确认可以查看对手弃牌
5. 点击"返回"按钮，确认切回自己视角
6. 确认对手视角下无法进行任何操作（点击手牌无反应）
7. 测试多语言切换（中文/英文）

## 注意事项

1. 对手视角仅用于查看，不能进行任何游戏操作
2. 弃牌堆在对手视角下可以查看（符合游戏规则）
3. 牌库数量可见，但不能查看牌库内容
4. 视角切换不影响游戏状态，仅改变 UI 显示
5. 对手视角下仍然可以看到自己的回合指示器和结束回合按钮（但不可操作）
