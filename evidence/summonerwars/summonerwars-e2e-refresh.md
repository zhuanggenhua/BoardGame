# Summoner Wars E2E 重写记录

## 本次范围

- 只处理 Summoner Wars 的 E2E 重写与其所需的稳定定位点。
- 不碰主仓移动端适配任务，不碰其他 worktree。

## 已完成改动

- 为阵营选择页补充稳定 `data-testid`：
  - `sw-faction-selection`
  - `sw-faction-card-<factionId>`
  - `sw-player-status-<playerId>`
  - `sw-faction-ready`
  - `sw-faction-unready`
  - `sw-faction-start`
  - `sw-custom-deck-entry`
- 为棋盘补充更直接的定位属性：
  - `data-cell-coord`
  - `data-unit-id`
  - `data-structure-id`
- 收敛 `e2e/helpers/summonerwars.ts` 中的可复用定位与联机建局辅助。
- 重写目标用例：
  - `e2e/summonerwars/summonerwars-selection.e2e.ts`
  - `e2e/summonerwars/summonerwars-push-pull-direction.e2e.ts`

## 目标覆盖

- 联机主流程：
  - 创建房间
  - 双方进入阵营选择
  - Host/Guest 选择阵营
  - Guest ready
  - Host start
  - 进入正式对战
- 机制回归：
  - `telekinesis` 攻击后将目标推到指定合法格
  - 对手视角同步看到同一落点
- UI 稳定性：
  - 非当前玩家的 `sw-end-phase` 禁用
  - `sw-action-banner` 显示等待对手

## 本地验证

- 已执行：`npm run check:encoding`
  - 结果：通过
- 已执行：`npx eslint e2e/helpers/summonerwars.ts e2e/summonerwars/summonerwars-push-pull-direction.e2e.ts e2e/summonerwars/summonerwars-selection.e2e.ts src/games/summonerwars/ui/BoardGrid.tsx src/games/summonerwars/ui/FactionSelectionAdapter.tsx scripts/infra/e2e-port-config.js`
  - 结果：无 error
  - 备注：仅剩仓库既有 warning，集中在 `BoardGrid.tsx` 和 `FactionSelectionAdapter.tsx` 的旧问题，不是这次重写新引入的错误
- 已执行：`npx tsc --noEmit --pretty false`
  - 结果：通过
- 已执行：`npm run test:e2e:ci -- e2e/summonerwars/summonerwars-selection.e2e.ts`
  - 结果：失败
  - 阻塞：当前环境禁止 `child_process spawn`，报错 `spawn EPERM`

## 阻塞结论

- 当前沙箱无法启动：
  - Playwright worker
  - E2E 三服务
  - 依赖子进程的端口清理与 bundle runner
- 因此本次无法在此环境生成真实 E2E 证据截图。
- 当前沙箱也无法完成 Git 提交：
  - `git rev-parse --git-dir` 指向 `D:/gongzuo/webgame/BoardGame/.git/worktrees/BoardGame-wt-summonerwars`
  - 提交时需要写入该目录下的 `index.lock`
  - 该路径位于 worktree 外，当前权限下报错 `Permission denied`

## 截图产物

- 当前环境未生成真实截图。
- 在允许子进程的本地终端或 CI 中重跑后，显式证据截图应落在：
  - `test-results/evidence-screenshots/summonerwars/summonerwars-selection/`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-push-pull-direction/`
