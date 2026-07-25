# PR #102 合并冲突裁决记录

日期：2026-07-25

## 对象

- PR：#102 [codex] 接入探险家等四个 POD 派系
- base：bf8daeb34fdbe2d18f932f3c37d07a1565b9e369
- 最新 main：682c53805f7a40d52f84ac1059e8065a81770dd9
- PR head：5b2acf46652d59810ef83792ee4b932eef50a18e

## 冲突范围

三方合并命中 8 个双方都改过的文件，其中 4 个产生内容冲突：

- public/locales/en/game-smashup.json
- public/locales/zh-CN/game-smashup.json
- src/games/smashup/domain/atlasCatalog.ts
- src/games/smashup/domain/ids.ts

## 裁决

- 本地化文案：以最新 main 为底，递归补入 #102 新增的探险家、星际旅者、侠义义警、摔角手 POD faction/card 文案；双方没有同一路径同时改动。
- 图集注册：保留 main 已有的漫威、宇宙武士、功夫斗士、俄罗斯童话、阿南西传说 POD 图集，补入 #102 四组 POD 图集。
- ID 注册与中文名：保留 main 已有 POD 常量和中文名，补入 #102 四组 POD atlas/faction 常量与中文名。
- 其他重叠文件采用自动三方合并结果，并在复核中检查双方新增项同时存在。

## 复核

- JSON 递归结构合并未发现同一路径双方同时修改。
- 合并后检查冲突标记、JSON 可解析性、OpenSpec 格式、图集/ID/卡牌注册和 faction meta 同时保留双方新增项。
