# 七大恨区域拓扑单一真相

## 适用场景

- 排查“某个地区为什么在正式图和运行时图里不一致”
- 修改 `辽北 / 辽东`、`敖汉部 / 辽西`、`顺天 / 蓟镇` 这类 shared printed 区
- 调整七大恨地图工具、运行时预览页、棋盘点击/高亮区域
- 判断某次改动应该落到正式印刷区，还是运行时逻辑区

## 当前单一真相分层

### 1. 印刷正式区真相

- 文件：
  - `src/games/qidahen/data/region-mask-regions.json`
  - `src/games/qidahen/data/region-graph.json`
- 现实含义：
  - 原图闭合命名区
  - devtool 生成和保存的正式区域结果
- 强制口径：
  - 每个存在地区名的独立闭合区都必须先在这里独立存在
  - 不得因为运行时逻辑区想聚合，就回头修改这里的地区名或吞并这里的闭合区

### 已盘点的正式闭合命名区

当前正式印刷区共 34 个，来自 `region-mask-regions.json` 与 `region-graph.json`：

`大同`、`外喀尔喀部`、`科尔沁部`、`乌喇部`、`辉发部`、`扎鲁特部`、`叶赫部`、`巴林部`、`哈达部`、`内喀尔喀部`、`长白`、`咸兴`、`建州`、`察哈尔部`、`辽北`、`克什克腾部`、`奈曼部`、`平壤`、`敖汉部`、`土默特部`、`喀喇沁部`、`锦州`、`东江`、`皮岛`、`宣府`、`山海关`、`鄂尔多斯部`、`保定`、`顺天`、`汉城`、`山西`、`延绥`、`登莱`、`山东`。

本轮核对结论：

- `喀喇沁部` 已是独立正式印刷区：`city-region-21`，不能再并回 `土默特部`。
- `土默特部` 是独立正式印刷区：`city-region-20`。
- `辽东`、`辽西`、`蓟镇` 是运行时逻辑区，不写回正式印刷区名称；它们通过 `printedRegionIds` 映射到 `辽北`、`敖汉部`、`顺天` 对应的印刷区。
- `朵颜部` 只在当前规则文本的剧本/标记描述中出现；在当前 `qidahen-main-map.png` 上未作为已确认独立闭合命名区落入正式印刷区表，后续若换图或补图，必须先重新看原图再新增正式区。
- 左侧轮盘、顶部流程表、右侧牌库、底部行动/年份轨等闭合框属于 UI/装饰区，不进入正式印刷区。

### 2. 运行时逻辑区真相

- 文件：
  - `src/games/qidahen/data/runtime-region-mask-regions.json`
  - `src/games/qidahen/data/runtime-region-graph.json`
- 现实含义：
  - 棋盘点击、高亮、移动、通路、运行时 shared printed 拆分后的目标区
- 强制口径：
- `辽东`、`辽西`、`蓟镇` 这类运行时专属区必须直接落盘在这两份文件里
- `喀喇沁部（city-region-21）` 与 `土默特部（city-region-20）` 在运行时也必须保持一对一区域；不得把 `city-region-21` 写进 `city-region-20.printedRegionIds`
- 禁止只在 `src/games/qidahen/ui/mapGraph.ts` 里手写补区、补边、补中心点

### 3. 印刷区 -> 运行时区显式映射

- 真相字段：
  - `runtime-region-mask-regions.json` 里的 `printedRegionIds`
- 现实含义：
  - 一个运行时区来源于哪些印刷正式区
  - 一个印刷正式区为什么会被拆成多个运行时区
- 强制口径：
  - shared printed 关系必须通过 `printedRegionIds` 明示
  - 禁止继续依赖“借同一个 id、再在代码里换名字/改邻接”的隐式映射

## 运行时锚点与中心点

- `runtime-region-mask-regions.json` 的 `seed`：
  - 运行时 ownership 拆分时的锚点真相
- `runtime-region-graph.json` 的 `center` / `pixelCount`：
  - 拆分后实际像素归属的中心点和面积真相
- 强制口径：
  - shared printed 区拆分后，`center` / `pixelCount` 必须来自实际像素归属结果
  - 不得继续复用父印刷区的旧 `pixelCount`，也不得把父区中心点复制给子区

## 改动落点判断

### 只影响正式闭合区

- 改：
  - `region-mask-regions.json`
  - `region-graph.json`
- 不改：
  - `runtime-region-*`

### 只影响运行时拆分、点击、高亮、通路

- 改：
  - `runtime-region-mask-regions.json`
  - `runtime-region-graph.json`
- 不改：
  - `region-mask-regions.json` 的正式闭合区命名结果

### 正式闭合区与运行时逻辑区同时变化

- 先改印刷正式区
- 再改运行时映射与运行时图
- 最后回到 runtime preview / Board 验证

## 禁止行为

- 禁止把运行时逻辑区名称写回正式印刷区，伪装成“正式区已经拆好”
- 禁止在 `mapGraph.ts` 里手写 runtime-only 地区、邻接或通路，绕过数据文件
- 禁止拿 shared printed 审计结果反向覆盖正式印刷区命名
- 禁止用截图、临时 overlay、旧 worktree 里的候选图充当正式拓扑真相

## 最低验证

1. `runtime-region-mask-regions.json` 与 `runtime-region-graph.json` 里的运行时区 id 必须一一对应
2. shared printed 区必须能在 runtime preview 的“正式共图块审计”里明确列出
3. 运行时拆出的子区必须有独立 `seed` / `center` / `pixelCount`
4. `mapGraph.ts` 只能读取正式数据文件，不得再补 runtime-only 区
5. `region-mask.png` 中每个正式印刷区必须是一个连续区域；如果同一个颜色跨成多个不相连块，必须先拆正式区或修 mask，不能靠运行时映射掩盖
