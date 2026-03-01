# Cardia 图片映射重建指南

## 当前资源结构分析

### 已有资源

1. **人物牌（Character Cards）**
   - 位置：`public/assets/cardia/cards/compressed/`
   - 数量：46 张 WebP 文件（1-48，缺少 11 和 12）
   - 格式：单张图片，编号 1-48

2. **地点牌（Location Cards）**
   - 目录已创建：`public/assets/i18n/zh-CN/cardia/cards/compressed/locations/`
   - 当前状态：空目录

3. **辅助卡（Helper Cards）**
   - `helper1.webp` 和 `helper2.webp`
   - 位置：`public/assets/i18n/zh-CN/cardia/cards/compressed/`

## 重建方案

### 方案 A：使用图集系统（推荐，适合大量卡牌）

#### 优点
- HTTP 请求最少（1-2 个请求）
- 加载速度快
- 内存使用优化
- 适合 100+ 张卡牌

#### 实施步骤

**1. 准备图片素材**

```bash
# 人物牌（32 张 I 牌组 + 32 张 II 牌组 = 64 张）
public/assets/cardia/cards/
  deck1/
    1.jpg, 2.jpg, ..., 16.jpg  # I 牌组 16 张
  deck2/
    1.jpg, 2.jpg, ..., 16.jpg  # II 牌组 16 张

# 地点牌（8 张）
public/assets/cardia/cards/locations/
  1.jpg  # 巨蛇神殿
  2.jpg  # 集市
  3.jpg  # 剑始者营
  4.jpg  # 大图书馆
  5.jpg  # 垃圾场
  6.jpg  # 拍卖行
  7.jpg  # 闹鬼地下墓穴
  8.jpg  # 迷雾沼泽
```

**2. 压缩图片**

```bash
# 压缩人物牌
npm run compress:images -- public/assets/cardia/cards/deck1
npm run compress:images -- public/assets/cardia/cards/deck2

# 压缩地点牌
npm run compress:images -- public/assets/cardia/cards/locations
```

**3. 创建图集**

```bash
# 创建人物牌图集（I 牌组）
python3 scripts/assets/create_uniform_atlas.py \
  public/assets/cardia/cards/deck1/compressed \
  --rows 4 \
  --cols 4 \
  --output public/assets/i18n/zh-CN/cardia/cards/compressed/deck1.webp

# 创建人物牌图集（II 牌组）
python3 scripts/assets/create_uniform_atlas.py \
  public/assets/cardia/cards/deck2/compressed \
  --rows 4 \
  --cols 4 \
  --output public/assets/i18n/zh-CN/cardia/cards/compressed/deck2.webp

# 创建地点牌图集
python3 scripts/assets/create_uniform_atlas.py \
  public/assets/cardia/cards/locations/compressed \
  --rows 2 \
  --cols 4 \
  --output public/assets/i18n/zh-CN/cardia/cards/compressed/locations.webp
```

**4. 更新代码**

