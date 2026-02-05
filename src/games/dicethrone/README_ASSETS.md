# Dice Throne 素材处理方案 (Asset Pipeline)

本文档规范了 Dice Throne 游戏模块中图片素材（卡牌、图标、英雄面板）的处理流程，供新增英雄时参考。

---

## 1. 目录结构

所有 Dice Throne 相关的静态资源存放在 `public/assets/dicethrone/` 下：

```text
public/assets/dicethrone/
├── assets-manifest.json          # 资源清单（CDN/版本管理用）
├── images/
│   ├── Common/                   # 通用资源（背景图等）
│   │   └── background.png
│   ├── monk/                     # 僧侣 (Monk) 专属资源
│   │   ├── monk-ability-cards.png       # 卡牌图集源图（大约 18MB）
│   │   ├── monk-player-board.png        # 玩家面板（技能槽背景）
│   │   ├── monk-tip-board.png           # 技能提示板
│   │   ├── dice-sprite.png              # 骰面图集
│   │   ├── compressed/                  # 压缩后的资源（实际加载）
│   │   │   ├── monk-ability-cards.avif
│   │   │   ├── monk-ability-cards.webp
│   │   │   ├── monk-ability-cards.atlas.json  # 图集配置
│   │   │   └── ...
│   │   └── status-icons/                # 状态图标
│   ├── barbarian/                # 野蛮人 (Barbarian) 专属资源
│   │   └── ...（结构同上）
│   └── ...（未来新英雄）
└── thumbnails/                   # 缩略图（选角界面用）
```

---

## 2. 图集系统 (Card Atlas)

### 2.1 核心概念

Dice Throne 使用**图集 (Atlas)** 方式管理卡牌图片，而非单独的图片文件。一个图集是一张包含多张卡牌的大图，配合一个 JSON 配置文件来定位每张卡牌的位置。

**优势**：
- 减少 HTTP 请求数
- 利用浏览器缓存
- 统一压缩处理

### 2.2 图集配置文件格式

每个英雄的 `compressed/` 目录下都有一个 `.atlas.json` 文件：

```json
{
  "imageW": 3726,         // 图集宽度 (px)
  "imageH": 4096,         // 图集高度 (px)
  "rows": 4,              // 行数
  "cols": 10,             // 列数
  "rowStarts": [29, 614, 1182, 1773],     // 每行起始 Y 坐标
  "rowHeights": [543, 546, 546, 535],     // 每行高度
  "colStarts": [28, 406, 777, ...],       // 每列起始 X 坐标
  "colWidths": [329, 335, 333, ...],      // 每列宽度
  "scan": { ... }         // 自动扫描参数（生成用，运行时不需要）
}
```

### 2.3 索引 (Index) 映射规则

卡牌在图集中的位置由 **index** 决定，从左到右、从上到下编号（0-based）：

```
Index 0   Index 1   Index 2   ...   Index 9
Index 10  Index 11  Index 12  ...   Index 19
...
```

**重要**：确保 `cards.ts` 中的 `previewRef.index` 与图集中的卡牌位置严格对应！

---

## 3. 代码引用方式

### 3.1 注册图集 ID

在 `src/games/dicethrone/domain/ids.ts` 中注册图集 ID：

```typescript
export const DICETHRONE_CARD_ATLAS_IDS = {
    MONK: 'dicethrone:monk-cards',
    BARBARIAN: 'dicethrone:barbarian-cards',
    // 新英雄在这里添加
} as const;
```

### 3.2 卡牌定义中引用

在 `heroes/<hero>/cards.ts` 中，每张卡牌通过 `previewRef` 字段引用图集：

```typescript
{
    id: 'card-enlightenment',
    name: cardText('card-enlightenment', 'name'),
    type: 'action',
    cpCost: 0,
    timing: 'main',
    description: cardText('card-enlightenment', 'description'),
    previewRef: {
        type: 'atlas',
        atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK,  // 图集 ID
        index: 0                                   // 卡牌在图集中的索引
    },
    effects: [ ... ]
}
```

### 3.3 图集加载与注册

图集在 `Board.tsx` 中动态加载并注册到全局 Registry：

