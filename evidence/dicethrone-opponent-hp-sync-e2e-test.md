# DiceThrone 对手血量同步 E2E 证据

## 结论

- 本轮问题更像是客户端 UI 血量冻结未释放，而不是服务端/网络没有同步到最新 HP。
- 修复后，联机 2 人与 4 人场景里，对手头条血量都会按结算结果同步更新，不再卡在旧值。

## 测试用例

- 文件：`e2e/dicethrone-simple-start.e2e.ts`
- 用例 1：`Online 2-player Meteor: opponent header HP should sync after undefendable damage resolves`
- 用例 2：`Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2`
- 命令 1：

```bash
npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 2-player Meteor: opponent header HP should sync after undefendable damage resolves"
```

- 命令 2：

```bash
npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2"
```

## 截图证据

### 2 人联机结算后头条血量

![2 人联机 Meteor 结算后头条血量](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-2-player-Meteor-opponent-header-HP-should-sync-after-undefendable-damage-resolves/03-two-player-meteor-opponent-hp-synced.png)

人工观察：

- 顶部唯一对手头条血量显示 `46`，没有停留在初始 `50`。
- 左侧自己的生命仍是 `50`，说明这不是整页重绘异常，而是目标头条血量已按结算结果单独更新。
- 结算后右侧主操作区和顶部头条都仍正常渲染，未出现“血量文本不变但其他 UI 已推进”的冻结错位。

### 结算后头条血量

![四人 2v2 Meteor 结算后头条血量](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-4-player-allOpponents-Meteor-collateral-only-hits-enemies-in-2v2/11-four-player-meteor-all-opponents-resolution.png)

人工观察：

- 顶部第 1 个敌方头条显示 `46`，顶部第 2 个队友头条显示 `50`，顶部第 3 个敌方头条显示 `44`；与该场景的目标伤害分布一致，敌方头条不是停留在初始 `50`。
- 左侧自己的生命仍为 `50`，说明不是整套 HUD 没刷新，而是各玩家血量按各自结算结果独立更新。
- 顶部三条头条都仍在正常渲染，未出现“伤害已结算但血量文本卡在旧值”的视觉冻结现象。

## 根因判断

- 服务端领域层 `src/games/dicethrone/domain/reduceCombat.ts` 会直接把 `core.players[*].resources.hp` 扣减到新值。
- 传输层 `src/engine/transport/server.ts` 会把 playerView 后的状态继续广播给客户端；本轮 E2E 中 harness 读到的服务端/客户端状态都已变成正确 HP。
- 真正风险点在客户端 `src/games/dicethrone/Board.tsx` + `src/games/dicethrone/hooks/useAnimationEffects.ts`：
  UI 会先冻结 HP，等特效 `impact` 时再释放。若某个特效直接 complete、未触发 impact，或 FX 根本没 push 成功，旧实现都可能把血量卡在冻结值。

## 本轮修复

- `src/games/dicethrone/Board.tsx`
  - 在 `FxLayer.onEffectComplete` 中增加兜底释放：若该 FX 仍持有 HP buffer 映射，则在 complete 时释放并清理，避免旧血量永久冻结。
- `src/games/dicethrone/hooks/useAnimationEffects.ts`
  - 当某个 FX 因未注册或被跳过而没有成功 push 时，立即释放对应 buffer，避免“动画没播，血量却还被冻结”。
- `src/games/dicethrone/ui/OpponentHeader.tsx`
  - 为顶部头条 HP 文本补充稳定的 `data-testid`，方便联机 E2E 直接断言对手血量文本。
- `e2e/dicethrone-simple-start.e2e.ts`
  - 为现有四人联机场景补充顶部头条 HP 文本断言，覆盖“状态对了但 UI 没掉血”的回归。
  - 新增 2 人联机场景断言，覆盖最常见的 1v1 对手头条血量同步。

## 剩余优化点

- 可以把“FX complete/skip 兜底释放”下沉为更通用的视觉缓冲约束，避免以后别的数值缓冲也重复踩同类坑。
- 如果后续用户还反馈“偶发卡血”，下一步应抓浏览器端 `fxBus.push` 返回 `null` 的实际原因，看是未注册、被 debounce，还是 DOM 引用为空导致渲染器立即结束。
