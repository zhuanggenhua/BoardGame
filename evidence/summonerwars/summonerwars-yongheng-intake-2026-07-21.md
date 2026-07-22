# 召唤师战争永恒议会录入合同（2026-07-21）

## 全面审计自检表

| 项目 | 状态 | 证据 / 说明 |
| --- | --- | --- |
| 对象全集 | passed | 已确认 `cards.jpg` slot 0-10 有效，slot 11-15 为空白 |
| 规则子句表 | passed | 本文已按卡面录入原子子句；实现状态见“L2 机制矩阵” |
| 完整技能流程矩阵 | passed | 已补自动机制、主要交互机制、学习拿回对手事件、延续保留持续事件、跳过路径和无合法候选负例的 L2 证据 |
| L0/L1/L2/L3/L4 证据层级 | passed | L0/L1 与资源链 passed；L2 已覆盖永恒议会规则单测与 UI 合同测试；L3/L4 真实入口 E2E 7/7 passed，并已完成关键截图肉眼核验 |
| 框架消费合同矩阵 | passed | 已反查通用技能解析、主动事件充能、战力计算、回合结束触发、对手事件来源追踪、延续弃除前拦截和永恒议会交互消费 |
| 真实入口 E2E 与截图核验 | passed | `node scripts/infra/run-e2e-command.mjs default e2e/summonerwars/summonerwars-yongheng.e2e.ts` 通过 7/7，用例产出 19 张真实入口截图 |
| 残余范围声明 | passed | 永恒议会对象级 L0-L4 已收口；当前仅保留非本轮 Betrayal 资源根级 manifest 哈希不一致作为历史/环境基线债务，不计入永恒议会残余 |

## 真相源表

| 对象 | 主真相源 | 尺寸 / bytes | SHA-256 | 录入口径 |
| --- | --- | --- | --- | --- |
| 卡牌图集 | `public/assets/i18n/zh-CN/summonerwars/hero/yongheng/cards.jpg` | 8088x1454 / 1,372,856 | `9D8D7D269E252078DDDBB5527F27B099A5E72A98C60B2220574B0D364E7B0037` | 8x2 横向图集，单格 1011x727 |
| 召唤师 | `public/assets/i18n/zh-CN/summonerwars/hero/yongheng/hero.png` | 1269x929 / 2,583,575 | `B246838720C39409B537E74184BB55D6D04256E656FE4498020C00F1BE53041A` | 单张召唤师图 |
| 提示板 | `public/assets/i18n/zh-CN/summonerwars/hero/yongheng/tip.jpg` | 786x562 / 242,959 | `64D48AEE3BC19702DE8E0F49367961A2D851FA50624DDB901AA1F410C0B55196` | 起始布置和史诗事件数量 |

## 切图表

