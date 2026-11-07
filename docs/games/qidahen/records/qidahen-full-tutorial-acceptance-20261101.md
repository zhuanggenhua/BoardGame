# 七大恨完整年度教程验收（R144）

后续更正：用户否定轮盘说明远离教学对象的定位；本页R144视觉放行已撤回，原测试与逐图记录仅保留为历史事实。当前修复与重新验收以[qidahen-tutorial-layering-20261101.md](qidahen-tutorial-layering-20261101.md)为准。

以下仅记录R144当时的执行与历史结论，不作为当前PC视觉放行。移动端未开始；本轮未提交、推送、切换分支或发布。

[PC整屏截图与真实掷骰录屏查看器](http://127.0.0.1:4867/?key=b2af32175279)。页面及52项媒体均返回200，顺序、中文标题、索引数量、响应字节与原文件哈希一致，见[查看器健康收据](../../../../test-results/qidahen-full-rebuild-viewer-health.json)。不自动打开浏览器。

## 课程与参考

[规则/UI覆盖、取舍、正常对局、完整教学步骤与主要修改文件](qidahen-full-tutorial-rebuild-20261101.md)是本轮作者总账，保留独立内容和基线审查实际读取时的版本，不在验收后追加结论改变其输入哈希。课程为revision23、一条连续对局、52条可见提示；无中途补资源或切换独立预设局面。

正常行动因果：公开纪年的控制增长目标 → 军屯筹牌与开垦税源 → 手牌征召 → 年中收入及超限弃牌 → 研发火炮、来源选兵后进攻叶赫 → 外交与大同换防 → 新年维护、供给和领取纪年 → 新顺位与人物 → 次年训练原参战军队并征兵 → 退场后接受下一方正常输入。

- [BGA《Get on Board》完整交互教程](https://en.boardgamearena.com/tutorial?game=getonboard&tutorial=967)实际从Start操作到完成页，52条不同提示、16次正式对象点击；作者为社区作者Nekonyancer，不冒称发行商编写。借鉴当前问题引出规则、真实操作产生下一问题、复用前次选择的后果，见[完整顺序观察与边界](../../../../evidence/qidahen/tutorial-full-causal-20261101/references/bga-getonboard/reference-review.md)。
- 《韦诺之战》两关完整可执行教程脚本用于补充战略回合的先行动后引入差异；这是源码检查，未称实机游玩。CK3只有字幕辅助，未计为完整实机参考。见[来源及行号](../../../../evidence/qidahen/tutorial-full-causal-20261101/references/wesnoth-complete-executable-tutorial-review.md)。
- 项目[教程标准](../../../../.spec/knowledge/standards/tutorial-design.md)是唯一执行正文；[教程skill](../../../../.spec/skills/tutorial-workflow/SKILL.md)绑定完整来源、正常行动链、独立内容因果审查及中后段恢复检查。

## 实际验证

| 验证层 | 当前结果及直接证据 |
| --- | --- |
| 内容与因果 | 全部52条中英文及正式对象/输入/事件独立复审PASS；首轮4项退回后修正，未用图审代填，见[内容报告](../../../../evidence/qidahen/tutorial-full-causal-20261101/reviews/content-review-final.json)。 |
| 游戏规则与行为 | 10文件248项通过，包含不启用教程的合法年度行动链、真实实体与支付预算、年中/新年/纪年公开时机，见[日志](../../../../test-results/qidahen-full-rebuild-unit-final.log)。 |
| 共享教程与存档 | 7文件95项通过，覆盖教程状态/回退/等待、几何变化定位、存档兼容与生命周期消费者，见[日志](../../../../test-results/qidahen-full-rebuild-shared-and-storage-r144.log)。合计343项定向测试。 |
| 类型与规范 | 类型检查、规范lint、skill结构、OpenSpec严格检查、范围内diff检查通过。全局国际化仍有其它模块8条告警，不宣称全项目全绿。 |
| 真实PC主链 | 正式教程入口、真实鼠标与正式控件完整走完76条行为记录，7.6分钟通过；718个实际浏览器消费源码字节一致、0漂移。教程active=false，nextInputAccepted=true，见[完整原始链](../../../../evidence/qidahen/tutorial-full-causal-20261101/traces/desktop-raw.json)及[执行日志](../../../../test-results/qidahen-full-rebuild-pc-r144.log)。 |
| 后段真实刷新 | 征兵目标处实际刷新并“从上次继续”；23,851,804字节原快照压为3,320,466字符，71个回退检查点、core/history哈希和随机游标106前后相同，见[收据](../../../../evidence/qidahen/tutorial-full-causal-20261101/traces/late-progress.json)。 |
| 工程生命周期 | 刷新继续、回退重做、重开、旧版本失效、真实菜单退出清理、普通入口不重启教程，6项PASS，54.9秒，见[记录](../../../../evidence/qidahen/tutorial-full-causal-20261101/traces/lifecycle.json)。退出恢复不是额外教学卡。 |
| 全量媒体私审 | 45张原始整屏PNG、6张原始整屏动态关键帧、1段原录屏全部由子代理审阅；录屏133帧逐帧连续覆盖，无抽查代全审。观察只证明界面、交互、可读及遮挡，数值规则另由测试证明，见[逐项账本](../../../../evidence/qidahen/tutorial-full-causal-20261101/.visual-review.json)。 |
| 独立基线 | 4项要求PASS，实际比较被否定/失败旧图与当前图，未把旧基线写成用户批准，见[原始基线报告](../../../../evidence/qidahen/tutorial-full-causal-20261101/reviews/baseline-review-original.json)。 |
| 证据与交付 | 项目验收通过：52媒体、1条完整行为链、52项逐媒体审计；318项原录制源帧/内审材料显式排除，不进入查看器。查看器dry-run与全部媒体健康检查通过，见[最终清单](../../../../evidence/qidahen/tutorial-full-causal-20261101/media/focused-pass-manifest.json)。 |

## 修复与限制

整条内容重排外，已修复正式纪年公开顺序、提示遮兵/城市、战术确认条横压地图、征兵长列表越界与标题穿透、大历史存档配额，以及静止提示定位反复组合计算。失败组和诊断材料保留，未混进本轮查看器。

共享定位修复只复用完整几何未变的计算结果；同一战后保存点3.006秒窗口，脚本时间2.872179秒降到0.081512秒。候选、保护、评分和排序不变，首次求解仍有原复杂度。见[独立性能审查](../../../../evidence/qidahen/tutorial-full-causal-20261101/reviews/layout-performance-review.json)。

大历史压缩保留全部对局和回退，不建立第二份进度；但同步编码/解码仍有开销，指定23.62MB样本的Node编码约0.74–0.93秒、解码约0.46–0.51秒，不称性能无变化，也不保证任意空间/任意不可压缩存档。见[独立存档审查](../../../../evidence/qidahen/tutorial-full-causal-20261101/reviews/storage-review-final.json)。

范围内核心操作与年度结算均有主线落点；未把全部势力/人物/卡牌、城战、水路、所有胜利终局或所有分支算作已实操。主线实际走轮盘1格，其它走法代价为规则说明；防守方避战为观察，杨镐十支指挥为说明。具体取舍在作者总账。PC待用户人工认可，移动端未纳入本次证据。
