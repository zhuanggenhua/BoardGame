# 冲突解决汇报：PR #91 同步 origin/main

## 1. 背景

- 日期：2026-07-13
- PR：#91「实装大杀四方迷你萌宠与时间旅行者 POD 版」
- 本地 PR head：cca65c5f2d5256dfe1cdb53d534b99f3f6ffe666
- 最新 origin/main：3157e4ac5cdb091a70ed8558cc6a765130adb806
- 合并提交：02917fbfe377f2a8baf23702c3ecaaedff7988fb
- 触发命令：git merge origin/main --no-edit
- 合并目标：让 #91 PR 分支追上最新 origin/main，解除 GitHub 显示的 DIRTY 冲突状态，并保留双方有效内容。

## 2. 真实冲突文件

本次实际出现冲突标记的文件共 6 个：

- public/assets/i18n/assets-manifest.json
- public/assets/i18n/zh-CN/smashup/assets-manifest.json
- src/games/smashup/data/englishAtlasMap.json
- src/games/smashup/domain/atlasCatalog.ts
- src/games/smashup/domain/ids.ts
- src/games/smashup/domain/variantBindings.ts

pre-push 冲突审计额外把以下 4 个双侧重叠但自动合并成功的文件纳入审计范围：

- public/locales/en/game-smashup.json
- public/locales/zh-CN/game-smashup.json
- src/games/smashup/data/cards.ts
- src/games/smashup/ui/factionMeta.ts

## 3. 双边内容与解决策略

### 资源 manifest

- PR #91 侧新增：迷你萌宠 POD、时间旅行者 POD 的中文卡图和压缩 WebP 资源。
- origin/main 侧新增：The Gang 金库劫案资源、Pretty Pretty POD 资源、漫威第一波资源，以及龙族、超级英雄、魔法少女、超级战队等已入主线的英文 POD 资源。
- 最终处理：以 origin/main 的 manifest 为基础，按 files 键级并集补入 PR #91 独有资源键；共享键冲突时保留 origin/main 的最新值。没有用整文件 ours/theirs 覆盖。

### 英文 atlas 映射

- PR #91 侧新增 4 个基地英文图集映射：base_critter_combat_club_pod、base_itty_city_pod、base_the_nexus_pod、base_portal_room_pod。
- origin/main 侧新增 Pretty Pretty POD 基地英文图集映射。
- 最终处理：保留主线 Pretty Pretty POD 基地映射，并补入 PR #91 的迷你萌宠、时间旅行者 POD 基地映射。

### atlas 与 ID 注册表

- PR #91 侧新增：迷你萌宠 POD、时间旅行者 POD 的 atlas ID、派系 ID、中文显示名和卡图 atlas 定义。
- origin/main 侧新增：漫威第一波、Pretty Pretty POD、龙族 POD、超级英雄 POD、魔法少女 POD、超级战队 POD、鲨鱼 POD、全明星 POD、龙卷风 POD、圣骑士等注册。
- 最终处理：保留 origin/main 的新增注册，并补回 PR #91 的迷你萌宠 POD、时间旅行者 POD 注册项。

### 变体绑定

- PR #91 侧新增：迷你萌宠 POD、时间旅行者 POD 绑定到对应基础派系。
- origin/main 侧新增：龙族 POD、超级英雄 POD、魔法少女 POD、超级战队 POD、鲨鱼 POD、龙卷风 POD 等绑定。
- 最终处理：保留主线全部绑定，并补入迷你萌宠 POD、时间旅行者 POD；没有删除主线已入库 POD 绑定。

### 自动合并文件复核

- cards.ts 和 factionMeta.ts 自动合并后同时保留了 PR #91 新派系与 origin/main 已入库派系。
- game-smashup.json 自动合并后能保留基础版文案，但主线新增的卡牌 i18n 完整性门禁要求 POD 精确 key；已按基础版对应卡牌复制迷你萌宠 POD、时间旅行者 POD 的中英文 cards 精确条目，避免运行时回退触发门禁失败。

## 4. 额外门禁修复

npm run i18n:check 显示当前 origin/main 已存在 7 个《七大恨》缺失文案 key，并有 3 处直接可见中文警告。为让 #91 分支通过同一条 pre-push 门禁，本次只做最小 i18n 补齐：

- 补齐 public/locales/zh-CN/game-qidahen.json 和 public/locales/en/game-qidahen.json 中 board.handInteraction.* 与 board.setup.* 缺失键。
- 将 src/games/qidahen/Board.tsx 中“缺少正式卡图”“本席”“待完成/已完成”三处直接可见文本改为 t() 调用。
- 未改《七大恨》玩法逻辑。

## 5. 验证

已执行并通过：

- npm run i18n:check
- npx vitest run src/games/smashup/__tests__/ittyCrittersTimeTravelersPodIntegration.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts --config vitest.config.core.ts --pool forks --no-file-parallelism --maxWorkers 1

补充核对：

- git diff --name-only --diff-filter=U 输出为空。
- 冲突文件中未保留冲突标记。
- 迷你萌宠 POD、时间旅行者 POD 的 atlas ID、派系 ID、variant binding、资源 manifest、英文基地映射均已存在。
- 主线侧鲨鱼 POD、龙卷风 POD、Pretty Pretty POD、龙族 POD 等注册未被覆盖删除。

## 6. 结果

- #91 与最新 origin/main 的真实冲突已解决。
- 双边有效内容均已保留。
- 本次没有用单边覆盖替代内容级归并。

