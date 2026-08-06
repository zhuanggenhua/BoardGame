# 冲突解决汇报：main 合并远端企鹅派系更新

## 1. 背景

- 本地父提交：`880ca0a2d9004b1280a9e6eaafd43960e98df504`，本轮线上反馈修复，包含 Munchkin 盗贼剩余对象、山屋教程投骰确认与相关证据。
- 远端父提交：`8ce62cd978e7f23dd83b8ddfac3ee853faee1fdf`，远端 main 新增大杀四方企鹅派系与图集资源。
- 合并提交：`a1b566a0fcf264349c82b0b788dbbdc41627bc44`。
- 触发命令：`git merge origin/main -m "合并远端 main 的企鹅派系更新"`。
- 说明：这次没有人工冲突标记；pre-push 的 Merge conflict guard 对自动合并后的双侧重叠文件做审计，识别到 2 个混合结果文件，因此补充本冲突汇报。

## 2. 冲突文件

- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`

## 3. 解决策略

### `public/locales/en/game-smashup.json`

- 策略：双侧有效内容合并，不采用整份单边覆盖。
- 合并要点：
  - 保留本地父提交新增的 Munchkin 盗贼交互提示，例如 `munchkin_thieves_fence_choose_treasures_title`、`munchkin_thieves_mugging_choose_minion_title`、`munchkin_thieves_strip_bare_choose_treasure_title`。
  - 保留远端父提交新增的企鹅派系提示、派系元信息、卡牌和基地文案，例如 `penguins_wish_play_titan_option`、`penguins_emperor_penguin`、`base_ice_floe`。
- 原因：两边修改的是同一份 SmashUp 英文文案真相源，但业务对象不同；本地侧负责 Munchkin 盗贼操作提示，远端侧负责企鹅派系新增内容，两者不存在互斥关系。
- 文件级风险：如果误取本地单边，会丢失企鹅派系用户可见文案；如果误取远端单边，会丢失 Munchkin 盗贼弃宝藏、打劫、剥光等选择提示。

### `public/locales/zh-CN/game-smashup.json`

- 策略：双侧有效内容合并，不采用整份单边覆盖。
- 合并要点：
  - 保留本地父提交新增的 Munchkin 盗贼中文交互提示，例如 `munchkin_thieves_fence_choose_treasures_title`、`munchkin_thieves_mugging_choose_minion_title`、`munchkin_thieves_strip_bare_choose_treasure_title`。
  - 保留远端父提交新增的企鹅派系中文提示、派系元信息、卡牌和基地文案，例如 `penguins_wish_play_titan_option`、`penguins_emperor_penguin`、`base_ice_floe`。
- 原因：两边都是当前业务需要的本地化内容；自动合并结果同时保留 Munchkin 盗贼和企鹅派系文案，符合“双边内容归并不得单边删边”的要求。
- 文件级风险：如果误取本地单边，企鹅派系在中文界面会缺名称、卡牌说明或基地说明；如果误取远端单边，Munchkin 盗贼真实入口会缺中文选择提示。

## 4. 风险与验证

- 风险点：两个 locale 文件都是共享文案真相源，后续若再以单边覆盖方式合并，可能静默删除另一侧已上线玩法的用户可见提示。
- 合并审计：`node scripts/verify/merge-conflict-audit.mjs HEAD --fail-on-single-side` 输出 2 个审计文件，均为 `混合结果`，没有完全等于父1或父2的单边结果。
- 文案核对：`rg -n "penguins_wish_play_titan_option|penguins_emperor_penguin|base_ice_floe|munchkin_thieves_fence_choose_treasures_title|munchkin_thieves_mugging_choose_minion_title|munchkin_thieves_strip_bare_choose_treasure_title" public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json` 命中两类文案。
- 格式检查：`git diff --check HEAD~1..HEAD` 无输出。
- pre-push 结果：首次 pre-push 已确认阻塞点仅为合并提交缺少 `evidence/merge-conflict-*.md` 冲突汇报；本文件用于补齐该门禁证据。

## 5. 回归与行为变化登记

- 原任务问题：继续提交并推送本轮线上反馈修复，包含 Munchkin 盗贼弃宝藏链与山屋投骰确认。
- 本次额外变化：远端 main 已合入企鹅派系提交，push 前必须把本地提交接到远端最新 main 之后。
- 本次额外发现：无新的业务回归；这里只是自动合并后的共享 locale 文件需要补人工留档。
- 不应升级的口径：本记录不表示 Munchkin 新派系整体完成，也不表示企鹅派系由本轮实现；它只说明这次 main 合并没有丢失两边文案。

## 6. 结果

- 合并提交：`a1b566a0fcf264349c82b0b788dbbdc41627bc44`
- 冲突汇报补记：本文档
- 推送目标：`origin/main`
