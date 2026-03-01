# Cardia 图片映射系统实现完成

## 实施日期
2026-02-27

## 实施内容

### 1. 创建卡牌注册表 (`domain/cardRegistry.ts`)
- 定义了 `CardDef` 接口，包含卡牌的所有元数据
- 创建了 32 张人物牌的完整定义：
  - I 牌组：16 张（影响力 1-16）
  - II 牌组：16 张（影响力 1-16）
- 每张卡牌包含：
  - `id`: 卡牌唯一标识
  - `influence`: 影响力值（1-16）
  - `faction`: 派系（沼泽/学院/公会/王朝）
  - `abilityIds`: 能力ID列表
  - `difficulty`: 难度等级（0-5）
  - `deckVariant`: 牌组变体（I 或 II）
  - `nameKey`: i18n 名称键
  - `descriptionKey`: i18n 描述键
  - `imagePath`: 图片路径（如 `cardia/cards/deck1/card_01`）

### 2. 创建地点卡注册表 (`domain/locationRegistry.ts`)
- 定义了 `LocationDef` 接口
- 创建了 8 张地点卡的完整定义（按实际图片文件对应关系）：
  1. location_01 - 迷雾沼泽 (Misty Swamp)
  2. location_02 - 大图书馆 (Great Library)
  3. location_03 - 闹鬼地下墓穴 (Haunted Catacombs)
  4. location_04 - 巨蛇神殿 (Giant Serpent)
  5. location_05 - 拍卖行 (Auction House)
  6. location_06 - 剑始者营 (Sword Starter Camp)
  7. location_07 - 垃圾场 (Garbage Dump)
  8. location_08 - 集市 (Market)

### 3. 更新核心类型 (`domain/core-types.ts`)
- 在 `CardInstance` 接口中添加了 `imagePath` 字段
- 保留了 `imageIndex` 字段以保持向后兼容

### 4. 更新工具函数 (`domain/utils.ts`)
- 更新 `createCardInstance` 函数，支持 `imagePath` 参数

### 5. 更新牌库初始化 (`domain/setupDeck.ts`)
- 更新 `createCardInstanceFromDef` 函数，使用新的 `CardDef` 接口
- 从卡牌定义中提取 `imagePath` 并传递给卡牌实例

### 6. 更新 UI 组件 (`Board.tsx`)
- 更新 `CardDisplay` 组件，优先使用 `card.imagePath`
- 保留对 `card.imageIndex` 的回退支持

### 7. 更新导出 (`domain/index.ts`)
- 导出 `cardRegistry` 和相关查询函数
- 导出 `locationRegistry`

## 图片目录结构

```
public/assets/i18n/zh-CN/cardia/cards/compressed/
  deck1/
    card_01.webp  # I 牌组第 1 张（影响力 1 - 盗贼）
    card_02.webp  # I 牌组第 2 张（影响力 2 - 学徒）
    ...
    card_16.webp  # I 牌组第 16 张（影响力 16 - 精灵）
  deck2/
    card_01.webp  # II 牌组第 1 张（影响力 1 - 间谍）
    card_02.webp  # II 牌组第 2 张（影响力 2 - 见习生）
    ...
    card_16.webp  # II 牌组第 16 张（影响力 16 - 继承人）
  locations/
    location_01.webp  # 迷雾沼泽
    location_02.webp  # 大图书馆
    location_03.webp  # 闹鬼地下墓穴
    location_04.webp  # 巨蛇神殿
    location_05.webp  # 拍卖行
    location_06.webp  # 剑始者营
    location_07.webp  # 垃圾场
    location_08.webp  # 集市
```

## 使用方式

### 在代码中使用卡牌注册表

```typescript
import cardRegistry, { getCardsByDeckVariant } from './domain/cardRegistry';

// 获取特定卡牌定义
const cardDef = cardRegistry.get('deck_i_card_01');

// 获取 I 牌组所有卡牌
const deckICards = getCardsByDeckVariant('I');

// 获取 II 牌组所有卡牌
const deckIICards = getCardsByDeckVariant('II');
```

### 在代码中使用地点卡注册表

```typescript
import locationRegistry from './domain/locationRegistry';

// 获取特定地点卡定义
const location = locationRegistry.get('location_giant_serpent');
```

### 在 UI 中显示卡牌图片

```typescript
// Board.tsx 中的 CardDisplay 组件会自动使用 card.imagePath
<OptimizedImage
    src={card.imagePath}  // 如 'cardia/cards/deck1/card_01'
    alt={t(card.defId)}
    className="absolute inset-0 w-full h-full object-cover"
/>
```

