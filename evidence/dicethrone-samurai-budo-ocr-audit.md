# DiceThrone 武士 `Budo / 武道` 裁图 OCR 复核

## 目标

复核武士角色板 `slot-05 / 武道` 与升级卡 `slot-23 / 武道 II` 的伤害数字，确认当前代码中的基础 `6 damage`、升级 `8 damage` 是否与本地汉化裁图一致。

## 真相源

- 角色板裁图：`public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/player-board/slot-05.webp`
- 升级卡裁图：`public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/ability-cards/slot-23.webp`

## 复核方法

1. 使用本地 `RapidOCR` 直接识别整张裁图。
2. 对 `slot-05.webp` 的“造成 ? 傷害”行做灰度裁切、放大和阈值二值化，再次用 `RapidOCR` 与 `easyocr` 识别数字。
3. 交叉对照当前 locale 与代码实现：
   - `public/locales/zh-CN/game-dicethrone.json`
   - `public/locales/en/game-dicethrone.json`
   - `src/games/dicethrone/heroes/samurai/abilities.ts`

## 关键 OCR 结果

### `slot-05 / 武道`

- 整图 `RapidOCR` 识别到：
  - `武道`
  - `小顺-4颗...`
  - `獲得榮誉指示物`
  - `造成`
  - `傷害。`
- 直接整图没有稳定读出中间数字，因此进一步裁切“造成 ? 傷害”一行。
- 对该行做 `threshold180 + x4` 处理后，`RapidOCR` 识别到：
  - `亚造成`
  - `6`
- `easyocr` 对同一行的增强图也识别到独立数字：
  - `6`

### `slot-23 / 武道 II`

- 整图 `RapidOCR` 识别到：
  - `武道！`
  - `造成`
  - `8`

## 结论

1. `slot-05 / 武道` 的本地裁图 OCR 支持基础伤害为 `6`。
2. `slot-23 / 武道 II` 的本地裁图 OCR 支持升级伤害为 `8`。
3. 当前实现与 locale 一致：
   - 基础：`+1 honor + 6 damage`
   - 升级：`+1 honor + 8 damage`
4. 因此，武士线此前“`Budo / 武道` 数值仍待最终复核”的角色级 residual 可以关闭。
