# Dice Throne 树精真相源表

> 本轮主真相源：用户放入的本地中文图片素材。对照源：本轮代码定义、DiceThrone 旧英雄共享合同（尤其 Gunslinger/Samurai 的 v2 面板与复合升级模式）。日期：2026-05-10。工作树：`.worktrees/dicethrone-treant-ninja`。
>
> 2026-06-05 当前有效口径：本文只保留树精素材、图面合同与图集合同的真相源清单，不代表树精整英雄、树精升级技能批次或四位新英雄整批当前完成态。当前若要判断树精对象级残余、升级技能 `L3/L4`、或批次级治理尾项，应以 `src/games/dicethrone/rule/treant录入核对.md`、`src/games/dicethrone/rule/treant卡牌录入核对.md`、`evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md` 与 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 为准。
>
> 2026-08-26 玩家板槽位复核：以 `temp/dicethrone-intake/audit/player-board-slot-review-sheets/treant-player-board-slots.png` 和 `evidence/dicethrone/升级牌槽位全量回图审计-2026-07-04.md` 为准，树精 `wild-roar` 已锁定在 `calm` 物理槽，`nature-touch` 已锁定在 `lightning` 物理槽；旧“临时同时放行 / 待后续确认 / calm 空槽”口径失效。

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

## 玩家板图面合同

| 图面区域 / 槽位 | 图片直接观察结论 | 运行时对象 | 允许状态 | 备注 |
|---|---|---|---|---|
| `sky` | 左下紫色独立槽，不属于普通技能列 | `quiet-cultivation` | passive / 非普通技能候选 | 旧共享语义误把它混入普通技能槽，现已纠正 |
| `lotus` | 下排普通技能槽 | `wild-growth` | offensive | 与 Treant v2 图面一致 |
| `combo` | 中排普通技能槽 | `vengeful-vines` | offensive | 与 Treant v2 图面一致 |
| `lightning` | 上排普通技能槽 | `nature-touch` | offensive | 2026-07-04 回图与 2026-08-26 扩审确认：`wild-roar` 不再放行到本槽 |
| `calm` | 右下左侧普通技能槽，大顺子技能 | `wild-roar` | offensive | 2026-07-04 回图确认，基础版和升级版 `野性怒吼` 均归属本槽 |
| `meditate` | 右下独立防御槽 | `rooted` | defensive | 真实防御位，不是旧 `calm` 语义 |

## 图集合同

- 树精卡图不是旧 `ability-cards-common.atlas.json` 的 `1860x2048` 宽图，不能套旧公共 atlas。
- 本轮使用 `ability-cards-treant.atlas.json`，合同为 `900x2048`、5 列、8 行、row-major frame。
- 通用卡使用 `TREANT_NINJA_COMMON_ATLAS_INDEX`，其中 `card-unexpected` 位于 `slot-32`。
- 未新增 `hand-cards-atlas`；手牌仍通过现有 `CardPreview`/atlas 运行时合同加载。

## 对照与冲突

| 项 | 主真相源结论 | 对照源结论 | 处理 |
|---|---|---|---|
| 卡图规格 | 5x8 窄图 | 旧公共 atlas 为宽图 | 新增专属 atlas，禁止复用旧公共合同 |
| 复合升级语义 | 升级卡替换基础技能 | Samurai/Gunslinger 等旧实现同样走 `targetAbilityId` | 复用共享升级合同，不拆成多张手牌 |
| Token 机制 | 提示板定义树灵/生命源泉/刺藤 | 代码已实现并有 L2 测试 | 继续用 L2/L3 分层记录，不再保留旧债务结论 |
| `野性怒吼` 玩家板槽位 | `calm -> wild-roar` | 旧记录曾写成 `lightning` 临时放行，且把 `calm` 记为空槽 | 旧记录失效；当前以回图审计、运行时代码和 `treant-ability-card-contract.test.ts` 为准 |

## 当前阅读门禁

- 本文的职责是回答“图片/资源/槽位合同是什么”，不是回答“树精当前还有哪些对象级缺口”。
- 即使这里的素材、atlas 与玩家板槽位合同已经盘清，也不能单独外推成树精当前已完成全面审计。
- 2026-06-05 当前若还要判断树精是否存在未完成项，只能回到录入核对矩阵、卡牌核对矩阵和主审计 / 升级重审 evidence；不能从本文的 `L0/L1` 素材盘点直接推出“当前已收口”。
