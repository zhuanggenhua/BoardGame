# Smash Up：Marvel POD 英文图集独立接入合同（2026-08-12）

## 用户原始要求

- 用户提供两张 Marvel POD 英文卡牌图集，要求按项目规范实装、上传图集并向作者提交 PR。
- 用户明确指出这些是 POD 卡图，不是中文卡图；必须作为独立 POD 版本接入。

## 覆盖对象

- 游戏：`smashup`
- POD 派系：`avengers_pod`、`shield_pod`、`spider_verse_pod`、`ultimates_pod`、`hydra_pod`、`kree_pod`、`masters_of_evil_pod`、`sinister_six_pod`
- 英文图集：`smashup/cards/marvel_wave_one_pod`、`smashup/cards/marvel_villains_pod`
- 资源语言：`en`

## 实现口径

- 八个 POD 派系保留独立 `factionId`、独立 `_pod` 卡牌 ID、独立 atlas 和派系选择入口。
- POD 卡牌玩法字段与经典版语义相同时，允许通过 variant binding 复用现有 ability / interaction / ongoing 等玩法表面。
- 用户提供的英文 PNG 与同尺寸 runtime WebP 进入 `i18n/en` 资源链及两级 manifest。
- 英文界面优先加载新增 `en` 图集；其他 locale 只通过项目既有图片回退链消费同一英文 POD 资源。

## 验收标准

- 两张图集均为 `9 x 6` 均匀网格，源 PNG 与 runtime WebP 尺寸一致且不降采样。
- `marvel_wave_one_pod` 的 54 个槽位全部使用；`marvel_villains_pod` 使用前 49 个槽位，末 5 个槽位为空。
- 八个 POD 派系各自构成 20 张牌库，所有卡牌 ID 以 `_pod` 结尾并引用对应独立 atlas。
- `en` 游戏级 manifest 和根级 i18n manifest 的路径、字节数及 SHA-256 与文件一致。
- 两张 runtime WebP 上传到正式资源主源，并通过公开 URL 回查。

## 不覆盖范围

- 不替换或修改经典 `avengers`、`shield`、`spider_verse`、`ultimates`、`hydra`、`kree`、`masters_of_evil`、`sinister_six` 派系。
- 不把英文 POD 图集登记为中文卡图，不修改经典 Marvel 的 `zh-CN` atlas、卡牌 ID、选择入口或行为。
- 不因图片接入改写卡牌规则文本或共享能力实现。
