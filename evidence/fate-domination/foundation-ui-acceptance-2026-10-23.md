# Fate 基础对局与当前界面验收（2026-10-23）

此前基础范围结论：全量Fate测试43文件229项通过；35张整屏媒体有当时独立视觉裁决（20张PASS、15张未改写沿用）。**用户追加退回详情04牌距、头像悬浮框式展示，并授权教程与AI后，当前整体状态为实施中 / REVISE**；原35图不能代表新增范围或受影响UI通过。新增范围以[教程与UI覆盖总账](../../src/games/fate-domination/intake/rules/tutorial-ui-coverage.md)为准。完整游戏及全仓类型检查不在此前通过结论内。没有提交、推送或发布。

## 对象、主源和环境

- 最新用户合同：攻击手牌单主区，技能右侧常显，推进在技能上方，合计威力紧邻暂存牌左侧。旧双主区、旧比例锚点不适用；首轮与后续准备也保留技能。
- 规则：[来源表](../../src/games/fate-domination/intake/rules/source-index.md)、[中文CHM合同](../../src/games/fate-domination/intake/rules/core-rules-from-chm.md)。用户指定中文CHM及中文卡图 → TTS → Wiki QA；Wiki不覆盖中文主源。
- 资源：[退役合同](../../src/games/fate-domination/intake/catalog/asset-retirement-contract-2026-10-21.md)。18个退役键保持退役，脏砚专属令咒来源缺口不造图。
- 当前工作区正式 Board；浏览器联网入口 `/play/fate-domination/match/:matchId?playerID=0`。自然链使用一个真实浏览器主视角及两个独立凭证的正式 GameTransportClient，经真实 HTTP/Socket.IO 服务同步。两个测试客户端提交合法命令，不代表AI；三独立浏览器页面的全链曾被资源保护器终止，明确未通过。

## 本轮修复

1. 焦点只在原按钮确已卸载且焦点回落body时恢复，避免检视重渲染把Tab拉回原牌；保留20张牌逐Tab断言。
2. 卡牌贴底完整显示；横向滚动保留6px描边/小数舍入余量。空与密集出牌区共用轨道，威力摘要固定最小宽度，牌组直接排列在其右。
3. 1366×768推进槽避开全局离开按钮，保持技能上方；没有修改全局层级。
4. 地图合法地点选择优先接收点击，修复第11轮部署被事件牌检视按钮截住的问题。选中目的地使用同一个加粗金色边界，确认文案明确地点；选择、取消仍不提交。
5. 从既有 `player.eliminated` 派生本人“已淘汰·观战”、对手席位及详情状态；不再把淘汰混作未部署。观战推进与令咒禁用。
6. 准备阶段保留攻击/技能区，仍由既有规则禁止选攻击；首轮推进也放入同一固定槽。空手牌明确显示“暂无攻击手牌”。

`useFateAttackDraft`、原子确认、骑乘事务和基础规则主体复用原实现，没有建立第二套草稿或规则状态。

## 直接覆盖与边界

| 验收对象 | 直接证据与口径 |
| --- | --- |
| 客户端草稿 | `Board.runtime.test.tsx`：选择/撤回零dispatch，确认一次携带 `cardIds/faceDownIds/round`，断线及错误/未确认回执保留，成功后进入正式出牌区；回合/席位/交互/牌实例失效清理。 |
| 混选、暗置、费用 | `normal-attacks.test.ts`、`face-down-attacks.test.ts`：普通牌与技能共用两张额度、技能不可暗置、暗置不收费/不贡献威力、明置限制、费用变化重验；过期、重复实例、非法暗置和重复提交拒绝，保留历史回放兼容。 |
| 权限和隐藏信息 | 真实三客户端 `network-match.test.ts`：独立凭证，私有手牌/牌库裁剪、暗置实例不泄露、越权/过期/重复拒绝、断开重连同一权威状态。其服务器使用内存存储，不代表生产持久化/认证验收。 |
| 骑乘 | 原23项领域回归、原4项浏览器E2E及新增真实网络验证。0/1/3张，第四张拒绝、取消重开、费用不足、普通两张出牌隔离。自然网络三张批次恰为0费；另一个显式合法原牌实例代表态直接证明正费用扣款，不能称为自然抽牌。 |
| 开局、四阶段和多轮 | 正式pipeline与真实网络单测自然11轮；新增浏览器自然链从选角到共同终局，无中途注入；实际247个步骤、1–11轮、本人0席被淘汰，三客户端终局一致。该随机种子未触发E12战后选择（0次），此分支由独立代表态证明。浏览器主视角实际操作选角、部署、御主抽牌、普通移动选择/取消/费用、令咒移动与恢复确认、攻击草稿/撤回/原子确认。最终自然链结果见下方日志。 |
| 战后、淘汰和终局 | `online-post-battle.e2e.ts` 两个明确代表态：真实服务/凭证，连接前一次注入，选择事务由正式pipeline生成；按第10/11轮高潮、合法地点、真实初始手牌及事件分区守恒构造。分数、资源、无地利位置和此前历史是代表态前提，不声称自然形成。本人确认后仍等下一席；最后响应后才淘汰/终局。第10轮另覆盖淘汰详情及真实淘汰本人凭证的观战界面。 |
| 当前交互与视觉 | 1920×1080、1366×768桌面和936×432横屏/真实触控上下文、触控检视、选牌/撤回/确认、空手牌、密集20牌、抽屉、详情、地图及令咒；行为断言与独立逐原图视觉审查分别记录。密集20牌是布局代表态，不代表本局合法数量或游戏上限。 |

## 最新验证记录

