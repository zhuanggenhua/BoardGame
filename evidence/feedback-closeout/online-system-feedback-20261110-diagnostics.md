# 线上系统反馈诊断（2026-11-10）

本记录是线上真实反馈的诊断与本地验证，不代表已部署。

## 游戏服务 CPU 报警

- 反馈 `6af0326955e295b6642f9f61`：`[system][infra-cpu-watch] environment=production host=iZn4a2rxxj7cvcamv233nvZ game-server CPU sustained high: average=88.28% highSamples=3/3 threshold=80% decision=restarted restarted=yes`。
- 生产机对应采样 `20261108T082616Z-boardgame-game-server.cpuprofile`：总采样约 8.6 秒，其中约 6.9 秒非 idle；沿调用栈归集状态广播约 2.9 秒、在线 AI 合法动作恢复约 1.9 秒，二者有嵌套，不可相加。直接热点包括视图序列化约 1.26 秒、差量计算约 1.01 秒、垃圾回收约 0.84 秒。这是该采样窗口的耗时，不证明是哪一个房间或循环造成持续高 CPU。
- 实际代码中 `stripStateForTransport` 已深拷贝玩家视图，广播末尾又复制同一份视图作为差量缓存。本地移除第二次复制，并将内部广播函数收回模块内；使用历史回放的状态、去除撤回快照后的微基准，100 轮单次复制 166 ms、双次复制 273 ms。这个微基准不等于线上 CPU 降幅。
- `transportStateSynchronizer.test.ts`、`patch.test.ts`、`patch-integration.test.ts` 共 59/59 通过，覆盖差量、断线和注入、玩家与观战视图、缓存与权威状态隔离。集成夹具此前缺少正式系统状态的 `undo` 字段，原实现下也失败；本轮改用系统状态初始化入口后通过。
- 仍缺触发该负载的房间、请求和动作循环关联。报警记录保持 open；此改动是局部开销优化，不称原报警已解决。

## “我又行了”骰子选择错误

- 反馈 `6aedeb8455e295b6642f8ca8`：`[auto][board-render-error] [DiceThrone] Invalid current die selection: dt-dice-select-card-i-can-again-1793977204850`。
- 私密回放是确认后的权威状态；撤回快照包含之前的主要阶段及随机游标。日志显示对手打出「我又行了」、当前玩家选择三颗骰子，随后服务端完成三次重掷并确认。用该撤回点恢复并重建对手出牌，测试中人为保留本地选择，同时注入第一颗骰子已重掷的中间态，可以触发相同异常；这只证明该中间态会触发异常，不能单独证明当时客户端确实收到该中间态。
- 当前代码的多命令批次禁止逐条广播，只在批次末广播。真实浏览器中以线上撤回点重建该身份和骰面，选择同三颗骰并确认，当前测试未复现报错，结果骰值正确、交互关闭；随机数在重建阶段恢复游标，浏览器后续重掷按历史结果注入，不等同于完整历史随机流回放。反馈保持 open，待进一步确定线上原始触发机制。

## 加载与界面报错

- `6af0dd4355e295b6642fa6a2`、`6aeddc1c55e295b6642f8ae5` 报 `Unable to preload CSS for /assets/HomeEntry-uYa2FQtX.css`；`6af0001355e295b6642f9c18`、`6aefbcf855e295b6642f9aaf` 报 `Unable to preload CSS for /assets/GameRulesDocumentLink-49og3kNy.css`。当前服务器对两个路径均返回 HTTP 200 和 CSS 类型；历史失败请求的状态码和网络原因未记录，不能据此认定根因或已修复。
- `6af1cc8a55e295b6642fadc7` 报 `Cannot read properties of undefined (reading 'activeTools')`。代码中该字段的直接消费点位于《The Gang》的 `ToolsPanel`，但报告未记录房间、玩家或状态，私密回放未附带；现有证据不足以确定哪种真实入口导致本地玩家缺失，未做猜测性修补。
