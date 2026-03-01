# Cardia 简单图片映射方案（一对一引用）

## 当前状态

Board.tsx 已经在使用 `OptimizedImage` 组件，采用一对一图片引用方式：

```typescript
const imagePath = card.imageIndex ? `cardia/cards/${card.imageIndex}.jpg` : undefined;

<OptimizedImage
    src={imagePath}
    alt={`Card ${card.imageIndex}`}
    className="absolute inset-0 w-full h-full object-cover"
/>
```

## 目标

建立 8 张地点牌和 32 张人物牌的图片映射。

---

## 方案：按类型分类的一对一映射

### 目录结构

```
public/assets/i18n/zh-CN/cardia/
  cards/
    compressed/
      deck1/
        card_01.webp  # I 牌组第 1 张（影响力 1）
        card_02.webp  # I 牌组第 2 张（影响力 2）
        ...
        card_16.webp  # I 牌组第 16 张（影响力 16）
      deck2/
        card_01.webp  # II 牌组第 1 张（影响力 1）
        card_02.webp  # II 牌组第 2 张（影响力 2）
        ...
        card_16.webp  # II 牌组第 16 张（影响力 16）
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

---

## 实施步骤

### 步骤 1：准备图片素材

将图片按照以下规则命名并放入对应目录：

**I 牌组（16 张）**
```bash
public/assets/cardia/cards/deck1/
  1.jpg   # 影响力 1 - 盗贼（沼泽）
  2.jpg   # 影响力 2 - 学徒（学院）
  3.jpg   # 影响力 3 - 商人（公会）
  4.jpg   # 影响力 4 - 守卫（王朝）
  5.jpg   # 影响力 5 - 猎人（沼泽）
  6.jpg   # 影响力 6 - 占卜师（学院）
  7.jpg   # 影响力 7 - 工匠（公会）
  8.jpg   # 影响力 8 - 骑士（王朝）
  9.jpg   # 影响力 9 - 刺客（沼泽）
  10.jpg  # 影响力 10 - 法师（学院）
  11.jpg  # 影响力 11 - 大师工匠（公会）
  12.jpg  # 影响力 12 - 将军（王朝）
  13.jpg  # 影响力 13 - 德鲁伊（沼泽）
  14.jpg  # 影响力 14 - 大法师（学院）
  15.jpg  # 影响力 15 - 公会长（公会）
  16.jpg  # 影响力 16 - 精灵（王朝）
```

**II 牌组（16 张）**
```bash
public/assets/cardia/cards/deck2/
  1.jpg   # 影响力 1 - 间谍（沼泽）
  2.jpg   # 影响力 2 - 新手（学院）
  3.jpg   # 影响力 3 - 小贩（公会）
  4.jpg   # 影响力 4 - 哨兵（王朝）
  5.jpg   # 影响力 5 - 游侠（沼泽）
  6.jpg   # 影响力 6 - 先知（学院）
  7.jpg   # 影响力 7 - 宫廷守卫（公会）
  8.jpg   # 影响力 8 - 骑士队长（王朝）
  9.jpg   # 影响力 9 - 影刃（沼泽）
  10.jpg  # 影响力 10 - 大魔导师（学院）
  11.jpg  # 影响力 11 - 首席工匠（公会）
  12.jpg  # 影响力 12 - 顾问（王朝）
  13.jpg  # 影响力 13 - 巫王（沼泽）
  14.jpg  # 影响力 14 - 元素使（学院）
  15.jpg  # 影响力 15 - 机械之灵（公会）
  16.jpg  # 影响力 16 - 继承人（王朝）
```

**地点牌（8 张）**
```bash
public/assets/cardia/cards/locations/
  1.jpg  # 迷雾沼泽
  2.jpg  # 大图书馆
  3.jpg  # 闹鬼地下墓穴
  4.jpg  # 巨蛇神殿
  5.jpg  # 拍卖行
  6.jpg  # 剑始者营
  7.jpg  # 垃圾场
  8.jpg  # 集市
```

### 步骤 2：压缩图片

```bash
# 压缩 I 牌组
npm run compress:images -- public/assets/cardia/cards/deck1

# 压缩 II 牌组
npm run compress:images -- public/assets/cardia/cards/deck2

