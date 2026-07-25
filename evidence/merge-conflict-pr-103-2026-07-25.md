# 冲突解决汇报：PR #103 大杀四方漫威 POD 派系卡图

## 1. 背景
- base: bf8daeb34fdbe2d18f932f3c37d07a1565b9e369
- PR head: 0d253f8e4645800cdb9ad7f25304d7f86297f143 (deathcats4/BoardGame:codex/smashup-marvel-pod-pr)
- 当前 main: 7d0710f9c8c199428e49f4475edae36dc8711795 (zhuanggenhua/BoardGame:main)
- 触发命令: `gh pr update-branch 103`
- 结果: GitHub 返回 `Cannot update PR branch due to conflicts`。本轮未切换本地分支，改用临时 index 构造等价合并提交。
- 合并提交: c57c43156ac5068b4049dc230d4a32a91c5b6582

## 2. 冲突/重叠文件
- public/assets/i18n/assets-manifest.json
- public/assets/i18n/zh-CN/smashup/assets-manifest.json
- public/locales/en/game-smashup.json
- public/locales/zh-CN/game-smashup.json

说明：本轮没有在本地工作树产生 `UU` 文件，因为当前工作区已有其他未提交改动，未执行 checkout/merge。上述清单来自共同祖先到 main 与 PR head 的三方重叠文件核对。

## 3. 解决策略
### public/assets/i18n/assets-manifest.json
- 策略：以当前 main 为基线，保留主线已有资源哈希与清单更新，仅追加 PR 新增的 Marvel POD 卡图条目。
- 合并要点：保留 main 中山屋惊魂等既有资源哈希变化；追加 `zh-CN/smashup/cards/compressed/marvel_villains_pod`、`zh-CN/smashup/cards/compressed/marvel_wave_one_pod`、`zh-CN/smashup/cards/marvel_villains_pod`、`zh-CN/smashup/cards/marvel_wave_one_pod`。
- 文件级原因说明：不能整份采用 PR 侧，因为 PR 侧基于旧主线，会覆盖 main 已更新的资源哈希；不能整份采用 main 侧，因为会丢失 Marvel POD 新图资源登记。若判断错误，最可能导致已有资源回退或 Marvel POD 图集加载失败。

### public/assets/i18n/zh-CN/smashup/assets-manifest.json
- 策略：以当前 main 为基线，保留主线新增的效果预览资源，只追加 Marvel POD 图集资源。
- 合并要点：保留 `cards/effect-preview/*` 条目；追加 `cards/compressed/marvel_villains_pod`、`cards/compressed/marvel_wave_one_pod`、`cards/marvel_villains_pod`、`cards/marvel_wave_one_pod`。
- 文件级原因说明：不能整份采用 PR 侧，因为会丢失 main 的效果预览资源；不能整份采用 main 侧，因为会丢失 Marvel POD 图集登记。若判断错误，最可能导致效果预览或 Marvel POD 卡图缺图。

### public/locales/en/game-smashup.json
- 策略：以当前 main 为基线，保留主线新增的圣骑士交互文案，只追加 PR 新增的 8 个 Marvel POD 派系名称与描述。
- 合并要点：保留 `paladins_devout_pastor_discard_title`；追加 `avengers_pod`、`shield_pod`、`spider_verse_pod`、`ultimates_pod`、`hydra_pod`、`kree_pod`、`masters_of_evil_pod`、`sinister_six_pod`。
- 文件级原因说明：不能整份采用 PR 侧，因为会丢失 main 的圣骑士文案；不能整份采用 main 侧，因为会丢失新派系英文展示文案。若判断错误，最可能导致圣骑士交互标题缺失或新派系名称缺失。

### public/locales/zh-CN/game-smashup.json
- 策略：以当前 main 为基线，保留主线新增的中文交互文案，只追加 PR 新增的 8 个 Marvel POD 派系中文名称与描述。
- 合并要点：保留 `paladins_devout_pastor_discard_title`；追加复仇者、神盾局、蜘蛛宇宙、终极战队、九头蛇、克里、邪恶大师、邪恶六人组的 POD 版文案。
- 文件级原因说明：不能整份采用 PR 侧，因为会丢失 main 的中文交互标题；不能整份采用 main 侧，因为会丢失新派系中文展示文案。若判断错误，最可能导致中文界面缺文案。

## 4. 回归与行为变化登记
- 原 PR 目标问题：接入大杀四方 Marvel POD 派系卡图、资源清单、派系注册与预加载合同。
- 本次额外发现的真实回归：未发现新的业务回归；本次只处理 PR 与 main 的合并阻塞。
- 仅业务口径 / 规则变化：无。本次补文档是仓库合并冲突审计门禁要求，不改变游戏规则。

## 5. 风险与验证
- 风险点：资源清单 JSON 合并不完整会造成缺图；语言 JSON 合并不完整会造成派系或既有交互缺文案。
- 审计范围：`bf8daeb34fdbe2d18f932f3c37d07a1565b9e369...7d0710f9c8c199428e49f4475edae36dc8711795` 与 `bf8daeb34fdbe2d18f932f3c37d07a1565b9e369...0d253f8e4645800cdb9ad7f25304d7f86297f143` 的交集。
- 权威来源：当前 main 为 `7d0710f9c8c199428e49f4475edae36dc8711795`，原 PR head 为 `0d253f8e4645800cdb9ad7f25304d7f86297f143`。
- 逐项合并结论：根级 manifest 保留 main 的山屋惊魂资源哈希并追加 Marvel POD 图集；大杀四方 manifest 保留 main 的 effect-preview 条目并追加 Marvel POD 图集；英文/中文文案保留 main 的圣骑士交互标题并追加 Marvel POD 派系与卡牌文案。
- 审计维度：四个重叠 JSON 均按结构化三方合并处理，不采用整份单边结果；未覆盖风险为 JSON 键级合并以外的业务语义仍需质量门和审查兜底。
- 已执行命令：`git push https://github.com/deathcats4/BoardGame.git 081ce2dbb4bb65c1f06076c65bd95e3e93065c14:refs/heads/codex/smashup-marvel-pod-pr`。
- 已执行输出：pre-push 的 merge conflict guard 审计 `c57c43156ac5068b4049dc230d4a32a91c5b6582`，4 个文件均为 `混合结果`，`完全等于父1: 0`，`完全等于父2: 0`。
- 格式核验：`git diff --check 7d0710f9c8c199428e49f4475edae36dc8711795..081ce2dbb4bb65c1f06076c65bd95e3e93065c14` 无输出。
- 远端验证：GitHub `quality-gate` 在补齐 POD 卡牌文案后通过，运行 `30158882843` / job `89682667811`。

## 6. 结果
- 合并提交：c57c43156ac5068b4049dc230d4a32a91c5b6582
- 说明提交：本文件所在提交
- 推送目标：deathcats4/BoardGame:codex/smashup-marvel-pod-pr
