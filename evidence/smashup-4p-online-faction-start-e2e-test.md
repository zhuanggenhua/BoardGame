# Smash Up 四人联机开局 E2E 证据

## 测试命令

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-online-faction-start.e2e.ts "四人联机可完成全部派系选择并让四个页面都进入对局"
```

结果：通过

## 关键截图与观察

### 1. 第四位玩家开始第二轮选派系前
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-4p-online-faction-last-player-first-pick.png`
- 我实际看到：页面还停留在派系选择阶段，底部四个玩家卡里 `P4` 高亮，前三位玩家已经各自占走了对应派系，未轮到当前玩家的派系卡显示锁定遮罩。
- 是否达到验收标准：达到。这张图证明四人房没有在中途卡死，选派系流程确实推进到了第四位玩家。

### 2. 房主进入正式对局
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-4p-online-faction-game-start-host.png`
- 我实际看到：房主页面已经离开派系选择页，进入正式棋盘；顶部显示 `你自己 / 出牌阶段`，右上角记分板有四名玩家，底部手牌区已发到手牌。
- 是否达到验收标准：达到。这张图证明最后一位玩家完成选择后，房主端真实进入了四人对局，不是只停在房间或加载页。

## 自动断言摘要

- 真实走了四人建房、3 个 guest 加入、8 次派系确认、4 个页面全部入局。
- 4 个页面都通过 `su-hand-area` 可见性校验。
- 最终状态里 `playerCount = 4`，`factionSelection` 已清空。
- 最终四名玩家派系分别为：
  - `0`: `aliens`, `pirates`
  - `1`: `ninjas`, `dinosaurs`
  - `2`: `robots`, `zombies`
  - `3`: `wizards`, `tricksters`

## 本轮反思

- 本轮中途失败不是根规范缺失，而是旧证据 `evidence/smashup-sequential-faction-selection.md` 与当前实现不一致，容易把选派系顺序误判成“顺序选秀”。
- 当前代码与实际运行结果一致采用蛇形顺序：`0 → 1 → 2 → 3 → 3 → 2 → 1 → 0`。
- 这类信息更适合落在专项证据或游戏规则文档里，不应直接上升成根 `AGENTS.md` 新规范。
