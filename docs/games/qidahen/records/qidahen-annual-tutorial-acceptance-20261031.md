# 七大恨连续年度教程验收记录

状态：本地验收通过；本轮已授权检查、提交、推送与部署，结果以 Git、CI 和生产回查为准。

[查看全部整屏截图与真实录屏](http://127.0.0.1:4867/?key=71458b02491f)。正常对局行动链、规则/UI覆盖盘点及明确取舍见[作者总账](qidahen-annual-tutorial-design-20261030.md)。

## 完成范围

正式入口仅一条连续课程，revision20，共73个真实输入/观察节点；节点数量不等于弹窗数量。正式开局后连续完成征召弃牌与建军、军屯/开垦、年中税赋/漕运与超限弃牌、军备研发、来源→实体部队→目标、守方响应/鸳鸯阵/炮骑步真实骰子、战后占领、外交/雇佣、新年朝贡/逐项维护/逐区耗损、纪年支付/新顺位/人物、次年训练及正常继续。途中不注入人口、兵力、手牌、季节或结果。

规则提示只承担当前信息缺口。地图候选使用正式边界；真实兵牌/控制标记均保留地区身份。手牌保留半露/抬起与共享放大镜，超出行宽时提供左右翻看箭头；支付节点真实翻到末端并返回，验证牌实体和已选支付保持。教程结束后清理提示并保留真实对局。

## 主要修改入口

| 职责 | 文件 |
|---|---|
| 唯一课程及初始发牌 | src/games/qidahen/annualTutorial.ts、tutorial.ts、tutorialSetup.ts |
| 正式落点及年度结算owner | src/games/qidahen/domain/turnResolutionTypes.ts、turnResolutionOpportunities.ts、turnResolutionChoices.ts、turnResolutionFacts.ts、turnResolutionProgress.ts、turnResolutionSystem.ts、seasonTasks.ts、characterJudgement.ts |
| 纪年与真实牌堆 | domain/chronologyCards.ts、chronologyResolution.ts、chronologyStatistics.ts、koreaCardState.ts、ordinaryHandCardIdentities.ts、specialCards.ts |
| 选兵/调度及轮盘规则 | domain/wheelDispatchDraft.ts、wheelSlotActions.ts、wheelMoveExecution.ts、wheelRecruitTrain.ts、battlePieceSelection.ts |
| 地图、手牌、候选与交互 | src/games/qidahen/Board.tsx、ui/QidahenTurnChoicePanel.tsx、ui/QidahenHandScrollControls.tsx、ui/useQidahenTurnInput.ts、ui/mapRegionFocus.ts、ui/MapViewportControls.tsx |
| 战斗动画及真实骰体 | ui/QidahenBattleRollOverlay.tsx、QidahenBattleRollSequence.tsx、useQidahenBattlePresentation.ts、battleDiceAppearance.ts；src/lib/dice-box-threejs/engine.ts |
| 语言包与正式素材来源 | public/locales/zh-CN/game-qidahen.json、public/locales/en/game-qidahen.json；data/runtime-region-graph.json |
| 浏览器验证与录制 | e2e/qidahen/qidahen-annual-tutorial.e2e.ts、qidahen-tutorial-lifecycle.e2e.ts、battleRecording.ts、tutorialPointer.ts |
| 测试环境端口 | scripts/infra/e2e-port-config.js：仅允许隔离测试前端显式配置，绕开本机系统保留端口，不改开发端口 |

旧seasonResolution和整年auto-pay/skip-all维护owner已退役；未为兼容旧测试恢复第二条运行链。


## 实际运行的验证

- Vitest：29文件420项通过，实际完整命令见PASS清单behavioralVerification.commands，日志test-results/qidahen-annual-r128-unit.log。规则数值、费用、输入/权限、季节选择、牌堆及共享骰子由行为测试负责。
- Chromium真实入口：桌面1920×1080、手机横屏915×412，各73节点完整通过，日志test-results/qidahen-annual-r128-full.log（2 passed）。两端均进入次年、领取纪年1301、结束教程并接受下一次正式输入；实际715份浏览器加载源与当前工作区一致。
- 生命周期：真实刷新继续、回退重做、重新开始和旧版进度失效通过，日志test-results/qidahen-annual-r128-lifecycle.log（1 passed），实际记录为清单引用的原始lifecycle-verification.json。
- 图片/动画：65张整屏图、2条真实时间录屏，共67媒体全部由独立子代理私读，逐图核哈希。两端录像全部136/152个解码帧已审；只作交互/UI/布局/可读性判定。最长采样间隔为2.848秒与1.9985秒，不外推间隙平滑性；十二面骰没有主线浏览器覆盖。
- 独立基线六要求通过；旧图仅作历史职责对照，不当作用户已验收版本。最终清单：[focused-pass-manifest.json](../../../../evidence/qidahen/tutorial-20261030-annual-r128-final/media/focused-pass-manifest.json)。项目证据校验通过，67媒体、2条完整行为链、67条逐图审计，原始字节副本与逐帧内审材料另行登记355项，未混入查看器；查看器页面与67媒体均HTTP200且字节/哈希匹配，见test-results/qidahen-annual-r128-viewer-health.json。
- 正常对局候选探查：102局面2992候选及17个条件候选实际校验/执行，越权和过期输入未被接受；见test-results/qidahen-annual-ai-choice-probe-result.json及qidahen-annual-ai-conditional-probe-result.json，不代表全人物/全战斗规则审计。
- spec:lint、git diff --check、OpenSpec strict validate通过；全项目typecheck仍返回2，仅DiceThrone 1796/2083两处错误（r128-typecheck.log）。i18n检查返回1，仍为OperationGuidePanel、DiceThrone、Fate共7条告警（r128-i18n.log）。未宣称全项目全绿。

## 边界

- 本轮为本课程及其正式运行链收口；未声称全游戏测试套件或全部规则分支通过。旧commands.test.ts、qidahen-runtime-interaction-contracts.test.ts仍含旧行动前置/已退休维护import等夹具，未纳入420项通过集，迁移仍未完成。
- 城战、围城、水路、完整三势力专属行动、全部人物表与平级伤亡分配未按完整自然浏览器对局逐分支验收；普通两/三格奖励和季节截停由领域测试承接，本课不强迫重复三种互斥走法。
- 阿敏印刷表重叠/缺项、林丹修正成零、毛文龙无东江占领者尚缺权威勘误；熊廷弼/毛文龙的可选免费训练仍被既有运行时自动处理，当前选择杨镐不等于修复这些范围外问题。
- 十二面骰已做共享数值/面映射测试，但主线实际只掷六/八/十面骰，不宣称十二面骰浏览器视觉通过；手机竖屏和低内存长时压力不是本次覆盖。
- 历史曾发生手机轮盘入口查询超时和一次地图稳定等待超时，尚无唯一现场归因；保留失败日志，后续同源通过不能证明所有时序风险已排除。

正式规则采用PDF Ver1.3，TTS素材作为可追溯组件来源，九张特典独立扩展开关默认关闭。商业参考实际检查了Game UI Database的Total War Troy和Civilization VI截图，采纳地图/部队本体承接操作及卡面检视；没有声称亲自游玩。具体来源与取舍链接见作者总账。
