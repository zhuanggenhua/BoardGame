# PR #115 合并冲突裁决（2026-07-29）

## 背景

- PR：#115「实装 SmashUp 半场战争扩四派系与图集」
- PR head：ebd39884f12caa3829219b965b16b070895d1659
- 最新 main：84e1b6681d7dde72fda520330ca62d13d18fda83
- 合并目标：把最新 main 合入 PR head，解除 GitHub 的 DIRTY 冲突状态，并保留主线已合入派系、#108 圆桌骑士/哥布林，以及 #115 半场战争四派系。
- 冲突解决方式：以 `git merge-tree origin/main <PR head>` 生成候选合并树，对真实冲突文件按内容级并集裁决，未使用整文件单边覆盖。

## 真实冲突文件

本次真实冲突文件共 10 个：

- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/abilities/ongoing_modifiers.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/domain/types.ts`

门禁重叠审计还可能覆盖自动合并文件，已按同一原则复核：

- `public/assets/i18n/assets-manifest.json`
- `src/games/smashup/__tests__/criticalImageResolver.test.ts`
- `src/games/smashup/domain/events.ts`
- `src/games/smashup/domain/ongoingModifiers.ts`
- `src/games/smashup/ui/factionMeta.ts`

## 双边内容与裁决

- 资源 manifest：主线侧保留已合入的 POD、Disney、圆桌骑士、哥布林等资源索引；PR 侧保留半场战争基地图、四派系卡图及压缩图索引。最终按 JSON key 深度并集生成，无同 key 值冲突。
- 中英文 `game-smashup.json`：主线侧保留 Marvel POD、Disney、波利尼西亚航海者、圆桌骑士、哥布林等文案；PR 侧保留半场战争四派系、卡牌和基地文案。最终按 key 并集保留，JSON 可解析。
- `abilities/index.ts`：主线侧保留波利尼西亚航海者、优秀电影青少年、DIY 杀手、DIY 小丑、Disney 等能力注册；PR 侧保留半场战争能力注册。最终双方 import 与注册调用都保留。
- `abilities/ongoing_modifiers.ts`：主线侧保留波利尼西亚航海者持续力量/基地断点修正；PR 侧保留半场战争 `Sword, That's Powerful` 力量修正。最终取双方完整函数并注册双方 modifier，避免函数体交错导致语法错误。
- `data/cards.ts`：主线侧保留优秀电影青少年、DIY 杀手、DIY 小丑及已合入派系卡牌/基地注册；PR 侧保留半场战争卡牌与基地注册。最终双方 `registerCards` / `registerBases` 都保留。
- `domain/atlasCatalog.ts`：主线侧保留既有及圆桌骑士/哥布林图集；PR 侧保留半场战争四派系卡图与基地图集。最终双方 atlas 定义都保留。
- `domain/ids.ts`：主线侧保留 DIY、POD、Disney、圆桌骑士、哥布林 ID；PR 侧保留半场战争四派系卡图与基地 atlas ID，并把半场战争四派系加入“实现中”集合。最终双方 ID 与集合成员都保留。
- `domain/reduce.ts` 与 `domain/types.ts`：主线侧保留 `fromStored`、`consumesNormalLimit`、`actionCardsPlayedThisTurn` 等已合入行动结算字段；PR 侧保留 `targetMinionUid` 等目标字段。最终字段和 reducer 分支都双保留，避免回退主线行动额度/暂存区逻辑。

## 验证

已在生成 merge commit 前完成轻量校验：

- 10 个真实冲突文件均无 Git 冲突标记 冲突标记。
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`、`public/locales/en/game-smashup.json`、`public/locales/zh-CN/game-smashup.json` 已通过 `JSON.parse`。
- 7 个 TypeScript 冲突文件已通过 `typescript.transpileModule` 语法诊断。
- 远端 PR 推送后仍需 GitHub quality-gate 作为最终合并门禁。

