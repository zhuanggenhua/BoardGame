# 大杀四方行动卡特写本地模式 E2E 验证

## 结论

本地/测试模式下，棋盘视角已经能跟随当前回合玩家切换，双方都可以通过真实 UI 点击自己的手牌，并稳定触发行动卡特写。

这次收口时还额外确认了一个测试层问题：

- 失败根因不是产品代码没切到 P1 视角
- 而是 E2E 把 P1 手牌 UID 硬编码成了 `p1-action-1`
- `setupScene()` 实际会为这张牌动态生成 UID，所以旧断言属于假红

## 相关修复

- [`react.tsx`](/F:/gongzuo/webgame/BoardGame/src/engine/transport/react.tsx)
  - `LocalGameProvider` 新增 `followCurrentTurnPlayer`
  - 启用后，Board 视角使用 `turnOrder[currentPlayerIndex]`
- [`LocalMatchRoom.tsx`](/F:/gongzuo/webgame/BoardGame/src/pages/LocalMatchRoom.tsx)
- [`TestMatchRoom.tsx`](/F:/gongzuo/webgame/BoardGame/src/pages/TestMatchRoom.tsx)
- [`UGCSandbox.tsx`](/F:/gongzuo/webgame/BoardGame/src/ugc/builder/pages/UGCSandbox.tsx)
  - 本地页、测试页、UGC 沙盒都开启了 `followCurrentTurnPlayer`
- [`framework-pilot-simple.e2e.ts`](/F:/gongzuo/webgame/BoardGame/e2e/framework-pilot-simple.e2e.ts)
  - 不再硬编码 `p1-action-1`
  - 改为从当前状态读取真实 UID，再校验对应手牌 DOM 可见

## 执行命令

```powershell
$env:PW_START_SERVERS='true'
$env:NODE_OPTIONS='--max-old-space-size=4096'
npx playwright test e2e/framework-pilot-simple.e2e.ts --workers=1 --reporter=dot -g "本地模式双方打出行动卡都应显示特写"
```

## 结果

- 运行日期：2026-03-12
- 结果：`1 passed`
- 验证点：
  - P0 回合可从底部手牌点击 `wizard_mystic_studies`
  - 关闭特写后推进回合
  - P1 回合能看到自己的真实手牌 DOM，并再次通过 UI 点击同一张行动卡
  - 两次都出现 `smashup-action-spotlight-card`

## 截图审查

### P0 出牌特写

> 历史截图已清理。如需重新取证，请重跑 `e2e/framework-pilot-simple.e2e.ts`，新统一目录为 `test-results/evidence-screenshots/`。

审查结论：

- 左上角回合条显示 `YOU / Play`
- 中央存在行动卡特写，右上角带 `Played!`
- 右侧弃牌堆计数为 `1`
- 底部只剩两张新抽到的牌，说明 P0 的行动卡已经真实离手并完成结算

### P1 出牌特写

> 历史截图已清理。如需重新取证，请重跑 `e2e/framework-pilot-simple.e2e.ts`，新统一目录为 `test-results/evidence-screenshots/`。

审查结论：

- 右上角记分板显示 `P0 / YOU`，说明当前“自己”已经切到 P1
- 中央同样出现行动卡特写，说明第二位玩家回合也能触发
- 底部可见 P1 结算后新抽到的两张牌，右侧弃牌区可见刚打出的 `Mystic Studies`
- 证明本地/测试模式不是停留在固定 P0 视角，而是已经随当前回合玩家切换

## 结论补充

本次本地 Spotlight 批次最终验证的是两件事：

1. 产品侧：本地 Board 身份跟随当前回合玩家，P1 回合确实能操作自己的手牌
2. 测试侧：E2E 不能再依赖 `setupScene()` 之外的固定 UID 假设
