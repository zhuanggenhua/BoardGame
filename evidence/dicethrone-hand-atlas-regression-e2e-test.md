# DiceThrone 枪手 / 武士手牌卡图接线回归验证

## 验证目标

- 确认 `samurai` / `gunslinger` 的手牌接线不再依赖 `hand-cards-atlas.webp`
- 确认手牌预览统一回到和老角色一致的 atlas 规格，继续使用原 `ability-cards.webp`
- 确认手牌区不再出现 shimmer / 空白占位
- 确认枪手/武士专属手牌在 UI 中能正常显示

## 执行命令

```powershell
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai and gunslinger hand cards should use ability atlas without shimmer"
```

## 自动化结果

- 结果：通过
- 用例：`DiceThrone hand card preview regression > samurai and gunslinger hand cards should use ability atlas without shimmer`
- 关键日志：
  - `samurai-hand-preview-diag` 中：
    - `upgrade-solemnity-2` 指向 `samurai/compressed/ability-cards.webp`
    - `upgrade-budo-2` 指向 `samurai/compressed/ability-cards.webp`
    - `upgrade-masamune-2` 指向 `samurai/compressed/ability-cards.webp`
  - `gunslinger-hand-preview-diag` 中：
    - `upgrade-fan-the-hammer-2` 指向 `gunslinger/compressed/ability-cards.webp`
    - `card-pistol-whip` 指向 `gunslinger/compressed/ability-cards.webp`
    - `upgrade-duel-2` 指向 `gunslinger/compressed/ability-cards.webp`
  - 两边 `shimmerCount` 都为 `0`

## 截图证据

- 武士：[samurai-hand-preview.png](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hand-preview-regression\samurai-hand-preview.png)
- 枪手：[gunslinger-hand-preview.png](D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hand-preview-regression\gunslinger-hand-preview.png)

## 肉眼观察结论

### 武士

- 底部手牌区显示的是武士专属升级卡真实卡面，不是黑块、灰块或 shimmer 骨架。
- `肃穆之仪 II`、`武道 II`、`正宗 II` 三张牌都继续从 `ability-cards` atlas 取图，没有回退到额外手牌 atlas。
- 右侧日志、按钮和手牌区之间没有因为 atlas 取图错误出现异常拉伸、空白块或拼接错位。

### 枪手

- 底部手牌区显示的是枪手专属手牌真实卡面，包含黑白系枪手牌面，不是共享大图的错误裁切块。
- `左轮速射 II` / `枪托击打` / `对决 II` 都继续走 `ability-cards` atlas，没有额外切到单卡图或 hand atlas。
- 整个手牌区无 shimmer、无空白占位，说明当前 atlas 接线稳定。

## 结论

- `hand-cards-atlas.webp` 不是这两个派系的正式运行时方案。
- 当前正确口径是：
  - 枪手 / 武士的手牌预览继续使用原 `ability-cards` atlas
  - 运行时和预加载都不再依赖 `hand-cards-atlas`
  - 规格回到和老角色一致的 atlas 契约
- 逐 slot 的全量人工复核见 `evidence/dicethrone-gunslinger-samurai-card-preview-audit-2026-04-04.md`。
