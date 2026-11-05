# 七大恨地图选区重构（R82，提示设计已被用户退回）

R82的提示设计已被用户指出冗余、含义不清，旧展示清单已标为REVISE；以下测试与原图审查只作历史证据。后续提示减量、规范修正与重新验收见[R83记录](qidahen-prompt-reduction-20261028.md)。

用户退回R80首图：合法候选没有全部反馈，教程推荐被误画成唯一候选；地区高亮不贴印刷边界。用户已明确要求重构。没有最后正常的已认可图，R80仅作失败证据，不能作为恢复基线。

## 真相与范围

- 原图：`public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`，1265×893；PDF Ver1.3。
- 原图逐项核对：`evidence/qidahen/.map-boundary-source-review-20261028-r81.json`、`.map-region-identities-source-20261028-r81.json`；32个土地地区名和3个朝鲜点位。城市白牌不是独立土地。
- 正式编辑器已复现合并与错映射：`evidence/qidahen/r81-diagnostic/editor-before.json`；HTTP回读mask字节与当前源文件哈希相同。辽北与辽东两个实印地区命中同色，辽西落入锦州色块，蓟镇落入山海关色块，与旧文档的父区映射相矛盾。
- 规则独立复核：山海关属于蓟镇；辽西与锦州/宁远是地域和城市的关系，不能给全部旧runtime编号各造一块土地。原PDF抽取全文保存在`test-results/qidahen-r81-rule-map.txt`，原文288–291、315、333–341行涉及这些关系。
- 目标入口：正式`basic-opening`、正式地图及`/dev/qidahen-region-mask`。PC构图与手机同构等比保持不变；本轮不通知已归档的聊天。

## 实施职责

1. `mapSelectionCandidates.ts`只从已有正式动作合法性读取候选；地图呈现全部候选。教程推荐独立加强，不能过滤普通候选，也不能把首个候选自动变成已选。
2. 原图土地mask只表达真实地理；城市作为土地内可操作对象保留已有城战入口，不把城名牌或图标变成一块省区。需要改变正式数据时先由原图核对、编辑器和像素矛盾补足证据，再落盘；未经复核的描线只留候选目录。
3. Board只做接线。边界、命中和候选各由现有正式owner或独立窄模块承担，不增加教程专用命中圆、代理列表或另一套规则状态。
4. 城战聚合控制、维护、税赋和跨年规则如存在旧缺口，记录其直接事实，不用地图图审代替领域规则验收；不扩成全游戏规则审计。

## 验收

- 候选完整性：首步全部合法建军候选可识别，辽北推荐与普通候选可区分；突袭未选目标时呈现合法敌区；普通浏览不误画为动作候选。
- 地理身份：土地、城市与朝鲜点位分层，辽北/辽东与辽西/敖汉、蓟镇/顺天不再用距离伪造边界；正式编辑器、运行时描边和持久命中点同时核对。
- 真实操作：重新跑正式入口、桌面连续主线、手机原生触摸、检视与退出续局。流程必须符合校准后的真实相邻关系，不能为保留旧路线留假通路。
- 图片：所有必要整屏状态交子代理逐图判断。原图描线候选核对不算教程PASS，数值仍由Vitest/E2E验证。

交互规范已有“所有可选目标必须高亮”及同族审查要求，当前不新增平行规范。R80整体仍为REVISE；以下R82结果只覆盖本轮地图选择及入门主线。

## 当前实现与验证（R82）

- 35个地理对象来自原图逐项核对：32土地+3朝鲜点位；运行时另保留4个城市/据点子对象，不按锚点距离伪造省界，也不另计霸权土地。正式本土字段与当前控制者分开。
- 原图13蒙古、13红字、9女真/朝鲜对象由不同子代理全量核边；汇总 `.map-boundary-source-final-r82.json`。长白牌库及鄂尔多斯/延绥标题各有1处明确近似闭合，共2处，不声称不可见段逐像素还原。
- 全部合法候选由正式动作合法性读模型给出，推荐只另加白边。首步展示候选总览，后续场景按真实目标聚焦；移除过期/禁用动作说明。
- 主线升级revision16：辽北军屯→真实河界进攻叶赫→银两支付→鸳鸯阵→出兵4→战后占领→同局继续。无教程命令先验证；战术提示刷新后真实使用D10=9，永久等级不被改写。
- 决策弹框与手牌确认托盘复用已有屏幕锚定浮层owner并全平台portal呈现，不启用手机独立版；手机实际对手按钮至少76×44，确认按钮至少152×44。结果、操作及战斗正文按正式owner提高字号。
- 无合法本土时，军屯保留允许的补牌，不回退当前非法地区、不改兵力汇总、不造加兵结果。

