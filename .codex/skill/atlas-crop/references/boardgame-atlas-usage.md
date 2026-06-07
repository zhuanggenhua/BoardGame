# BoardGame 图集使用清单（按类型分门别类）

> 目的：快速判断“这是哪种图集格式”，以及对应的裁切/注册链路。

## 类型 A：SpriteAtlasConfig（不规则网格）
**特征**：`imageW/imageH + rows/cols + colStarts/rowStarts/colWidths/rowHeights`  
**用途**：卡牌、棋盘、骰子等“按格切”的大图集  
**裁切建议**：使用 `extract-atlas-crops.py --config <atlas.json>`  

### DiceThrone
- 配置：`public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json`
- 运行时：`src/games/dicethrone/ui/cardAtlas.ts`（可叠加角色全局偏移）
- 说明：新角色可能存在轻微左/右偏；需要同步运行时偏移与脚本偏移

### Summoner Wars
- 配置：`src/games/summonerwars/ui/cardAtlas.ts`（手写 HERO/CARDS/PORTAL/DICE）
- 说明：**不是均匀网格**，下半部分有黑色填充；必须手写 rowHeights

---

## 类型 B：SpriteAtlasConfig（frames 列表）
**特征**：`imageW/imageH + frames: [{x,y,width,height}]`  
**用途**：非规则排版、需要精确逐帧裁切  
**裁切建议**：`extract-atlas-crops.py --config <frames-list.json>`

> 当前仓库未发现明确落地示例，但引擎类型已支持（`src/engine/primitives/spriteAtlas.ts`）。

---

## 类型 C：TexturePacker JSON（frames map）
**特征**：`meta.size.w/h + frames.{key}.frame{x,y,w,h}`  
**用途**：状态图标/特效图集等“语义帧”  
**裁切建议**：`extract-atlas-crops.py --config <status-icons-atlas.json>`（输出文件名=frame key）

### DiceThrone（状态图标）
- JSON：`public/assets/i18n/zh-CN/dicethrone/images/<hero>/status-icons-atlas.json`
- 运行时：`src/games/dicethrone/ui/statusEffects.tsx`
- 规则：`buildLocalizedImageSet` 需要去掉 `.png` 扩展名（见 `docs/ai-rules/asset-pipeline.md`）

---

## 类型 D：Lazy Grid（仅 rows/cols）
**特征**：只声明 `rows/cols`，运行时用图片实际尺寸生成均匀网格  
**用途**：大量 POD/批量图集  
**裁切建议**：  
- 如果有图片：`extract-atlas-crops.py --grid-rows N --grid-cols M --image ...`
- 或先将 rows/cols 转成 SpriteAtlasConfig 后用 `--config`

### SmashUp
- 懒注册：`src/components/common/media/cardAtlasRegistry.ts`（`registerLazyCardAtlasSource`）
- 配置来源：`public/assets/atlas-configs/smashup/pod-atlas-config.json`
- 入口：`src/games/smashup/ui/cardAtlas.ts`

---

## 通用注意事项
- 图集配置 JSON **与语言无关**，放 `public/assets/atlas-configs/<gameId>/`
- 图集图片 **必须走 i18n/compressed** 路径（见 `docs/ai-rules/asset-pipeline.md`）
- 裁切偏移必须与运行时偏移一致（否则“裁切正确但渲染偏”）
