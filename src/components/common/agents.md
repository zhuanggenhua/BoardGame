# common 组件目录规范

> 目的：避免 common 继续演化为“杂物间”，明确职责边界与放置规则。

## 分类规则

- **overlays/**：叠层类 UI（Modal、Tooltip、Magnify 等）。
- **feedback/**：用户反馈类 UI（Toast、Notification）。
- **i18n/**：国际化相关 UI（语言切换、语言提示等）。
- **media/**：媒体/资源渲染（优化图片、资源加载展示）。
- **labels/**：轻量文案/按钮/装饰类标签组件。
- **animations/**：动效组件库（framer-motion 变体与封装）。

## 放置原则

1. **App Shell / 全局根组件**（例如 ModalStackRoot、ToastViewport、EngineNotificationListener）不属于 common，放在 `src/components/system/`。
2. **跨页面复用**且与业务无关的 UI，才放在 common；游戏专属组件放到各自 `src/games/<gameId>/`。
3. 新增组件前先判断：是否为全局能力（system）、跨页通用（common）、游戏内专用（games）。