| 裁图 | 来源坐标规则 | 对应对象 | 可读性 |
| --- | --- | --- | --- |
| `temp/summonerwars-yongheng-intake/card-slot-00.jpg` | row 0 col 0 | 学习 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-01.jpg` | row 0 col 1 | 城塞参谋 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-02.jpg` | row 0 col 2 | 心灵骑士 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-03.jpg` | row 0 col 3 | 主管玛鲁娜 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-04.jpg` | row 0 col 4 | 远古学者 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-05.jpg` | row 0 col 5 | 洞察 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-06.jpg` | row 0 col 6 | 主管奥维 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-07.jpg` | row 0 col 7 | 探寻 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-08.jpg` | row 1 col 0 | 主管卡图 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-09.jpg` | row 1 col 1 | 心念侵袭 | locked |
| `temp/summonerwars-yongheng-intake/card-slot-10.jpg` | row 1 col 2 | 玄谜贤者 | locked |
| `temp/summonerwars-yongheng-intake/cards-contact.jpg` | 8x2 总览 | 槽位核对 | locked |

## 可视合同表

| slotId | 图上对象 | 运行时对象 | 允许状态 | 是否可交互 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 0 | 学习 | `yongheng-learning` | active event | 可打出 | 传奇事件，魔力阶段，持续，放置 2 充能 |
| 1 | 城塞参谋 | `yongheng-fortress-advisor` | unit | 可召唤/移动/攻击 | 士兵，远程，1 战力，3 生命 |
| 2 | 心灵骑士 | `yongheng-psychic-knight` | unit | 可召唤/移动/攻击 | 士兵，近战，2 战力，4 生命 |
| 3 | 主管玛鲁娜 | `yongheng-supervisor-maruna` | unit | 可召唤/移动/攻击 | 英雄，近战，5 战力，8 生命，费用 3 |
| 4 | 远古学者 | `yongheng-ancient-scholar` | unit | 可召唤/移动/攻击 | 士兵，近战，1 战力，2 生命 |
| 5 | 洞察 | `yongheng-insight` | active event | 可打出 | 普通事件，召唤阶段，持续 |
| 6 | 主管奥维 | `yongheng-supervisor-ovi` | unit | 可召唤/移动/攻击 | 英雄，远程，4 战力，6 生命，费用 2 |
| 7 | 探寻 | `yongheng-search` | active event | 可打出 | 普通事件，召唤阶段，持续 |
| 8 | 主管卡图 | `yongheng-supervisor-katu` | unit | 可召唤/移动/攻击 | 英雄，远程，6 战力，10 生命，费用 2 |
| 9 | 心念侵袭 | `yongheng-mental-invasion` | active event | 可打出 | 普通事件，召唤阶段，持续 |
| 10 | 玄谜贤者 | `yongheng-mystery-sage` | unit | 可召唤/移动/攻击 | 士兵，远程，2 战力，4 生命，费用 3 |
| 11-15 | 空白槽 | 无 | empty | 不可交互 | 不生成卡牌，不进入卡池 |

## 核对合同表

| 状态 | 实体标识 | 类别 | 原始名称 | 数值 / 阶段 | 原始文本 | 结构化字段 / 子句 |
| --- | --- | --- | --- | --- | --- | --- |
| locked | `yongheng-summoner` | 召唤师 | 大议长艾迪雅 | 远程；3 战力；13 生命 | 动能虹吸：每回合一次，在本单位攻击一个敌方单位或被一个敌方单位攻击之后，将本单位充能。延续：当你将要弃除一个持续事件时，你可以消耗 2 点充能以将该事件保留在场上。 | C1 攻击后或被攻击后每回合一次充能；C2 友方持续事件将被弃除时可消耗 2 充能保留 |
| locked | `yongheng-learning` | 传奇事件 | 学习 | 魔力阶段；0 费用；持续 | 将 2 点充能放置到本事件上。每次在对手打出的事件被弃除之后，如果可能，从本事件上移除 1 点充能。如果你这样做，将被弃除的事件加入你的手牌。当本事件被弃除时，将本事件上所有充能移动到你的召唤师上。 | C1 打出时放置 2 充能；C2 对手事件被弃除后可移除 1 充能拿回该事件；C3 本事件被弃除时转移全部充能到召唤师 |
| locked | `yongheng-fortress-advisor` | 士兵 | 城塞参谋 | 远程；1 战力；3 生命；费用 2 | 情报：在本单位移动之后，你可以抓取一张卡牌。警告：在本单位攻击一个敌方单位之后，你可以从你的手牌选择一张卡牌放置到你的牌库底部以将你的召唤师推拉 1 个区格。 | C1 移动后可抓 1；C2 攻击敌方后可把 1 手牌放到牌库底；C3 若如此做，推拉召唤师 1 格 |
| locked | `yongheng-psychic-knight` | 士兵 | 心灵骑士 | 近战；2 战力；4 生命；费用 2 | 唤起恐惧：如果一个敌方单位移动结束时和本单位相邻，则如果可能，对手必须从其手牌弃除一张卡牌。冲撞：在本单位攻击一个相邻敌方士兵或英雄之后，你可以将该单位推拉 1 个区格。 | C1 敌方移动结束相邻时强制弃 1；C2 攻击相邻敌方士兵/英雄后可推拉目标 1 格 |
| locked | `yongheng-supervisor-maruna` | 英雄 | 主管玛鲁娜 | 近战；5 战力；8 生命；费用 3 | 惩戒：在一个敌方单位被召唤到本单位 2 个区格以内的任意区格之后，如果可能，对手必须从其手牌弃除一张卡牌。 | C1 敌方单位召唤至 2 格内后强制弃 1 |
| locked | `yongheng-ancient-scholar` | 士兵 | 远古学者 | 近战；1 战力；2 生命；费用 3 | 智慧：在召唤本单位之后，你可以抓取一张卡牌。分析：在本单位攻击一个敌方单位之后，你可以抓取一张卡牌。 | C1 召唤后可抓 1；C2 攻击敌方后可抓 1 |
| locked | `yongheng-insight` | 普通事件 | 洞察 | 召唤阶段；0 费用；持续 | 每当你抓取一张或更多卡牌时，将本事件充能。本事件每有 1 点充能，则你的召唤师获得战力 +1，至多为 +5。 | C1 每次抓牌后本事件 +1 充能；C2 召唤师按充能获得 +1 战力，最多 +5 |
| locked | `yongheng-supervisor-ovi` | 英雄 | 主管奥维 | 远程；4 战力；6 生命；费用 2 | 谋划：你每拥有两张手牌，则本单位获得战力 +1。 | C1 每 2 张手牌 +1 战力 |
| locked | `yongheng-search` | 普通事件 | 探寻 | 召唤阶段；0 费用；持续 | 在你的移动、建造和攻击阶段开始时，你可以抓取一张卡牌。 | C1 己方移动阶段开始抓 1；C2 己方建造阶段开始抓 1；C3 己方攻击阶段开始抓 1 |
| locked | `yongheng-supervisor-katu` | 英雄 | 主管卡图 | 远程；6 战力；10 生命；费用 2 | 坚毅：在你的回合结束时，如果你的牌库已经耗尽，则将本单位充能。力量强化：本单位每有 1 点充能，则获得战力 +1，至多为 +5。 | C1 回合结束且牌库为空则充能；C2 按充能 +1 战力，最多 +5 |
| locked | `yongheng-mental-invasion` | 普通事件 | 心念侵袭 | 召唤阶段；0 费用；持续 | 每当你在自己的回合中抓取一张或更多卡牌时，你可以指定你的召唤师 2 个区格以内的一个敌方士兵或英雄为目标。对目标造成 1 点伤害。 | C1 己方回合抓牌后可选召唤师 2 格内敌方士兵/英雄；C2 对目标造成 1 伤害 |
| locked | `yongheng-mystery-sage` | 士兵 | 玄谜贤者 | 远程；2 战力；4 生命；费用 3 | 运用：在本单位攻击一个敌方单位之后，你可以从你的手牌选择一张卡牌放置到你的牌库底部以指定一个相邻单位为目标。对目标造成 1 点伤害。 | C1 攻击敌方后可把 1 手牌放到牌库底；C2 指定一个相邻单位；C3 造成 1 伤害 |

## 起始配置

| 项 | 图面结论 | 运行时配置 |
| --- | --- | --- |
| 起始单位 | 城塞参谋（△）、心灵骑士（□） | 两者作为起始单位，不进入抽牌堆起始副本 |
| 起始城门 | 10 生命城门 | 起始城门 10 生命 |
| 史诗事件 | 学习 x2 | 传奇事件 `yongheng-learning` 2 张 |
| 起始位置 | 提示板给出相对位置 | 运行时按玩家朝向镜像，坐标在静态配置中登记 |

## 对照表

| 对照源 | 结论 |
| --- | --- |
| 现有莫古 / 灰烬 / 冰苔兽人新格式派系 | 图集同为 8088x1454，8x2，slot 11-15 空白；可复用新格式 atlas 合同 |
| 提示板 vs 单卡 | 名称一致：城塞参谋、心灵骑士、学习；无旧译名冲突 |

## 冲突待裁定表

| 冲突对象 | 状态 |
| --- | --- |
| 无 | 当前主真相源内部无冲突 |

## L1 静态接入结果

| 范围 | 状态 | 证据 |
| --- | --- | --- |
| 派系 ID / 名称 / 目录 | passed | `yongheng` 已进入 `FactionId`、合法派系列表、派系目录和中英文文案 |
| 牌组与卡池 | passed | `createYonghengDeck()` 注册召唤师、3 英雄、4 士兵、4 事件、城门和传送门；`factions.test.ts` 覆盖牌组、起始阵型和卡池 |
| 图集与关键图片 | passed | `cardAtlas.ts` / `criticalImageResolver.ts` 接入 hero、cards、tip；`criticalImageResolver.test.ts` 覆盖 hero 与 cards critical |
| AI / 音频 | passed | `factionProfiles.ts` 与 `audio.config.ts` 已登记永恒议会 |

## L2 机制矩阵（当前已实现 / 已测部分）

| 对象 | 子句 | 当前实现 | 证据 |
| --- | --- | --- | --- |
| 大议长艾迪雅 | 动能虹吸 C1：攻击敌方或被敌方攻击后每回合一次充能 | passed | `abilities-yongheng.test.ts` 覆盖主动攻击、被攻击、同回合第二次不触发 |
| 大议长艾迪雅 | 延续 C2：可消耗 2 充能保留将弃除的持续事件 | passed | `abilities-yongheng.test.ts` 覆盖持续事件弃除前生成确认/跳过交互；确认消耗召唤师 2 充能并保留事件，跳过则事件进入弃牌堆且不消耗充能 |
| 洞察 | C1 抓牌后主动事件 +1 充能；C2 召唤师按充能 +1 战力，单张最多 +5 | passed | `abilities-yongheng.test.ts` 覆盖 `CARD_DRAWN` 后充能与 7 充能只给 +5 |
| 学习 | C1 打出时带 2 充能；C2 对手事件弃除后可移除 1 充能拿回该事件；C3 被弃除时把全部充能转给召唤师 | passed | 静态事件卡 `charges: 2`；`abilities-yongheng.test.ts` 覆盖对手普通事件弃除后移除 1 充能并拿回手牌，以及回合开始弃除后转移 2 充能 |
| 城塞参谋 | 情报 C1：移动后可确认/跳过抓 1 | passed | `abilities-yongheng.test.ts` 覆盖确认抓牌与跳过不抓 |
| 城塞参谋 | 警告 C2/C3：攻击敌方后可选 1 手牌置入牌库底，并推拉召唤师 1 格 | passed | `abilities-yongheng.test.ts` 覆盖选手牌、选落点、手牌进牌库底和召唤师移动；并覆盖手牌选择跳过、落点选择跳过、无手牌不生成交互 |
| 心灵骑士 | 唤起恐惧 C1：敌方移动结束相邻时，由目标玩家选择弃 1 手牌 | passed | `abilities-yongheng.test.ts` 覆盖敌方移动相邻后生成强制弃牌交互并弃指定手牌；目标玩家无手牌时不生成交互 |
| 心灵骑士 | 冲撞 C2：攻击相邻敌方士兵/英雄后可推拉目标 1 格 | passed | `abilities-yongheng.test.ts` 覆盖目标选择、落点选择和单位位移；并覆盖目标选择跳过、落点选择跳过不移动目标 |
| 主管玛鲁娜 | 惩戒 C1：敌方单位召唤到 2 格内后，由召唤者选择弃 1 手牌 | passed | `abilities-yongheng.test.ts` 覆盖敌方召唤进 2 格内后生成强制弃牌交互并弃指定手牌；召唤后无可弃手牌时不生成交互 |
| 远古学者 | 智慧 C1 / 分析 C2：召唤后或攻击敌方后可确认/跳过抓 1 | passed | `abilities-yongheng.test.ts` 通过永恒议会抽牌交互 helper 覆盖确认/跳过；共享 `yongheng_draw` 消费链同构 |
| 主管奥维 | 谋划：每 2 张手牌 +1 战力 | passed | `abilities-yongheng.test.ts` 覆盖 0/1/2/5 张手牌 |
| 探寻 | C1/C2/C3：己方移动、建造、攻击阶段开始可确认/跳过抓 1 | passed | `abilities-yongheng.test.ts` 覆盖阶段开始确认抓牌与跳过不抓 |
| 主管卡图 | 坚毅：牌库空回合结束充能；力量强化：按自身充能 +1 战力，最多 +5 | passed | `abilities-yongheng.test.ts` 覆盖空牌库充能一次、非空不充能、9 充能只给 +5 |
| 心念侵袭 | C1/C2：己方回合抓牌后可选召唤师 2 格内敌方士兵/英雄造成 1 伤害 | passed | `abilities-yongheng.test.ts` 覆盖己方回合抓牌触发、距离过滤、造成 1 伤害、跳过不伤害、无合法目标不生成交互 |
| 玄谜贤者 | 运用 C1/C2/C3：攻击敌方后可选 1 手牌置入牌库底，并对相邻单位造成 1 伤害 | passed | `abilities-yongheng.test.ts` 覆盖选手牌、选目标、手牌进牌库底和伤害；并覆盖手牌选择跳过、目标选择跳过、无手牌不生成交互 |

## 当前残余 / 非本轮基线债务

| 对象 | 子句 | 状态 | 原因 |
| --- | --- | --- | --- |
| 永恒议会对象级范围 | L0-L4 | passed | 静态数据、资源链、机制、UI 交互、真实入口 E2E 与截图链均已补齐 |
| 非本轮资源基线 | 根级 manifest | scoped_debt | `public/assets/i18n/assets-manifest.json` 仍受当前工作区已有非永恒议会 Betrayal 怪物 token 哈希差异影响；这是历史/环境基线债务，不影响本轮永恒议会真实入口 E2E 结论 |

## L3/L4 真实入口 E2E 与截图核验

| 项 | 结论 |
| --- | --- |
| E2E 命令 | `node scripts/infra/run-e2e-command.mjs default e2e/summonerwars/summonerwars-yongheng.e2e.ts` |
| E2E 结果 | passed：7/7（约 4.8m） |
| 真实截图根目录 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-yongheng.e2e` |
| AI 核图辅助联系图 | `D:\gongzuo\webgame\BoardGame\temp\summonerwars-yongheng-e2e-contact.jpg` |

