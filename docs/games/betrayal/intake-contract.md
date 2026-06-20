# 山屋惊魂 3 版首轮录入合同

## 1. 问题对象

- 游戏：山屋惊魂第三版 / `betrayal`
- 用户素材根目录：`D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods`
- 本轮目标：把本地素材转成后续易读、易实现、易索引的 intake 结果，而不是现在就完成玩法实现。

## 2. 真相源与对照源

| 类型 | 现实含义 | 路径/链接 | 本轮角色 | 当前状态 |
| --- | --- | --- | --- | --- |
| 本地图片 | 用户现有汉化图片、牌图、标记图、拼版图 | `Mods\Images` | 主真相源 | 已完成尺寸盘点、缩略图索引、首轮命名 |
| 本地 PDF | 用户现有规则/剧本扫描件 | `Mods\PDF` | 主真相源的补充来源 | 都是扫描型 PDF，当前自动抽取为空 |
| 官方说明页 | 官方组件与下载入口说明 | `https://instructions.hasbro.com/en-ca/instruction/avalon-hill-betrayal-at-house-on-the-hill-3rd-edition-cooperative-board-game-for-ages-12-and-up-for-3-6-players` | 英文对照源 | 已确认可访问 |
| 英文规则书镜像 | 英文规则参考 | `https://www.qugs.org/rules/r358504.pdf` | 英文对照源 | 已确认存在，未并入本地资源树 |
| 英文规则书文本 | 上一条镜像的可读 Markdown | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md` | 英文对照源 | 已抽取成 13 页文本 |
| 英文求生者剧本书 | 求生者侧剧本文档 | `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md` | 英文对照源 | 已抽取成 60 页文本 |
| 英文叛徒剧本书 | 叛徒侧剧本文档 | `docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md` | 英文对照源 | 已抽取成 60 页文本 |

## 3. PDF 处理结论

| 序号 | 原始文件 | 大小 | 抽取结果 | 结论 |
| --- | --- | ---: | --- | --- |
| 01 | `httpssteamusercontent...AC91.PDF` | 22.50 MB | `pdf-01.md` 为空 | 扫描型，待 OCR |
| 02 | `httpssteamusercontent...5477.PDF` | 48.07 MB | `pdf-02.md` 为空 | 扫描型，待 OCR |
| 03 | `httpssteamusercontent...68AC8.PDF` | 48.52 MB | `pdf-03.md` 为空 | 扫描型，待 OCR |
| 04 | `httpssteamusercontent...770E.PDF` | 20.71 MB | `pdf-04.md` 为空 | 扫描型，待 OCR |
| 05 | `httpssteamusercontent...9460.PDF` | 5.11 MB | `pdf-05.md` 为空 | 扫描型，待 OCR |
| 06 | `httpssteamusercontent...317E.PDF` | 9.24 MB | `pdf-06.md` 为空 | 扫描型，待 OCR |
| 07 | `httpssteamusercontent...1EDD.PDF` | 9.34 MB | `pdf-07.md` 为空 | 扫描型，待 OCR |
| 08 | `httpssteamusercontent...DC2F.PDF` | 6.22 MB | `pdf-08.md` 为空 | 扫描型，待 OCR |

当前结论：本地 PDF 不能直接转成可读规则文本，后续应走 OCR 或人工录入，不允许把空 Markdown 当规则真相源。

补充：英文规则书、求生者剧本书、叛徒剧本书都已经转成可读 Markdown，可作为当前对照源；Hasbro 说明页的文本镜像抓取仍被对端拒绝，暂不影响本轮 intake 结论。

## 4. 图片盘点结果

- 总图片数：172
- 尺寸组：56
- 主要高频组：
  - `384x336`：51 张，主要是头像、怪物 token、骰面/状态小图
  - `450x450`：28 张，主要是数字标记与状态标记
  - `675x1275`：14 张，主要是牌背与参考卡
  - `1270x1289`：10 张，主要是探索者角色牌

辅助索引位置：

- `docs/games/betrayal/sources/image-index/images-manifest.csv`
- `docs/games/betrayal/sources/image-index/images-dimension-summary.json`
- `docs/games/betrayal/sources/image-index/contact-*.jpg`
- `docs/games/betrayal/sources/image-index/all-by-size-*.jpg`

## 5. 运行时资源白名单

本轮只允许以下素材进入正式运行时资源树；当前候选文件虽然已经暂存到 `public/assets/betrayal/`，但正式落点应为 `public/assets/i18n/zh-CN/betrayal/`：

| 类别 | 数量 | 现实含义 |
| --- | ---: | --- |
| `ui` | 2 | 标题横幅、0-9 轨道 |
| `thumbnails` | 1 | 大厅封面候选 |
| `cards` | 12 | 牌背、玩家参考卡、中文参考卡 |
| `explorers` | 13 | 已识别探索者角色牌 |
| `monsters` | 3 | 已识别怪物/特殊角色卡 |
| `markers` | 28 | 数字、状态、资源标记 |

资源映射真相源：`docs/games/betrayal/sources/image-index/runtime-resource-map.json`

补充结论：

- `public/assets/betrayal/` 只是当前 worktree 里的 intake 暂存目录，不是正式运行时合同目录。
- 正式资源合同应对齐：
  - 缩略图：`public/assets/i18n/zh-CN/betrayal/thumbnails/cover.png`
  - 运行时图片：`public/assets/i18n/zh-CN/betrayal/<category>/...`
- 依据来自项目现有 `create-new-game` skill 6.6、`ManifestGameThumbnail` 测试和 `AssetLoader` 的本地化资源解析合同。

## 6. 明确不进运行时的素材

以下素材现在只保留为 `source/candidate`，不进入 `public/assets/`：

- 6300x5400、6076x6376、5400x3826 这类大拼版图
- 3376x2550、2026x2550、2943x969 这类待裁切的楼层/房间/标记拼页
- 含大面积黑底的拼接参考页
- 扫描页 JPG
- 32x32、512x512 这类当前无明确业务语义的小图

原因：这些文件还不能唯一映射到“后续代码里会直接引用的单对象资源”，混入运行时目录会污染资源真相源。

## 7. 已确认对象

- 探索者角色牌：已确认 13 张
- 怪物/特殊角色卡：已确认 3 张
- 牌背：已确认 5 张
- 玩家/叛徒/怪物参考卡：已确认 6 张
- 标记：已确认 28 张

## 8. 待确认对象

- 大拼版中的房间板块
- 楼层总览图与房屋楼层板
- 扫描 PDF 对应的规则书、剧本书、参考书具体分工
- 尚未进入白名单的头像/模型/局部标记图

## 9. 后续实施入口

1. 先把当前候选资源从 `public/assets/betrayal/` 迁到 `public/assets/i18n/zh-CN/betrayal/`，并重新生成 manifest。
2. 再从大拼版图中裁出房间板块、楼层板和可能的起始房间。
3. 最后补 OCR/人工录入，把规则、剧本和参考卡转成结构化文字合同。
