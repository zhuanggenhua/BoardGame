# Dice Throne 素材处理方案 (Asset Pipeline)

本文档规范了 Dice Throne 游戏模块中图片素材（卡牌、图标、英雄面板）的处理流程，供新增英雄时参考。

> **⚠️ 方案 A 变更 (2026-02-06)**
> 
> 移除了基础技能精灵图 (`base-ability-cards.png`) 的渲染逻辑。玩家面板 (`player-board.png`) 本身已包含基础技能图案，技能槽覆盖层仅用于：
> 1. **定位选框**：透明点击区域用于技能选择
> 2. **升级卡叠加**：技能升级后，使用 `CardPreview` 组件叠加显示升级卡图片
> 
> 此方案解决了手动切割精灵图定位不准确的问题。

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
│   │   ├── ability-cards.png            # 卡牌图集源图（大约 18MB）
│   │   ├── player-board.png             # 玩家面板（技能槽背景）
│   │   ├── tip.png                      # 技能提示板
│   │   ├── dice.png                     # 骰面图集
│   │   ├── compressed/                  # 压缩后的资源（实际加载）
│   │   │   ├── ability-cards.avif
│   │   │   ├── ability-cards.webp
│   │   │   ├── ability-cards.atlas.json  # 图集配置
│   │   │   └── ...
│   │   └── status-icons/                # 状态图标
│   ├── barbarian/                # 野蛮人 (Barbarian) 专属资源
│   │   └── ...（结构同上）
│   └── ...（未来新英雄）
└── thumbnails/                   # 缩略图（选角界面用）
```

---

## 2. 角色选择阶段配置

角色选择界面需要以下素材和代码配置：

### 2.1 头像图集 (Character Portraits)

所有角色头像存放在一张图集中：

**文件路径**: `public/assets/dicethrone/images/Common/character-portraits.avif/webp`

**图集规格**：
- 总尺寸：3950 x 4096 px
- 有效区域：3934 x 1054 px（10 列 × 2 行）
- 单个头像：~393 x 527 px

**索引映射**（`ui/assets.ts` 中的 `CHARACTER_PORTRAIT_INDEX`）：

```typescript
const CHARACTER_PORTRAIT_INDEX: Record<string, number> = {
    barbarian: 13,
    moon_elf: 1,
    pyromancer: 2,
    monk: 3,
    shadow_thief: 4,
    paladin: 5,
    ninja: 6,
    treant: 7,
    vampire_lord: 8,
    cursed_pirate: 9,
    gunslinger: 10,
    samurai: 11,
    tactician: 12,
    huntress: 0,
    seraph: 14,
};
```

### 2.2 角色详情预览

选中角色后显示的详细面板素材：

| 素材 | 路径 | 用途 |
|------|------|------|
| 玩家面板 | `images/<hero>/player-board.avif/webp/png` | 技能槽背景 |
| 技能提示板 | `images/<hero>/tip.avif/webp/png` | 技能提示信息 |

### 2.3 代码配置

#### 在 `ui/assets.ts` 中：
1. 新增英雄索引到 `CHARACTER_PORTRAIT_INDEX`
2. `getPortraitStyle()` 函数自动根据索引计算背景位置

#### 在 `ui/CharacterSelectionAdapter.tsx` 中：
1. 更新 `selectable` 数组启用新英雄选择

```typescript
// CharacterSelectionAdapter.tsx 约 52 行
selectable: ['monk', 'barbarian', '<new_hero>'].includes(char.id),
```

#### 在 `heroes/index.ts` 中：
1. 导入新英雄的 cards 和 abilities
2. 在 `HEROES_DATA` 中注册

```typescript
import { NEW_HERO_CARDS, getNewHeroStartingDeck } from './new_hero/cards';
import { NEW_HERO_ABILITIES } from './new_hero/abilities';

