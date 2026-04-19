---
name: atlas-crop
description: 通用图集裁切与抽样验收流程；支持不规则网格配置、全局偏移与批量导出 slot 图片。
---

# 通用图集裁切（可复用）

用于从任意图集裁出单元图块，并做抽样检查（关键内容是否被裁掉、是否偏移）。  
**目标**：裁切结果与运行时渲染一致，关键内容不被裁掉。

## 适用场景
- 新图集出现轻微左/右偏，需要微调裁切偏移
- 需要批量导出 `slot-xx.webp/png` 做目检
- 使用不规则网格（colStarts/rowStarts/colWidths/rowHeights）裁切

## 先决条件
- Python 3
- Pillow（若缺失：`pip install pillow`）

## 脚本
```
./.windsurf/skills/atlas-crop/scripts/extract-atlas-crops.py
```

## 快速流程
1. **准备配置 JSON（或规则网格参数）**
   - **SpriteAtlasConfig（网格）**：`imageW`/`imageH`/`cols`/`rows`/`colStarts`/`colWidths`/`rowStarts`/`rowHeights`
   - **SpriteAtlasConfig（frames 列表）**：`imageW`/`imageH` + `frames: [{x,y,width,height}]`
   - **TexturePacker（frames map）**：`meta.size.w/h` + `frames: { key: { frame: {x,y,w,h}} }`
   - **规则网格（无 JSON）**：使用 `--grid-rows/--grid-cols` + 可选 `--cell-w/--cell-h/--gap-x/--gap-y/--start-x/--start-y`
2. **执行裁切脚本（在仓库根目录运行）**
   ```bash
   python ./.windsurf/skills/atlas-crop/scripts/extract-atlas-crops.py \
     --image "<图集路径>" \
     --config "<配置JSON路径>" \
     --out "<输出目录>" \
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

## 项目内图集类型分类（摘要）
- **A. SpriteAtlasConfig（不规则网格）**：卡牌/棋盘图集常用（手写 `colStarts/rowStarts`）。
- **B. SpriteAtlasConfig（frames 列表）**：非规则复合排版可用（逐帧数组）。
- **C. TexturePacker JSON（frames map）**：状态图标/特效图集（`meta.size` + `frames.{key}.frame`）。
- **D. Lazy Grid（仅 rows/cols）**：运行时用图片尺寸生成均匀网格（SmashUp）。

更完整的项目内使用清单见：`./.windsurf/skills/atlas-crop/references/boardgame-atlas-usage.md`

## DiceThrone 示例（可选）
```bash
python ./.windsurf/skills/atlas-crop/scripts/extract-atlas-crops.py \
  --image "public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/ability-cards.webp" \
  --config "public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json" \
  --out "temp/dicethrone/atlas-crops-YYYYMMDD-HHMMSS/gunslinger" \
  --shift-x -5 \
  --max-index 31
```
