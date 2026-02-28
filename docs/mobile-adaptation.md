# 移动端适配说明

## 功能概述

项目已实现移动端适配，主要特性：

1. **主页自适应**：主页支持竖屏和横屏，自动适配不同屏幕尺寸
2. **游戏页面横屏强制**：游戏页面（`/play/*`）在移动设备竖屏时显示旋转提示
3. **响应式缩放**：游戏页面横屏时自动缩放界面以适配不同屏幕尺寸
4. **触摸优化**：增大按钮点击区域，禁用长按选择文本

## 技术实现

### 1. 横屏检测组件

**文件**：`src/components/common/MobileOrientationGuard.tsx`

- 使用 `useLocation` 检测当前路由
- 仅在游戏页面（`/play/*`）且移动设备（< 1024px）上检测横竖屏
- 竖屏时显示全屏旋转提示，横屏时正常渲染内容
- 主页和其他页面不受影响，支持竖屏访问

### 2. 视口配置

**文件**：`index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

- `maximum-scale=1.0, user-scalable=no`：禁止用户缩放（避免误触）
- `viewport-fit=cover`：支持刘海屏等异形屏幕

### 3. 响应式缩放

**文件**：`src/index.css`

```css
@media (max-width: 1023px) and (orientation: landscape) {
    /* 仅游戏页面应用缩放 */
    body:has([data-game-page]) #root {
        transform-origin: top left;
        transform: scale(calc(100vw / 1280));
        width: 1280px;
        height: calc(100vh / (100vw / 1280));
        overflow: hidden;
    }
}
```

- 基于设计宽度 1280px 动态计算缩放比例
- 仅在移动设备横屏且游戏页面时生效（通过 `data-game-page` 标记）
- 主页和其他页面保持自适应布局
- PC 端（≥1024px）保持原始布局

**游戏页面标记**：
- `src/pages/MatchRoom.tsx` - 在线对局页面添加 `data-game-page` 属性
- `src/pages/LocalMatchRoom.tsx` - 本地对局页面添加 `data-game-page` 属性

### 4. 触摸优化

**文件**：`src/index.css`

```css
@media (max-width: 1023px) {
    /* 禁用长按选择文本 */
    body {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
    }
    
    /* 增大按钮点击区域 */
    button {
        min-height: 44px;
        min-width: 44px;
    }
}
```

## 测试方法

### 方法 1：浏览器开发者工具

1. 打开 Chrome DevTools（F12）
2. 点击设备工具栏图标（Ctrl+Shift+M）
3. 选择移动设备（如 iPhone 12 Pro）
4. 测试主页：
   - 竖屏：应正常显示，支持滚动浏览
   - 横屏：应正常显示，自适应布局
5. 测试游戏页面（访问 `/play/tictactoe/local`）：
   - 竖屏：应显示"请旋转设备"提示
   - 横屏：应正常显示游戏界面（缩放适配）

### 方法 2：真机测试

1. 在移动设备上访问开发服务器（如 `http://192.168.x.x:3000`）
2. 测试主页：
   - 竖屏访问：应正常显示游戏列表
   - 横屏访问：应正常显示，布局自适应
3. 测试游戏页面：
   - 竖屏访问游戏：应显示旋转提示
   - 旋转至横屏：提示消失，显示游戏界面
4. 测试触摸交互：按钮点击、卡牌拖拽等

### 方法 3：E2E 自动化测试

**文件**：`e2e/mobile-orientation.e2e.ts`

```bash
npm run test:e2e -- e2e/mobile-orientation.e2e.ts
```

测试覆盖：
- ✅ 主页竖屏时正常显示（不强制横屏）
- ✅ 游戏页面竖屏时显示旋转提示
- ✅ 游戏页面横屏时正常显示内容
- ✅ PC 端不显示旋转提示
- ✅ 游戏页面移动端横屏时应用缩放样式
- ✅ 游戏页面方向切换时动态更新显示
- ✅ 主页横屏时不应用游戏缩放

## 支持的设备

### 移动设备（< 1024px）

- ✅ iPhone（所有型号）
- ✅ iPad Mini（横屏模式）
- ✅ Android 手机（所有尺寸）
- ✅ Android 平板（小尺寸）

### PC/平板（≥ 1024px）

- ✅ iPad Pro（保持原始布局）
- ✅ 笔记本电脑
- ✅ 台式机

## 已知限制

1. **游戏页面竖屏不支持**：游戏页面在移动设备竖屏时无法游戏，必须旋转至横屏
2. **主页支持竖屏**：主页和非游戏页面支持竖屏访问，自适应布局
3. **缩放固定**：游戏页面基于 1280px 设计宽度，超宽屏可能有黑边
4. **触摸手势**：暂未实现长按查看详情、双指缩放等高级手势

## 后续优化方向

### 短期（可选）

- [ ] 优化旋转提示动画（更流畅的过渡效果）
- [ ] 添加横屏锁定提示（提醒用户关闭屏幕旋转锁定）
- [ ] 优化小屏幕设备的字体大小

### 中期（可选）

- [ ] 实现触摸手势（长按查看卡牌详情、双指缩放）
- [ ] 优化拖拽交互（触摸反馈、拖拽预览）
- [ ] 添加虚拟摇杆（替代键盘操作）

### 长期（可选）

- [ ] PWA 支持（添加到主屏幕、离线缓存）
- [ ] 性能优化（移动端降低粒子特效密度）
- [ ] 小游戏竖屏支持（为井字棋等简单游戏提供竖屏布局）

## 设计决策

### 为什么主页支持竖屏？

1. **用户体验**：用户可能在任意方向打开网站，主页应该友好地展示游戏列表
2. **SEO 友好**：搜索引擎爬虫可能以竖屏模式访问，主页需要正常渲染
3. **渐进式引导**：用户在主页浏览后，进入游戏时才提示旋转设备

### 为什么游戏页面强制横屏？

1. **游戏设计**：桌游通常需要横向布局（手牌、棋盘、对手信息）
2. **视野需求**：横屏提供更宽的视野，适合展示游戏状态
3. **一致性**：所有游戏统一横屏体验，避免混乱

## 维护注意事项

1. **新增 UI 组件**：确保按钮最小尺寸 ≥ 44px（触摸友好）
2. **布局调整**：避免依赖固定像素值，使用相对单位（rem/em/%）
3. **测试覆盖**：新功能必须在移动端测试（Chrome DevTools 设备模式）
4. **性能监控**：移动设备性能较弱，避免过度使用动画和特效

## 相关文件

- `src/components/common/MobileOrientationGuard.tsx` - 横屏守卫组件（路由感知）
- `src/App.tsx` - 应用入口（包裹 MobileOrientationGuard）
- `src/pages/MatchRoom.tsx` - 在线对局页面（添加 `data-game-page` 标记）
- `src/pages/LocalMatchRoom.tsx` - 本地对局页面（添加 `data-game-page` 标记）
- `index.html` - 视口配置
- `src/index.css` - 响应式缩放和触摸优化样式（游戏页面专用）
- `e2e/mobile-orientation.e2e.ts` - E2E 测试
- `docs/mobile-adaptation.md` - 本文档

## 参考资料

- [MDN - Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag)
- [CSS Tricks - Responsive Design](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [Apple - Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/ios)