```typescript
// Board.tsx (约 643-667 行)
React.useEffect(() => {
    const loadAtlas = async (atlasId: string, imageBase: string) => {
        const config = await loadCardAtlasConfig(imageBase, locale);
        registerCardAtlasSource(atlasId, {
            image: imageBase,
            config,
        });
    };

    void loadAtlas(DICETHRONE_CARD_ATLAS_IDS.MONK, ASSETS.CARDS_ATLAS('monk'));
    void loadAtlas(DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, ASSETS.CARDS_ATLAS('barbarian'));
    // 新英雄在这里添加加载调用
}, [locale]);
```

### 3.4 渲染组件

`CardPreview` 组件根据 `previewRef.type` 自动选择渲染方式：

```tsx
// src/components/common/media/CardPreview.tsx
if (previewRef.type === 'atlas') {
    const source = getCardAtlasSource(previewRef.atlasId);
    const atlasStyle = getCardAtlasStyle(previewRef.index, source.config);
    return (
        <div
            style={{
                backgroundImage: buildLocalizedImageSet(source.image, locale),
                ...atlasStyle,
            }}
        />
    );
}
```

---

## 4. 图片压缩流程

### 4.1 压缩工具

项目使用自定义脚本将 PNG 压缩为 AVIF 和 WebP 格式：

```bash
# 压缩指定目录下的图片
node scripts/compress-images.js public/assets/dicethrone/images/monk
```

### 4.2 输出规范

| 原始格式 | 压缩格式       | 存放位置                    |
| -------- | -------------- | --------------------------- |
| `.png`   | `.avif`, `.webp` | `compressed/` 子目录      |

### 4.3 图集配置生成

使用 `atlas-scan.js` 脚本自动扫描卡牌边界并生成 `.atlas.json`：

```bash
node scripts/atlas-scan.js public/assets/dicethrone/images/monk/monk-ability-cards.png
```

**输出**：`monk-ability-cards.atlas.json`（需复制到 `compressed/` 目录）

---

## 5. 新增英雄检查清单

当添加新英雄时，按以下步骤操作：

### 5.1 素材准备
- [ ] 获取卡牌扫描图（所有卡牌排列在一张大图上）
- [ ] 获取玩家面板图 (`<hero>-player-board.png`)
- [ ] 获取技能提示板图 (`<hero>-tip-board.png`)
- [ ] 获取骰面图集 (`dice-sprite.png`)

### 5.2 目录创建
- [ ] 创建 `public/assets/dicethrone/images/<hero>/`
- [ ] 创建 `public/assets/dicethrone/images/<hero>/compressed/`

### 5.3 图集处理
- [ ] 运行 `atlas-scan.js` 生成配置
- [ ] 手动核对索引与卡牌对应关系
- [ ] 运行 `compress-images.js` 压缩
- [ ] 将 `.atlas.json` 复制到 `compressed/`

### 5.4 代码注册
- [ ] 在 `domain/ids.ts` 添加 `DICETHRONE_CARD_ATLAS_IDS.<HERO>`
- [ ] 在 `domain/ids.ts` 添加 `<HERO>_DICE_FACE_IDS`（如果骰面不同）
- [ ] 在 `Board.tsx` 添加 `loadAtlas()` 调用
- [ ] 在 `heroes/<hero>/cards.ts` 中为每张卡牌设置正确的 `previewRef.index`

### 5.5 验证
- [ ] 本地运行游戏，检查所有卡牌图片是否正确显示
- [ ] 检查放大预览是否正确
- [ ] 检查弃牌堆顶显示是否正确

---

## 6. 常见问题

### Q: 图片显示为空白或错位？
**A**: 检查 `previewRef.index` 是否与图集中的实际位置匹配。使用图片编辑器（如 Photoshop）查看像素坐标，与 `.atlas.json` 对比。

### Q: 新英雄的卡牌预览不加载？
**A**: 确保在 `Board.tsx` 中添加了 `loadAtlas()` 调用，并且 `DICETHRONE_CARD_ATLAS_IDS` 中注册了正确的 ID。

### Q: 压缩后图片质量太差？
**A**: 调整 `compress-images.js` 中的质量参数，或者对于小图标类资源考虑保留 PNG 格式。

---

**维护记录**
- 2026-02-06: 完善文档，添加 Monk 处理流程详解
