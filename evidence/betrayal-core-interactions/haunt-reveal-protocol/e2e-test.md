# 山屋惊魂作祟揭示横幅 E2E 证据

## 范围

- 规则切片：作祟开始后，运行时必须用开局剧本卡 + 触发预兆确定作祟编号，并在牌桌只用短溯源表达；玩家可以通过既有剧本书入口打开规则详情，但主牌桌不公开秘密目标、隐藏身份、设置队列或规则步骤清单。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=1` 真实牌桌入口，经项目 harness 注入两条代表作祟链：`一抹鲜红 -> A Splash of Crimson -> 作祟 1` 和 `一瓶微尘 -> A Dusty Vial -> 作祟 3`。
- 本次只证明作祟揭示开场横幅的非模态处理、剧本卡 / 触发预兆 / 作祟编号短溯源、手动剧本书入口、关书后横幅保持、关闭横幅后牌桌动作释放，以及剧本入口按钮保持短文案；不外推为完整作祟系统、全量剧本卡 × 预兆映射或逐作祟 setup 队列。
- 夹具纠偏：旧一名叛徒 E2E 曾直接注入首剧本作祟态，实际溯源显示触发牌是 `书本`，与 `赤红杰克归来` 剧本卡期待的 `A Splash of Crimson` 不匹配；当前 E2E 已改为通过事件牌《一抹鲜红》真实触发首剧本，避免用不匹配代表态冒充规则正确。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "普通预兆触发作祟时记录开局剧本卡和触发预兆来源|一瓶微尘作祟检定成功会进入灰尘剧本|作祟风险" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`3 passed / 200 skipped`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "首剧本作祟检定只写作祟开始|作祟揭示切到下一行动者|大宅饿了作祟" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`3 passed / 90 skipped`；输出尾部有测试环境 `ECONNRESET/socket hang up` 噪声，但进程退出码为 0。
- `npx eslint src/games/betrayal/scenarioConfig.ts src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/haunt-reveal-protocol.e2e.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json`
  - 结果：通过，0 errors / 8 warnings；warnings 为 JSON ignored 以及 `game.ts` 既有未用函数。
- `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/haunt-reveal-protocol.e2e.ts`
  - 结果：通过，`2 passed`。

## 截图链

| 序号 | 文件 | 画面结论 |
| --- | --- | --- |
| 01 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\01-作祟揭示-一名叛徒横幅提示.jpg` | 一名叛徒作祟开场只显示顶部短横幅：`作祟开始，剧本发生变化，可以打开剧本查阅`、`剧本卡 赤红杰克归来 / 触发 A Splash of Crimson / 作祟 1` 和 `关闭`；没有流程面板、公开步骤、隐藏身份、setup 队列或横幅内打开剧本书按钮。 |
| 02 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\02-作祟揭示-一名叛徒打开剧本书.jpg` | 玩家通过右侧常驻剧本书入口打开剧本书，剧本内容在阅读层显示；这不是横幅里的第二入口。右侧入口按钮可见文案保持为短标签 `剧本`。 |
| 03 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\03-作祟揭示-一名叛徒关闭剧本书横幅仍在.jpg` | 关闭剧本书后回到牌桌，顶部横幅仍在，且仍显示剧本卡 / 触发预兆 / 作祟编号短溯源；牌桌后续动作仍未提前释放。 |
| 04 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\04-作祟揭示-一名叛徒关闭横幅后牌桌.jpg` | 点击横幅 `关闭` 后横幅消失，牌桌继续，右侧常驻剧本书入口仍可用。 |
| 05 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\05-作祟揭示-剧本3横幅提示.jpg` | 剧本 3 隐藏叛徒作祟开场同样只显示顶部短横幅：`剧本卡 赤红杰克归来 / 触发 A Dusty Vial / 作祟 3`；主 UI 不暴露隐藏身份、秘密目标、公开设置或 setup 队列。 |
| 06 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\06-作祟揭示-剧本3打开剧本书.jpg` | 通过既有剧本书入口打开剧本 3 内容，规则正文只在阅读层出现。右侧入口按钮可见文案保持为短标签 `剧本`。 |
| 07 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\07-作祟揭示-剧本3关闭剧本书横幅仍在.jpg` | 关闭剧本书后横幅仍在，仍保留 `A Dusty Vial / 作祟 3` 短溯源；隐藏叛徒后的研究/疾病/交换进度和行动入口仍未提前显示。 |
| 08 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\08-作祟揭示-剧本3关闭横幅后牌桌.jpg` | 点击横幅 `关闭` 后进入作祟后的真实牌桌，显示剧本 3 短进度和主动作入口。 |

## 图面核验

- 通过。8 张截图均为 1600x900 真实牌桌整屏，不是加载页、错误页、局部裁切或替代说明页。
- 通过。01 / 05 的作祟提示是顶部短横幅，不是居中 modal、流程面板或 action panel。
- 通过。横幅文案只有玩家能理解的短句：`作祟开始`、`剧本发生变化，可以打开剧本查阅`、`剧本卡 ... / 触发 ... / 作祟 ...`、`关闭`；未出现 `看清后可关闭`、`上屏`、`不上屏`、`setup 队列` 等审查/AI 话术。
- 通过。01 的首剧本横幅显示 `A Splash of Crimson / 作祟 1`，05 的剧本 3 横幅显示 `A Dusty Vial / 作祟 3`；两者都没有把公开设置、秘密目标或剧本规则正文塞进主 UI。
- 通过。右侧剧本书入口按钮只显示 `剧本`，没有 `剧本1查阅` / `剧本3查阅` 这类编号+用途拼接文案，因此不会因长文案撑大或挤压 rail。
- 通过。02 / 06 证明剧本书从既有常驻入口打开；03 / 07 证明关闭剧本书不会自动释放牌桌动作；04 / 08 证明关闭横幅后牌桌继续。
- 通过。剧本 3 横幅期没有暴露隐藏叛徒身份、秘密规则、公开设置或目标细节；这些内容只在剧本书 / 后续牌桌目标 UI 中出现。

## 服务器相册

- 已发布：`http://8.148.71.102:18080/#/boardgame/betrayal-haunt-reveal-protocol`。
- 本地发布命令：`D:\gongzuo\webgame\image-preview\scripts\publish-artifact.ps1 -Project boardgame -Task betrayal-haunt-reveal-protocol -Title "山屋惊魂作祟揭示短溯源" -Images <8 screenshots> -ImageTitles <8 titles> -KeepHistory`。
- 服务器同步范围：只同步 `D:\gongzuo\webgame\image-preview\data\projects\boardgame\tasks\betrayal-haunt-reveal-protocol` 到 `/home/admin/image-preview/data/projects/boardgame/tasks/`，未修改预览站应用壳层或根页。
- 服务器健康检查：`ssh admin@8.148.71.102 "curl -fsS http://127.0.0.1:18080/health"` 返回 `{"status":"ok"}`。
- 远端 manifest 回查：标题为“山屋惊魂作祟揭示短溯源”，`status=passed`，`images=8`，latest 目录包含 `manifest.json` 和 8 张 JPG。
- 公网详情页回查：`http://8.148.71.102:18080/#/boardgame/betrayal-haunt-reveal-protocol` 返回 200；移动视口打开详情页显示“截图 1 / 8”，首图自然尺寸为 1600x900。
- 8 张 artifact 直链回查：全部返回 `200 image/jpeg`，长度分别为 `129763 / 148979 / 130173 / 126766 / 129630 / 136787 / 129814 / 133555` 字节。
- 根路径回查：`http://8.148.71.102:18080/` 仍显示任务列表，且列表包含“山屋惊魂作祟揭示短溯源”，不是单图页或强制跳转。

## 未覆盖范围

- 不证明山屋惊魂完整 50 个作祟全部完成。
- 不证明全部剧本卡 × 预兆映射已完成；本次只覆盖已接入代表链和短溯源表达。
- 不证明完整叛徒选择策略、最高 / 最低属性平局、自愿替代叛徒等作祟定位细节已完成。
- 不证明完整隐藏叛徒阵营模型、自由混战或自愿替代叛徒规则已经全部实现。
- 不证明作祟后每个具体目标动作都已完整验收；本证据只覆盖作祟揭示横幅与剧本书入口链路。