当前定向Vitest为16文件163/163；正式Chromium为4/4，覆盖编辑器、入口生命周期、桌面完整对局和手机至支付/长按检视。三条教程trace共63步骤、226条记录断言。源码复审已核76个输入与冻结副本一致，指纹 `d782dbf4c50294ee2af6b77e630fec81761f27544637774b29f144e83337b52d`；正式编辑器35种子和HTTP原mask同SHA。桌面11张与手机5张当前整屏已分别由子代理逐图实读并通过；编辑器1图另行通过，未混入玩家图组。最终PASS清单及媒体目录适配清单均已通过正式证据校验：16媒体、3条行为链、16张逐图审计、0张合同外媒体。

验证日志：`test-results/qidahen-r82-unit.log`、`qidahen-r82-e2e.log`、`qidahen-r82-spec-lint.log`；图组为 `evidence/qidahen/tutorial-20261028-map-selection-r82-final`。源码报告 `.baseline-review-r82-source-final.json` 不代替图片结论。旧R80与R81图组不作为本轮最终图。

[查看本轮教程整屏图（16张）](http://127.0.0.1:4867/?key=555088c5615a)。页面、索引16/16及全部媒体HTTP响应已核验；仅注册链接，没有自动打开，也不表示用户已经验收。最终清单为 `evidence/qidahen/tutorial-20261028-map-selection-r82-final/pass-manifest.json`；查看器媒体目录适配清单仅调整相对报告路径，引用同一批媒体及独立审查报告。

## 实现落点

| 职责 | 文件 |
| --- | --- |
| 教学流程与译文 | `src/games/qidahen/tutorial.ts`、中英文 `game-qidahen.json`、教程覆盖矩阵 |
| 地理数据 | `data/region-mask.png`、`region-mask-regions.json`、`region-graph.json`、`runtime-region-mask-regions.json`、`runtime-region-graph.json` |
| 合法候选与命中 | `ui/mapSelectionCandidates.ts`、`mapRegionHitTesting.ts`、`mapGraph.ts`、`runtimeRegionOwnership.ts` |
| 显示与视野 | `Board.tsx`窄接线、`ui/regionMaskOverlay.ts`、`mapRegionFocus.ts`、`QidahenMapPopulationLayer.tsx` |
| 同构决策浮层 | `ui/QidahenHoverTip.tsx`、`QidahenHandInteractionTray.tsx` |
| 本土/城市/剧本 | `domain/regionConfig.ts`、`regionRuleSemantics.ts`、`regionEthnicity.ts`、`regionSelectionPreferences.ts`、`scenarioRuntimeRegionPresets.ts`、`mapTokens.ts`、`victoryResolution.ts` |
| 正式结算衔接 | `domain/selectionBuilders.ts`、`characterActionWindow.ts`、`wheelImmediateEffect.ts`、`wheelRecruitTrain.ts`、`interactionSystem.ts` |
| 实操验证 | `e2e/qidahen/qidahen-closeout.e2e.ts`、`map-selection-geometry.e2e.ts`，及上述16文件定向回归 |

## 证据边界

全仓typecheck与i18n检查仍失败，分别保留在 `qidahen-r82-typecheck.log`、`qidahen-r82-i18n.log`，不能写全仓通过。额外运行时合同套件当前与R80冻结基线都是同名21失败，新增失败为0，比较见 `qidahen-r82-runtime-baseline-comparison.json`；没有把它们计入163项通过。

本轮未完成城市父子聚合控制、维护、税赋、跨年、全部通路或全游戏规则审计；手机触摸证据未走战斗后半程，未验所有桌面分辨率。开发端4273曾返回旧编译模块，未拿其诊断图作当前验收；本轮正式证据全部来自指纹核对后的隔离运行实例。

未提交、推送、创建/切换分支或发布；保留其它脏改动。用户已归档另一个主棋盘聊天，本轮没有通知或唤醒该聊天。
