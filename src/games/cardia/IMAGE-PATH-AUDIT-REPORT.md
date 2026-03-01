# Cardia 图片路径审查报告

## 审查日期
2026-02-27

## 审查目标
1. 确认所有 `imagePath` 配置与实际图片文件匹配
2. 添加桌游主题图配置
3. 排查潜在的 bug

---

## 发现的问题

### 问题 1: 图片文件名不匹配 ❌ → ✅ 已修复

**问题描述**：
- 代码中定义的路径：`cardia/cards/deck1/card_01`
- 实际文件名：`1.webp`（不是 `card_01.webp`）

**影响范围**：
- I 牌组：16 张卡牌
- II 牌组：16 张卡牌
- 地点卡：8 张

**修复方案**：
更新所有 `imagePath` 配置，移除 `card_` 和 `location_` 前缀，使用纯数字文件名。

**修复后的路径格式**：
- I 牌组：`cardia/cards/deck1/1` ~ `cardia/cards/deck1/16`
- II 牌组：`cardia/cards/deck2/1` ~ `cardia/cards/deck2/16`
- 地点卡：`cardia/cards/locations/1` ~ `cardia/cards/locations/8`

---

## 实际文件结构

### 已确认存在的文件

```
public/assets/i18n/zh-CN/cardia/cards/compressed/
├── title.webp          ✅ 主题图（已存在）
├── helper1.webp        ✅ 辅助卡 1（已存在）
├── helper2.webp        ✅ 辅助卡 2（已存在）
├── deck1/
│   ├── 1.webp          ✅ I 牌组卡牌 1
│   ├── 2.webp          ✅ I 牌组卡牌 2
│   ├── ...
│   └── 16.webp         ✅ I 牌组卡牌 16
├── deck2/
│   ├── 1.webp          ✅ II 牌组卡牌 1
│   ├── 2.webp          ✅ II 牌组卡牌 2
│   ├── ...
│   └── 16.webp         ✅ II 牌组卡牌 16
└── locations/
    ├── 1.webp          ✅ 迷雾沼泽
    ├── 2.webp          ✅ 大图书馆
    ├── 3.webp          ✅ 闹鬼地下墓穴
    ├── 4.webp          ✅ 巨蛇神殿
    ├── 5.webp          ✅ 拍卖行
    ├── 6.webp          ✅ 剑始者营
    ├── 7.webp          ✅ 垃圾场
    └── 8.webp          ✅ 集市
```

---

## 修复的文件

### 1. `src/games/cardia/domain/cardRegistry.ts`
- ✅ 更新 I 牌组所有卡牌的 `imagePath`（16 张）
- ✅ 更新 II 牌组所有卡牌的 `imagePath`（16 张）
- 修改前：`imagePath: 'cardia/cards/deck1/card_01'`
- 修改后：`imagePath: 'cardia/cards/deck1/1'`

### 2. `src/games/cardia/domain/locationRegistry.ts`
- ✅ 更新所有地点卡的 `imagePath`（8 张）
- 修改前：`imagePath: 'cardia/cards/locations/location_01'`
- 修改后：`imagePath: 'cardia/cards/locations/1'`

### 3. `src/games/cardia/manifest.ts`
- ✅ 添加主题图配置
- 修改前：`thumbnailPath: 'cardia/thumbnails/cover'`（不存在）
- 修改后：`thumbnailPath: 'cardia/cards/title'`（使用实际存在的 title.webp）

---

## 图片路径映射表

### I 牌组（16 张）

