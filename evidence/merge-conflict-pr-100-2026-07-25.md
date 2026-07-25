# PR #100 合并冲突裁决（2026-07-25）

## 背景

- PR：#100 `[codex] 修复漫威阵营选择规则与额外行动限制`
- 最新主线：`8b7240efc02784d25c8c6a85b813d5a321bd7e70`
- PR head（第一次 main 同步与补记后）：`3b64cdf91adab2b509cc28b724af39593c471d5e`
- PR 分支内最新 main 同步 merge commit：`089421037d43044d204d89368ba4ef289327e5e6`

## 重叠文件

- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`

## 双边内容

- 主线侧保留已合入的 Smash Up POD 本地化内容，包括 Marvel POD 以及探险家、星际旅者、侠义义警、摔角手 POD 的派系、卡牌、基地和相关 UI 文案。
- PR 侧新增 6 个漫威选择提示标题：`ultimates_first_to_arrive_title`、`hydra_hour_of_destiny_title`、`hydra_reactivate_agents_title`、`hydra_secret_reserves_title`、`kree_prepare_to_engage_title`、`kree_proven_methods_title`。

## 裁决

- 两侧内容互不替代，合并结果保留主线侧全部 POD 本地化内容。
- 合并结果同时保留 PR #100 新增的 6 个漫威选择提示标题。
- 不删除、不重命名既有本地化键，避免破坏已合入 POD 资源链路和漫威交互提示。

## 验证

- `git merge-tree --write-tree --messages 3b64cdf91adab2b509cc28b724af39593c471d5e origin/main`：仅自动合并两个本地化 JSON 文件，无未解决冲突标记。
- `git diff origin/main de82f6bdc93548bea7cbffe2b688b7a677e465ec -- public/locales/en/game-smashup.json public/locales/zh-CN/game-smashup.json`：相对最新主线保留 PR #100 的 6 个提示标题键。
- 两个 JSON 文件在补文案提交生成时已完成 JSON 解析校验。