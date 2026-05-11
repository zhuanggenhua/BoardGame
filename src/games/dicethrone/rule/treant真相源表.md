# Dice Throne 树精真相源表

> 本轮主真相源：用户放入的本地中文图片素材。对照源：本轮代码定义、DiceThrone 旧英雄共享合同（尤其 Gunslinger/Samurai 的 v2 面板与复合升级模式）。日期：2026-05-10。工作树：`.worktrees/dicethrone-treant-ninja`。

## 素材与用途

| 对象 | 路径 | 本轮确认 | 用途 | 状态 |
|---|---|---:|---|---|
| 原始卡图 | `public/assets/i18n/zh-CN/dicethrone/images/treant/abilitycards.png` | `1910x4348` | 原始 OCR/核对真相源 | L0 |
| 正式卡图 | `public/assets/i18n/zh-CN/dicethrone/images/treant/ability-cards.png` | `900x2048` | 运行时 atlas 图 | L1 |
| 玩家面板 | `public/assets/i18n/zh-CN/dicethrone/images/treant/player-board.png` | `2048x1233` | 角色面板 / 技能槽 | L1 |
| 提示板 | `public/assets/i18n/zh-CN/dicethrone/images/treant/tip.png` | 已压缩 | Token 规则核对 | L1 |
| 骰子 | `public/assets/i18n/zh-CN/dicethrone/images/treant/dice.png` | `1024x1024` | 骰子精灵 | L1 |
| 状态图集 | `public/assets/i18n/zh-CN/dicethrone/images/treant/status-icons-atlas.png/json` | 5 帧 | 树灵、生命源泉、刺藤 | L1 |
| 压缩运行时资源 | `public/assets/i18n/zh-CN/dicethrone/images/treant/compressed/*.webp` | player-board/tip/ability-cards/dice/status-icons-atlas | 客户端真实加载 | L1，远端回查见 evidence |

## 图集合同

- 树精卡图不是旧 `ability-cards-common.atlas.json` 的 `1860x2048` 宽图，不能套旧公共 atlas。
- 本轮使用 `ability-cards-treant.atlas.json`，合同为 `900x2048`、5 列、8 行、row-major frame。
- 通用卡使用 `TREANT_NINJA_COMMON_ATLAS_INDEX`，其中 `card-unexpected` 位于 `slot-37`。
- 未新增 `hand-cards-atlas`；手牌仍通过现有 `CardPreview`/atlas 运行时合同加载。

## 对照与冲突

| 项 | 主真相源结论 | 对照源结论 | 处理 |
|---|---|---|---|
| 卡图规格 | 5x8 窄图 | 旧公共 atlas 为宽图 | 新增专属 atlas，禁止复用旧公共合同 |
| 复合升级语义 | 升级卡替换基础技能 | Samurai/Gunslinger 等旧实现同样走 `targetAbilityId` | 复用共享升级合同，不拆成多张手牌 |
| Token 机制 | 提示板定义树灵/生命源泉/刺藤 | 代码已实现并有 L2 测试 | 继续用 L2/L3 分层记录，不再保留旧债务结论 |