| 卡牌 ID | 影响力 | 派系 | 图片路径 | 实际文件 |
|---------|--------|------|----------|----------|
| deck_i_card_01 | 1 | 沼泽 | `cardia/cards/deck1/1` | ✅ `1.webp` |
| deck_i_card_02 | 2 | 学院 | `cardia/cards/deck1/2` | ✅ `2.webp` |
| deck_i_card_03 | 3 | 公会 | `cardia/cards/deck1/3` | ✅ `3.webp` |
| deck_i_card_04 | 4 | 王朝 | `cardia/cards/deck1/4` | ✅ `4.webp` |
| deck_i_card_05 | 5 | 沼泽 | `cardia/cards/deck1/5` | ✅ `5.webp` |
| deck_i_card_06 | 6 | 学院 | `cardia/cards/deck1/6` | ✅ `6.webp` |
| deck_i_card_07 | 7 | 公会 | `cardia/cards/deck1/7` | ✅ `7.webp` |
| deck_i_card_08 | 8 | 王朝 | `cardia/cards/deck1/8` | ✅ `8.webp` |
| deck_i_card_09 | 9 | 沼泽 | `cardia/cards/deck1/9` | ✅ `9.webp` |
| deck_i_card_10 | 10 | 学院 | `cardia/cards/deck1/10` | ✅ `10.webp` |
| deck_i_card_11 | 11 | 公会 | `cardia/cards/deck1/11` | ✅ `11.webp` |
| deck_i_card_12 | 12 | 王朝 | `cardia/cards/deck1/12` | ✅ `12.webp` |
| deck_i_card_13 | 13 | 沼泽 | `cardia/cards/deck1/13` | ✅ `13.webp` |
| deck_i_card_14 | 14 | 学院 | `cardia/cards/deck1/14` | ✅ `14.webp` |
| deck_i_card_15 | 15 | 公会 | `cardia/cards/deck1/15` | ✅ `15.webp` |
| deck_i_card_16 | 16 | 王朝 | `cardia/cards/deck1/16` | ✅ `16.webp` |

### II 牌组（16 张）

| 卡牌 ID | 影响力 | 派系 | 图片路径 | 实际文件 |
|---------|--------|------|----------|----------|
| deck_ii_card_01 | 1 | 沼泽 | `cardia/cards/deck2/1` | ✅ `1.webp` |
| deck_ii_card_02 | 2 | 学院 | `cardia/cards/deck2/2` | ✅ `2.webp` |
| deck_ii_card_03 | 3 | 公会 | `cardia/cards/deck2/3` | ✅ `3.webp` |
| deck_ii_card_04 | 4 | 王朝 | `cardia/cards/deck2/4` | ✅ `4.webp` |
| deck_ii_card_05 | 5 | 沼泽 | `cardia/cards/deck2/5` | ✅ `5.webp` |
| deck_ii_card_06 | 6 | 学院 | `cardia/cards/deck2/6` | ✅ `6.webp` |
| deck_ii_card_07 | 7 | 公会 | `cardia/cards/deck2/7` | ✅ `7.webp` |
| deck_ii_card_08 | 8 | 王朝 | `cardia/cards/deck2/8` | ✅ `8.webp` |
| deck_ii_card_09 | 9 | 沼泽 | `cardia/cards/deck2/9` | ✅ `9.webp` |
| deck_ii_card_10 | 10 | 学院 | `cardia/cards/deck2/10` | ✅ `10.webp` |
| deck_ii_card_11 | 11 | 公会 | `cardia/cards/deck2/11` | ✅ `11.webp` |
| deck_ii_card_12 | 12 | 王朝 | `cardia/cards/deck2/12` | ✅ `12.webp` |
| deck_ii_card_13 | 13 | 沼泽 | `cardia/cards/deck2/13` | ✅ `13.webp` |
| deck_ii_card_14 | 14 | 学院 | `cardia/cards/deck2/14` | ✅ `14.webp` |
| deck_ii_card_15 | 15 | 公会 | `cardia/cards/deck2/15` | ✅ `15.webp` |
| deck_ii_card_16 | 16 | 王朝 | `cardia/cards/deck2/16` | ✅ `16.webp` |

### 地点卡（8 张）

| 地点 ID | 中文名 | 图片路径 | 实际文件 |
|---------|--------|----------|----------|
| location_misty_swamp | 迷雾沼泽 | `cardia/cards/locations/1` | ✅ `1.webp` |
| location_great_library | 大图书馆 | `cardia/cards/locations/2` | ✅ `2.webp` |
| location_haunted_catacombs | 闹鬼地下墓穴 | `cardia/cards/locations/3` | ✅ `3.webp` |
| location_giant_serpent | 巨蛇神殿 | `cardia/cards/locations/4` | ✅ `4.webp` |
| location_auction_house | 拍卖行 | `cardia/cards/locations/5` | ✅ `5.webp` |
| location_sword_starter_camp | 剑始者营 | `cardia/cards/locations/6` | ✅ `6.webp` |
| location_garbage_dump | 垃圾场 | `cardia/cards/locations/7` | ✅ `7.webp` |
| location_market | 集市 | `cardia/cards/locations/8` | ✅ `8.webp` |

### 其他资源

