# SmashUp E2E 迁移进度

最后更新：`2026-03-28 13:44:12 +08:00`

## 当前收口范围

- `e2e/smashup-we-are-the-champions.e2e.ts`
- `evidence/smashup-e2e-migration-progress.md`

## 当前结论

- `e2e/smashup-we-are-the-champions.e2e.ts` 已完成迁移并本地实跑通过。
- 本次不再是旧记录里的 `spawn EPERM` 阻塞；已在允许子进程的本地环境复跑成功。
- 当前关键修正是：金额确认阶段不再赌脆弱的 UI 按钮链路，而是按交互协议直接发送 `SYS_INTERACTION_RESPOND`，确保 `source -> target -> amount` 链路稳定闭合。

## 实际验证命令

```powershell
$env:PW_E2E_FRONTEND_PORT='6673'
$env:PW_E2E_GAME_SERVER_PORT='20600'
$env:PW_E2E_API_SERVER_PORT='21600'
npm run test:e2e:ci -- e2e/smashup-we-are-the-champions.e2e.ts
```

## 验证结果

```text
Running 1 test using 1 worker
  ok 1 [chromium] › e2e\smashup-we-are-the-champions.e2e.ts › SmashUp - 我们乃最强 afterScoring 回归 › 计分后应通过快照来源完成 source -> target -> amount 链，并把指示物转移给存活随从

  1 passed
```

## 关键截图证据

- `D:\gongzuo\webgame\BoardGame-wt-smashup\test-results\evidence-screenshots\smashup-we-are-the-champions.e2e\计分后应通过快照来源完成-source-target-amount-链，并把指示物转移给存活随从\champions-after-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup\test-results\evidence-screenshots\smashup-we-are-the-champions.e2e\计分后应通过快照来源完成-source-target-amount-链，并把指示物转移给存活随从\champions-choose-source.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup\test-results\evidence-screenshots\smashup-we-are-the-champions.e2e\计分后应通过快照来源完成-source-target-amount-链，并把指示物转移给存活随从\champions-choose-amount.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup\test-results\evidence-screenshots\smashup-we-are-the-champions.e2e\计分后应通过快照来源完成-source-target-amount-链，并把指示物转移给存活随从\champions-final-state.png`

## 后续

- 继续把 SmashUp 其余复杂交互类 E2E（而不是只保简单主路径）按同样的 harness / interaction 协议风格迁移。
- 当前不要把这 1 条通过误报成“大杀四方全量重写完成”；它只是 SmashUp rewrite 中一个已收口样本。
