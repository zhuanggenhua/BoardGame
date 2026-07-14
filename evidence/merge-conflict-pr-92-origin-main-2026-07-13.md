# 冲突解决汇报：PR #92 同步 origin/main

## 1. 背景

- 日期：2026-07-13
- PR：#92「实装大杀四方五族 POD 卡图派系」
- 本地 PR head：508696bb84b3e3ff0acdaed2ef92b879d88cedfb
- 最新 origin/main：4bab6fb037adbd36ef602ecf9e944677cd65fd36
- 共同祖先：da82e67afbbe9af038e4897666f2cd564126ae99
- 触发命令：git merge origin/main --no-edit
- 合并目标：让 #92 PR 分支追上最新 origin/main，解除 GitHub 显示的 DIRTY 冲突状态，并保留主线与 #92 的有效派系接入。

## 2. 真实冲突文件

本次实际出现冲突标记或 add/add 冲突的文件共 11 个：

- public/locales/en/game-smashup.json
- public/locales/zh-CN/game-smashup.json
- src/games/smashup/abilities/dragons.ts
- src/games/smashup/data/cards.ts
- src/games/smashup/data/englishAtlasMap.json
- src/games/smashup/data/factions/dragons_pod.ts
- src/games/smashup/data/factions/mythic_greeks_pod.ts
- src/games/smashup/data/factions/sharks_pod.ts
- src/games/smashup/domain/atlasCatalog.ts
- src/games/smashup/domain/ids.ts
- src/games/smashup/ui/factionMeta.ts

## 3. 双边内容与解决策略

### 注册表与图集

- #92 侧新增：鲨鱼 POD、骷髅 POD、希腊神话 POD、变形者 POD、龙 POD 的 atlas ID、派系 ID、卡牌注册和 faction metadata。
- origin/main 侧新增：迷你萌宠 POD、时间旅行者 POD、Pretty Pretty POD、Marvel 第一波、龙/超级英雄/魔法少女/超级战队 POD、鲨鱼/全明星/龙卷风 POD、圣骑士等主线已入库内容。
- 最终处理：以 origin/main 为基础，补入 #92 独有的骷髅 POD、变形者 POD、五族注册缺口，并保留主线已有 POD 与 Marvel/圣骑士注册。没有用整文件单边覆盖。

### 龙 POD 图集 ID

- #92 侧使用 DRAGONS_POD_CARDS。
- origin/main 侧已使用 DRAGONS_POD，并有既有测试覆盖。
- 最终处理：保留主线 DRAGONS_POD 真实图集值，同时新增 DRAGONS_POD_CARDS 兼容别名指向同一 atlas ID。这样 #92 新测试和主线旧测试都命中同一张龙 POD 图集。

### 三份 add/add POD 数据文件

- sharks_pod.ts：双边卡牌 id、槽位、count 与能力标签一致；origin/main 侧常量命名更具体。
- mythic_greeks_pod.ts：双边卡牌 id、槽位、count 与能力标签一致；origin/main 侧中文名显式带 POD 后缀。
- dragons_pod.ts：双边卡牌定义一致，仅 atlas 常量名称不同。
- 最终处理：采用 origin/main 的文件版本，并通过 DRAGONS_POD_CARDS 兼容别名保留 #92 对龙 POD atlas 常量的引用契约。

### 龙能力共享逻辑

- #92 侧显式为基础版和 POD 版分别注册分数修正。
- origin/main 侧新增 matchesDefId 统一匹配基础版与对应 _pod 版本。
- 最终处理：采用 origin/main 的统一匹配逻辑，因为它等价覆盖基础版和 POD 版，并避免重复注册。

### i18n 与英文图集映射

- #92 侧新增五族 POD 的中英文 faction/cards 文案与英文图集映射。
- origin/main 侧新增大量已入主线派系文案和映射。
- 最终处理：按 JSON 键级并集补入 #92 独有条目；共享键保留 origin/main 的最新文案。修正 faction metadata，使五个经典版派系仍仅 zh-CN 显示，五个 POD 版面向全部语言。

## 4. 验证

已执行并通过：

- npx eslint src/games/smashup/abilities/dragons.ts src/games/smashup/data/cards.ts src/games/smashup/data/factions/dragons_pod.ts src/games/smashup/data/factions/mythic_greeks_pod.ts src/games/smashup/data/factions/sharks_pod.ts src/games/smashup/domain/atlasCatalog.ts src/games/smashup/domain/ids.ts src/games/smashup/ui/factionMeta.ts
- npm run i18n:check
- npx openspec validate add-smashup-sharks-skeletons-greeks-shapeshifters-pod --strict --no-interactive
- npx vitest run src/games/smashup/__tests__/sharksSkeletonsGreeksShapeshiftersDragonsPodIntegration.test.ts src/games/smashup/__tests__/dragonsSuperheroesMagicalGirlsMegaTroopersPodIntegration.test.ts src/games/smashup/__tests__/mermaidsMythicGreeksPodIntake.test.ts src/games/smashup/__tests__/sharksAllStarsTornadosPodIntake.test.ts --configLoader native

补充核对：

- git diff --name-only --diff-filter=U 输出为空。
- 冲突文件中未保留冲突标记。
- public/locales/en/game-smashup.json、public/locales/zh-CN/game-smashup.json、src/games/smashup/data/englishAtlasMap.json 均可被 JSON.parse 解析。
- 五族 POD 的卡牌导入和 registerCards 均为 1 次，没有重复注册。

## 5. 结果

- #92 与最新 origin/main 的真实冲突已解决。
- 主线已有 POD、Marvel、圣骑士和 #92 五族 POD 均被保留。
- 本次没有用单边覆盖替代内容级归并。
