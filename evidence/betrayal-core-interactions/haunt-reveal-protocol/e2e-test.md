# 山屋惊魂作祟揭示顺序和秘密边界 E2E 证据

## 范围

- 规则切片：作祟开始后，先公开英雄介绍 / 设置；一名叛徒作祟再公开叛徒介绍 / 设置；之后才分开阅读秘密目标。无叛徒作祟不应出现叛徒公开步骤。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=1` 真实牌桌入口，经项目 harness 注入一名叛徒和无叛徒作祟代表态。
- 本次只证明作祟揭示层的公开步骤短标签、基础秘密边界提示和真实入口截图；不能外推为完整 `hauntSetupQueue`、每作祟公开 setup、隐藏叛徒 / 自由混战、段落级 reveal-on-use 或 50 个作祟完成。

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "作祟揭示|秘密|公开" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`3 passed / 179 skipped`。
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "作祟揭示|剧本书|首剧本作祟" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`4 passed / 77 skipped`。
- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/haunt-reveal-protocol.e2e.ts`
  - 结果：通过，0 errors。
- `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/haunt-reveal-protocol.e2e.ts`
  - 结果：通过，`2 passed`。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-作祟揭示-一名叛徒公开步骤.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\01-作祟揭示-一名叛徒公开步骤.jpg` | 真实牌桌顶部显示“作祟开始 / 赤红杰克归来”，显示叛徒为达里尔·海拉，并依次显示“公开：英雄介绍 / 公开：英雄设置 / 公开：叛徒介绍 / 公开：叛徒设置”；下方提示“之后分开阅读目标；使用规则时可公开对应文本”。 |
| `02-作祟揭示-无叛徒公开步骤.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-reveal-protocol\02-作祟揭示-无叛徒公开步骤.jpg` | 真实牌桌顶部显示“作祟开始 / 灰尘 / 无叛徒作祟”，只显示“公开：英雄介绍 / 公开：英雄设置”，没有叛徒公开步骤；下方提示“公开设置后全员读英雄目标；使用规则时读出对应文本”。 |

## 自动断言摘要

- 一名叛徒分支：
  - `betrayal-haunt-reveal-public-steps` 的 `data-haunt-type = one-traitor`。
  - 英雄介绍、英雄设置、叛徒介绍、叛徒设置四个公开步骤均在真实页面可见。
  - 秘密边界提示包含“之后分开阅读目标”。
  - 首剧本作祟发现文本只写“作祟开始”而不写“剧本”时，也会被识别为作祟开场并自动打开剧本书。
- 无叛徒分支：
  - `betrayal-haunt-reveal-cue` 和 `betrayal-haunt-reveal-public-steps` 的 `data-haunt-type = no-traitor`。
  - 英雄介绍和英雄设置可见。
  - 叛徒介绍和叛徒设置不存在。
  - 秘密边界提示包含“公开设置后全员读英雄目标”。
- 页面没有记录前端致命错误。

## 图面核验

- 通过。两张截图都是 1600x900 真实牌桌整屏，不是加载页、错误页、局部裁切或替代说明页。
- 通过。一名叛徒截图的顶部作祟揭示层清楚列出英雄和叛徒公开步骤，并能同时看到当前牌桌和右侧作祟状态。
- 通过。无叛徒截图的顶部作祟揭示层只列英雄公开步骤，右侧仍显示作祟已开始，底部仍保留灰尘剧本的研究 / 疾病 / 交换疾病进度。
- 通过。两张图都保留短提示，不把完整规则解释正文常驻在主牌桌 HUD 上。

## 服务器相册

- 已发布：`http://8.148.71.102:18080/#/boardgame/betrayal-haunt-reveal-protocol`。
- 服务器健康检查通过：`http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
- 远端 `latest` 目录回查通过：包含 `manifest.json`、`01-01----.jpg`、`02-02----.jpg`，两张图片文件非 0 字节。
- 公开详情页回查通过：手机视口打开相册后加载 2 张图片，实际图片元素类为 `mobile-viewer-image`，首图自然尺寸为 `1600x900`。
- 根路径回查通过：`http://8.148.71.102:18080/` 仍显示任务列表，不是单图页或强制跳转。

## 未覆盖范围

- 尚未实现完整 `hauntSetupQueue`，公开 setup 还不是逐条可确认的有序队列。
- 尚未按 50 个作祟逐条拆出公开 setup、秘密目标、特殊规则和段落级可见性。
- 尚未实现隐藏叛徒、自由混战和自愿替代叛徒等完整阵营模型。
- 尚未实现对方请求朗读已使用规则段落的交互和 `revealedHauntParagraphs` 记录。
- 尚未证明完整作祟系统、怪物系统或山屋惊魂完整规则实现完成。