```typescript
// src/games/cardia/domain/ids.ts
export const CARDIA_ATLAS_IDS = {
    DECK_I: 'cardia-deck-i',
    DECK_II: 'cardia-deck-ii',
    LOCATIONS: 'cardia-locations',
} as const;

// src/games/cardia/ui/cardAtlas.ts
import { registerLazyCardAtlasSource } from '../../../components/common/media/CardPreview';
import { CARDIA_ATLAS_IDS } from '../domain/ids';

// 注册 I 牌组图集
registerLazyCardAtlasSource(CARDIA_ATLAS_IDS.DECK_I, {
    image: 'i18n/zh-CN/cardia/cards/compressed/deck1.webp',
    grid: { rows: 4, cols: 4 }, // 16 张卡牌
});

// 注册 II 牌组图集
registerLazyCardAtlasSource(CARDIA_ATLAS_IDS.DECK_II, {
    image: 'i18n/zh-CN/cardia/cards/compressed/deck2.webp',
    grid: { rows: 4, cols: 4 }, // 16 张卡牌
});

// 注册地点牌图集
registerLazyCardAtlasSource(CARDIA_ATLAS_IDS.LOCATIONS, {
    image: 'i18n/zh-CN/cardia/cards/compressed/locations.webp',
    grid: { rows: 2, cols: 4 }, // 8 张地点牌
});

// src/games/cardia/domain/cardRegistry.ts
export interface CardDef {
    id: string;
    influence: number;
    faction: FactionId;
    abilityIds: AbilityId[];
    difficulty: number;
    deckVariant: DeckVariantId;
    nameKey: string;
    descriptionKey: string;
    
    // 图集引用
    atlasId: string;      // 'cardia-deck-i' | 'cardia-deck-ii'
    atlasIndex: number;   // 0-15（图集中的索引）
}

// 示例：I 牌组第 1 张卡
{
    id: CARD_IDS_DECK_I.CARD_01,
    influence: 1,
    faction: FACTION_IDS.SWAMP,
    abilityIds: [ABILITY_IDS.THIEF],
    difficulty: 0,
    deckVariant: 'I',
    nameKey: 'cards.deck_i_card_01.name',
    descriptionKey: 'cards.deck_i_card_01.description',
    atlasId: CARDIA_ATLAS_IDS.DECK_I,
    atlasIndex: 0,  // 图集中的第 1 张（0-based）
}

// src/games/cardia/domain/locationRegistry.ts（新建）
export interface LocationDef {
    id: string;
    nameKey: string;
    descriptionKey: string;
    atlasId: string;
    atlasIndex: number;
}

export const LOCATION_IDS = {
    GIANT_SERPENT: 'location_giant_serpent',
    MARKET: 'location_market',
    SWORD_STARTER_CAMP: 'location_sword_starter_camp',
    GREAT_LIBRARY: 'location_great_library',
    GARBAGE_DUMP: 'location_garbage_dump',
    AUCTION_HOUSE: 'location_auction_house',
    HAUNTED_CATACOMBS: 'location_haunted_catacombs',
    MISTY_SWAMP: 'location_misty_swamp',
} as const;

export const LOCATIONS: LocationDef[] = [
    {
        id: LOCATION_IDS.GIANT_SERPENT,
        nameKey: 'locations.giant_serpent.name',
        descriptionKey: 'locations.giant_serpent.description',
        atlasId: CARDIA_ATLAS_IDS.LOCATIONS,
        atlasIndex: 0,
    },
    {
        id: LOCATION_IDS.MARKET,
        nameKey: 'locations.market.name',
        descriptionKey: 'locations.market.description',
        atlasId: CARDIA_ATLAS_IDS.LOCATIONS,
        atlasIndex: 1,
    },
    // ... 其他 6 张地点牌
];

// src/games/cardia/Board.tsx
const CardDisplay: React.FC<CardDisplayProps> = ({ card }) => {
    return (
        <CardPreview
            previewRef={{
                type: 'atlas',
                atlasId: card.atlasId,
                index: card.atlasIndex,
            }}
            className="..."
        />
    );
};
```

---

### 方案 B：使用单张图片（简单，适合少量卡牌）

#### 优点
- 实现简单
- 易于调试
- 适合 <50 张卡牌

#### 实施步骤

**1. 组织图片文件**

```bash
public/assets/i18n/zh-CN/cardia/cards/compressed/
  deck1/
    card_01.webp, card_02.webp, ..., card_16.webp
  deck2/
    card_01.webp, card_02.webp, ..., card_16.webp
  locations/
    location_01.webp  # 巨蛇神殿
    location_02.webp  # 集市
    location_03.webp  # 剑始者营
    location_04.webp  # 大图书馆
    location_05.webp  # 垃圾场
    location_06.webp  # 拍卖行
    location_07.webp  # 闹鬼地下墓穴
    location_08.webp  # 迷雾沼泽
```

**2. 更新代码**

