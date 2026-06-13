# 书本首页账户入口同步图证 2026-06-07

## 范围

- 目标问题：书本风格首页在已登录状态下，右上角账户入口仍走登录弹窗，未与经典首页的用户菜单内容同步。
- 本轮实现：已登录时书本首页账户区切换为复用 `UserMenu` 的书本变体，带上积分徽标，并复用通知、对战记录、好友、账户设置、光标设置、我的反馈、退出登录等现有内容。

## 本地入口说明

- 当前本地 Web 路由 `/` 受 [src/lib/homeV2Routing.ts](/D:/gongzuo/webgame/BoardGame/src/lib/homeV2Routing.ts:62) 约束，默认只会落到 `classic`；`book` 在本地 Web 不能直接作为默认首页进入。
- 因此本轮截图入口使用项目内约定的书本首页真实组件预览路由：`/dev/home-v2-preview`。
- 该入口直接渲染 [src/pages/HomeV2.tsx](/D:/gongzuo/webgame/BoardGame/src/pages/HomeV2.tsx:1)，对应本轮修改的书本首页 UI 组件链。

## 截图与肉眼结论

### 1. 默认态

- 截图：
  [01-home-v2-preview-account-default.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/home-v2-account-menu-2026-06-07/01-home-v2-preview-account-default.png)
- 肉眼看到：
  右上角账户区显示积分徽标 `+12`、用户图标和用户名，不再显示“登录”字样。
- 验收判断：
  已证明“书本首页已登录默认态”与经典首页的登录态信息一致到用户名/积分这一层，不再停留在游客入口。

### 2. 展开态

- 截图：
  [02-home-v2-preview-account-menu-open.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/home-v2-account-menu-2026-06-07/02-home-v2-preview-account-menu-open.png)
- 肉眼看到：
  点击账户区后出现的是用户菜单，不是登录弹窗；菜单内可见 `通知`、`对局记录`、`好友`、`账户设置`、`光标设置`、`我的反馈`、`退出登录`。
- 验收判断：
  已证明“点击用户名后弹登录弹窗”的旧错误被替换为已登录用户菜单链路。

## 状态注入说明

- 截图在当前仓库前端实例 `http://127.0.0.1:4274/dev/home-v2-preview` 上完成。
- 为了让本地 Web 端进入已登录态，注入了可解析 JWT 到 `localStorage.auth_token`，并拦截了 `/auth/me`、`/notifications`、`/notifications/read-state`。
- 这次图证证明的是“当前书本首页 UI 组件链在已登录态下的真实页面表现”，不是 Android 壳默认首页路由本身的开关行为。