### 截图预览站发布

| 项 | 结论 |
| --- | --- |
| 本地发布命令 | `D:\gongzuo\webgame\image-preview\scripts\publish-artifact.ps1 -Project boardgame -Task summonerwars-yongheng-e2e -Title "召唤师战争永恒议会端到端截图" -Images <19 screenshots> -ImageTitles <01-19 titles> -KeepHistory` |
| 本地发布结果 | `data/projects/boardgame/tasks/summonerwars-yongheng-e2e/latest/manifest.json` 写入成功，manifest 记录 19 张图片 |
| 服务器同步 | `scp -r ...\summonerwars-yongheng-e2e admin@8.148.71.102:/home/admin/image-preview/data/projects/boardgame/tasks/` 返回成功 |
| 服务器验证 | `curl -fsS http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`；远端 latest 目录为 20 个文件（manifest + 19 张图）；远端 manifest 标题为“召唤师战争永恒议会端到端截图”，图片数 19 |
| 公网详情页 | `http://8.148.71.102:18080/#/boardgame/summonerwars-yongheng-e2e` 返回 HTTP 200 |

### 关键截图观察

| 截图 | 肉眼观察 | 结论 |
| --- | --- | --- |
| `03-永恒议会正式开局布局.jpg` | 画面已进入真实牌桌，能看到大议长艾迪雅、城塞参谋、心灵骑士、起始城门与永恒议会手牌；不是静态预览或调试壳。 | passed |
| `04-延续保留持续事件确认入口.jpg` | 顶部横幅出现延续确认入口，确认/跳过动作清晰，目标持续事件仍在场面上下文中。 | passed |
| `05-延续确认后持续事件仍在场.jpg` | 确认后持续事件没有被弃除，画面可继续回到牌桌流程。 | passed |
| `06-探寻阶段开始抓牌确认入口.jpg` | 阶段开始时出现“永恒议会：确认是否抓 1 张牌”横幅，按钮选择型交互可见。 | passed |
| `07-心念侵袭选择两格内敌方.jpg` | 顶部提示“心念侵袭：选择召唤师 2 格内的敌方士兵或英雄”，棋盘敌方目标黄框可见。 | passed |
| `08-心念侵袭伤害结算完成.jpg` | 目标伤害结算后回到牌桌，交互没有残留旧 prompt。 | passed |
| `09-冲撞选择相邻敌方目标.jpg` | 心灵骑士攻击后进入目标选择，目标单位在棋盘本体上高亮，未退化为代理按钮。 | passed |
| `10-冲撞选择推拉落点.jpg` | 冲撞第二步显示棋盘位置选择，可落点在棋盘区格上可见。 | passed |
| `11-冲撞推拉完成.jpg` | 目标单位完成推拉位移，流程收口后无旧选择层残留。 | passed |
| `12-警告选择一张手牌.jpg` | 顶部提示“警告：选择一张手牌放到牌库底”，底部真实候选手牌高亮，跳过按钮可见。 | passed |
| `13-警告选择大议长移动落点.jpg` | 顶部提示进入大议长移动落点选择，多个绿色可移动格清晰可见且未越界。 | passed |
| `14-警告结算完成.jpg` | 结算后回到牌桌状态，手牌放底与移动链路完成。 | passed |
| `15-运用选择一张手牌.jpg` | 玄谜贤者攻击后进入手牌直选，候选手牌本体承接点击。 | passed |
| `16-运用选择相邻伤害目标.jpg` | 顶部提示“运用：选择相邻单位造成 1 点伤害”，相邻目标单位黄框可见。 | passed |
| `17-运用伤害结算完成.jpg` | 目标伤害结算完成，UI 退回正常牌桌。 | passed |
| `18-唤起恐惧由目标玩家选择弃牌.jpg` | 目标玩家视角出现“永恒议会：选择要弃除的手牌”，目标玩家手牌高亮可见。 | passed |
| `19-唤起恐惧弃牌结算完成.jpg` | 强制弃牌完成后回到牌桌，无残留选择壳层。 | passed |

