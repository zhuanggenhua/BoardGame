---
name: mobile-adaptive
description: "兼容入口：移动端适配统一转到 adapt-game-mobile；仅在旧指令或 OpenSpec 名称命中 mobile-adaptive 时使用。"
---

# mobile-adaptive 兼容入口

本 skill 不承载独立执行规范。BoardGame 单游戏移动端适配的唯一项目 workflow 是 [`adapt-game-mobile`](../adapt-game-mobile/SKILL.md)。

## 使用规则

- 用户说“移动端适配 / 手机横屏 / H5 / PWA / 触控 / hover 替代 / mobile shell”时，读取并执行 [`adapt-game-mobile`](../adapt-game-mobile/SKILL.md)。
- `openspec/specs/mobile-adaptive/` 只作为产品规格来源；它定义产品希望什么行为，不替代项目 AI workflow。
- 若旧任务、旧摘要或工具路由点名 `mobile-adaptive`，先把本文件当 adapter，再进入 `adapt-game-mobile`。
- 冲突裁决：执行步骤、项目路径、验收链和 PC / 移动边界以 `adapt-game-mobile` 为准；产品规格只裁决用户故事和需求范围。

## 禁止

- 禁止把本文件当第二套移动端 workflow。
- 禁止从旧 OpenSpec 或历史试点外推当前实现已完成。
- 禁止用“mobile-first”覆盖当前项目的 PC 权威布局和手机横屏条件适配边界。
