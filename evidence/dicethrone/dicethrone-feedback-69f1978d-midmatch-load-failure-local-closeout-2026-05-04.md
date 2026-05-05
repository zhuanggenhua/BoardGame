# Dice Throne 反馈 69f1978d 本地验收收口说明（2026-05-04）

## 反馈原文

- `游戏中途加载失败`

线上反馈对应：

- feedbackId：`69f1978dab54eadcc2bb24b0`
- gameId：`dicethrone`
- route：`/play/dicethrone/match/xTmtJWSjiPg?playerID=0`
- appVersion：`production`

## 线上现场缺失情况

这条反馈比同日其它加载失败记录弱：

- 无 `stateSnapshot`
- 无 `errorContext`
- 无同局系统反馈

因此无法像普通规则/交互 bug 那样精确回放原现场。

## 明确的推断依据

以下判断是**基于现有证据的推断**：

- 同一天（`2026-04-29`）DiceThrone 已有两条已收口的同类加载失败：
  - `69f1f938ab54eadcc2bb2ab5`：`游戏加载失败`
  - `69f1f943ab54eadcc2bb2ab8`：`游戏加载失败 / Cannot access 'rt' before initialization`
- 这两条已经定位到全局 HUD 社交弹窗链的循环导入 TDZ，不是 DiceThrone 规则链问题：
  - 证据：`evidence/dicethrone/dicethrone-feedback-69f1f943-match-load-tdz-social-cycle-local-closeout-2026-04-29.md`
- `69f1978d...` 同样只表现为路由级“游戏中途加载失败”，没有任何领域态、交互态或 watchdog 现场特征。
- 由于该问题的已知根因是**全局**懒加载 HUD chunk 初始化失败，它本来就可以跨任意对局路由触发，不依赖某个特定 matchId。

## 本地验证

已重新通过同一修复簇的两条关键验证：

1. `node scripts/infra/vitest-cli-safe.mjs run src/components/social/__tests__/chatSelectionLogic.test.ts --configLoader native`
   - 结果：`14 passed`
   - 其中 `FriendList 与 FriendsChatModal 可同时导入，不应通过常量互相形成初始化环` 通过。
2. `npm run build`
   - 结果：构建成功。
   - 当前生产构建链路下未再出现该 TDZ 修复簇对应的初始化失败。

## 收口结论

- 按当前任务口径，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 这条反馈缺少可直接复盘的原现场，因此本条收口带有明确推断成分。
- 结合同日同游戏同类加载失败簇、全局 HUD 懒加载 TDZ 的已知全局性，以及当前本地回归与构建验证均通过，本条可按“高概率近重复 / 已修未回写”转 `resolved`。
