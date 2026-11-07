# 房间揭示与立即放置（进行中）

## 已锁规则与交互合同

官方第三版 `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md` 印刷 p12–13（681–786行）：选未探索门，按背面匹配区域，翻正面，旋转并连接原门，放置进入，结算房间文字再抽符号牌。不能翻后取消/换门；用户进一步确认必须立即选择放置。区域耗尽不扣移动、不结束回合；封死区域的既有重抽/最小板块调整策略保持。

圣符卡面合同 `evidence/betrayal/betrayal-discovery-effect-audit-2026-07-02.md:160` 允许看到当前牌后埋葬并替换。替换仍绑定原门，不可反向恢复第一张。保留现有次数/持有时点限制，本轮不改其尚未完整复核的卡面特殊行动图标合同。雕像、叛徒跳事件继续用原放置后的正式选择；7号作祟特例保留。

第一入口仍为地图上的未探索门；沿用当前放置面板、朝向选择与确认按钮，不增加第二套弹层。首次点门提交 REVEAL_ROOM；服务端 pendingRoomPlacement 保存操作者、门及已揭示结果。此时禁止移动、换门、结束、撤销；只可合法圣符替换或 EXPLORE_ROOM 完成放置。刷新/断线不是取消，重连重建同一面板。无关闭取消入口。确认前不消耗移动、不进入、不执行房间效果、不抽符号牌；确认成功沿原结算链。

## 单一 owner 与消费者

- 新 roomRevealModel：揭示状态、合法揭示校验、锁定、公开投影。game.ts 仅命令/事件接线。
- roomDiscoveryModel：原绘制/旋转/调整几何与抽取算法保持；待放置时只消费锁定结果。
- Board/previewStateModel/roomPlacementSurface：消费服务端 pending 恢复显示，不本地预测牌堆。
- AI、教程脚本、规则测试便利入口：显式执行两阶段，不保留生产一阶段旁路。
- UndoSystem：仅新增 opt-in 的事件历史屏障；小黑屋在揭示和放置时启用，清理旧快照与 pending request，不影响其它游戏默认规则。
- player/spectator、transport sync/update/patch：无未抽房间牌堆；areaMismatch 不公开正面身份；已翻正面的 sealedRegion/holySymbol 可公开。权威状态不被投影修改。

## 验证计划与边界

先 RED：直接一阶段放置被拒、两阶段锁门/权限/非法朝向、圣符不可反转、耗尽不扣移动、撤销不能跨揭示；再真实生产投影 sync/update/patch/重连、Board 关闭/换门/旋转/确认代表链。扩展现有相关回归，类型与 lint。真实 Mongo 18项未执行且不重试；无推送、部署、上传。浏览器截图和全 HTTP/Mongo E2E 不由组件测试替代。

## 实装发现与修正（保留首轮失败）

- `room-reveal-red.log`：两条正式 pipeline 回归首次均失败，旧版允许绕过揭示，且没有 REVEAL_ROOM。
- `room-reveal-regression-first.log`：77文件1483通过/39失败。失败均先核原断言和真实路径，旧取消换门/预览读取隐藏堆被规则合同明确替换；其余 placement 专项测试显式先运行真实揭示，未恢复生产一阶段旁路。
- 独立复核确认 AI 曾耗尽循环，直接查隐藏堆修法又会令 playerView AI 无法探索。改为公开楼层数量，真实 localRunner 与在线 immediate executor 分别执行 REVEAL_ROOM → EXPLORE_ROOM；耗尽不重复请求。公开计数不包含顺序或身份。
- 旧楼层池首次规范化复用 legacy discoveredCount 偏移；cloneCore 保留缺失堆的 legacy 身份，不提前补错误顺序。测试同时覆盖空数组/缺字段、当前楼层与未抽其它楼层。
- 教程 checkpoint 是独立恢复入口，已复现隐藏堆透传和跨揭示回退。Betrayal 单独系统注册在线教程命令门禁；传输移除检查点；本地回退目标须同一揭示序号，揭示和完成放置分别递增。其它游戏 TutorialSystem 默认行为未改。Betrayal 教程 revision 升级，旧本地放置步不继续套用一阶段合同。
- 内置教学 manifest 的确定性 setup fixture 是源码已有公开教学数据，仍可能出现在 active tutorial 的脚本字段。没有声称清洗任意教程所有嵌套字段；受保护对象为在线随机权威牌堆、隐藏检查点和其回滚旁路。
- Undo 事件屏障同时清空 snapshots、snapshotCursors、pending request 与 restored cursor；拒绝的命令不改变历史。共享默认 undo 回归保留。

最终回归、类型/lint 与本地完整恢复校验以同目录外 reports/FINAL-VALIDATION.txt 最新顶部记录为准。本文件不是已部署或完整浏览器验收证明。
