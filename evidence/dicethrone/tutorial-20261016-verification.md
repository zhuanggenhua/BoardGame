# Dice Throne 双人交互式教学验收

## 本轮合同

用户要求交互式教程承担视频和文本规则的教学职责，并明确本轮先完整覆盖双人通用规则与操作。主线从正式双人僧侣开局连续运行；其余七个机制练习在首帧前建立已声明的合法代表态，各自独立，不冒充主线自然后果。

本轮本地验收通过：十四条正式浏览器路径、二百九十四张整屏媒体均已有对应逐图审查记录，最终清单校验通过。结论以同目录最终逐图报告、正式回放日志和最终清单为准；这是供用户查看的实现证据，不代表用户已经验收。

## 实现与实际问题

- 主线包含六十八张可见教学卡；正式教程目录包含主线与七个机制练习。
- 主线补齐起手、双方资源、阶段、出售与撤回、锁骰和重掷、改点与确认、选技、防御、奖励骰、响应、标记使用、收入、净化和升级；独立练习覆盖红橙牌介入、超限出售与重洗、终极真实终局、伤害与标记上限、三级升级差价、大小顺子、击倒两种处理及主动不发动。
- 学习者固定为座位零。本人首次防御、响应、支付和确认都保留正式玩家输入，对手使用公开合法命令。
- 修正超限处理错误调用不获战斗点数的弃牌命令；正式出售七张至六张时战斗点数从十四到十五，后续收入受十五上限约束。
- 修正正式本地命令附加撤回元数据后被闪避候选合同拒绝的问题；只接受既有传输元数据的真值，未知参数和错误伤害编号仍拒绝。
- 修正触屏长按抬手合成点击立即关闭手牌详情、透明侧栏拦截提示板放大镜，以及教程说明挡住资源、骰盘和净化确认入口的问题。
- 正式骰子与命中特效继续运行；取证等待其真实结束后读取结果，不关闭动画或使用假时间。

## 行为验证

