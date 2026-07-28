# PR #101 合并冲突裁决记录

日期：2026-07-25

## 对象

- PR：#101 [codex] 接入大杀四方四组 POD 派系卡图
- base：bf8daeb34fdbe2d18f932f3c37d07a1565b9e369
- 最新 main：6eb161d849b10813f5f796122e8af1361798f003
- PR head：9f11a00175df8ea7f5f8b26389c5efd9c1c51a38

## 冲突范围

三方合并命中 4 个双方都改过的文件：

- public/assets/i18n/assets-manifest.json
- public/assets/i18n/zh-CN/smashup/assets-manifest.json
- src/games/smashup/domain/atlasCatalog.ts
- src/games/smashup/domain/ids.ts

## 裁决

- 素材总清单：以最新 main 为底，补入 #101 新增的宇宙武士、功夫斗士、俄罗斯童话、阿南西传说 POD 卡图条目；保留 main 已有的漫威 POD 卡图条目。
- 中文 Smash Up 素材清单：同样以最新 main 为底，补入 #101 新增的 8 个中文 POD 原图/压缩图条目；保留 main 已有的漫威 POD 条目。
- 图集注册与 ID：采用自动三方合并结果，确认同时包含漫威 POD 与 #101 四组 POD 常量/注册项。

## 复核

- JSON 结构化合并未发现同名条目双方同时修改。
- 合并后检查冲突标记、JSON 可解析性，以及漫威 POD 与 #101 四组 POD 注册是否同时存在。
