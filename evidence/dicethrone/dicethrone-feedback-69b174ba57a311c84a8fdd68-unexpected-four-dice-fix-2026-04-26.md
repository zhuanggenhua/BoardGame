# DiceThrone 反馈 69b174ba57a311c84a8fdd68 历史修复证据

> 2026-06-06 当前有效口径：本文只保留 `意不意外？！ / card-unexpected(any-2)` 本地多步交互越权改 4 颗骰子这一条历史反馈的专项修复证据，不代表 DiceThrone 全体改骰交互、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时 `selectCount` 下沉链被专项修补并做过回归，不能外推成 DiceThrone 当前总体收口。

- 反馈 ID：`69b174ba57a311c84a8fdd68`
- 游戏：`dicethrone`
- 反馈原文：`改了四个骰子`
- 对应卡牌：`card-unexpected`
- 规则基线：`Change any 2 dice to any values.`
- 结论：`可 resolved`

## 线上异常链还原

- 线上反馈快照与 action log 对上的是 `Shadow Thief` 的 `意不意外？！`，不是别的改骰卡。
- 关键线上链路是：
  - 对手先确认 `[6,6,6,6,6]`
  - 然后打出 `card-unexpected`
  - 该卡当前代码与规则都只允许“任意改 2 颗骰子”
- 我把异常继续下钻到本地多步交互层后，复现出修前缺口：
  - 旧 `diceModifyReducer(..., { mode: 'any' })` 不看 `selectCount`
  - 旧 `diceModifyToCommands(...)` 也不看 `selectCount`
  - 在本地连续喂 4 个不同骰子的 `setAny` 步骤时，修前会得到：
    - `modCount: 4`
    - `MODIFY_DIE` 命令数：`4`
- 这说明“改了四个骰子”不是误报，而是客户端本地交互预览/提交链确实能越过 `any-2` 上限。

## 根因

- 领域命令层本来就有上限保护：
  - 第 3 次正式 `MODIFY_DIE` 会被拒绝
  - 对同一颗已完成骰子的重复修改会被拒绝
- 真正缺口在客户端本地 hydration 后的多步交互层：
  - `selectCount=2` 只停留在交互 meta / 展示层
  - 本地 reducer 与 `toCommands` 没把这个上限作为硬约束
  - 结果就是 UI 可以在本地累计到第 3、4 颗骰子，随后一次性生成超限命令列表

## 最小修复

- 在 `src/games/dicethrone/domain/systems.ts` 与 `e2e/src/games/dicethrone/domain/systems.ts`：
  - 给 `diceModifyReducer` 增加 `maxSelectCount`
  - 当是新骰子且已到上限时，直接忽略该步
  - 仍允许在上限内重改已经选中的那 2 颗骰子
  - `diceModifyToCommands` 同步按 `maxSelectCount` 裁剪最终命令
- 在以下 hydration / 注入点把 `selectCount` 下沉到本地 reducer 和 `toCommands`：
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/RightSidebar.tsx`
  - `src/games/dicethrone/__tests__/test-utils.ts`
  - 以及对应 `e2e/src/games/dicethrone/**` 镜像文件
- 回归测试补在已有文件中，没有新建额外测试文件：
  - `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
  - `e2e/src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
  - `e2e/dicethrone/dicethrone-unexpected-card-interaction.e2e.ts`

## 验证记录

1. 单测 / 交互锁定回归
   - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native`
   - 结果：通过，`9 passed`
   - 覆盖点：
     - `afterRollConfirmed` 中打出 `card-unexpected` 会创建并锁住交互
     - 第 3 次 `MODIFY_DIE` 会被拒绝
     - 本轮新增回归：`card-unexpected 本地 any-2 预览不得累计到第 3/4 颗骰子`

2. 定向 E2E
   - 命令：`BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 PW_RUNTIME_SCOPE=feedback-69b174ba57a311c84a8fdd68-r6 PW_E2E_FRONTEND_PORT=6280 PW_E2E_GAME_SERVER_PORT=20107 PW_E2E_API_SERVER_PORT=21107 npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-unexpected-card-interaction.e2e.ts`
   - 结果：通过，`1 passed`
   - 覆盖点：
     - 真实 UI 点击 `card-unexpected`
     - 真实点击右侧两个 `+`
     - 真实点击确认后，交互收口且只改动 2 颗骰子

3. 复跑备注
   - 我在当前工作区又复跑了一次 Vitest，仍是 `9 passed`。
   - 当下再次复跑同一条 E2E 时，被仓库里的另一条 `smashup` 重任务门禁拦住；这不是本反馈失败，而是全局 Playwright 重任务已有占用。

## 关键截图（绝对路径）

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-feedback-69b174ba57a311c84a8fdd68-unexpected-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-feedback-69b174ba57a311c84a8fdd68-unexpected-settled.png`

## 我实际看到的现象

1. `unexpected-open.png`
   - 我能直接看到右侧改骰交互本体，包含 5 颗骰子的纵向面板与每颗骰子旁的 `+` 控件。
   - 右侧黄色提示明确写着“选择要修改的骰子”，说明 `card-unexpected` 的本地交互已经被正确拉起。
   - 这张图达到了“触发/特写出现”的验收标准。

2. `unexpected-settled.png`
   - 我能直接看到右侧黄色“选择要修改的骰子”提示已经消失，说明改骰交互已收口，不再停留在未完成状态。
   - 右侧骰列仍保留原本的 5 颗骰子展示，没有出现 4 颗一起被批量改写后的异常面板；界面重新回到可继续推进的主战斗视图。
   - 结合该用例的状态断言 `firstTwoDice: [2,3]`，可以确认本轮只提交了前两颗骰子的修改，没有把第 3/4 颗骰子一起带入结果。
   - 这张图达到了“关键操作后 UI/结果发生变化，并已回到可继续推进状态”的验收标准。

## 是否可 resolved

- 可以标记为 `resolved`。
- 依据：
  - 反馈对应的异常链已经明确还原到 `card-unexpected(any-2)` 本地多步交互。
  - 修复是最小范围，只把 `selectCount` 真正下沉到 reducer / `toCommands` / hydration 边界。
  - 现有回归文件已补测，定向 Vitest 通过。
  - 定向 E2E 已通过，且有实际截图证据证明交互出现与收口。

## 当前阅读说明

- 本文只覆盖 `card-unexpected(any-2)` 这一条改单骰交互链，不覆盖更广范围 DiceThrone 多步交互或新英雄整批完成态。
- 文中的 `resolved` 只代表当轮反馈链本地收口，不是当前 DiceThrone 总审计出口。
