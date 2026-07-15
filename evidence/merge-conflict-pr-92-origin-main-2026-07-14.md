# PR #92 同步主线冲突审计

## 对象

- PR：#92 `[codex] 实装大杀四方五族 POD 卡图派系`
- PR head：`98af47ec09dbc1924f18d02064db3d38c0bf7808`
- 同步主线：`origin/main` at `a831e3c7e6b29b7cf254835434146140e13a8566`
- 执行目录：`.tmp/pr92-merge-20260714-120928`

## 冲突文件

- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/data/englishAtlasMap.json`

## 裁决

- `game-smashup.json` 的 `factions` 冲突采用双边保留：
  - 保留 #92 的骷髅（POD版）与变形者（POD版）。
  - 保留主线已合入的九头蛇、克里、邪恶大师、邪恶六人组、宇宙武士、卑劣封臣、星际旅者、百变机兵、迷你萌宠（POD）与时间旅行者（POD）。
- `englishAtlasMap.json` 的 POD 基地冲突采用双边保留并去重：
  - 保留 #92 独有的骷髅、龙、鲨鱼、神话希腊 POD 基地映射。
  - 保留主线已合入的迷你萌宠（POD）基地映射。
  - `base_boneyard_pod` 与 `base_ossuary_pod` 两边值一致，仅保留一份。
- 额外修复 #92 暴露的真实门禁缺口：
  - 为骷髅（POD版）与变形者（POD版）补齐卡牌中英文 `cards.*_pod` 精确文案键。
  - 删除骷髅（POD版）卡图图集的重复常量/重复注册，避免构建警告。

## 验证

- `node -e "const fs=require('fs'); for (const f of ['public/locales/en/game-smashup.json','public/locales/zh-CN/game-smashup.json','src/games/smashup/data/englishAtlasMap.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json ok')"`
- `npm run i18n:check`
- `npx vitest run src/games/smashup/__tests__/sharksSkeletonsGreeksShapeshiftersDragonsPodIntegration.test.ts src/games/smashup/__tests__/dragonsSuperheroesMagicalGirlsMegaTroopersPodIntegration.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts`
- `git diff --check`
