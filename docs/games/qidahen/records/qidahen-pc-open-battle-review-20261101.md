# 七大恨 PC 战斗表现返工

后续状态：用户已退回整体教程内容，当前revision23按[完整教程重构](qidahen-full-tutorial-rebuild-20261101.md)执行。本记录保留R134骰子表现、操作与视觉范围，不作为当前整条教学内容通过，也不作为最新查看器交付。

## 任务与验收边界

用户原话：“为什么全是移动端的截图，规范没说pc没过人工验收哦先不考虑移动端吗，还有为什么骰子还是封闭设计，规范要不要更新，设计skill要不要重构，tmd没有哪个游戏这么设计吧，去gameui找参考重构”。

本轮对象是现有教程中的 PC 骰子表现及验收顺序。入口为正式七大恨教程，规则来源仍为正式 PDF Ver1.3；Game UI Database 只提供视觉参考，不替代规则。先交付 PC 完整主链与战斗录屏，等待该版本人工认可；不进行移动端适配、采集或送验。

## 规范治理裁决

| 对象 | 处置与角色 | 原因 |
| --- | --- | --- |
| UI 主规范“PC 主基线优先” | 更新，canonical-source，适用全项目游戏 UI | 旧文“通过”未区分 AI 通过与人工批准；改成可回查的 PC 图组和明确用户回复，人工批准前不进入移动端。 |
| game-ui-design | 更新编排，adapter | 引用上述主源并安排执行顺序，不复制批准规则。 |
| Game UI Database 首查规则 | 保留 | 已要求实际看对应操作态、记录采用与舍弃；本轮须真实执行，不能再用站点首页或静态几何证明设计。 |
| 骰子版式 | 本游戏设计裁决 | 不将“所有游戏禁止骰盘”升级为通用规范；依据实际商业参考、七大恨规则和当前玩家任务裁定。 |

原 R131 清单包含桌面48条、移动30条。查看器 `collectMedia` 按中文文件名重排，使移动端先显示；浏览器当前索引已确认前30条是移动端。此事实不等于用户认可 PC。新交付单独建立 PC 组，不修改共享查看器。

规范先修改主源和 workflow，再执行 `npm run spec:lint`，通过后才进入游戏改造。顺序复演：用户质疑规范 → 找到主源含糊点 → 补足人工批准语义 → workflow 引用 → 校验 → 商业参考与游戏实现。旧的“AI PASS 后直接做移动端”现在会在主源的人工批准检查被拒绝。

## 职责与影响面

- 扩展已有表现 owner `QidahenBattleRollSequence`，其职责为正式骰果的物理播放与停稳结果揭示；不结算、不随机、不写游戏状态。
- `QidahenBattleRollOverlay` 仍负责可用空间及地图镜头握手；共用骰子引擎仍负责投掷与正式骰面，不新增第二套表现或随机源。
- 私审发现战后仍有默认嵌套骰盘，故将原 `Board.tsx` 的历史骰果显示职责迁移至唯一 `QidahenBattleReport`；默认折叠，真实点击“战报”才能阅读，关闭后继续原占领/撤回决策。删除原内联显示owner和无独立决策价值的“几种结果”读数，不修改候选或规则选择权。
- PC 主线仍由既有年度教程 E2E 驱动；只执行桌面用例，不改写移动端既有行为合同。
- 数值、规则与阶段由领域测试及真实输入断言证明；逐媒体私有图审证明开放投掷、可读性、双方归属与地图/HUD保护。

## 已读商业参考与设计合同

