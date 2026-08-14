# 小黑屋配置表：探索者玩家面板与地图 Token 索引验收

## 本轮目标

- 问题对象：山屋惊魂 `/games/betrayal/config` 真实“小黑屋配置表”。
- 真相来源：正式运行配置 `BETRAYAL_EXPLORER_CATALOG`，配置审查 adapter 从该正式源物化表格行；`docs/` 只作为证据说明，不是配置表本体。
- 验收口径：配置表能筛选 / 搜索探索者，能同屏看到玩家面板资源与地图 Token 资源；点击面板图或地图 Token 能打开各自独立候选列表，选择候选后形成字段级配置修正提案。

## 修改范围

- `src/games/betrayal/config/configReviewAdapter.ts`：把探索者角色作为 `explorer` 行接入配置审查表，字段包含玩家面板资源、面板源图、地图 Token、Token 源图、Token 压缩图和素材职责说明。
- `src/components/config/ConfigReviewTable.tsx`：把自定义单元格接回同一套待提交修正状态，游戏侧候选选择器不另造草稿系统。
- `src/pages/BetrayalConfigReview.tsx`：配置表新增“探索者角色”筛选；素材预览列同时显示“面板”和“Token”两张图；点击面板 / Token 可打开对应候选列表并写入待提交修正。
- `src/games/betrayal/__tests__/configReviewAdapter.test.ts`：验证探索者行来自正式配置源、字段路径指向 `portraitAsset` / `tokenAsset`，并进入搜索索引。
- `e2e/betrayal/config-review-explorer-assets.e2e.ts`：从真实配置表入口验证搜索、双素材预览、横向字段、点击面板候选、点击地图 Token 候选、选择候选、待提交修正和配置修正提案弹窗。
- `public/locales/zh-CN/game-betrayal.json` / `public/locales/en/game-betrayal.json`：配置表说明和搜索占位文案加入探索者、玩家面板与 Token。

## 验证命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/configReviewAdapter.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node .\node_modules\typescript\bin\tsc --noEmit --pretty false --project tsconfig.json
node scripts/infra/run-e2e-single.mjs default e2e/betrayal/config-review-explorer-assets.e2e.ts
```

结果：

- adapter 单测：`6 passed`。
- TypeScript：通过，无类型错误输出。
- 真实入口 E2E：`1 passed`。

## 截图验收

### 01-配置表搜索探索者-面板与Token预览.jpg

- 真实入口为“小黑屋配置表”，筛选器为“探索者角色”，搜索词为 `jaden-jones`。
- 表格显示 `1-1 / 1`，说明探索者角色数据已进入配置表搜索索引，而不是只写在文档表里。
- 素材预览列同时出现“面板”和“Token”两张缩略图，玩家面板资源和地图 Token 资源没有再被混成同一个展示职责。

### 02-配置表横向字段-Token源图与职责.jpg

- 横向滚动后可见 Token 源图、Token 压缩图和素材职责列。
- 素材职责列明确写出玩家面板使用 `panelAsset / portraitAsset`，地图房间角色 token 使用 `mapTokenAsset / tokenAsset`，两者不能互相替代。
- 该图证明配置表不是只展示一个素材 ID，而是把两类资源和职责边界放在同一条探索者配置行里供人工核对。

### 03-点击面板图-面板候选列表.jpg

- 点击素材预览里的“面板”后，弹出“为杰登·琼斯选择玩家面板资源”的候选列表。
- 候选来自正式素材索引，列表展示缩略图、候选名称、资源路径和源文件路径。
- 当前 `betrayal/explorers/jade-jones` 被标为“当前选择”，证明玩家面板资源和地图 Token 的候选入口是分开的。

### 04-点击地图Token-Token候选列表.jpg

- 点击素材预览里的“Token”后，弹出“为杰登·琼斯选择地图 Token”的候选列表。
- 候选来自 `tokens/explorers` 素材集合，图面显示的是地图玩家棋子 Token，不是玩家面板图。
- 该图证明配置表允许从所有可选地图 Token 中点选，而不是要求维护者手写路径。

### 05-选择地图Token-待提交修正.jpg

- 从 Token 候选列表选择 `betrayal/tokens/explorers/darryl-highla` 后，表格同一行的 Token 缩略图和地图 Token 字段同步变为新草稿值。
- 顶部状态显示“已暂存 1 个字段修改”，提交按钮显示“提交修正（1）”，证明候选选择写入的是同一套待提交修正状态。
- 该步骤没有直接改正式源，而是进入配置审查表的字段级修正流程。

### 06-配置表修改交互-修正提案弹窗.jpg

- 点击提交后打开反馈 / 配置修正提案弹窗。
- 弹窗显示对象“杰登·琼斯”、字段“地图 Token”、当前值 `betrayal/tokens/explorers/jaden-jones` 和修改后值 `betrayal/tokens/explorers/darryl-highla`。
- 该图证明修改交互最终形成字段级配置修正提案，而不是浏览器里静默改正式配置。

## AI 图面裁决

- verdict: PASS
- score: 96/100
- hard_failures: []
- 结论：六张整图共同覆盖真实配置表入口、搜索索引、双素材预览、字段职责、面板候选列表、地图 Token 候选列表、候选选择后的草稿状态和配置修正提案弹窗，达到本轮验收标准。
