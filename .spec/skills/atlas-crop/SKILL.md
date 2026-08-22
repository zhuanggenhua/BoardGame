---
name: atlas-crop
description: 通用图集裁切与抽样验收流程；支持不规则网格配置、全局偏移与批量导出 slot 图片。
---

# 通用图集裁切（可复用）

用于从任意图集裁出单元图块，并做抽样检查（关键内容是否被裁掉、是否偏移）。  
**目标**：裁切结果与运行时渲染一致，关键内容不被裁掉。

## 规范来源与职责边界

- 本 skill 是 `workflow`：只承载图集裁切脚本、参数和抽样验收步骤。
- 正式素材主源、压缩产物、manifest、运行时资源链和图集语义门禁，以 `.spec/knowledge/standards/asset-pipeline.md` 为 `canonical-source`。
- 数据录入核对合同以 `.spec/knowledge/standards/data-entry.md` 为 `canonical-source`。
- 本 skill 不把资源规范或录入规范复制成第二份正文；若冲突，先改规范主源。

## 适用场景
- 新图集出现轻微左/右偏，需要微调裁切偏移
- 需要批量导出 `slot-xx.webp/png` 做目检
- 使用不规则网格（colStarts/rowStarts/colWidths/rowHeights）裁切

## 先决条件
- Python 3
- Pillow（若缺失：`pip install pillow`）
- 裁切输入必须是原始图集、原始单图或同等清晰度源文件；`contact-*`、`all-by-size-*`、截图总览、缩略索引页只允许用于定位和索引，禁止作为运行时主素材裁切源。
- 如果目标产物会进入 `public/assets/**` 并被正式页面引用，必须先在资源映射里记录原始 atlas 文件、裁剪坐标、导出尺寸和验收截图；从低清索引图导出的产物只能标记为临时占位，不能标为正式 runtime。

## 脚本
```
./.spec/skills/atlas-crop/scripts/extract-atlas-crops.py
```

## 快速流程
0. **锁定源图真相**
   - 先确认 `--image` 指向原始 atlas / 原始单图，而不是联系表、索引总览或截图缩略图。
   - 如果只有低清索引图，先停止正式裁切；只能生成临时目检产物或明确标注为 `temporary-runtime-placeholder`。
1. **准备配置 JSON（或规则网格参数）**
   - **SpriteAtlasConfig（网格）**：`imageW`/`imageH`/`cols`/`rows`/`colStarts`/`colWidths`/`rowStarts`/`rowHeights`
   - **SpriteAtlasConfig（frames 列表）**：`imageW`/`imageH` + `frames: [{x,y,width,height}]`
   - **TexturePacker（frames map）**：`meta.size.w/h` + `frames: { key: { frame: {x,y,w,h}} }`
   - **规则网格（无 JSON）**：使用 `--grid-rows/--grid-cols` + 可选 `--cell-w/--cell-h/--gap-x/--gap-y/--start-x/--start-y`
2. **执行裁切脚本（在仓库根目录运行）**
   ```bash
   python ./.spec/skills/atlas-crop/scripts/extract-atlas-crops.py \
     --image "public/assets/i18n/<locale>/<gameId>/<category>/compressed/<atlas>.webp" \
     --config "public/assets/atlas-configs/<gameId>/<atlas>.atlas.json" \
     --out "temp/<gameId>/atlas-crops-YYYYMMDD-HHMMSS/<batch>" \
     --shift-x -0.5 \
     --max-index 31
   ```
3. **抽样验收（必须）**
   - 先看整图理解结构，再看单卡是否偏移/被裁  
   - 如仍偏移：微调 `shift-x`/`shift-y`（0.5~1px 级别）后重跑

## 验收要点（必看）
- 关键内容完整可见（如角标、角标数字、右侧符号等）
- 边界不过裁、不留异常大空白
- 若图集本身有“空白/占位”区域，需先确认结构再判定是否异常

## 注意事项
- **不要提交 `temp/` 产物**，仅用于目检与交付。  
- **运行时偏移与脚本偏移必须一致**，否则裁切结果与实际渲染不一致。  
- 输出目录建议包含时间戳，避免残留旧 slot 误判。

更完整的项目内图集类型和使用清单见 [boardgame-atlas-usage](references/boardgame-atlas-usage.md)。
