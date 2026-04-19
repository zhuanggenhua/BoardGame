# Innsmouth "The Locals" Card Display Investigation

## 问题描述

用户反馈："本地人怎么不展示了，日志有，但没展示"

- 卡牌 ID: `innsmouth_the_locals`
- 症状: 日志中有记录，但 UI 不显示
- 中文名: 本地人
- 英文名: The Locals

## 调查结果

### ✅ 1. 卡牌定义正确

**文件**: `src/games/smashup/data/factions/innsmouth.ts`

```typescript
{
    id: 'innsmouth_the_locals',
    type: 'minion',
    name: '本地人',
    nameEn: 'The Locals',
    faction: 'innsmouth',
    power: 2,
    abilityTags: ['onPlay'],
    count: 10,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS2, index: 26 },
}
```

### ✅ 2. 卡牌已注册

**文件**: `src/games/smashup/data/cards.ts`

```typescript
registerCards(INNSMOUTH_CARDS);
```

### ✅ 3. 图集配置正确

**文件**: `src/games/smashup/domain/atlasCatalog.ts`

- Atlas ID: `CARDS2` (smashup:cards2)
- Grid: 7 rows × 8 cols = 56 positions (indices 0-55)
- Index 26: row 3, col 2 ✅ (valid)

### ✅ 4. 图片文件存在

- 中文图集: `public/assets/i18n/zh-CN/smashup/cards/compressed/cards2.webp` ✅
- 英文图集: `public/assets/i18n/en/smashup/pod-assets/compressed/tts_atlas_14.webp` ✅

### ✅ 5. 英文图集映射正确

**文件**: `src/games/smashup/data/englishAtlasMap.json`

```json
"innsmouth_the_locals": {
    "atlasId": "tts_atlas_14",
    "index": 10
}
```

### ✅ 6. i18n 翻译存在

**中文** (`public/locales/zh-CN/game-smashup.json`):
```json
"innsmouth_the_locals": {
    "name": "本地人",
    "abilityText": "展示你牌库顶的三张牌，将任何以此方式展示的本地人放到你的手牌。将剩下的牌放入你的牌库底。"
}
```

**英文** (`public/locales/en/game-smashup.json`):
```json
"innsmouth_the_locals": {
    "name": "The Locals",
    "abilityText": "Reveal the top three cards of your deck. Place any Locals revealed this way into your hand. Place the remaining cards on the bottom of your deck."
}
```

## 可能的原因

所有静态配置都正确，问题可能出在运行时：

### 1. 卡牌注册表未初始化

- `getCardDef('innsmouth_the_locals')` 可能返回 `undefined`
- 原因: 注册表在 `HandArea` 渲染前未完成初始化

### 2. 时序问题

- 卡牌定义在模块加载时注册
- 如果 `HandArea` 在注册完成前渲染，会导致 `def` 为 `undefined`

### 3. CardPreview 组件问题

- `previewRef` 传递正确，但 `CardPreview` 或 `SmashUpCardRenderer` 未正确处理
- 可能是图集加载失败或渲染器逻辑问题

### 4. 浏览器控制台错误

- 可能有 JavaScript 错误阻止渲染
- 需要查看浏览器控制台的具体错误信息

## 诊断步骤

### 已添加的调试日志

**文件**: `src/games/smashup/ui/HandArea.tsx`

1. **HandCard 组件**:
   ```typescript
   if (card.defId === 'innsmouth_the_locals') {
       console.log('[HandCard] Rendering innsmouth_the_locals:', {
           cardUid: card.uid,
           defId: card.defId,
           defExists: !!def,
           defPreviewRef: def?.previewRef,
           defName: def?.name,
       });
   }
   ```

2. **CardPreview props**:
   ```typescript
   {card.defId === 'innsmouth_the_locals' && (() => {
       const previewRef = isOpponentView 
           ? SMASHUP_CARD_BACK
           : (def?.previewRef
               ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId } }
               : undefined);
       console.log('[HandCard] CardPreview props for innsmouth_the_locals:', {
           isOpponentView,
           defExists: !!def,
           defPreviewRef: def?.previewRef,
           finalPreviewRef: previewRef,
       });
       return null;
   })()}
   ```

### 下一步操作

1. **运行游戏并查看控制台**:
   - 启动开发服务器: `npm run dev`
   - 打开浏览器控制台
   - 创建包含印斯茅斯派系的游戏
   - 查看 `[HandCard]` 日志输出

2. **检查日志输出**:
   - `defExists` 是否为 `true`?
   - `defPreviewRef` 是否正确?
   - `finalPreviewRef` 是否为 `undefined`?

3. **对比其他印斯茅斯卡牌**:
   - 检查其他印斯茅斯卡牌是否正常显示
   - 如果其他卡牌也不显示，可能是派系级别的问题
   - 如果只有 "本地人" 不显示，可能是该卡牌特有的问题

4. **检查 SmashUpCardRenderer**:
   - 添加日志到 `SmashUpCardRenderer.tsx`
   - 确认渲染器是否被调用
   - 确认 `defId` 是否正确传递

## 测试文件

创建了以下测试文件用于独立验证:

1. **test-innsmouth-locals-render.html**: 独立的 HTML 测试页面，直接加载图集并提取卡牌图片
2. **scripts/diagnose-innsmouth-locals.mjs**: 诊断脚本，检查所有静态配置

## 总结

- ✅ 所有静态配置正确
- ⚠️ 需要运行时调试确认问题
- 🔍 已添加调试日志，等待用户反馈控制台输出
- 💡 可能是注册表初始化时序问题或 CardPreview 渲染问题

## 下一步

等待用户提供:
1. 浏览器控制台日志
2. 是否只有 "本地人" 不显示，还是所有印斯茅斯卡牌都不显示
3. 游戏日志中 "本地人" 的具体记录内容