| 检查 | 当前结果 | 日志 |
| --- | --- | --- |
| 准备常显、地图目标文案、淘汰UI相关单测 | 2文件33项通过 | `temp/fate-preparation-unit-20261023.log` |
| 战后选择、淘汰、观战与末轮终局 E2E | 2项通过20.3秒；观战等待地图就绪后定向复跑1项通过16.9秒，未跳过原5步断言 | `temp/fate-post-battle-final-verified-20261023.log`、`temp/fate-observer-final-verified-20261023.log` |
| 自然联网浏览器完整链 | 1项通过4.8分钟；247步全部日志断言相等，终局权威/可见性均true | `temp/fate-online-final-verified-20261023.log` |
| 原手牌/骑乘 E2E | 手牌完整交互复跑通过40.8秒，仅定向重采已改写的空手牌1图；骑乘原4项本轮通过，后续修改未触及骑乘场景并有独立沿用证据，不冒称同批全绿 | `temp/fate-hand-final-current-20261023.log`、`temp/fate-browser-safe-slot-20261023.log`、`temp/fate-ui-carry-forward-scope-20261023.md` |
| 最终 Fate 全量单测 | **43文件229项通过**，包含真实网络4项及骑乘原23项 | `temp/fate-full-final-20261023.log` |
| 资源完整性 | 235/235变体大小与SHA-256完全匹配；manifest验证通过 | `temp/fate-asset-final-check-20261023.json`、`temp/fate-manifest-validation-20261023.log` |
| 全仓类型检查 | **未通过，4890项诊断**；最终日志未命中Fate路径，不能记全仓通过或发布就绪 | `temp/fate-final-typecheck-20261023.log` |
| 本轮相关文件ESLint | 0错误、107警告；保留全部警告，不关闭校验 | `temp/fate-final-eslint-20261023.log` |
| 规范/规格 | `spec-lint: OK`，两个change的严格验证均valid | `temp/fate-final-spec-lint-20261023.log`、`temp/fate-final-foundation-validate-20261023.log`、`temp/fate-final-mechanism-validate-20261023.log` |

所有最终截图均来自当前真实运行页面，图片门禁保持开启。行为trace记录实际输入前后可见与权威状态、运行来源及媒体哈希；独立图审只证明交互/UI，不代替规则数值测试。旧截图、旧勾选和历史PASS未用作当前结论。

## 资源恢复与发布边界

从用户指定 `D:/gongzuo/webgame/gameasset/fate命运之夜` 的CHM解压图、原Mods/Images及TTS索引恢复96张同哈希源图，压缩仅接纳大小与SHA均匹配既有manifest的产物；Q5/Q6取自已声明TTS原UGC图且四个源/压缩产物同哈希。最终235/235变体完整，manifest未重建，退役键未恢复。E2E在完整性检查通过后仅跳过会重扫/重建manifest的重复bootstrap；没有跳过图片或哈希门禁。资源只恢复本地，尚未上传/发布。

## 必须分别保留的未完成项

| 项目 | 未完成边界与后续动作 |
| --- | --- |
| 全卡效果 | 卡图、定义和局部executor存在不代表全部牌可执行。逐卡核对registry→executor→命令/事件→reducer→最终结果，补调查、残留、临时等缺口。 |
| 高级响应 | 完整响应窗口、替代、防止、复制/借用、控制权/所有权、嵌套frame及恢复仍按mechanism change推进；骑乘和E12不代表全覆盖。 |
| 角色能力 | 韦伯、绮礼等已有部分阶段能力和入口；不代表所有御主/从者能力完整。无限剑制的中文适用性及未选手牌去向继续锁中文主源，不猜规则。 |
| AI | manifest `localAi:false/remoteAi:false`；测试客户端策略不构成AI功能验收。 |
| 教程 | `tutorial.ts` 为 `steps:[]`，教学未完成。 |
| 音频 | `criticalSounds:[]`、`feedbackResolver:()=>null`，Fate完整音频未接入。 |
| 资源发布 | 远端资源、file-index、Android游戏包、生产URL回查未执行；脏砚令咒素材来源缺口保留。 |

## 正式查看器与原始证据

- [手牌、桌面与触控：12张](http://127.0.0.1:4867/?key=e87d6049367a)
- [骑乘：4张](http://127.0.0.1:4867/?key=489987a54bff)
- [真实联网自然11轮：11张](http://127.0.0.1:4867/?key=234cd79da4b2)
- [战后、淘汰、观战与终局代表场景：8张](http://127.0.0.1:4867/?key=cc5a3ce5cf9a)

查看器已按正式清单注册，未自动打开；供用户查看不等于用户已验收。每组目录含原图、`.e2e-image-index.json`、`focused-pass-manifest.json`、`visual-review.json`及实际行为trace。目录位于 `test-results/evidence-screenshots/fate-domination/正式*验收-20261023`；四份最终机器门禁日志为 `temp/fate-{hand,riding,online,postBattle}-final-gate-20261023.log`。

[独立逐图账本与沿用范围](acceptance-20261023/visual-review.json)、[汇总索引](acceptance-20261023/evidence-index.json)保留原路径、SHA、sourceRun/sourceRevision。手牌11与骑乘4图沿用原字节；新空手牌与观战帧使用独立定向链，旧链只提取本组保留的uiStates、保留实际步骤和derivedFrom。没有将旧图伪称新跑次。

过程失败保留为诊断并排除最终交付：初版自然终局日志以显式role查询隐式region，导致可见性false却未执行布尔断言；修后统一用Playwright语义可见性并真正expect，再完整重跑。初版观战在地图纹理尚未绘制时拍成黑底；修后等待现有资源ready和实际绘制帧，再定向重跑。旧错误日志或失败图不会因测试曾显示绿色而进入最终PASS清单。