# 压缩地点牌
npm run compress:images -- public/assets/cardia/cards/locations
```

压缩后会生成：
- `public/assets/cardia/cards/deck1/compressed/*.webp`
- `public/assets/cardia/cards/deck2/compressed/*.webp`
- `public/assets/cardia/cards/locations/compressed/*.webp`

### 步骤 3：移动到 i18n 目录

```bash
# 移动 I 牌组
mkdir -p public/assets/i18n/zh-CN/cardia/cards/compressed/deck1
cp public/assets/cardia/cards/deck1/compressed/*.webp \
   public/assets/i18n/zh-CN/cardia/cards/compressed/deck1/

# 移动 II 牌组
mkdir -p public/assets/i18n/zh-CN/cardia/cards/compressed/deck2
cp public/assets/cardia/cards/deck2/compressed/*.webp \
   public/assets/i18n/zh-CN/cardia/cards/compressed/deck2/

# 移动地点牌
mkdir -p public/assets/i18n/zh-CN/cardia/cards/compressed/locations
cp public/assets/cardia/cards/locations/compressed/*.webp \
   public/assets/i18n/zh-CN/cardia/cards/compressed/locations/
```

### 步骤 4：重命名文件（统一格式）

```bash
# I 牌组：1.webp → card_01.webp
cd public/assets/i18n/zh-CN/cardia/cards/compressed/deck1
for i in {1..16}; do
  mv $i.webp card_$(printf "%02d" $i).webp
done

# II 牌组：1.webp → card_01.webp
cd public/assets/i18n/zh-CN/cardia/cards/compressed/deck2
for i in {1..16}; do
  mv $i.webp card_$(printf "%02d" $i).webp
done

# 地点牌：1.webp → location_01.webp
cd public/assets/i18n/zh-CN/cardia/cards/compressed/locations
for i in {1..8}; do
  mv $i.webp location_$(printf "%02d" $i).webp
done
```

---

## 代码实现

### 1. 更新 CardDef 接口

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
    
    // 图片路径（不含扩展名，不含 compressed/）
    imagePath: string;  // 'cardia/cards/deck1/card_01'
}
```

### 2. 更新卡牌定义

```typescript
// I 牌组示例
export const DECK_I_CARDS: CardDef[] = [
    {
        id: CARD_IDS_DECK_I.CARD_01,
        influence: 1,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.THIEF],
        difficulty: 0,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_01.name',
        descriptionKey: 'cards.deck_i_card_01.description',
        imagePath: 'cardia/cards/deck1/card_01',  // 新增
    },
    {
        id: CARD_IDS_DECK_I.CARD_02,
        influence: 2,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.APPRENTICE],
        difficulty: 0,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_02.name',
        descriptionKey: 'cards.deck_i_card_02.description',
        imagePath: 'cardia/cards/deck1/card_02',  // 新增
    },
    // ... 其他 14 张
];

// II 牌组示例
export const DECK_II_CARDS: CardDef[] = [
    {
        id: CARD_IDS_DECK_II.CARD_01,
        influence: 1,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.SPY],
        difficulty: 0,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_01.name',
        descriptionKey: 'cards.deck_ii_card_01.description',
        imagePath: 'cardia/cards/deck2/card_01',  // 新增
    },
    // ... 其他 15 张
];
```

### 3. 创建地点牌注册表

```typescript
// src/games/cardia/domain/locationRegistry.ts
import type { FactionId } from './ids';

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

export interface LocationDef {
    id: string;
    nameKey: string;
    descriptionKey: string;
    imagePath: string;
}

export const LOCATIONS: LocationDef[] = [
    {
        id: LOCATION_IDS.MISTY_SWAMP,
        nameKey: 'locations.misty_swamp.name',
        descriptionKey: 'locations.misty_swamp.description',
        imagePath: 'cardia/cards/locations/location_01',
    },
    {
        id: LOCATION_IDS.GREAT_LIBRARY,
        nameKey: 'locations.great_library.name',
        descriptionKey: 'locations.great_library.description',
        imagePath: 'cardia/cards/locations/location_02',
    },
    {
        id: LOCATION_IDS.HAUNTED_CATACOMBS,
        nameKey: 'locations.haunted_catacombs.name',
        descriptionKey: 'locations.haunted_catacombs.description',
        imagePath: 'cardia/cards/locations/location_03',
    },
    {
        id: LOCATION_IDS.GIANT_SERPENT,
        nameKey: 'locations.giant_serpent.name',
        descriptionKey: 'locations.giant_serpent.description',
        imagePath: 'cardia/cards/locations/location_04',
    },
    {
        id: LOCATION_IDS.AUCTION_HOUSE,
        nameKey: 'locations.auction_house.name',
        descriptionKey: 'locations.auction_house.description',
        imagePath: 'cardia/cards/locations/location_05',
    },
    {
        id: LOCATION_IDS.SWORD_STARTER_CAMP,
        nameKey: 'locations.sword_starter_camp.name',
        descriptionKey: 'locations.sword_starter_camp.description',
        imagePath: 'cardia/cards/locations/location_06',
    },
    {
        id: LOCATION_IDS.GARBAGE_DUMP,
        nameKey: 'locations.garbage_dump.name',
        descriptionKey: 'locations.garbage_dump.description',
        imagePath: 'cardia/cards/locations/location_07',
    },
    {
        id: LOCATION_IDS.MARKET,
        nameKey: 'locations.market.name',
        descriptionKey: 'locations.market.description',
        imagePath: 'cardia/cards/locations/location_08',
    },
];

export const locationRegistry = new Map<string, LocationDef>(
    LOCATIONS.map(loc => [loc.id, loc])
);

export default locationRegistry;
```

### 4. 更新 Board.tsx（已经正确）

Board.tsx 中的 `CardDisplay` 组件已经正确使用 `OptimizedImage`：

```typescript
const CardDisplay: React.FC<CardDisplayProps> = ({ card, core }) => {
    // ...
    
    // 使用 card.imagePath 而不是 card.imageIndex
    const imagePath = card.imagePath || undefined;
    
    return (
        <div className="relative w-32 h-48 rounded-lg border-2 border-white/20 shadow-lg overflow-hidden">
            {imagePath ? (
                <OptimizedImage
                    src={imagePath}
                    alt={card.nameKey}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${bgColor}`} />
            )}
            {/* ... */}
        </div>
    );
};
```

### 5. 添加地点牌 i18n 文案

```json
// public/locales/zh-CN/game-cardia.json
{
  "locations": {
    "misty_swamp": {
      "name": "迷雾沼泽",
      "description": "在游戏的第一回合中，不要揭示牌"
    },
    "great_library": {
      "name": "大图书馆",
      "description": "如果你的牌库中只剩1张牌，照常抽取"
    },
    "haunted_catacombs": {
      "name": "闹鬼地下墓穴",
      "description": "此效果仅在你在阶段1揭示牌时触发"
    },
    "giant_serpent": {
      "name": "巨蛇神殿",
      "description": "即使在之后的游戏中你再次输掉那次遭遇，这也无关紧要"
    },
    "auction_house": {
      "name": "拍卖行",
      "description": "此效果在你阶段1揭示牌后触发"
    },
    "sword_starter_camp": {
      "name": "剑始者营",
      "description": "你需要在3个连续的遭遇中获胜"
    },
    "garbage_dump": {
      "name": "垃圾场",
      "description": "如果你的牌库中有2张牌，则抽两张并放回其中1张"
    },
    "market": {
      "name": "集市",
      "description": "仅在回合结束阶段你不会抽牌"
    }
  }
}
```

---

## 验证清单

### 文件结构验证

- [ ] `public/assets/i18n/zh-CN/cardia/cards/compressed/deck1/` 包含 16 个 WebP 文件
- [ ] `public/assets/i18n/zh-CN/cardia/cards/compressed/deck2/` 包含 16 个 WebP 文件
- [ ] `public/assets/i18n/zh-CN/cardia/cards/compressed/locations/` 包含 8 个 WebP 文件

### 代码验证

- [ ] `CardDef` 接口包含 `imagePath` 字段
- [ ] 所有 32 张人物牌都有正确的 `imagePath`
- [ ] `locationRegistry.ts` 已创建，包含 8 张地点牌
- [ ] i18n 文件包含地点牌的中英文文案

### 功能验证

- [ ] 启动游戏，卡牌图片正确显示
- [ ] 浏览器控制台无图片加载错误
- [ ] 所有派系的卡牌都能正确显示

---

## 性能对比

| 指标 | 图集系统 | 一对一引用 |
|------|---------|-----------|
| HTTP 请求数 | 3 个 | 72 个 |
| 实现复杂度 | 中等 | 简单 |
| 调试难度 | 中等 | 简单 |
| 首次加载 | 快 | 较慢 |
| 适用场景 | 100+ 张卡牌 | <50 张卡牌 |

**注意**：虽然一对一引用实现简单，但 72 个 HTTP 请求会影响首次加载速度。如果未来卡牌数量增加，建议迁移到图集系统。

---

## 快速开始脚本

创建一个自动化脚本来简化步骤 3-4：

```bash
#!/bin/bash
# scripts/cardia/setup-images.sh