| 资源类型 | 图片路径 | 实际文件 | 用途 |
|---------|----------|----------|------|
| 主题图 | `cardia/cards/title` | ✅ `title.webp` | 游戏缩略图/封面 |
| 辅助卡 1 | `cardia/cards/helper1` | ✅ `helper1.webp` | 玩家辅助卡 |
| 辅助卡 2 | `cardia/cards/helper2` | ✅ `helper2.webp` | 玩家辅助卡 |

---

## OptimizedImage 组件路径解析

`OptimizedImage` 组件会自动处理路径转换：

**输入路径**：`cardia/cards/deck1/1`

**自动转换为**：
1. 添加 i18n 前缀：`i18n/zh-CN/cardia/cards/deck1/1`
2. 添加 compressed 目录：`i18n/zh-CN/cardia/cards/compressed/deck1/1`
3. 添加扩展名：`i18n/zh-CN/cardia/cards/compressed/deck1/1.webp`

**最终访问路径**：
```
public/assets/i18n/zh-CN/cardia/cards/compressed/deck1/1.webp
```

---

## 潜在问题排查

### ✅ 已排查的问题

1. **图片文件名不匹配** - ✅ 已修复
   - 所有 `imagePath` 已更新为实际文件名

2. **主题图缺失** - ✅ 已修复
   - manifest.ts 已更新为使用实际存在的 `title.webp`

3. **地点卡顺序错误** - ✅ 已修复
   - locationRegistry.ts 已按照用户提供的正确对应关系更新

4. **OptimizedImage 路径解析** - ✅ 无问题
   - Board.tsx 中的 `CardDisplay` 组件正确使用 `card.imagePath`
   - 有回退机制：优先使用 `imagePath`，不存在则使用 `imageIndex`

### ⚠️ 需要注意的点

1. **i18n 文案缺失**
   - 卡牌名称和描述的 i18n 文案尚未添加
   - 需要在 `public/locales/zh-CN/game-cardia.json` 和 `public/locales/en/game-cardia.json` 中添加

2. **辅助卡未使用**
   - `helper1.webp` 和 `helper2.webp` 已存在但未在代码中引用
   - 如果需要显示辅助卡，需要添加相应的组件和逻辑

---

## 验证清单

### 代码层面 ✅

- [x] I 牌组所有卡牌的 `imagePath` 正确（16 张）
- [x] II 牌组所有卡牌的 `imagePath` 正确（16 张）
- [x] 地点卡所有的 `imagePath` 正确（8 张）
- [x] manifest.ts 中的 `thumbnailPath` 正确
- [x] Board.tsx 中的 `CardDisplay` 组件正确使用 `imagePath`
- [x] 向后兼容性保持（保留 `imageIndex` 字段）

### 文件层面 ✅

- [x] I 牌组图片文件存在（16 个 .webp 文件）
- [x] II 牌组图片文件存在（16 个 .webp 文件）
- [x] 地点卡图片文件存在（8 个 .webp 文件）
- [x] 主题图文件存在（title.webp）
- [x] 辅助卡文件存在（helper1.webp, helper2.webp）

### 功能验证 ⏳（需要运行时测试）

- [ ] 启动游戏，确认主题图正确显示
- [ ] 进入游戏，确认卡牌图片正确加载
- [ ] 检查浏览器控制台，确认无 404 错误
- [ ] 验证所有派系的卡牌都能正确显示
- [ ] 验证 I 牌组和 II 牌组的卡牌都能正确显示

---

## 总结

### 修复的问题
1. ✅ 修复了 32 张人物牌的图片路径不匹配问题
2. ✅ 修复了 8 张地点卡的图片路径不匹配问题
3. ✅ 添加了主题图配置（使用实际存在的 title.webp）
4. ✅ 确认了所有图片文件都存在

### 代码质量
- ✅ 所有路径配置与实际文件完全匹配
- ✅ 保持了向后兼容性（保留 imageIndex 字段）
- ✅ 使用了正确的路径格式（不含扩展名，不含 compressed/）
- ✅ 遵循了项目的资源管理规范

### 下一步工作
1. 添加 i18n 文案（卡牌名称和描述）
2. 运行游戏进行功能验证
3. 如果需要，添加辅助卡的显示逻辑

---

**审查者**：Kiro AI Assistant  
**审查日期**：2026-02-27  
**审查结果**：✅ 所有图片路径问题已修复，代码质量良好
