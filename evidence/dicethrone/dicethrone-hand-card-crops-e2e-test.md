# Dice Throne 手牌卡图验收证据

## 本轮口径

- 问题对象：`dicethrone` 手牌里出现的卡图
- 对照角色：`monk`
- 目标角色：`samurai`、`gunslinger`
- 本文只记录运行时正式素材链路，不再引用录入中间产物或临时裁图

## 验证方式

- 页面：本地 `http://127.0.0.1:4173/play/dicethrone`
- 方式：Playwright 打开真实页面，注入最小手牌场景，保留本地资源门禁，不跳过正式图片加载
- 额外校验：
  - `samurai` / `gunslinger` 的 `hand-cards-atlas` 已纳入 DiceThrone 运行时图片预加载解析
  - `CardPreview` 的 atlas 卡面不再在 4 秒后强行移除 shimmer 露出深蓝底板

## 截图与观察

### 武士手牌

![武士手牌](../../test-results/evidence-screenshots/dicethrone/dicethrone-hand-final/samurai-hand.png)

观察：

- 手牌里两张武士卡在首帧可见状态下就是实际卡图，不再是整块深蓝底板。
- 左侧 `肃穆之仪 II` 和右侧 `正宗 II` 都能看到各自标题区、正文区和插画区，不是透明区或空白区。
- 两张牌只是正常扇形重叠，上沿有少量遮挡，没有出现“整体偏到透明区”的现象。

### 枪手手牌

![枪手手牌](../../test-results/evidence-screenshots/dicethrone/dicethrone-hand-final/gunslinger-hand.png)

观察：

- 手牌里的枪手卡同样直接显示正式卡图，没有先露深蓝底板。
- 左卡可见 `枪托击打` 的标题和正文，右卡可见 `执法者` 的标题、费用区和正文区。
- 两张牌都落在卡框可视区域内，仍然是正常重叠，不存在之前那种“只有底色、像裁到透明区”的表现。

### Monk 对照

![Monk 手牌对照](../../test-results/evidence-screenshots/dicethrone/dicethrone-hand-final/monk-hand.png)

观察：

- `monk` 手牌继续正常显示，标题、插画和正文完整可见。
- `samurai` / `gunslinger` 修复后的表现已经和 `monk` 回到同一类运行时效果：进入手牌后直接看到卡图，而不是蓝板。
- 三组手牌都保留相同的扇形排布与重叠方式，说明问题不在 `HandArea` 布局，而在正式 hand atlas 的加载与显示时机。

## 结论

- 根因不是 atlas 裁切公式，也不是手牌排布偏移。
- 根因是两点叠加：
  - `samurai` / `gunslinger` 的 `hand-cards-atlas` 没有进入 DiceThrone 的正式预加载资源集合。
  - atlas 卡面组件会在图片尚未完成时 4 秒后强行去掉 shimmer，直接露出深蓝底色。
- 修复后，武士和枪手手牌已与 `monk` 对齐：真实手牌场景里直接显示正式卡图。