### 新交互类型 / 新 UI 验收表

| 新类型 / 新 UI | 首条 direct E2E 对象 | E2E 文件 | 截图证据 | 人工观察结论 |
| --- | --- | --- | --- | --- |
| 顶部按钮选择 | 探寻 / 延续 | `e2e/summonerwars/summonerwars-yongheng.e2e.ts` | `06-探寻阶段开始抓牌确认入口.jpg`、`04-延续保留持续事件确认入口.jpg` | 横幅按钮承接确认/跳过，按钮文字与当前能力语义一致 |
| 棋盘单位选择 | 心念侵袭 / 冲撞 / 运用 | `e2e/summonerwars/summonerwars-yongheng.e2e.ts` | `07-心念侵袭选择两格内敌方.jpg`、`09-冲撞选择相邻敌方目标.jpg`、`16-运用选择相邻伤害目标.jpg` | 目标单位本体高亮并可直选，没有代理命令墙 |
| 棋盘位置选择 | 冲撞 / 警告 | `e2e/summonerwars/summonerwars-yongheng.e2e.ts` | `10-冲撞选择推拉落点.jpg`、`13-警告选择大议长移动落点.jpg` | 可选区格落在真实棋盘位置，移动/推拉后能完成收口 |
| 手牌直选 / 目标玩家弃牌 | 警告 / 运用 / 唤起恐惧 | `e2e/summonerwars/summonerwars-yongheng.e2e.ts` | `12-警告选择一张手牌.jpg`、`15-运用选择一张手牌.jpg`、`18-唤起恐惧由目标玩家选择弃牌.jpg` | 只展示真实候选手牌，候选手牌本体承接点击；目标玩家弃牌视角正确 |

