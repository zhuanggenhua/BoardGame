# DiceThrone 奖励骰无中央特写 E2E 证据

## 用户症状

- 奖励骰 / 临时骰阶段不应出现中央骰子特写、卡牌特写内嵌骰子或对掷 / 决斗中间特写。
- 玩家需要在右侧 2D 骰盘改骰；中央特写会遮挡牌桌和操作路径。

## 当前结论

- 当前奖励骰和临时骰统一由右侧 2D 骰盘承接展示、改骰和确认。
- 本轮验收覆盖两条代表链：月精灵 `万箭齐发` 多骰奖励和武僧 `雷霆万钧` 三骰奖励。
- 两条链路截图前都执行了无中央特写断言：不允许 `compare-roll-overlay`、`bonus-die-overlay`、旧奖励骰专用确认按钮、中央骰子内容、卡牌特写内嵌骰子或中央卡牌特写。

## 修复覆盖

- `src/games/dicethrone/hooks/useCardSpotlight.ts`：奖励骰路由到右侧骰盘时，不再把分批奖励骰事件绑定回中央卡牌特写。
- `src/games/dicethrone/ui/CardSpotlightOverlay.tsx`：旧队列项即便残留奖励骰字段，也不在中央卡牌特写渲染骰子或奖励骰汇总文本。
- `src/games/dicethrone/Board.tsx`：奖励骰 / 临时骰上下文存在时，隐藏并清理中央卡牌特写队列，让右侧骰盘成为唯一操作入口。
- `e2e/dicethrone/bonus-dice-flow.ts`：共享 E2E helper 统一断言奖励骰流程无中央特写。
- `e2e/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e.ts`：截图链删除旧“等待中央卡牌特写”路径，每张关键截图前检查无中央特写。

## 验证命令

```powershell
npx vitest run src/games/dicethrone/__tests__/useCardSpotlight.rollback.test.tsx src/games/dicethrone/ui/__tests__/CardSpotlightOverlay.test.tsx src/games/dicethrone/ui/__tests__/CompareRollOverlay.test.tsx
npx tsc --noEmit --pretty false
node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e.ts --grep "万箭齐发：弹一手修改奖励骰后按改后弓面数加伤并施加缠绕|武僧雷霆万钧：弹一手修改奖励骰后按改后点数和造成伤害"
```

## 验证结果

- Vitest：`3 files / 11 tests passed`。
- TypeScript：`npx tsc --noEmit --pretty false` 通过。
- Playwright：`2 passed (1.8m)`。
- E2E 预热阶段出现一次 `warm-prefetch-play-route-source` 失败日志，但测试正式进房、截图和断言均通过；该日志只说明预热请求失败后继续正式链路，不是本轮 UI 验收失败。

## 截图与肉眼观察

### 万箭齐发

- `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/万箭齐发：弹一手修改奖励骰后按改后弓面数加伤并施加缠绕/02-万箭齐发-无中央特写且右侧2D奖励骰盘可见.jpg`
  - 画面中央没有卡牌特写、骰子特写或对掷层。
  - 五颗奖励骰全部在右侧 2D 骰盘显示。
  - 响应窗口和手牌仍可见，玩家可继续打 `弹一手`。
- `.../04-万箭齐发-弹一手选择奖励骰改前.jpg`
  - 右侧骰盘进入可改骰状态，目标骰子周围出现加减控件。
  - 中央仍无任何遮挡式特写。
- `.../05-万箭齐发-弹一手已修改奖励骰.jpg`
  - 被选奖励骰已从原值改成新结果。
  - 改骰状态仍停在右侧骰盘，没有回到中央展示。
- `.../06-万箭齐发-改后奖励骰等待攻击方确认.jpg`
  - 改后奖励骰由攻击方在右侧普通确认按钮收口。
  - 中央没有奖励骰确认弹窗或卡牌特写。
- `.../07-万箭齐发-改后弓面数已写入加伤并施加缠绕.jpg`
  - 结算后右侧保留奖励骰只读回看。
  - 对手已获得缠绕标记，说明万箭齐发按改后结果继续结算。

### 雷霆万钧

- `test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/武僧雷霆万钧：弹一手修改奖励骰后按改后点数和造成伤害/04-雷霆万钧-弹一手选择奖励骰改前.jpg`
  - 三颗奖励骰在右侧骰盘可选可改。
  - 中央没有骰子特写、卡牌特写或对掷层。
- `.../05-雷霆万钧-弹一手已修改奖励骰.jpg`
  - 目标骰从 `6` 改为 `5`，骰盘即时反映改后点数。
  - 没有旧奖励骰专用确认按钮。
- `.../06-雷霆万钧-改后奖励骰等待攻击方确认.jpg`
  - 改后奖励骰等待攻击方用右侧普通确认按钮确认。
  - 中央区域仍可读，不被临时骰展示遮挡。
- `.../07-雷霆万钧-按改后点数和造成伤害.jpg`
  - 结算后出现 `-14` 伤害飘字。
  - 右侧骰盘保留最终奖励骰回看，证明伤害按改后点数链路完成。

## 用户展示图组

- 带序号图组目录：`test-results/evidence-screenshots/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e/_labeled-for-pureref/bonus-no-central-spotlight-20260815-1441/`
- 已用项目入口打开：`node scripts/verify/open-verified-image.mjs --viewer pureref --paths ...`

## 同类扩审

- 生产渲染入口：奖励骰期间 `Board.tsx` 直接清理并隐藏中央卡牌特写；`CardSpotlightOverlay.tsx` 不再渲染奖励骰字段。
- 共享 E2E 驱动器：`bonus-dice-flow.ts` 统一检查旧中央特写、旧奖励骰 overlay 和旧专用确认按钮不存在。
- 代表对象 E2E：`万箭齐发` 覆盖多骰攻击修正奖励；`雷霆万钧` 覆盖技能奖励骰按改后点数造成伤害。
- 旧 evidence：已给 `dicethrone-bonus-die-spotlight-close-guard-e2e-test.md` 和 `dicethrone-card-dice-display-fix.md` 加历史失效说明，避免继续把中央特写当当前合同。
- 当前未宣称全英雄奖励骰 family 全量商业封版；本证据只证明共享展示入口和两条代表链已经按“右侧骰盘唯一入口、无中央特写”收口。
