# FantasyRealms 正式卡图接线核对（2026-06-06）

## 本轮目标

- 将 `FantasyRealms` 桌面实现从程序文字卡切换到正式中文 atlas 卡图。
- 牌库使用正式牌背。
- 焦点区改为“真实大卡 + 推演说明”组合，而不是只保留文字摘要。

## 核对资源

- 卡图 atlas：`public/assets/i18n/zh-CN/fantasyrealms/cards/atlases/compressed/fantasyrealms-base-cards-atlas.webp`
- 牌背：`public/assets/i18n/zh-CN/fantasyrealms/cards/backs/compressed/fantasyrealms-base-card-back.webp`

## 坐标合同

- 网格：`10 x 7`
- 采样依据：
  - `temp/fantasyrealms-crops/row-1.png` ... `row-6.png`
  - `temp/fantasyrealms-atlas-grid/contact-top2.png`
  - `temp/fantasyrealms-atlas-grid/contact-r2-r6.png`

## 截图

- 桌面 1440x1024：`evidence/fantasyrealms/fantasyrealms-atlas-desktop-balanced-2026-06-06.png`
- 历史补充图，非本轮准入门禁：`evidence/fantasyrealms/fantasyrealms-atlas-mobile-landscape-2026-06-06.png`

## 结果

- 按当前项目流程，本轮 atlas 接线先以 `PC` 真图收口；桌面端未达标前，不继续把移动端当成下一步默认目标。
- 手牌区已显示正式卡图，不再渲染程序文字卡面。
- 公开弃牌区沿用正式卡图合同，空态时保持真实桌面空槽，不引入假素材。
- 焦点区已显示正式大卡；隐藏焦点时切回正式牌背，不泄露他人手牌。
- 焦点区右栏已从上一版的偏重占比收回，当前大卡预览缩到 `120px` 宽，长牌名可换行，不再挤压桌面端的预估分数与说明文本。
- 牌库已改为正式牌背堆叠显示。
- 低高度横屏图仅保留为历史补充记录；后续是否继续移动端适配，以桌面端先达标为前置门禁。