实际执行：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/tutorial-practices.test.ts src/games/dicethrone/__tests__/tutorial-e2e.test.ts src/games/dicethrone/__tests__/tokenResponseChoiceContract.test.ts src/games/dicethrone/ui/__tests__/diceStagePolicy.test.ts src/games/dicethrone/__tests__/roll-context.test.ts src/pages/__tests__/matchRoomTutorialStageRuntime.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
```

结果：六个文件、一百零六项通过。日志：`.tmp/dicethrone-tutorial-regression-final.log`。数值与规则结论由这些行为测试承担，逐图报告只验证玩家可见交互。

最终修改后，另行执行 `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/tutorial-practices.test.ts src/games/dicethrone/__tests__/tutorial-e2e.test.ts src/pages/__tests__/matchRoomTutorialStageRuntime.test.tsx src/pages/__tests__/matchRoomPageShell.test.tsx src/pages/__tests__/matchRoomStages.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`，五个文件、三十三项通过，日志 `.tmp/dicethrone-tutorial-delivery-behavior-final.log`。结合上次运行中未改动的响应合同、骰盘策略、随机上下文三个文件八十三项，去重后为八个文件、一百一十六项，没有把重复运行相加计数。

类型检查通过，日志 `.tmp/dicethrone-tutorial-typecheck-final.log`；最终规范检查通过，日志 `.tmp/dicethrone-tutorial-spec-delivery.log`。目标静态检查零错误、四个警告，日志 `.tmp/dicethrone-tutorial-eslint-final.log`；其中三个为端到端测试的宽泛类型，一个为手牌区域的回调依赖提示。最后改写的主线、练习与布局辅助文件另行静态检查通过，日志 `.tmp/dicethrone-tutorial-layout-lint-final.log`。

目录壳层修复后再次类型检查通过，日志 `.tmp/dicethrone-tutorial-typecheck-delivery.log`。

最终新增文件与修改文件的静态检查为零错误、三个测试宽泛类型警告，日志 `.tmp/dicethrone-tutorial-delivery-eslint.log`；共享目录判断已移到纯函数文件，不留下组件热更新警告。

## 共享目录修复的影响边界

| 项目 | 本轮事实与保护 |
| --- | --- |
| 旧行为 | 所有 MatchRoom 页面包含选课目录都经过手机牌桌缩放壳；手机目录正文被缩至约五六像素。牌桌需要此壳保持固定构图，选课目录需要真实页面尺寸。 |
| 消费者 | 所有 MatchRoom 教程目录走共同目录判断；指定课程、单可见课程、隐藏章节过滤后的单课程和联机入口仍走牌桌壳。各游戏目录主题继续由原配置提供。 |
| 行为差异 | 仅把正式选课目录从牌桌变换树中移出。课程选择、路由、目录推荐顺序、隐藏章节、预加载 provider、光标 provider 和牌桌子树保留。没有新增手机目录或复制一套章节规则。 |
| 单一判断 | 页面壳和目录阶段共同读取 `shouldShowMatchRoomTutorialCatalog`，沿用原来“未指定课程且有两门以上可见课程”的条件。 |
| 保护证据 | 六项页面壳边界测试及四项既有目录测试通过，覆盖正式目录、指定课程、单课程、隐藏章节、七大恨主题覆盖和联机入口；真实桌面及手机目录回放与图审另行记录。 |

## 浏览器与逐图验收

正式入口为 `/play/dicethrone/tutorial` 及其各课程路由。主回放使用桌面鼠标点击与拖动、手机原生触屏事件；详情检视在长按抬手后仍保持打开，后续短按继续正常出牌。测试只读取状态作断言，不用测试分发替代玩家动作。

原始回放媒体根目录：`test-results/evidence-screenshots/dicethrone/tutorial-rebuild-20261016-r19`。来源运行由每条 `chain.json` 的 `sourceRun` 区分；定向修复回放只覆盖对应链，未变实现沿用已审通过证据。全部媒体包含各自主线或练习的前态、中态、后态，不把不同代表态拼成一局。

用户查看目录为 `test-results/evidence-screenshots/dicethrone/tutorial-complete-20261016-final`，将十四条链的整屏原图集中到同一层，逐张确认复制前后哈希一致；最终索引和审查报告保留原始路径及链路来源。查看器已注册二百九十四张媒体，未打开窗口，供用户查看：[完整教学验收图](http://127.0.0.1:4867/?key=4a58b14bc813)。全体媒体的查看入口预检亦已通过。

当前完整回放由三组最新运行组成：

| 覆盖 | 当前结果 | 实际日志 |
| --- | --- | --- |
| 桌面主线、手机原生触屏主线、合法放弃响应主线 | 三条全部通过 | `.tmp/dicethrone-tutorial-e2e-r27-main.log` |
| 七种机制练习及顺子、击倒的非推荐分支 | 九条全部通过 | `.tmp/dicethrone-tutorial-e2e-r28-practices.log` |
| 桌面、手机从正式目录选课并进入练习 | 两条全部通过 | `.tmp/dicethrone-tutorial-catalog-r25.log` |

十二条教学路径均检查实际文字 Range 位于可见边界内，避免把容器内边距误当成漏字，也不允许真实文字裁切。目录检查实际显示宽度、标题高度和按钮高度，并等待全部条目入场动画结束。

完整媒体索引共十四条链、二百九十四张整屏画面；桌面七十一条、手机七十一条、机制练习与放弃响应分支一百五十二条审查记录全部通过。已审且实现与条件未改的屏幕保留来源记录并登记沿用，机械重拍后更新当前原图哈希，不把重复采样冒充新一轮独立审图。

最终清单为 `tutorial-20261016-final-pass-manifest.json`，全量逐图报告为 `tutorial-20261016-final-visual-review.json`。
最终中文文案调整只影响纯粹伤害与附属伤害两张截图；两张均已定向重录、逐张复看、刷新哈希并重新进入全量证据校验。其余截图沿用已有逐图审查记录，没有重复开展整套图审。已执行 `npm run verify:e2e-evidence -- evidence/dicethrone/tutorial-20261016-final-pass-manifest.json`，结果为二百九十四张媒体、十四条前中后链路、二百九十四条逐图审计全部通过。

## 规范与边界

通用完整教学要求只在 `.spec/knowledge/standards/tutorial-design.md` 维护；单游戏来源、规则矩阵、元素职责、交互族与代表态合同记录在 `docs/games/dicethrone/tutorial-coverage.md`，不复制通用执行正文。

教程进度沿用已有版本判定：主线版本四、终极练习版本三。旧版本进度直接失效，从头开始；不迁移旧步骤索引。

本轮不包含其它英雄专属机制、伙伴、多人和团战。纯粹与附属伤害为规则分类参考，没有伪造僧侣当前不存在的对应技能结算；多效果维持没有玩家排序界面；响应偏好解释其作用，未声称亲手切换过开关。响应练习覆盖确认骰面后介入及重新选技，不声称覆盖所有英雄效果与所有选技后的重宣告组合。

本文件记录提交前的本地验收，不单独证明生产状态；提交、推送、部署与线上验证以发布回执为准。
