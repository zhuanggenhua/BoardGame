---
description: DiceThrone 国际化使用说明
---

# DiceThrone 国际化使用说明

> 适用范围：DiceThrone（僧侣）模块的文本与图片国际化。

## 1. 命名空间与翻译文件

- 命名空间：`game-dicethrone`
- 翻译文件位置：
  - `public/locales/zh-CN/game-dicethrone.json`
  - `public/locales/en/game-dicethrone.json`

新增键值后需保持中英文文件结构一致。

## 2. 文本国际化（UI 文案）

DiceThrone Board UI 统一通过 `useTranslation('game-dicethrone')` 获取文案，主要涵盖：

- 阶段说明（`phase.*`）
- HUD 文案（`hud.*`）
- 骰子交互与按钮文本（`dice.*` / `actions.*`）
- 弹窗提示（`confirmSkip.*`）

**示例**：

```tsx
const { t } = useTranslation('game-dicethrone');

<span>{t('hud.health')}</span>
```

## 3. 数据定义的国际化（技能 / 卡牌 / 状态效果）

### 3.1 技能（Ability）

- Key 结构：`abilities.<abilityId>.*`
- 示例：
  - `abilities.fist-technique.name`
  - `abilities.fist-technique.description`
  - `abilities.fist-technique-3.effects.damage4`

**规则**：
- 技能名称与描述统一使用 `abilityText()`
- 技能效果文本统一使用 `abilityEffectText()`

### 3.2 卡牌（Cards）

- Key 结构：`cards.<cardId>.*`
- 示例：
  - `cards.card-upgrade-fist-2.name`
  - `cards.card-upgrade-fist-2.description`

**规则**：
- 卡牌名称与描述统一使用 `cardText()`

### 3.3 状态效果（Status Effects）

- Key 结构：`statusEffects.<effectId>.*`
- 示例：
  - `statusEffects.evasive.name`
  - `statusEffects.evasive.description`

**规则**：
- `description` 使用数组，配合 Tooltip 列表展示。

## 4. 图片国际化（Scheme A）

DiceThrone 图片资源采用 **Scheme A**（静态多语言资源）规则：

- 路径约定：`/assets/i18n/<lang>/<relativePath>`
- 取图函数：
  - `getLocalizedAssetPath(assetPath, locale)`
  - `buildLocalizedImageSet(assetPath, locale)`
- `OptimizedImage` 支持 `fallbackSrc`，当本地化资源缺失时回退到默认资源。

**示例**：

```tsx
<OptimizedImage
  src={getLocalizedAssetPath(ASSETS.PLAYER_BOARD, locale)}
  fallbackSrc={ASSETS.PLAYER_BOARD}
  alt={t('imageAlt.playerBoard')}
/>
```

## 5. 新增文案或资源的流程

1. **新增文案**：
   - 添加到 `public/locales/*/game-dicethrone.json`
   - 在代码中使用 `t('...')`
2. **新增图片本地化**：
   - 放置到 `/public/assets/i18n/<lang>/<relativePath>`
   - 使用 `getLocalizedAssetPath` / `buildLocalizedImageSet`
   - 提供 `fallbackSrc` 以防缺失

---

如需扩展到其他英雄或卡包，按相同命名规则扩展即可。
