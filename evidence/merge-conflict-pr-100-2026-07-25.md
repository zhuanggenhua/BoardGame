# PR #100 合并冲突裁决（2026-07-25）

## 背景

- PR：#100 `[codex] 修复漫威阵营选择规则与额外行动限制`
- 当前主线：`682c53805f7a40d52f84ac1059e8065a81770dd9`
- PR head（补文案与首次 evidence 后）：`edda80ddbd29d64b1457ff699dd2e68de7bec699`
- PR 分支内手工 merge commit：`24e8b831b70ae7cb60f3275327d2546230853c65`
- GitHub 测试合并提交：`085637249d2b25a632f54e20aced6befdccf003b`

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
- `git diff edda80ddbd29d64b1457ff699dd2e68de7bec699 origin/pr-100-merge -- public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json`：合并结果保留主线侧 POD 本地化内容。
- 两个 JSON 文件在补文案提交生成时已完成 JSON 解析校验。