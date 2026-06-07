---
name: mobile-responsiveness
description: "BoardGame 的移动端路由 skill。用于把通用 mobile-first 诉求转回本项目的移动端适配入口；涉及本项目移动端适配时，默认走 adapt-game-mobile。"
---

# Route To Project Mobile Workflow

这个 skill 用来把移动端诉求路由到本项目的正确入口。

## 在 BoardGame 中的使用方式

本项目不是通用“移动优先网页”场景，尤其游戏页默认不是把桌面站压成小网页。

出现以下需求时，改走：

- 单个游戏移动端适配
  - `.codex/skill/adapt-game-mobile/SKILL.md`
- 共享 UI / 壳层 / 页面布局问题
  - `docs/ai-rules/ui-ux.md`
  - `docs/mobile-adaptation.md`

## 为什么不该放通用正文

- BoardGame 的移动端规则依赖游戏画布、manifest、横屏基线、E2E 验收
- 通用 mobile-first 示例会误导成“做一套普通响应式网页”

因此这里不再维护通用响应式教程正文。
