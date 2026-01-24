# 前端 Bug 教训

> 目标：记录高频、易复发或定位成本高的前端 Bug 教训，便于快速回忆与避免复发。

## 条目格式
- 标题：<简短标题>
- 现象：<一行描述>
- 根因：<一行描述>
- 证据链：<关键证据/日志/代码路径>
- 回归测试：<1-3 条最小验证>
- 防复发措施：<一行描述>

## 条目

### 2026-01-24 overflow 父容器吞布局
- 现象：子组件布局/滚动失效，设置 overflow 无效。
- 根因：父容器的 overflow/height 覆盖子组件布局。
- 证据链：修改布局时发现父级容器 overflow/height 配置导致子组件样式不生效。
- 回归测试：检查父容器 overflow/height；验证目标组件滚动/布局恢复。
- 防复发措施：改布局前先 grep 搜索父容器 overflow/height 并确认影响范围。

### 2026-01-24 遮罩层级判断错误
- 现象：遮罩/弹窗被页面元素盖住，z-index 调整无效。
- 根因：未验证实际最上层元素，Portal 外层缺失显式 z-index。
- 证据链：通过 elementsFromPoint 定位到遮挡元素；Portal 外层容器无 z-index。
- 回归测试：elementsFromPoint 验证顶层元素；检查 Portal 容器 z-index。
- 防复发措施：先用 elementsFromPoint 证明层级，再修改 z-index。

### 2026-01-24 backdrop-filter 被动画吞
- 现象：遮罩 blur 失效或闪烁。
- 根因：遮罩被外层 motion/opacity 动画包裹导致合成层问题。
- 证据链：移除外层 motion 后 blur 恢复。
- 回归测试：验证遮罩 blur 在动画前后均正常。
- 防复发措施：允许遮罩自身做透明度动画，但外层禁止再套 motion。

### 2026-01-24 HMR Upgrade Required
- 现象：HMR 报 “Upgrade Required”。
- 根因：vite.config.ts 中 hmr 设置了自定义端口。
- 证据链：移除 hmr.port 后恢复。
- 回归测试：启动 dev server，确认 HMR 正常。
- 防复发措施：禁止配置 hmr.port，端口占用时先清理 node 进程。

### 2026-01-24 高频交互状态抖动
- 现象：拖拽/鼠标跟随出现跳动、卡死。
- 根因：高频回调使用 useState 导致异步延迟；mouseup 未兜底清理状态。
- 证据链：切换到 useRef 和 window mouseup 后问题消失。
- 回归测试：快速拖拽/移动检查无抖动；mouseup 可正常复位。
- 防复发措施：高频回调用 useRef，必要时直接修改 DOM.style，重置时同步清空 Ref。
