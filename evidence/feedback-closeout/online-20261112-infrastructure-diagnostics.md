# 线上系统反馈排查：CPU 与客户端错误

- CPU 原文：`[system][infra-cpu-watch] environment=production host=iZn4a2rxxj7cvcamv233nvZ game-server CPU sustained high: average=92.62% highSamples=3/3 threshold=80% decision=restarted restarted=yes`。生产监控在 2026-11-11 21:01–21:02（北京时间）采样 81.94%、104.52%、91.39%，重启后 21:03 三次采样为 40.65%、0.21%、1.23%；这是止血证据，不单独证明完整根因。
- 线上原始 V8 profile：`/home/admin/BoardGame/logs/game-server-cpu-watch/20261111T130103Z-boardgame-game-server.cpuprofile`，8 秒、4839 个样本，`FeedbackReplayCommandHistory.record` 自身 1486 个样本；调用链为成功命令处理中的反馈回放快照记录。此结果证明该函数是采样时显著热点，不证明它是高 CPU 的唯一原因或哪个房间导致。
- 本地优化：`src/engine/transport/feedbackReplayCommandHistory.ts` 将一条记录的命令参数和前后状态一起克隆，复用同一次克隆中真实共享的未变子树，仍完整保留前后状态及随机游标。`feedbackReplayCommandHistory.test.ts` 覆盖原状态后续修改、快照关联和私密回放归档；错误输入仍按原路径返回失败。
- 实测：从另一条骰子王座反馈的事故前私密状态执行真实跳过响应，取得该命令实际前后状态，在本机各克隆 20 次，原方案 119 ms，合并克隆 66 ms；这是该对局该命令的本地样本，不代表 CPU 告警现场房间的整体线上改善。本地未发布，CPU 原因仍未完整确认，反馈保持 open。
- 客户端原文：`[auto][window.error] undefined is not an object (evaluating 'a.tagName.match')`。来源 `client-window-error`，结构化包为 `unreplayable`，缺少 matchId、roomId、requestId、stateId、stateRevision、decisionEpoch、随机游标及前中后快照；未附私密回放和堆栈。上下文显示 393×694 视口、非游戏页面、弹窗打开，在一次 click 后约 27ms 报错，但没有记录具体弹窗和点击目标。记录中的源路径返回 SPA HTML，不能证明具体脚本归属；仓内源码未发现 `tagName.match`。目前无法将报错归因于项目代码或浏览器注入，也无法验证原始故障修复，反馈保持 open。
- 诊断链缺口：客户端向服务端提交 `errorContext.source`，但服务端入库投影仅保留固定来源名，文件位置丢失。本地新增正式站点构建 JS 的公开指纹与行列号安全投影；不保存 URL、查询参数、任意栈和玩家信息。管理员列表与详情支持显示该位置，API 集成测试覆盖写入和读取以及原始数据不落库。这改善今后符合格式的反馈，不恢复历史位置，也不保证浏览器一定提供位置；本地未发布。
