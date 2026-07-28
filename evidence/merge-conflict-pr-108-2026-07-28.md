# PR #108 合并冲突裁决（2026-07-28）

## 背景

- PR：#108「接入圆桌骑士与哥布林图集」
- PR head：608f7a7e5b2d13498993e08b5b37d0ac585da70f
- 合并目标：把最新 main 合入 PR head，解除 GitHub 的 DIRTY 冲突状态，并保留主线已合入派系与 PR #108 新增派系。
- 冲突解决方式：以 `git merge-tree origin/main <PR head>` 生成候选合并树，对真实冲突文件按内容级并集裁决，未使用整文件单边覆盖。

## 真实冲突文件

本次真实冲突文件：

- `.gitignore`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/atlasCatalog.ts`

门禁重叠审计还覆盖以下自动合并文件，已一并复核：

- `public/assets/i18n/assets-manifest.json`
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/ui/factionMeta.ts`

## 双边内容与裁决

- `.gitignore`：主线侧已有波利尼西亚航海者、迪士尼与文化冲击等资源白名单；PR 侧新增圆桌骑士与哥布林卡图/基地图白名单。最终双保留，避免资源被 ignore 规则误过滤。
- 资产 manifest：主线侧已有已合入派系资源索引；PR 侧新增圆桌骑士与哥布林资源索引。Git 自动合并后保留双方条目。
- 中英文 `game-smashup.json`：主线侧保留 Marvel POD、Disney、波利尼西亚航海者等已合入 faction/cards/base 文案；PR 侧保留圆桌骑士与哥布林 faction/cards/base 文案。最终按 key 并集保留，补必要逗号，JSON 结构保持可解析。
- `src/games/smashup/data/cards.ts`：主线侧保留波利尼西亚航海者、Disney 等基地注册；PR 侧保留 `NEW_ROUND_TABLE_KNIGHTS_BASES` 与 `NEW_GOBLINS_BASES` 注册。最终双方注册都保留。
- `src/games/smashup/domain/atlasCatalog.ts`：主线侧保留 Disney 图集；PR 侧保留圆桌骑士与哥布林基地图集。最终双方 atlas 定义都保留。
- `src/games/smashup/domain/ids.ts` 与 `src/games/smashup/ui/factionMeta.ts`：Git 自动合并后保留主线已新增 ID / faction metadata，并保留 PR #108 的圆桌骑士与哥布林 ID / metadata。

## 验证

已在生成 merge commit 前完成轻量校验：

- 冲突解决后的 5 个真实冲突文件均无 `<<<<<<<` / `>>>>>>>` 冲突标记。
- `public/locales/en/game-smashup.json` 与 `public/locales/zh-CN/game-smashup.json` 已通过 `JSON.parse`。
- `git diff-tree --check` 已针对真实冲突文件执行，无输出。

远端 PR 推送后仍需 GitHub quality-gate 作为最终合并门禁。