## 向后兼容性

- 保留了 `imageIndex` 字段，旧代码仍可正常工作
- `CardDisplay` 组件优先使用 `imagePath`，如果不存在则回退到 `imageIndex`

## 下一步工作

### 1. 准备图片素材
- 将 32 张人物牌图片放入对应目录
- 将 8 张地点卡图片放入对应目录

### 2. 压缩图片
```bash
# 压缩 I 牌组
npm run compress:images -- public/assets/cardia/cards/deck1

# 压缩 II 牌组
npm run compress:images -- public/assets/cardia/cards/deck2

# 压缩地点牌
npm run compress:images -- public/assets/cardia/cards/locations
```

### 3. 移动到 i18n 目录
```bash
# 使用提供的脚本自动化处理
chmod +x scripts/cardia/setup-images.sh
./scripts/cardia/setup-images.sh
```

### 4. 添加 i18n 文案
需要在以下文件中添加卡牌和地点的中英文文案：
- `public/locales/zh-CN/game-cardia.json`
- `public/locales/en/game-cardia.json`

#### 中文文案结构
```json
{
  "cards": {
    "deck_i_card_01": {
      "name": "盗贼",
      "description": "随机弃1张手牌"
    },
    "deck_i_card_02": {
      "name": "学徒",
      "description": "抽1张牌"
    }
    // ... 其他 30 张卡牌
  },
  "locations": {
    "giant_serpent": {
      "name": "巨蛇神殿",
      "description": "即使在之后的游戏中你再次输掉那次遭遇，这也无关紧要"
    },
    "market": {
      "name": "集市",
      "description": "仅在回合结束阶段你不会抽牌"
    }
    // ... 其他 6 张地点卡
  }
}
```

### 5. 测试验证
- 启动游戏，确认卡牌图片正确显示
- 检查浏览器控制台，确认无图片加载错误
- 验证所有派系的卡牌都能正确显示

## 技术细节

### 图片路径解析
- `OptimizedImage` 组件会自动处理路径转换
- 输入：`cardia/cards/deck1/card_01`
- 自动转换为：`i18n/zh-CN/cardia/cards/compressed/deck1/card_01.webp`

### 性能考虑
- 使用一对一图片引用方式（72 个 HTTP 请求）
- 适合当前卡牌数量（32 + 8 = 40 张）
- 如果未来卡牌数量增加到 100+ 张，建议迁移到图集系统

### 数据完整性
- 所有 32 张人物牌都有完整的元数据
- 所有 8 张地点卡都有完整的元数据
- 使用 TypeScript 类型系统确保数据一致性

## 文件清单

### 新增文件
- `src/games/cardia/domain/cardRegistry.ts` - 卡牌注册表
- `src/games/cardia/domain/locationRegistry.ts` - 地点卡注册表
- `src/games/cardia/IMAGE-MAPPING-IMPLEMENTATION.md` - 本文档

### 修改文件
- `src/games/cardia/domain/core-types.ts` - 添加 `imagePath` 字段
- `src/games/cardia/domain/utils.ts` - 更新 `createCardInstance` 函数
- `src/games/cardia/domain/setupDeck.ts` - 更新 `createCardInstanceFromDef` 函数
- `src/games/cardia/Board.tsx` - 更新 `CardDisplay` 组件
- `src/games/cardia/domain/index.ts` - 导出新的注册表

## 设计原则遵循

### 1. DRY (Don't Repeat Yourself)
- 卡牌定义只在 `cardRegistry.ts` 中定义一次
- 地点卡定义只在 `locationRegistry.ts` 中定义一次
- 避免在多处重复定义相同数据

### 2. 单一真实来源 (Single Source of Truth)
- `CardDef` 是卡牌元数据的唯一来源
- `LocationDef` 是地点卡元数据的唯一来源
- 所有其他地方通过注册表查询获取数据

### 3. 类型安全
- 使用 TypeScript 接口定义数据结构
- 使用常量表（`CARD_IDS`、`LOCATION_IDS`）确保 ID 一致性
- 编译期检查防止数据错误

### 4. 面向百游戏设计
- 数据驱动架构，易于扩展
- 新增卡牌只需在注册表中添加定义
- 框架层代码无需修改

## 总结

图片映射系统已成功实现，建立了 32 张人物牌和 8 张地点卡的完整数据结构。系统采用一对一图片引用方式，简单直接，易于维护。下一步需要准备实际的图片素材并添加 i18n 文案。

---

**实施者**：Kiro AI Assistant  
**文档版本**：1.0  
**最后更新**：2026-02-27
