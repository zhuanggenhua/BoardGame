---
name: mobile-responsiveness
description: "历史兼容入口。BoardGame 不直接采用通用 mobile-first 网页 skill；涉及本项目移动端适配时，应改走 adapt-game-mobile。"
---

# Deprecated: Redirect To Project Mobile Workflow

这个文件保留只是为了兼容历史入口。

## 在 BoardGame 中不要直接用它

本项目不是通用“移动优先网页”场景，尤其游戏页默认不是把桌面站压成小网页。

出现以下需求时，改走：

- 单个游戏移动端适配
  - `.windsurf/skills/adapt-game-mobile/SKILL.md`
- 共享 UI / 壳层 / 页面布局问题
  - `docs/ai-rules/ui-ux.md`
  - `docs/mobile-adaptation.md`

## 为什么不该放通用正文

- BoardGame 的移动端规则依赖游戏画布、manifest、横屏基线、E2E 验收
- 通用 mobile-first 示例会误导成“做一套普通响应式网页”

因此这里不再维护通用响应式教程正文。
