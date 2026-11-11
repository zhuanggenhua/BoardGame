# 大杀四方无限循环命令失败

- 反馈原文：`[system][player-command-failure] SYS_INTERACTION_RESPOND pipeline_error`；线上 ID `6af343a4d6dc65a125d2b611`。
- 私密回放处于 `playCards`，当前交互是 `geeks_non_infinite_loop_action`。恢复状态并选行动牌后重现 `processedKeys.has is not a function`；跳过可通过。复现使用测试随机源，没有声称还原后续随机流。
- 原因：上个命令的临时去重 Set 留在系统状态中，序列化后变为普通对象；下一命令未清理而当作 Set 使用。
- 修改：在大杀四方事件系统的 `beforeCommand` 清理该临时字段，同一命令多轮仍共享去重集合。私密现场重放选牌成功并进入回手选择，跳过成功；`abilities/geeks.test.ts` 的 37 项通过，包括新增 JSON 往返回归，修复前该回归复现同一异常。
- 边界：领域管线验证，未进行浏览器回放或生产部署；不能外推其他交互故障。
