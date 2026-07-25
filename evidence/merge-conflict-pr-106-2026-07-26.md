# PR #106 合并冲突处理记录

- 时间：2026-07-26
- PR：#106 [codex] 新增 Smash Up Disney 四派系并纳入图片资源
- 处理对象：阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王。
- 冲突来源：PR #106 新增 Disney 图集、派系元数据、语言包和素材清单；main 侧已有 Marvel/POD 派系与资源清单追加。
- 裁决：以最新 main 为底，保留 main 侧 Marvel/POD 条目，同时补入 #106 的 Disney 图集 ID、派系 ID、factionMeta、双语文案、卡牌/基地文本和 assets-manifest 条目。
- 资源边界：保留 #106 的通用 Disney 图集路径 smashup/cards/disney 与 smashup/base/disney_bases；未覆盖 main 已有资源条目。
- 验收位点：PR head 更新后回到 GitHub PR checks 与 open PR 状态确认。
