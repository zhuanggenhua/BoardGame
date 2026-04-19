# 大杀四方四人局布局测试页面

## 创建时间
2026-03-04

## 目的
创建临时测试路由，方便快速查看四人局响应式布局效果，无需完整游戏流程。

## 访问方式
启动开发服务器后，访问：
```
http://localhost:5173/dev/smashup-4p-layout
```

## 实现内容

### 1. 测试页面 (`src/pages/SmashUp4PLayoutTest.tsx`)
- 构造了一个简单的 4 人局模拟状态
- 包含 4 个玩家，每个玩家有不同的派系和手牌
- 4 个基地，每个基地上有不同数量的随从和持续行动卡
- 显示当前布局配置参数（baseGap、baseCardWidth、minionCardWidth）

### 2. 路由配置 (`src/App.tsx`)
- 添加了懒加载组件：`SmashUp4PLayoutTest`
- 添加了路由：`/dev/smashup-4p-layout`
- 使用 LoadingScreen 作为加载占位

## 当前布局配置

### 二人局
- baseGap = 12vw（宽松）
- baseCardWidth = 14vw
- minionCardWidth = 5.5vw

### 三人局
- baseGap = 8vw（适度）
- baseCardWidth = 13vw
- minionCardWidth = 5vw

### 四人局
- baseGap = 6vw（紧凑但合理）
- baseCardWidth = 12vw
- minionCardWidth = 4.5vw

## 设计考虑
- 四人局 baseGap 设置为 6vw，考虑到基地下方有随从卡片，间距不能太小
- 卡片尺寸随玩家数量递减，确保所有基地都能显示在屏幕内
- 保持合理的视觉比例，避免卡片过小影响可读性

## 下一步
- 用户查看布局效果
- 根据实际显示效果调整 baseGap 和卡片尺寸
- 确认随从卡片不会重叠
- 验证在不同屏幕尺寸下的表现

## 文件清单
- `src/pages/SmashUp4PLayoutTest.tsx` - 测试页面组件
- `src/App.tsx` - 路由配置（已添加 `/dev/smashup-4p-layout`）
- `src/games/smashup/ui/layoutConfig.ts` - 响应式布局配置