export const HEROES_DATA: Record<string, HeroData> = {
    // ...existing heroes
    new_hero: {
        cards: NEW_HERO_CARDS,
        abilities: NEW_HERO_ABILITIES,
        getStartingDeck: getNewHeroStartingDeck,
    },
};
```

---

## 3. 图集系统 (Card Atlas)

### 3.1 核心概念

Dice Throne 使用**图集 (Atlas)** 方式管理卡牌图片，而非单独的图片文件。一个图集是一张包含多张卡牌的大图，配合一个 JSON 配置文件来定位每张卡牌的位置。

**优势**：
- 减少 HTTP 请求数
- 利用浏览器缓存
- 统一压缩处理

### 3.2 图集配置文件格式

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

### 3.3 索引 (Index) 映射规则

卡牌在图集中的位置由 **index** 决定，从左到右、从上到下编号（0-based）：

```
Index 0   Index 1   Index 2   ...   Index 9
Index 10  Index 11  Index 12  ...   Index 19
...
```

**重要**：确保 `cards.ts` 中的 `previewRef.index` 与图集中的卡牌位置严格对应！

---

## 4. 代码引用方式

### 4.1 注册图集 ID

在 `src/games/dicethrone/domain/ids.ts` 中注册图集 ID：

```typescript
export const DICETHRONE_CARD_ATLAS_IDS = {
    MONK: 'dicethrone:monk-cards',
    BARBARIAN: 'dicethrone:barbarian-cards',
    PYROMANCER: 'dicethrone:pyromancer-cards',
} as const;

export const DICETHRONE_STATUS_ATLAS_IDS = {
    MONK: 'dicethrone:monk-status',
    PYROMANCER: 'dicethrone:pyromancer-status',
} as const;