```typescript
// src/games/cardia/domain/cardRegistry.ts
export interface CardDef {
    id: string;
    influence: number;
    faction: FactionId;
    abilityIds: AbilityId[];
    difficulty: number;
    deckVariant: DeckVariantId;
    nameKey: string;
    descriptionKey: string;
    
    // 图片路径
    imagePath: string;  // 'cardia/cards/deck1/card_01'
}

// 示例
{
    id: CARD_IDS_DECK_I.CARD_01,
    influence: 1,
    faction: FACTION_IDS.SWAMP,
    abilityIds: [ABILITY_IDS.THIEF],
    difficulty: 0,
    deckVariant: 'I',
    nameKey: 'cards.deck_i_card_01.name',
    descriptionKey: 'cards.deck_i_card_01.description',
    imagePath: 'cardia/cards/deck1/card_01',
}

// src/games/cardia/Board.tsx
const CardDisplay: React.FC<CardDisplayProps> = ({ card }) => {
    return (
        <OptimizedImage
            src={card.imagePath}
            alt={card.nameKey}
            className="..."
        />
    );
};
```

---

## 推荐方案对比

| 特性 | 方案 A（图集） | 方案 B（单张） |
|------|--------------|--------------|
| HTTP 请求数 | 3 个（deck1 + deck2 + locations） | 72 个（64 人物 + 8 地点） |
| 首次加载速度 | 快 | 慢 |
| 内存使用 | 优化 | 较高 |
| 实现复杂度 | 中等 | 简单 |
| 调试难度 | 中等 | 简单 |
| 适用场景 | 100+ 张卡牌 | <50 张卡牌 |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

**结论**：由于 Cardia 有 72 张卡牌（64 人物 + 8 地点），**强烈推荐使用方案 A（图集系统）**。

---

## 实施清单

### 阶段 1：准备素材

- [ ] 收集所有人物牌图片（I 牌组 16 张 + II 牌组 16 张）
- [ ] 收集所有地点牌图片（8 张）
- [ ] 按牌组分类放入对应目录

### 阶段 2：压缩图片

- [ ] 压缩 I 牌组图片
- [ ] 压缩 II 牌组图片
- [ ] 压缩地点牌图片

### 阶段 3：生成图集

- [ ] 生成 I 牌组图集（4x4 = 16 张）
- [ ] 生成 II 牌组图集（4x4 = 16 张）
- [ ] 生成地点牌图集（2x4 = 8 张）

### 阶段 4：更新代码

- [ ] 更新 `domain/ids.ts`（添加图集 ID）
- [ ] 更新 `ui/cardAtlas.ts`（注册图集）
- [ ] 更新 `domain/cardRegistry.ts`（添加 atlasId 和 atlasIndex）
- [ ] 创建 `domain/locationRegistry.ts`（地点牌注册表）
- [ ] 更新 `Board.tsx`（使用 CardPreview）
- [ ] 更新 `manifest.ts`（添加 criticalImages）

### 阶段 5：测试验证

- [ ] 启动游戏验证卡牌显示
- [ ] 检查图集加载是否正常
- [ ] 验证地点牌显示
- [ ] 运行 E2E 测试

---

## 常见问题

### Q1: 如何确定图集的行列数？

A: 根据卡牌数量选择最接近的正方形：
- 16 张 → 4x4
- 8 张 → 2x4 或 4x2
- 32 张 → 8x4 或 6x6

### Q2: 图集中的卡牌顺序如何确定？

A: 按照影响力值从小到大排列：
- I 牌组：1-16
- II 牌组：1-16
- 地点牌：按规则书顺序

### Q3: 如果某张卡牌图片缺失怎么办？

A: 使用降级策略：
```typescript
const atlasIndex = card.atlasIndex ?? -1;
{atlasIndex >= 0 ? (
    <CardPreview ... />
) : (
    <div className="bg-gradient-to-br from-gray-700 to-gray-900" />
)}
```

### Q4: 如何添加新的卡牌类型（如事件卡）？

A: 
1. 创建新的图集（如 `events.webp`）
2. 在 `CARDIA_ATLAS_IDS` 中添加新 ID
3. 注册新图集
4. 创建新的注册表（如 `eventRegistry.ts`）

---

## 参考资料

- 图集系统文档：`docs/ai-rules/asset-pipeline.md`
- 图集生成脚本：`scripts/assets/create_uniform_atlas.py`
- SmashUp 图集实现：`src/games/smashup/ui/cardAtlas.ts`
- SummonerWars 图集实现：`src/games/summonerwars/ui/cardAtlas.ts`

---

**文档版本**：1.0  
**最后更新**：2026-02-27  
**作者**：AI Assistant