# 创建目标目录
mkdir -p public/assets/i18n/zh-CN/cardia/cards/compressed/{deck1,deck2,locations}

# 复制并重命名 I 牌组
for i in {1..16}; do
  src="public/assets/cardia/cards/deck1/compressed/$i.webp"
  dst="public/assets/i18n/zh-CN/cardia/cards/compressed/deck1/card_$(printf "%02d" $i).webp"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "✓ Copied deck1 card $i"
  else
    echo "✗ Missing deck1 card $i"
  fi
done

# 复制并重命名 II 牌组
for i in {1..16}; do
  src="public/assets/cardia/cards/deck2/compressed/$i.webp"
  dst="public/assets/i18n/zh-CN/cardia/cards/compressed/deck2/card_$(printf "%02d" $i).webp"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "✓ Copied deck2 card $i"
  else
    echo "✗ Missing deck2 card $i"
  fi
done

# 复制并重命名地点牌
for i in {1..8}; do
  src="public/assets/cardia/cards/locations/compressed/$i.webp"
  dst="public/assets/i18n/zh-CN/cardia/cards/compressed/locations/location_$(printf "%02d" $i).webp"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "✓ Copied location $i"
  else
    echo "✗ Missing location $i"
  fi
done

echo ""
echo "✅ Image setup complete!"
echo "Total files: $(find public/assets/i18n/zh-CN/cardia/cards/compressed -name '*.webp' | wc -l)"
```

使用方法：
```bash
chmod +x scripts/cardia/setup-images.sh
./scripts/cardia/setup-images.sh
```

---

**文档版本**：1.0  
**最后更新**：2026-02-27  
**方案**：一对一图片引用（简单实现）