```

### 4.2 卡牌定义中引用

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

### 4.3 图集加载与注册

图集在 `Board.tsx` 中按对局英雄动态加载并注册到全局 Registry：

```typescript
// Board.tsx (约 690-720 行)
React.useEffect(() => {
    if (!heroCharIds) return;
    let isActive = true;
    const loadAtlas = async (atlasId: string, imageBase: string) => {
        const config = await loadCardAtlasConfig(imageBase, locale);
        if (!isActive) return;
        registerCardAtlasSource(atlasId, { image: imageBase, config });
    };

    for (const charId of heroCharIds.split(',')) {
        const atlasId = `dicethrone:${charId}-cards`;
        const imageBase = `dicethrone/images/${charId}/ability-cards`;
        void loadAtlas(atlasId, imageBase);
    }

    return () => {
        isActive = false;
    };
}, [locale, heroCharIds]);
```

### 4.4 渲染组件

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

## 5. 图片压缩流程

### 5.1 压缩工具

项目使用自定义脚本将 PNG 压缩为 AVIF 和 WebP 格式：

```bash
# 压缩指定目录下的图片
node scripts/compress-images.js public/assets/dicethrone/images/monk
```

### 5.2 输出规范

| 原始格式 | 压缩格式       | 存放位置                    |
| -------- | -------------- | --------------------------- |
| `.png`   | `.avif`, `.webp` | `compressed/` 子目录      |

### 5.3 图集配置生成

使用 `atlas_grid_scan.js` 脚本自动扫描卡牌边界并生成 `.atlas.json`：

```bash
node scripts/assets/atlas_grid_scan.js public/assets/dicethrone/images/monk/ability-cards.png
```

**输出**：`ability-cards.atlas.json`（需复制到 `compressed/` 目录）

---

## 6. 新增英雄检查清单

当添加新英雄时，按以下步骤操作：

### 6.1 素材准备
- [ ] 获取卡牌扫描图（所有卡牌排列在一张大图上）
- [ ] 获取玩家面板图 (`player-board.png`)
- [ ] 获取技能提示板图 (`tip.png`)
- [ ] 获取骰面图集 (`dice.png`)

### 6.2 目录创建
- [ ] 创建 `public/assets/dicethrone/images/<hero>/`
- [ ] 创建 `public/assets/dicethrone/images/<hero>/compressed/`

### 6.3 图集处理
- [ ] 运行 `atlas_grid_scan.js` 生成配置
- [ ] 手动核对索引与卡牌对应关系
- [ ] 运行 `compress-images.js` 压缩
- [ ] 将 `.atlas.json` 复制到 `compressed/`

### 6.4 代码注册
- [ ] 在 `domain/ids.ts` 添加 `DICETHRONE_CARD_ATLAS_IDS.<HERO>`
- [ ] 在 `domain/ids.ts` 添加 `<HERO>_DICE_FACE_IDS`（如果骰面不同）
- [ ] 在 `Board.tsx` 添加 `loadAtlas()` 调用
- [ ] 在 `heroes/<hero>/cards.ts` 中为每张卡牌设置正确的 `previewRef.index`

### 6.5 验证
- [ ] 本地运行游戏，检查所有卡牌图片是否正确显示
- [ ] 检查放大预览是否正确
- [ ] 检查弃牌堆顶显示是否正确

---

## 7. 常见问题

### Q: 图片显示为空白或错位？
**A**: 检查 `previewRef.index` 是否与图集中的实际位置匹配。使用图片编辑器（如 Photoshop）查看像素坐标，与 `.atlas.json` 对比。

### Q: 新英雄的卡牌预览不加载？
**A**: 确保在 `Board.tsx` 中添加了 `loadAtlas()` 调用，并且 `DICETHRONE_CARD_ATLAS_IDS` 中注册了正确的 ID。

### Q: 压缩后图片质量太差？
**A**: 调整 `compress-images.js` 中的质量参数，或者对于小图标类资源考虑保留 PNG 格式。

---

## 8. 数据修改记录规范 (Data Correction Logging)

**适用范围**：当且仅当根据图片素材（如卡牌图集、提示板、面板图）对代码中的业务数据进行提取、覆盖或修正时，才需要执行此记录规范。

**强制要求**：
1. **组件全口径原则**：表格必须包含该组件在素材中展示的**所有核心业务属性及执行顺序**。
2. **逻辑序列化 (Sequence)**：如果图片中描述了“先 A 然后 B”的逻辑，表格的“Visual Value”列必须以 **1. 2. 3.** 的形式枚举完整的逻辑链路。
3. **关键连接词核对**：必须显式核对诸如“然后”、“另外”、“所有对手”、“不可防御”等关键限定词，并说明代码如何实现该顺序（如通过自定义动作整合）。

**标准表格格式示例 (以 Pyromancer 为例)**：

| Ability/Card | Property / Sequence (Visual Interpretation from Image) | Code Status | Action/Reason |
| :--- | :--- | :--- | :--- |
| `fiery-combo` | 1. 触发: 小顺子<br>2. **获得 2 火焰精通**<br>3. **然后**造成 5 点伤害<br>4. **每有 1 火焰精通 + 1 点伤害** | **Fixed** | 修正了 FM 获得数，并将计算整合进 Custom Action 以确保计算包含新获得的精通。 |
| `soul-burn` | 1. 触发: 2x [Soul 图标]<br>2. **获得 2x 火焰精通**<br>3. **所有对手**造成 1x [Soul 图标] 伤害 | **Fixed** | 修正 FM 获得数为 2；补全对“所有对手”的伤害结算。 |

**注意**：此表格仅出现在对话回复中，作为 AI 与用户之间的“全量核对契约”，无需写入文件。

---

## 9. 英雄骰子配置 (Hero Dice Configuration)

每个英雄的骰面 ID 与数值对应关系需在 `src/games/dicethrone/domain/ids.ts` 中定义。

### 9.1 烈火术士 (Pyromancer)
| 骰值 (Value) | 符号 ID (Symbol ID) | 说明 (Description) |
| :--- | :--- | :--- |
| 1, 2, 3 | `FIRE` | 火 (基础符号) |
| 4 | `MAGMA` | 爆发 (AOE/爆裂符号) - 见 `tip.png` 右下角 |
| 5 | `FIERY_SOUL` | 焚魂 (资源/符号) |
| 6 | `METEOR` | 流星 (强力攻击) |

### 9.2 如何获取骰子数据 (How to Read Dice Data)
在配置新英雄的骰子时，应优先参考素材目录下的 `tip.png`（提示板图片）：
- **骰子对应关系**：通常在 `tip.png` 的**右下角**或**底部**会列出 1-6 号骰面对应的符号。
- **符号名称**：
  - 如果图片中有明确文字标注，使用该标注的英文译名。
  - 对于烈火术士，4 号面在 `tip.png` 中标注为 **爆发/Magma** 图标，5 号面为 **焚魂/Fiery Soul**。
- **核对流程**：
  1. 打开 `public/assets/dicethrone/images/<hero>/tip.png`。
  2. 找到骰面说明区域。
  3. 将 1-6 的数值映射到 `src/games/dicethrone/domain/ids.ts`。

---

## 10. 图片阅读法则 (Image Reading Guidelines)

### 10.1 严禁猜测 (Strict No-Guessing Policy)
在解读卡牌或面板图片时，如果遇到以下情况：
- 图标模糊不清
- 符号含义不确定（例如：两种相似的火焰图标）
- 数值被遮挡
- 文本有歧义

**绝对禁止**进行猜测或“合理推断”。**必须**直接向用户询问澄清。猜测导致的错误（如混淆 "Fire" 和 "Fiery Soul"）会严重破坏游戏平衡。

### 10.2 图标识别指南
- **仔细对比**：将卡牌上的微小图标与 `tip.png` 或 `dice.png` 上的大图标进行形状对比。
- **上下文检查**：如果一个效果包含 "Gain Fire Mastery"（获得火焰精通），其前置条件图标通常是产生资源的符号（如 "Fiery Soul"），而非产生伤害的符号。但烈火术士例外，其机制允许不同符号产生混合效果，因此必须**字面解读**图片，不可套用惯例。
- **多版本核对**：检查是否有 Level 2 / Level 3 的异同。升级版不仅仅是数值提升，机制逻辑（如哪些骰面产生什么效果）可能会完全改变（如 Magma Armor II vs III）。

---

## 11. 经验教训：卡牌透明/空白问题 (Lessons Learned: Blank Card Issue)

> **事件时间**：2026-02-07
> **影响范围**：Barbarian 全部升级卡 + 三英雄全部通用卡

### 11.1 问题描述

重构卡牌渲染系统（从 `atlasIndex` 直接渲染 → `CardPreview` + `previewRef` 组件化渲染）后，部分卡牌显示为透明/空白。

### 11.2 根因分析

`CardPreview` 组件在 `previewRef` 为 `undefined` 时直接返回 `null`，导致卡面空白。遗漏发生在两处：

1. **通用卡 (Common Cards)**：重构前通用卡通过 `card.atlasIndex` 直接渲染，重构后需要 `previewRef`，但 `commonCards.ts` 中未注入。
   - **修复**：新增 `COMMON_ATLAS_INDEX` 映射表 + `injectCommonCardPreviewRefs()` 函数，在各英雄 `cards.ts` 中 spread 时自动注入。

2. **Barbarian 升级卡**：Monk 和 Pyromancer 的升级卡在重构时已添加 `previewRef`，但 Barbarian 的 10 张升级卡被遗漏。
   - **修复**：逐张补上 `previewRef`，索引需对照图集图片核实。

### 11.3 索引不能假设顺序

**关键教训**：升级卡在图集中的排列顺序**不一定**按代码定义顺序排列。

以 Barbarian 为例，图集实际布局为：
```
index 5:  皮肉厚 II (thick-skin-2)
index 6:  悍然不顾 II (reckless-strike-2)
index 7:  力大无穷 II (suppress-2)
index 8:  百折不挠 II (steadfast-2)
index 9:  撼地重击 II (violent-assault-2)
index 10: 神力重击 II (powerful-strike-2)
index 11: 坚毅重击 III (all-out-strike-3)
index 12: 坚毅重击 II (all-out-strike-2)
index 13: 重击 III (slap-3)
index 14: 重击 II (slap-2)
```

这与代码中卡牌定义的顺序完全不同。**必须逐张对照图集图片确认索引**，不可按代码顺序递增赋值。

### 11.4 防范检查清单（补充到 §6）

新增英雄或重构渲染系统时，额外检查：

- [ ] **所有卡牌类型都有 `previewRef`**：专属行动卡、升级卡、通用卡，缺一不可
- [ ] **通用卡通过 `injectCommonCardPreviewRefs()` 注入**，不要手动逐张写
- [ ] **升级卡索引必须对照图集图片逐张核实**，禁止按代码顺序假设
- [ ] **快速验证方法**：`grep -c "previewRef"` 统计每个英雄 `cards.ts` 中的 previewRef 数量，应等于该英雄专属卡数量（通用卡由 inject 函数处理）
- [ ] **运行时验证**：进入游戏后翻阅所有手牌，确认无透明卡
- [ ] **升级卡显示配置**：在 `ui/AbilityOverlays.tsx` 中：
  - 将新英雄的卡牌定义导入并添加到 `HERO_CARDS_MAP` 映射
  - 在 `HERO_SLOT_TO_ABILITY` 中添加新英雄的槽位→技能ID映射（8个普通技能+1个终极）

### 11.5 通用卡图集布局（所有英雄一致）

通用卡在每个英雄图集中占据 index 15-32，映射关系定义在 `domain/commonCards.ts` 的 `COMMON_ATLAS_INDEX` 中：

| Index | Card ID | 中文名 |
|-------|---------|--------|
| 15 | card-play-six | 玩转六骰！ |
| 16 | card-just-this | 就这？ |
| 17 | card-give-hand | 给一手！ |
| 18 | card-i-can-again | 我又行了！ |
| 19 | card-me-too | 俺也一样！ |
| 20 | card-surprise | 惊不惊喜！ |
| 21 | card-worthy-of-me | 配得上我 |
| 22 | card-unexpected | 意不意外 |
| 23 | card-next-time | 下次吧 |
| 24 | card-boss-generous | 老板大方 |
| 25 | card-flick | 弹一下 |
| 26 | card-bye-bye | 拜拜了您 |
| 27 | card-double | 双倍 |
| 28 | card-super-double | 超级双倍 |
| 29 | card-get-away | 滚远点 |
| 30 | card-one-throw-fortune | 一掷千金 |
| 31 | card-what-status | 什么状态 |
| 32 | card-transfer-status | 转移状态 |

---
*上次更新时间: 2026-02-07*

## 12. 月精灵 (Moon Elf) 卡牌汇总 (Card Summary)

| Index | Card ID | Name (ZH) | Type | Cost (CP) | Effect Summary |
|---|---|---|---|---|---|
| 0 | `moon-shadow-strike` | 月影袭人! (Moon Shadow Strike!) | Action | 0 | 投掷判定: 1-3=抽1牌; 4-5=缠绕; 6=致盲+锁定 |
| 1 | `dodge` | 闪躲! (Dodge!) | Action | 1 | 获得闪避 (Gain Evasive) |
| 2 | `volley` | 万箭齐发! (Volley!) | Action | 1 | 攻击修正: 每个[弓]骰 +1 伤害，施加缠绕 |
| 3 | `watch-out` | 看箭! (Watch Out!) | Action | 0 | 攻击修正: [弓]+2伤害, [足]施加缠绕, [月]施加致盲 |
| 4 | `moonlight-magic` | 月光魔法! (Moonlight Magic!) | Action | 4 | 获得闪避, 施加致盲+缠绕+锁定 |
| 5 | `upgrade-elusive-step-2` | 打不到我 II (Elusive Step II) | Upgrade | 3 | 升级迷影步至 II 级 (Upgrade Elusive Step) |
| 6 | `upgrade-eclipse-2` | 星蚀 II (Eclipse II) | Upgrade | 2 | 升级月食至 II 级 (Upgrade Eclipse) |
| 7 | `upgrade-blinding-shot-2` | 致盲射击 II (Blinding Shot II) | Upgrade | 2 | 升级致盲射击至 II 级 (Upgrade Blinding Shot) |
| 8 | `upgrade-entangling-shot-2` | 缠绕射击 II (Entangling Shot II) | Upgrade | 2 | 升级缠绕射击至 II 级 (Upgrade Entangling Shot) |
| 9 | `upgrade-exploding-arrow-3` | 爆炸射击 III (Exploding Arrow III) | Upgrade | 3 | 升级爆裂箭至 III 级 (Upgrade Exploding Arrow) |
| 10 | `upgrade-exploding-arrow-2` | 爆炸射击 II (Exploding Arrow II) | Upgrade | 2 | 升级爆裂箭至 II 级 (Upgrade Exploding Arrow) |
| 11 | `upgrade-covering-fire-2` | 隐蔽射击 II (Covering Fire II) | Upgrade | 2 | 升级掩护射击至 II 级 (Upgrade Covering Fire) |
| 12 | `upgrade-deadeye-shot-2` | 赐死射击 II (Deadeye Shot II) | Upgrade | 2 | 升级隐秘射击至 II 级 (Upgrade Covert Fire) |
| 13 | `upgrade-longbow-3` | 长弓 III (Longbow III) | Upgrade | 3 | 升级长弓至 III 级 (Upgrade Longbow) |
| 14 | `upgrade-longbow-2` | 长弓 II (Longbow II) | Upgrade | 2 | 升级长弓至 II 级 (Upgrade Longbow) |
