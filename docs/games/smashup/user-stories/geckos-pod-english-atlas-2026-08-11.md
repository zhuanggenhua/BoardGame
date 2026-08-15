# Smash Up：Geckos POD 英文卡图合同（2026-08-11）

## 用户原始要求

- 用户提供 Geckos POD 英文原版 4x5 卡牌图集，要求按项目规范接入，并连同图集向上游作者提交 PR。
- 用户进一步明确：现有资源是中文翻译卡图，本次目标是补齐 POD 英文卡图，不是重复添加同名派系。

## 覆盖对象

- 游戏：`smashup`
- 派系：`adolescent_epic_geckos`
- 资源语言：`en`
- 图集：`smashup/cards/half_the_battle_geckos`

## 实现口径

- 保留现有派系 ID、卡牌定义、能力实现和 `previewRef` 索引。
- 将用户提供的 action-first 英文图集重排为现有运行时的 minion-first 4x5 槽位合同。
- 中文 `zh-CN` 图集保持不变；英文界面优先加载新增的 `en` 图集。
- 源 PNG 与同尺寸运行时 WebP 一并进入 PR，且在 manifest 中登记。

## 验收标准

- 英文图集包含 20 张实体卡，无空槽、无中文卡面。
- 20 个槽位与现有 Geckos `previewRef.index` 一一对应。
- 源 PNG 与运行时 WebP 像素尺寸一致，压缩过程不降采样。
- `en` 游戏级 manifest 和根级 i18n manifest 的路径、大小、SHA-256 与文件一致。
- 英文运行时资源可通过正式资源路径读取。

## 不覆盖范围

- 不修改 Geckos 卡牌规则、能力 handler、卡牌数量或中文翻译。
- 不新增基地卡；用户提供的图集不包含基地。
- 不补齐半场战争扩另外三个派系的英文卡图。