子代理实际打开并逐张阅读 [Armello 游戏页](https://www.gameuidatabase.com/gameData.php?id=244)的[投掷态原图](https://www.gameuidatabase.com/uploads/Armello07152020-074618-7504.jpg)和[命中态原图](https://www.gameuidatabase.com/uploads/Armello07152020-074619-79668.jpg)，均为1920×1080。静态图只证明布局和对应可见状态，不证明该游戏的动画、取消或点击合同。

| 元素 / 玩家任务 | 已读参考与差异 | 本游戏裁决与收口 |
| --- | --- | --- |
| 当前投掷 | Armello 骰子直接出现在战斗舞台，未按骰种分别套不透明框；其专用全屏舞台不适用于保留七大恨地图 | 删除总背板、边框和骰种小盒，透明物理投掷层保留地图、双方军队和常驻界面。 |
| 攻守归属 | Armello 左右角色与骰池位置对应 | 同阶段有双方骰池时按攻左守右分区，同侧混合骰种仍属同侧；只有一方实际投掷时居中展示并标明侧别，不虚构另一方的骰盘或未掷骰占位。 |
| 阶段 | 本游戏 PDF第6页为炮兵→骑兵→步兵，同阶段双方同时结算 | 一处阶段标题；双方物理骰均停稳后再揭示同阶段结果，不更改领域时序。 |
| 骰点与损伤 | 骰面本体承载结果，参考命中态对应同侧反馈 | 每侧保留一处合计和造成损伤。只在有修正或十面骰零面须解释时保留逐骰补充；不复写普通骰面数值或常驻骰种标签。 |
| 地图来源/目标、手牌和牌堆 | 现有PC主链信息，不照搬参考全屏换场 | 保留地图镜头与保护槽位，不隐藏来腾出骰子窗口。战后层退场后由真实占领/撤回选择接手。 |

本轮交付物为用户已明确要求返工的真实实现，非另外要求审批的设计稿。PC图组仅表示AI可送验，不能代替用户人工认可。

## 当前状态

商业参考查证完成。R132虽完成行为链，战斗文字不可见及战后常显旧骰盘被图审退回，未送验；当前独立诊断不能唯一归因其历史缺字。R133在入口发现共享服务返回旧Board及Sequence，源码身份校验中止，未放宽门禁。R134使用独立新服务和缓存从正式入口完整重跑，通过79条行为记录、49条媒体、716个实际依赖身份检查及结束后的正常输入；独立服务随测试正常退出。

当前222项定向测试、类型检查、规范检查及OpenSpec严格校验通过。42张整屏PNG、6张战斗整屏JPG和1份真实录屏，共49条媒体已全部由子代理私审通过；录屏105个解码帧全部顺序审查，未用抽样替代。三项独立前后基线审查通过。尚无用户人工认可，未进入移动端。

采集结束时716个实际依赖身份一致。收口时发现共享CardPreview文件有一项并发字节变化：其余715项仍一致，变化仅为已有导入新增绑定和getCardPreviewAspectRatio的atlas分支，当前教程使用的CardPreview声明未变。原始采集哈希未改；独立审查核对了实际消费路径：日志Panel未挂载，本链不执行该helper。AST对照及内存中恢复变更前全文均与采集时浏览器源码精确相同。因此本链49媒体继续有效，不宣称716项源码零漂移，也不覆盖未来打开日志后的卡名预览。精确旧新哈希、消费条件及审查身份保存在[影响审查](../../../../evidence/qidahen/tutorial-pc-open-battle-20261101/reviews/cardpreview-drift-impact-review.json)和[机器对照](../../../../evidence/qidahen/tutorial-pc-open-battle-20261101/reviews/cardpreview-drift-ast-evidence.json)。

检查边界：额外军备领域套件七项失败，其测试与领域源码相对HEAD无差异且不导入本轮显示组件，保留原日志，不据此宣称全游戏规则通过。全局国际化检查仍被其它文件八条告警阻断，本游戏新增战报/结果中英文键定向检查通过。

## 当前PC交付与验证

[PC完整教程及真实战斗录屏查看器](http://127.0.0.1:4867/?key=c781db0faf5e)共49条，按01-PC至49-PC顺序展示，未混入移动端或局部裁图。第26条为战斗录屏，27、28条分别是默认战后与主动展开战报。[最终清单](../../../../evidence/qidahen/tutorial-pc-open-battle-20261101/media/focused-pass-manifest.json)、[行为链](../../../../evidence/qidahen/tutorial-pc-open-battle-20261101/traces/desktop.json)、[全量图审](../../../../evidence/qidahen/tutorial-pc-open-battle-20261101/.visual-review.json)、[独立基线](../../../../evidence/qidahen/tutorial-pc-open-battle-20261101/.baseline-review.json)已归档。

| 实际执行 | 结果与证据 |
| --- | --- |
| 五文件定向Vitest：Board、battleRollProjection、battleRollPlacement、annualTutorialFlow、turnResolution；native loader、单worker | 222/222通过；[日志](../../../../test-results/qidahen-open-battle-r133-focused.log) |
| 当前Chromium 1920×1080正式教程入口完整年度链 | 1/1通过，79条记录；教程退出引导后正常输入被接受；[日志](../../../../test-results/qidahen-open-battle-r134-pc.log) |
| npm run typecheck | 通过；[日志](../../../../test-results/qidahen-open-battle-r134-typecheck.log) |
| npm run spec:lint | 通过；[日志](../../../../test-results/qidahen-open-battle-r134-spec.log) |
| OpenSpec当前change严格校验 | 通过；[日志](../../../../test-results/qidahen-open-battle-r133-openspec.log) |
| 本游戏新增中英文键定向核查 | 通过；[日志](../../../../test-results/qidahen-open-battle-r134-locales-focused.log) |
| npm run verify:e2e-evidence -- evidence/qidahen/tutorial-pc-open-battle-20261101/media/focused-pass-manifest.json | 49媒体、1完整行为链、49逐项视觉审计通过；424份原始副本/私审材料显式登记在展示合同外 |
| open-verified-image dry-run、--dir --no-open注册及实际HTTP取回 | 通过；页面和49条媒体均200、字节/哈希及顺序与清单一致；[健康报告](../../../../test-results/qidahen-open-battle-r134-viewer-health.json) |
| 扩展军备领域测试 / 全局i18n | 分别7项既有失败、8条其它文件告警，见[领域日志](../../../../test-results/qidahen-open-battle-r132-unit.log)及[i18n日志](../../../../test-results/qidahen-open-battle-r134-i18n.log)；未宣称全项目全绿 |

逐图保留一项非阻断观察：人物卡主动放大时盖住下层部分教程文字，符合上层读牌、关闭后恢复的既有合同；卡面和关闭入口可读，前态正常提示及关闭后继续均有实际验证。不宣称所有层文字同时可见。录屏保留真实时间，不声称60fps；本轮没有按自然浏览器全链验收城战、水路、全部人物/军备和所有骰种分支。

## 本轮修改文件

- 主规范与编排：[ui-change-gates](../../../../.spec/knowledge/standards/ui-change-gates.md)、[game-ui-design](../../../../.spec/skills/game-ui-design/SKILL.md)。
- 唯一表现与只读战报：[QidahenBattleRollSequence](../../../../src/games/qidahen/ui/QidahenBattleRollSequence.tsx)、[QidahenBattleReport](../../../../src/games/qidahen/ui/QidahenBattleReport.tsx)、[Board](../../../../src/games/qidahen/Board.tsx)。
- 中英文键：[中文](../../../../public/locales/zh-CN/game-qidahen.json)、[英文](../../../../public/locales/en/game-qidahen.json)。
- 回归断言：[battleRollProjection](../../../../src/games/qidahen/__tests__/battleRollProjection.test.tsx)、[Board测试](../../../../src/games/qidahen/__tests__/Board.test.ts)。
- 实际操作和录屏：[年度E2E](../../../../e2e/qidahen/qidahen-annual-tutorial.e2e.ts)、[battleRecording](../../../../e2e/qidahen/battleRecording.ts)。
- 交付记录：本文、[年度设计](qidahen-annual-tutorial-design-20261030.md)、[当前任务](../../../../openspec/changes/refactor-qidahen-continuous-annual-tutorial/tasks.md)及上述证据组。

验收结论仅为当前PC版本AI核验通过、可供人工验收；人工状态pending。未提交、推送、切分支或发布。用户人工认可前不进入移动端。