## 资源链结果

| 项 | 结果 |
| --- | --- |
| 压缩命令 | `npm run compress:images -- public/assets/i18n/zh-CN/summonerwars/hero/yongheng` |
| 压缩产物 | `compressed/cards.webp` 8088x1454 / 2,062,610 bytes；`compressed/hero.webp` 1269x929 / 295,994 bytes；`compressed/tip.webp` 786x562 / 125,230 bytes |
| manifest | 已重建 `public/assets/i18n/zh-CN/summonerwars/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json`，只保留本轮永恒议会新增键 |
| 上传预检 | `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/summonerwars/hero/yongheng`，待发布 3 个对象 |
| 上传结果 | `serverPrimaryPublish=completed objects=3`，并刷新 SummonerWars 安卓 file-index/manifest 差异索引 |
| 远端回查 | 三张公开资源 URL 均 `HEAD 200` 且 `X-Asset-Source: server` |

## 验证记录

| 命令 | 结果 |
| --- | --- |
| `npx eslint src/games/summonerwars/domain/yonghengMechanics.ts src/games/summonerwars/domain/execute.ts src/games/summonerwars/domain/flowHooks.ts src/games/summonerwars/domain/abilityResolver.ts src/games/summonerwars/domain/abilities.ts src/games/summonerwars/domain/abilities-yongheng.ts src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | 0 errors；`abilityResolver.ts` 保留既有 warning |
| `npx vitest run src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | passed：26 tests（2026-07-22 续跑） |
| `npx vitest run src/games/summonerwars/__tests__/abilities-yongheng.test.ts src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/criticalImageResolver.test.ts src/games/summonerwars/__tests__/abilityI18nIntegrity.test.ts src/games/summonerwars/__tests__/ability-name-uniqueness.test.ts` | passed：5 files / 60 tests（2026-07-22 续跑） |
| `npx eslint src/games/summonerwars/domain/execute.ts src/games/summonerwars/domain/validate.ts src/games/summonerwars/domain/yonghengMechanics.ts src/games/summonerwars/domain/executors/yongheng.ts src/games/summonerwars/domain/systems.ts src/games/summonerwars/domain/abilityValidation.ts src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | 0 errors（2026-07-22 续跑） |
| `npx eslint src/games/summonerwars/domain/index.ts src/games/summonerwars/domain/reduce.ts src/games/summonerwars/domain/yonghengMechanics.ts src/games/summonerwars/domain/systems.ts src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | 0 errors（2026-07-22 续跑） |
| `npx eslint src/games/summonerwars/ui/systemInteractionAdapter.ts src/games/summonerwars/ui/useCellInteraction.ts src/games/summonerwars/ui/StatusBanners.tsx src/games/summonerwars/ui/statusBannerText.ts src/games/summonerwars/__tests__/useGameEvents.test.ts e2e/summonerwars/summonerwars-yongheng.e2e.ts e2e/helpers/summonerwars.ts` | 0 errors（2026-07-22，永恒议会 UI/E2E 接线） |
| `npx vitest run src/games/summonerwars/__tests__/useGameEvents.test.ts src/games/summonerwars/__tests__/StatusBanners.render.test.tsx src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | passed：3 files / 68 tests（2026-07-22；仅有既有音频 missing_sfx stderr） |
| `node scripts/infra/run-e2e-command.mjs default e2e/summonerwars/summonerwars-yongheng.e2e.ts --grep "探寻与心念侵袭"` | passed：1 test（2026-07-22，失败链路定向复跑） |
| `node scripts/infra/run-e2e-command.mjs default e2e/summonerwars/summonerwars-yongheng.e2e.ts` | passed：7/7（2026-07-22，约 4.8m；产出 19 张真实入口截图） |
| `npx openspec validate add-summonerwars-yongheng-faction --strict --no-interactive` | passed：Change `add-summonerwars-yongheng-faction` is valid（2026-07-22） |
| `python D:\codex-home\skills\task-completion-guard\scripts\check_completion.py --state temp\summonerwars-yongheng-completion-guard.json` | passed：COMPLETE（2026-07-22） |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id summonerwars` | passed |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets --id i18n` | blocked：当前工作区已有非本轮 Betrayal 怪物 token 文件与根级 manifest 哈希不一致；本轮未吸收这些非永恒议会资源变更 |
