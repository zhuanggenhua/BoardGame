# 移动端适配说明

## 功能概述

项目已实现移动端横屏适配，主要特性：

1. **横屏强制**：移动设备竖屏时显示旋转提示，引导用户旋转设备
2. **响应式缩放**：横屏时自动缩放界面以适配不同屏幕尺寸
3. **触摸优化**：增大按钮点击区域，禁用长按选择文本

## 技术实现

### 1. 横屏检测组件

**文件**：`src/components/common/MobileOrientationGuard.tsx`

- 检测设备方向（横屏/竖屏）
- 仅在移动设备（屏幕宽度 < 1024px）上生效
- 竖屏时显示全屏旋转提示，横屏时正常渲染内容

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
    #root {
        transform-origin: top left;
        transform: scale(calc(100vw / 1280));
        width: 1280px;
        height: calc(100vh / (100vw / 1280));
        overflow: hidden;
    }
}
```

- 基于设计宽度 1280px 动态计算缩放比例
- 仅在移动设备横屏时生效
- PC 端（≥1024px）保持原始布局

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
4. 测试竖屏/横屏切换：
   - 竖屏：应显示"请旋转设备"提示
   - 横屏：应正常显示游戏界面

### 方法 2：真机测试

1. 在移动设备上访问开发服务器（如 `http://192.168.x.x:3000`）
2. 竖屏访问：应显示旋转提示
3. 旋转至横屏：提示消失，显示游戏界面
4. 测试触摸交互：按钮点击、卡牌拖拽等

### 方法 3：E2E 自动化测试

**文件**：`e2e/mobile-orientation.e2e.ts`

```bash
npm run test:e2e -- e2e/mobile-orientation.e2e.ts
```

测试覆盖：
- ✅ 竖屏时显示旋转提示
- ✅ 横屏时正常显示内容
- ✅ PC 端不显示旋转提示
- ✅ 移动端横屏时应用缩放样式
- ✅ 方向切换时动态更新显示

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

1. **竖屏不支持**：移动设备竖屏时无法游戏，必须旋转至横屏
2. **缩放固定**：基于 1280px 设计宽度，超宽屏可能有黑边
3. **触摸手势**：暂未实现长按查看详情、双指缩放等高级手势

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
- [ ] 竖屏布局（为小游戏如井字棋提供竖屏支持）

## 维护注意事项

1. **新增 UI 组件**：确保按钮最小尺寸 ≥ 44px（触摸友好）
2. **布局调整**：避免依赖固定像素值，使用相对单位（rem/em/%）
3. **测试覆盖**：新功能必须在移动端测试（Chrome DevTools 设备模式）
4. **性能监控**：移动设备性能较弱，避免过度使用动画和特效

## 相关文件

- `src/components/common/MobileOrientationGuard.tsx` - 横屏守卫组件
- `src/App.tsx` - 应用入口（包裹 MobileOrientationGuard）
- `index.html` - 视口配置
- `src/index.css` - 响应式缩放和触摸优化样式
- `e2e/mobile-orientation.e2e.ts` - E2E 测试
- `docs/mobile-adaptation.md` - 本文档

## 参考资料

- [MDN - Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag)
- [CSS Tricks - Responsive Design](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [Apple - Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/ios)
