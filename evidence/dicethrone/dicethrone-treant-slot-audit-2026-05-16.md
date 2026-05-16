# DiceThrone Treant 槽位审计 2026-05-16

## 范围

- 角色：`treant`
- 问题：基础技能高亮 / 被动槽 / 防御槽映射异常
- 触发反馈：树精第一个技能正常，但被动出现可选标记；防御阶段高亮到倒数第二个技能

## 真相源

- 玩家板主图：
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\玩家面板.png`
- 运行时压缩图：
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\compressed\player-board.webp`
- 代码入口：
  - `D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\abilitySlotMapping.ts`
  - `D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\AbilityOverlays.tsx`

## 结论

- 这不是单纯“基础技能数组索引偏一位”。
- 直接原因是 Treant 沿用了旧共享槽位语义：
  - 被动 `quiet-cultivation` 被塞进普通技能槽；
  - `rooted` 被错误挂到 `calm`，并在旧实现里重复占了两个槽；
  - v2 实图的真实槽位顺序没有写进 Treant 的角色 override。
- 本轮已修复的映射合同：
  - `sky -> quiet-cultivation`（独立被动槽）
  - `lotus -> wild-growth`
  - `combo -> vengeful-vines`
  - `lightning -> nature-touch`
  - `meditate -> rooted`
  - `calm` 不再错误回退到 `rooted`

## 额外发现

- Treant 的卡图 / 面板录入仍存在更深一层的 intake 缺口：
  - 面板右下左侧还存在一格当前运行时代码未完整接线的基础技能位；
  - 现有 `treant` 卡图专属区也存在未完整回写到 `cards.ts` / locale 的对象。
- 这部分不会再用被动或防御槽去“硬填充”遮盖，但仍需后续按主真相源补齐。

