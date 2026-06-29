# 七大恨区域红线真相源

## 适用场景

- 排查“当前红线是不是手工画的那版”
- 打开 `/dev/qidahen-region-mask` 看图、截图、核对保存结果
- 清理七大恨区域工具遗留图、临时工作区、历史 overlay 前

## 当前结论

- 正式工作区 `src/games/qidahen/data` 当前**没有**手工红线真相。
  - `region-boundary-mask.png`：`0 px`
  - `region-boundary-add.png`：`0 px`
  - `region-boundary-remove.png`：`0 px`
- 默认页现在看到的红线，如果来自正式工作区，只是**根据已保存区域边缘反推出来的显示层**，不能当“用户手工画过的红线版本”。
- 当前仍保留完整手工红线的主候选工作区是：
  - `temp/devtools/qidahen-region-mask-workspaces/manual-boundary-user`
  - 其中 `region-boundary-mask.png`：`76,214 px`
- `manual-boundary-user` 的几个派生副本不是主真相源：
  - `manual-boundary-user-backup-20260530-163845`
  - `manual-boundary-user-generate-smoke`
  - `manual-boundary-user-city-name-smoke-20260530`
  - `manual-boundary-user-city-name-smoke-unique-20260530`
  - 这些目录的 `region-boundary-mask.png` 都只有 `6,917 px`，主要依赖 `region-boundary-add.png` / `region-boundary-remove.png` 才能恢复当时的编辑态，不能拿来冒充“完整红线本体”。

## 四类文件怎么区分

### 1. 正式输入

- 位置：`src/games/qidahen/data`
- 现实含义：
  - `region-mask.png` / `region-mask-regions.json` / `region-graph.json` 是当前正式区域和通路结果
  - `region-boundary-mask.png` / `region-boundary-add.png` / `region-boundary-remove.png` 才是正式边界输入
- 当前事实：
  - 正式区域结果存在
  - 正式边界输入为空

### 2. 默认页辅助红线

- 入口：`/dev/qidahen-region-mask`
- 现实含义：当正式边界输入为空时，工具会根据已保存区域边缘反推一层红线，方便继续编辑
- 红线地位：**辅助显示层，不是真相源**

### 3. 当前手工红线主候选

- 入口：`/dev/qidahen-region-mask?workspace=manual-boundary-user`
- 文件：
  - `temp/devtools/qidahen-region-mask-workspaces/manual-boundary-user/region-boundary-mask.png`
- 当前现场：
  - 页面会显示 `临时隔离工作区`
  - 当前边界文件本体是完整闭合线稿，不再依赖 add/remove 分层

### 4. 历史诊断图 / overlay / 证据截图

- 典型位置：
  - `temp/qidahen-*.png`
  - `test-results/evidence-screenshots/_shared/qidahen-*.png`
- 现实含义：这些图只能证明“某次诊断/某次页面状态/某次候选方案长什么样”
- 禁止误用：
  - 不能把它们当运行时直接消费的边界输入
  - 不能因为某张 overlay 看起来更像，就跳过工作区本体文件

## 最低核对顺序

1. 先看当前页面是哪类工作区：正式工作区，还是隔离工作区。
2. 再看 `region-boundary-mask/add/remove` 是否真的有像素。
3. 如果正式边界文件为空，就把默认页红线视为辅助层，不得直接下结论。
4. 要认“当前手工红线”，优先核 `manual-boundary-user` 工作区本体。
5. 清理遗留图前，先核它是否还被 `evidence/`、`task_plan.md`、`progress.md`、`test-results/` 引用。

## 保存门禁

- 默认页与隔离工作区页现在都会先自动回读当前工作区文件，再允许保存。
- 回读完成前，所有“保存边界 / 保存区域 / 保存连线 / 保存 guide 候选 / 保存工作区”入口都应视为**禁止写盘**。
- 如果页面提示“读取已保存区域数据失败”，只能先修回读错误；这时继续保存，有把旧内存态写回当前工作区的风险。

## 当前安全清理口径

- 现在可以做的：
  - 在 UI 和文档里显式标注“默认页红线不是真实手工边界图”
  - 把 `manual-boundary-user` 与几个 smoke/backup 工作区的地位写清楚
- 现在不能直接做的：
  - 直接删除 `temp/qidahen-*.png`、`test-results/evidence-screenshots/_shared/qidahen-*.png`
  - 直接删除 `manual-boundary-user-*` 派生目录
- 原因：
  - 这些文件和目录仍被现有证据文档引用；在完成引用清点前直接删，会把历史证据链打断

## 本轮现场证据

- 默认正式页截图：
  - `temp/qidahen-dev-current-warning-5274.png`
- 手工红线候选页截图：
  - `temp/qidahen-manual-boundary-user-5274.png`
- 当前手工红线本体截图：
  - `temp/devtools/qidahen-region-mask-workspaces/manual-boundary-user/region-boundary-mask.png`
