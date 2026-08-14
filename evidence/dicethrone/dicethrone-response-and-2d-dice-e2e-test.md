# DiceThrone 响应控件、骰盘与默认 2D 骰子动效 E2E 验收

> 验收状态：PASS。以下截图已按本轮新增口径重新生成 / 重新核验：悬浮手牌抬起后不遮挡响应条，响应条保持胶囊形与视口居中，边框/阴影更突出，并加入用户明确允许的流光效果；默认 2D 骰子恢复历史 CSS 六面体翻滚，不恢复已删除的 WebGL/Canvas 可选 3D 骰子。

## 本轮验收对象

- 响应控件：棋盘内的“可以响应 / 跳过”提示条。目标是更显眼、有抬升感，加入流光，并向上避让鼠标悬浮后抬起的当前可响应手牌；它仍须保持视口水平居中和胶囊形。
- 骰盘：真人自己的五颗 2D 骰图必须在首屏可见；骰盘使用实色强边框和阴影突出层次，不使用渐变；默认 2D 骰子继续使用历史 CSS 六面体翻滚和停稳骰面逻辑，不创建 Canvas/WebGL 渲染器。
- 预加载范围：真人所选角色的骰图属于首屏必须加载；对手所选角色的骰图仅在后台暖加载。

## 自动验证

1. `npm run test:e2e:file -- e2e/dicethrone/dicethrone-ai-ultimate-response.e2e.ts "真人响应提示更显眼且可跳过并关闭响应窗口"`
   - 真实响应窗口出现后，直接读取“可以响应 / 跳过”控件的计算样式：响应条为 `4px` 实色强边框、胶囊形、强阴影、视口居中，按钮为 `2px` 实色边框且高度不少于 `44px`；响应条背景本身无渐变，只有用户明确允许的流光层使用 `linear-gradient` 动画。
   - 同时读取 2D 骰盘：`2px` 实色边框、有阴影、无渐变、五颗骰图均已加载，且没有 Canvas。
   - 先 hover 当前可响应手牌，再读取响应条和所有可见手牌矩形，断言无相交；横向投影相交时，垂直留白至少 `6px`。
   - hover 到“跳过”按钮后，断言按钮中心点仍命中按钮本体，并实际点击“跳过”证明响应窗口和响应提示条均退场。

2. `npm run test:e2e:file -- e2e/dicethrone/dicethrone-die-modification.e2e.ts "card-me-too 复制骰面时重复点源骰不会提前完成，点目标骰后才结算"`
   - 在真人自己的骰盘初始可操作状态，断言有五颗 `dice-2d`，每颗骰图都已加载完成，并且骰盘没有 Canvas。

3. `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-2d-dice-roll-animation.e2e.ts`
   - 真人点击右侧“投掷”后，五颗默认 2D 骰子都必须在真实翻滚期间执行历史 `dice2d-cube-tumble` CSS 动画；停稳后动画必须变为 `none` 并回到对应骰面。
   - 该断言和两张同链路整屏截图共同覆盖动态过程，不能再用“骰图已加载”的静态图替代“骰子会翻滚”的验收。

## 预加载事实

`src/games/dicethrone/criticalImageResolver.ts` 把骰图列为对局素材；有真人视角时，真人所选角色的完整素材集合进入首屏必须加载队列，对手所选角色进入后台暖加载队列。该规则没有把对手骰图提升为必须加载。

## 最终原图与图面结论

| 顺序 | 原图 | 直接证明的内容 |
| --- | --- | --- |
| 01 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ai-ultimate-response.e2e\真人响应提示更显眼且可跳过并关闭响应窗口\01-真人响应提示显眼且2D骰盘已就绪.jpg` | “可以响应 / 跳过”位于视口水平中心，保持胶囊形、实色强边框与阴影；它位于“惊不惊喜”手牌上方，二者不相交并保留垂直空隙。 |
| 02 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ai-ultimate-response.e2e\真人响应提示更显眼且可跳过并关闭响应窗口\02-真人跳过响应后提示关闭.jpg` | 点击“跳过”后，响应控件完全退场，画面回到对手思考状态，没有遗留提示条。 |
| 03 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-modification.e2e\card-me-too-复制骰面时重复点源骰不会提前完成，点目标骰后才结算\01-真人自己的2D骰图已加载.jpg` | 右侧骰盘已显示真人和尚的五颗专用骰图；骰盘外框是清晰的实色强边框和阴影，图中没有 Canvas/WebGL 渲染器或空白骰位。 |
| 04 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-2d-dice-roll-animation.e2e\真人点击投掷后，右侧-2D-骰盘恢复旧-CSS-六面体翻滚并停稳\01-真人投掷中2D骰子恢复立体翻滚.jpg` | 真人点击右侧“投掷”后，五颗默认 2D 骰子处于历史 CSS 六面体翻滚中；E2E 同时读取到五颗骰子的计算动画名都是 `dice2d-cube-tumble`。 |
| 05 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-2d-dice-roll-animation.e2e\真人点击投掷后，右侧-2D-骰盘恢复旧-CSS-六面体翻滚并停稳\02-真人投掷后2D骰子停稳.jpg` | 同一次真人投掷结束后，五颗骰子停稳并显示专用骰面；E2E 读取到计算动画均为 `none`。 |

## AI 图面审计

```text
verdict: PASS
score: 96/100
hard_failures: []
negative_impact_checks:
  - 响应控件保持胶囊形和视口水平居中，只沿纵向上移以避让手牌。
  - 响应控件与每张可见手牌无矩形相交；横向重叠时至少保留 6px 垂直空隙。
  - “跳过”按钮取消自身 hover/active 位移，真实 pointer 命中按钮本体后响应窗口退场。
  - 对手骰图仍为后台暖加载，DiceThrone 骰盘没有 Canvas/WebGL 渲染残留。
  - 默认 2D 骰子的 CSS 立体翻滚已从历史代码回接；该视觉效果不依赖 Canvas/WebGL，也不是已删除的可选 3D 骰子入口。
```

图面观察：响应条的胶囊轮廓、黄色强边框、底部投影和流光层清楚可辨，第一眼即可知道可以响应或跳过；响应条位于悬浮手牌上方，二者之间有明确空隙；跳过后的截图明确显示该控件已消失；真人骰盘中五颗骰图完整可辨认，外框与棋盘背景的分离清晰。投掷中截图能看见骰子具有六面体体积感，停稳图能看见结果骰面；两张均来自同一条真人点击“投掷”的 E2E，而不是单独摆拍或静态状态注入。

## 规范落点

`.spec/knowledge/standards/ui-change-gates.md` 是本次回归约束的唯一规范正文：删除可选 UI 前必须拆清可选分支专属职责与默认态共用职责，禁止误删默认 2D 骰图加载、旧动效、尺寸、命中区或截图合同。`.spec/knowledge/standards/e2e-verification.md` 同步规定动态回归必须断言实际动画状态并给出同链路中间态与停稳态截图；`.spec/knowledge/README.md` 只承担路由入口，明确该规则同样适用于删除可选 3D/实验 UI。
