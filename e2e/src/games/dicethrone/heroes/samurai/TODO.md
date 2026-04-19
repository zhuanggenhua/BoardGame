# Samurai (武士) 待补充信息

## 基础数据（从 tip.png 提取）
- [ ] 角色中文名称：武士（已确认）
- [ ] 角色英文名称：Samurai（已确认）
- [ ] 起始 HP：？
- [ ] 起始 CP：？

## 骰子配置（从 dice.png 提取）
需要确认完整的 6 个面配置（1-6 点分别对应什么图标）

## Token 系统
- [ ] 武士特有的 Token 定义

## 被动能力
- [ ] 从 tip.png 提取被动能力描述

## 技能卡牌（从 ability-cards.png 提取）
需要补充：
- [ ] 每张卡牌的完整描述
- [ ] 卡牌效果的具体数值
- [ ] 卡牌的 CP 消耗
- [ ] 卡牌的升级路径

## 图片资源
已重命名完成：
- ✅ player-board.png
- ✅ tip.png
- ✅ dice.png
- ✅ ability-cards.png

待生成：
- [ ] status-icons-atlas.json（状态图标图集配置）
- [ ] dice-sprite.png（骰子精灵图）

---

## Addendum（2026-03-27）

- 本文件为早期占位 TODO，已不再代表当前武士接入状态。
- 当前真实进度以 `task_plan.md`、`progress.md` 以及 `src/games/dicethrone/rule/武士真相源表.md` 为准。
- 已完成事实：
  - 角色中文名、骰面配置、`honor / shame / samurai_retribution` token、主要技能与卡牌、`status-icons-atlas.json` 已接入。
  - `Masamune II` 升级差异已核定并落入代码、locale、回归。
  - 武士图片资源已登记进 `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json`。
