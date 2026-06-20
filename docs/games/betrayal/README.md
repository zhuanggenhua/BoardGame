# 山屋惊魂 3 版资料 intake

本目录记录 `gameId = betrayal` 的首轮资料录入结果。

## 当前结论

- 当前执行现场：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal`
- 分支：`feat/game-betrayal`
- 用户本地图片是本轮主真相源，优先用于资源命名、对象识别和后续实现合同。
- 用户本地 PDF 都是扫描型 PDF，现有自动抽取只能得到空文本，暂时不能直接当“可读规则文本”。
- 已经从 `Mods\Images` 中挑出 59 个可直接进入运行时的明确资源。
- 首批运行时资源已经同步到 `public/assets/i18n/zh-CN/betrayal/`；`public/assets/betrayal/` 继续保留为 intake 暂存层，不删旧入口。

## 已落地内容

- 资源总表：`docs/games/betrayal/sources/image-index/runtime-resource-map.json`
- 图片尺寸与分组索引：`docs/games/betrayal/sources/image-index/`
- PDF 空转证据：`docs/games/betrayal/sources/pdf-text/`
- 英文规则书文本：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`
- 英文求生者剧本书文本：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md`
- 英文叛徒剧本书文本：`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md`
- 首轮 intake 合同：`docs/games/betrayal/intake-contract.md`
- foundation 实施映射：`docs/games/betrayal/foundation-implementation-map.md`
- 正式资源迁移清单：`docs/games/betrayal/resource-migration-plan.md`
- 资源缺口审计：`docs/games/betrayal/resource-gap-audit.md`
- 需求对齐表：`docs/games/betrayal/requirement-alignment.md`
- 架构审查：`evidence/betrayal/betrayal-architecture-review-2026-06-16.md`
- UI 设计规范：`design-system/games/betrayal.md`
- 位图设计稿索引：`docs/games/betrayal/design/README.md`
- 运行时页面级布局合同：`docs/games/betrayal/style-b-screen-contract.md`（历史文件名保留，当前记录的是 `v4` 实现合同，不再代表独立风格分叉）
- 当前运行时实现基线：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v4.png`
- `v8-v12`：历史继续稿，统一记录为过程参考；当前不再视为候选，因为用户本轮已要求回到 `v4` 实施
- `v5`：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v5.png`，记录为 3D 跑偏继续稿
- `v6`：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v6.png`，记录为 2D 纠偏但有说明正文的问题稿
- `v7`：`docs/games/betrayal/design/generated/betrayal-runtime-prehaunt-board-v7.png`，记录为仍未守住 `v4` 版式纪律的失败稿
- 当前角色选择实现基线：`docs/games/betrayal/design/generated/betrayal-character-select-style-b.png`
- 当前终局实现基线：`docs/games/betrayal/design/generated/betrayal-endgame-style-b.png`
- 历史误方向试稿：`docs/games/betrayal/design/generated/betrayal-foundation-ui-mockup-v3.png`

## 首批运行时资源范围

- `ui/`
  - 标题横幅
  - 0-9 数字轨道
- `thumbnails/`
  - `cover.png`
- `cards/`
  - 事件 / 物品 / 预兆 / 叛徒 / 怪物牌背
  - 英文与中文玩家参考卡
  - 中文叛徒参考卡
  - 中文怪物参考卡
  - 1 张蓝色中文参考卡
- `explorers/`
  - 13 张已识别的探索者角色牌
- `monsters/`
  - 3 张已识别的怪物/特殊角色卡
- `markers/`
  - 28 个数字 / 状态 / 资源标记

## 资源落点结论

- 当前候选资源暂存目录：`public/assets/betrayal/`
- 正式运行时目录：`public/assets/i18n/zh-CN/betrayal/`
- 依据：
  - `create-new-game` skill 6.6 明确要求新游戏图片默认落到 `public/assets/i18n/zh-CN/<gameId>/...`
  - `ManifestGameThumbnail` 与 `AssetLoader` 现有测试合同默认从 `i18n/zh-CN/<gameId>/...` 解析缩略图与本地化图片
- 因此，当前 intake 已完成“对象识别与候选资源筛出”，并已完成首轮“正式运行时资源落盘收口”。

## 当前未进入运行时的素材

- 大尺寸拼版房间图
- 大尺寸拼版标记图
- 扫描页类 JPG / PNG
- 含黑底拼接的参考页
- 无法唯一判断运行时语义的 candidate 图

这些素材继续保留在 `docs/games/betrayal/sources/` 作为真相源或候选源，不混入 `public/assets/`。

## 下一步建议

1. 当前优先完成首剧本真实页面截图验收：角色选择、`v4` 运行时、终局三态。
2. 后续再从大拼版房间图里裁出房间板块与楼层板，补 `rooms/`、`boards/` 资源合同。
3. 再处理扫描 PDF 的 OCR 或人工录入，把规则文本沉淀成可实现的结构化文档。
4. 最后进入 haunt / 叛徒 / 剧本的正式玩法实现。
