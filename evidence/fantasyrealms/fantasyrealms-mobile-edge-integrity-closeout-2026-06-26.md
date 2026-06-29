# Fantasy Realms 手机横屏边缘完整性收口 2026-06-26

## 结论

- 以下只针对当前对话。
- 这次收口处理的是 Fantasy Realms live 牌桌在手机横屏里的三类现实问题：`左右边缘公开牌像只剩半截`、`奇怪透明边框/灰白边观感`、`移动端改得像另一套 UI`。
- 当前真实截图链已经重新产出，手机横屏、PC、扫光加载态都来自同一版当前代码。
- 这次不再只靠“看起来差不多”收口，截图脚本已经补成硬门禁：只要中央牌压手牌、边缘牌超视口、牌库加载态露半截、按钮文案不对，脚本会直接失败。
- 用户刚才指出的“只显示半截”在当前代码链里没有复现。排查后确认，之前看到的是一张 `2026-06-25` 旧扫光图残留，不是当前脚本产物。

## 本轮范围

1. 手机横屏 `936x432` live 牌桌边缘完整性
2. PC `1920x1080` live 牌桌不被移动端改坏
3. 扫光加载态不是纯色底板，且左上牌库、左右边缘公开牌仍完整可见
4. 主按钮文案固定为 `从手牌弃置一张牌`

## 当前真实截图

- 手机横屏 live：
  [01-手机横屏936x432-live牌桌-重构后.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-mobile-refactor-final/01-%E6%89%8B%E6%9C%BA%E6%A8%AA%E5%B1%8F936x432-live%E7%89%8C%E6%A1%8C-%E9%87%8D%E6%9E%84%E5%90%8E.png)
- PC live：
  [02-PC1920x1080-live牌桌-重构后.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-mobile-refactor-final/02-PC1920x1080-live%E7%89%8C%E6%A1%8C-%E9%87%8D%E6%9E%84%E5%90%8E.png)
- 当前扫光加载态：
  [03-手机横屏936x432-扫光加载态-重构后.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-mobile-refactor-final/03-%E6%89%8B%E6%9C%BA%E6%A8%AA%E5%B1%8F936x432-%E6%89%AB%E5%85%89%E5%8A%A0%E8%BD%BD%E6%80%81-%E9%87%8D%E6%9E%84%E5%90%8E.png)

## 我实际看到的画面

### 1. 手机横屏 live

- 最左和最右公开牌都完整露出，没有被相邻牌盖成半张。
- 第二排公开牌没有再压进手牌区。
- 手牌仍保留 PC 同构桌面式布局，没有被改成另一套手机稿。
- 右侧主按钮文案是 `从手牌弃置一张牌`。

### 2. PC live

- 公开牌两排仍保持桌面 live 牌桌构图，没有被移动端改坏。
- PC 右下角主按钮、右下 FAB 仍正常可见。
- 边缘公开牌完整，桌面布局没有被收窄成手机感 UI。

### 3. 扫光加载态

- 正式卡面加载时已经是扫光骨架，不是纯色贴图。
- 左上牌库在当前加载态截图里完整露出，没有再只剩半截。
- 左右边缘公开牌在加载态里也完整留在视口内。

## 硬门禁结果

脚本：

```bash
$env:PW_GAME_SERVER_PORT='18002'
$env:GAME_SERVER_PORT='18002'
npx tsx temp/fantasyrealms-mobile-refactor/capture-final.ts
```

### 手机横屏 live

- `compactLayout = false`
- `liveTable = true`
- `centerCardHitsHandZone = false`
- `centerCardHitsHandCard = false`
- `centerCardsStayInsideRow = true`
- `edgeCardsRemainVisible = true`
- `deckRemainsVisible = true`
- `actionLabels = ["从手牌弃置一张牌"]`

### PC live

- `compactLayout = false`
- `liveTable = true`
- `centerCardHitsHandZone = false`
- `centerCardHitsHandCard = false`
- `centerCardsStayInsideRow = true`
- `edgeCardsRemainVisible = true`
- `deckRemainsVisible = true`
- `fabDisplay = "block"`
- `actionLabels = ["从手牌弃置一张牌"]`

### 扫光加载态

- `compactLayout = false`
- `liveTable = true`
- `edgeCardsRemainVisible = true`
- `deckRemainsVisible = true`
- `actionLabels = ["从手牌弃置一张牌"]`

## 为什么上一轮“结束”口径不成立

1. 当时缺了“最外侧对象完整性”门禁，只看了不重叠，不足以证明用户最开始指出的边缘半截问题已经处理掉。
2. 当时扫光加载态截图没有绑定到当前脚本产物，导致 `2026-06-25` 的旧图还能混进当前结论。
3. 旧图里左上牌库看起来只有半截，这次已经通过重新产出当前加载态截图和 `deckRemainsVisible` 量测把这条问题锁死。

## 旧图说明

- 旧图：
  [03-手机横屏936x432-扫光加载态.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-mobile-refactor-final/03-%E6%89%8B%E6%9C%BA%E6%A8%AA%E5%B1%8F936x432-%E6%89%AB%E5%85%89%E5%8A%A0%E8%BD%BD%E6%80%81.png)
- 该文件最后写入时间是 `2026-06-25 11:08:03`，不是当前这轮 `capture-final.ts` 产物。
- 本轮验收应以新增的 `03-手机横屏936x432-扫光加载态-重构后.png` 为准。

## 回归验证

- 截图链：通过
- 单测：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
```

结果：

- `52 passed`
