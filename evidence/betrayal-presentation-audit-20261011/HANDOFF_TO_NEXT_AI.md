# 山中小屋第三版｜小黑屋表现差距实玩交接包

## 任务边界

- 只分析《山中小屋》第三版的小黑屋（Betrayal）表现差距。
- 不改 `src/`、不改 OpenSpec、不提交、不发布。
- 不抄对方配色、字体、墨线素材或整体皮肤。
- 直选移动、点 `?` 自动探索、dock 不作为移动/探索入口、Skip 只属于“你的回合”片头，这些已锁定。
- 本轮按要求没有打开声音；不要把声音写成已听感验证，只能引用资源包 cue 作为提案线索。

## 真实实玩进度

- 入口：`https://yuanyigames.top/` → 单人模式 → 新的冒险。
- 真实推进到第 6 轮。
- 已完成：多格移动、目的地预览/确认、`?` 探索、发现新房间、旋转/放置/确认、事件卡、理智/敏捷检定、伤害骰、预兆、灾厄揭露、叛徒/英雄阶段。
- 已完成英雄攻击：阮丹用十字弓攻击保安机器人 2，敏捷 `3 对 6`，没打中，阮丹不受伤。
- 已完成怪物组：机器人 1 追击并攻击斯蒂芬妮，机器人 2 追击并攻击阮丹；两次都进入 VS、骰子、伤害结算和伤害分配。
- 已交回第 6 轮斯蒂芬妮回合；当前地图上可见多个发光 `?`。
- 随后重新重演了一条可见攻击链：斯蒂芬妮攻击保安机器人 1，VS 画面后机器人掷出 10、斯蒂芬妮为 0，结算显示 `−10` 与“反击成功！斯蒂芬妮受到 10 点物理伤害”。浏览器标签已停在该结算画面。

## 关键攻击证据

这些截图在原对话中以浏览器截图形式保留：

- `shot45`：英雄攻击选择层。
- `shot47`：英雄与机器人完整 VS 对决。
- `shot49`：骰子结果与“没打中”结论。
- 机器人 1 → 斯蒂芬妮：VS、力量 `7 对 2`、`−5` 伤害、伤害分配层。
- 机器人 2 → 阮丹：VS、力量 `9 对 2`、`−7` 伤害、伤害分配层。
- 最新重演：斯蒂芬妮 → 保安机器人 1：VS、力量 `0 对 10`、`−10` 伤害结算。

注意：这些攻击关键帧目前是“对话内截图”，不是本地 JPG，也不是视频录屏。内置浏览器接口没有直接导出截图文件的接口。

## 本地证据

- 差距表：[gap-table.md](D:/gongzuo/webgame/BoardGame/evidence/betrayal-presentation-audit-20261011/gap-table.md)
- 证据说明：[README.md](D:/gongzuo/webgame/BoardGame/evidence/betrayal-presentation-audit-20261011/README.md)
- 移动 GIF：[fresh-move-confirm.gif](D:/gongzuo/webgame/BoardGame/evidence/betrayal-presentation-audit-20261011/fresh-move-confirm.gif)
- 移动帧：`fresh-move-00-before.jpg` 至 `fresh-move-08-620ms.jpg`
- 怪物组稳定帧：[shot51-monster-group-current.jpg](D:/gongzuo/webgame/BoardGame/evidence/betrayal-presentation-audit-20261011/shot51-monster-group-current.jpg)
- 若目录里出现 `attack-live-00-vs.jpg`，请忽略；它不是对局截图，不纳入证据。

## 本轮临时媒体目录

- `D:/gongzuo/webgame/BoardGame/evidence/temp/betrayal-presentation-audit-20261011/`
- `03-attack-vs.png`：攻击 VS 等待掷骰。
- `04-attack-result.png`：攻击结算，机器人 10、斯蒂芬妮 0、负 10 伤害。
- `05-attack-sequence.gif`：以上两帧组成的短攻击动图。
- 查看器：`http://127.0.0.1:4867/?key=dbcb01708ae0`

## 交给下一个 AI 时直接粘贴

请阅读以下交接包并继续工作：

1. 先读 `D:/gongzuo/webgame/BoardGame/evidence/betrayal-presentation-audit-20261011/gap-table.md` 和 `README.md`。
2. 不要改代码、OpenSpec、分支或提交。
3. 不要重做已完成的移动、探索、攻击实玩；把攻击截图视为原对话内证据，不能声称有本地攻击录屏。
4. 如果需要继续实玩，只做视觉交互证据，声音保持关闭。
5. 重点补：逐格移动 hop、路径预览、落点反馈、房间淡出/入场、光雾、回合片头/skip、怪物逐格走子是否有真实视觉证据。
6. 最终继续维护 `gap-table.md`，每条写“对方做什么 / 我方现在做什么 / 吸收？ / 依据”。
7. 把攻击结论写成“已有对话截图证据，无本地录屏”，不要误报为未实玩。
