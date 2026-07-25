# PR #100 合并冲突裁决（2026-07-25）

## 背景

- PR：#100 `[codex] 修复漫威阵营选择规则与额外行动限制`
- 当前主线：`682c53805f7a40d52f84ac1059e8065a81770dd9`
- PR head：`18c6408473bc3130f86824f2f55d152f524e1c1a`
- GitHub 测试合并提交：`b44063ef688cd8fd15c6f5cb5d41faaf6fb6ad48`

## 重叠文件

- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`

## 双边内容

- 主线侧保留了已合入的 Smash Up POD 本地化内容，包括 Marvel POD 派系、卡牌、基地和相关 UI 文案。
- PR 侧新增 6 个漫威选择提示标题：`ultimates_first_to_arrive_title`、`hydra_hour_of_destiny_title`、`hydra_reactivate_agents_title`、`hydra_secret_reserves_title`、`kree_prepare_to_engage_title`、`kree_proven_methods_title`。

## 裁决

- 两侧内容互不替代，合并结果保留主线侧 POD 本地化内容。
- 合并结果同时保留 PR #100 新增的 6 个漫威选择提示标题。
- 不删除、不重命名既有本地化键，避免破坏已合入 POD 资源链路和漫威交互提示。

## 验证

- `git diff origin/main origin/pr-100-merge -- public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json`：相对当前主线仅新增 PR #100 的 6 个提示标题键。
- `git diff 18c6408473bc3130f86824f2f55d152f524e1c1a origin/pr-100-merge -- public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json`：合并结果保留主线侧 POD 本地化内容。
- 两个 JSON 文件在补文案提交生成时已完成 JSON 解析校验。