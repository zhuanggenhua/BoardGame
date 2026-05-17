# DiceThrone 四人 AI 空真人座位回归验证

## 范围

- 场景：DiceThrone 四人在线房间。
- 座位配置：P1 房主真人，P2 AI，P3 真人空位，P4 AI。
- 问题：进入加载/选角后不应因第三座无 AI 或 AI 座位凭据补领竞态自动退回大厅。

## 修复点

- `claim-seat` 对已经有凭据的座位改为幂等返回既有凭据。
- 这样创建房间后台 AI 占座与 MatchRoom 进入后的 AI 凭据补领即使并发，也不会互相覆盖同一个 AI 座位的凭据。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/server/__tests__/claimSeat.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 通过：3 tests。
- `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/CreateRoomModal.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 通过：8 tests。
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-four-player-ai-empty-seat.e2e.ts "四人房第三座保持真人空位时"`
  - 通过：1 test。

## 截图观察

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-four-player-ai-empty-seat\dicethrone-four-player-ai-empty-seat-still-in-match.png`
- 我实际看到：页面停在 DiceThrone 选英雄界面，没有跳回大厅。
- 我实际看到：P1 是“四人房房主”，P2/P4 标记为 AI，P3 显示真人空位。
- 我实际看到：底部仍显示“等待全员就绪”，符合第三座真人空位未加入时的预期状态。

## 结论

该回归证明“四人房第三座无 AI”不会被前端错误提交成 AI，也不会在当前修复后因 AI 座位重复 claim 覆盖凭据导致加载后自动退出。
