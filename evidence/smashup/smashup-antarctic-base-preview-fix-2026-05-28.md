# Smash Up《南极基地》卡图错连修复（2026-05-28）

## 反馈

- 用户反馈：`卡图是更衣室，文本是南极基地`

## 结论

- 这不是能力实现问题，也不是派系归属问题。
- 根因是 `南极基地 / base_antarctic_base` 的 `previewRef` 接错了图集槽位。

## 直接证据

### 1. 当前代码接线

- 文件：`src/games/smashup/data/cards.ts`
- 旧接线：
  - `base_antarctic_base -> SMASHUP_ATLAS_IDS.BASE4 index 10`

### 2. 当前本地图集实况

- 文件：`public/assets/i18n/zh-CN/smashup/base/compressed/base4.webp`
- `BASE4` 配置：
  - 文件：`src/games/smashup/domain/atlasCatalog.ts`
  - 网格：`3 x 4`
- 按从左到右、从上到下读取，`index 10` 的图面是：
  - `更衣室 / Locker Room`

因此当前表现会变成：

- 图面：`更衣室`
- 文本：`南极基地`

两者不一致。

### 3. 真相源图集

- 文件：`public/assets/atlas-configs/smashup/2833984701.json`
- 对应牌组：`Elder Things Bases`
- 图集：`tts_atlas_0b888d02fd`
- 网格：`4 x 2`
- 正确映射：
  - `base_antarctic_base -> index 0`

## 回归来源

- 引入提交：`938c93a5 Align Cthulhu bases ownership triggers`
- 该提交新增了：
  - `base_antarctic_base`
  - 并直接假定它应落在 `BASE4 index 10`
- 但当时并没有同步修正本地 `base4` 中文图集，因此形成了“对象定义已加，正式图集没对齐”的断裂。

## 修复

- 将 `base_antarctic_base.previewRef` 改为直接指向：
  - `tts_atlas_0b888d02fd index 0`
- 同步修正 `src/games/smashup/data/englishAtlasMap.json` 中的 `base_antarctic_base`
- 补测试锁定：
  - 非 POD 的 `南极基地` 不再走 `BASE4 index 10`
  - 英文映射也改到同一张正确图集

## 当前口径

- 现在“谁的基地有更衣室”这个答案是：
  - **没有任何正式基地定义叫更衣室**
  - 错的是 `南极基地` 误连到了本地 `base4.webp` 的 `更衣室` 槽位
