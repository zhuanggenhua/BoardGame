---
name: tutorial-workflow
description: "BoardGame 教程与新手引导：用于设计、重构、审查教程内容、交互与验证。"
---

# Tutorial Workflow

这是项目适配入口。多游戏教程的唯一设计与验收正文是 [`tutorial-design`](../../knowledge/standards/tutorial-design.md)；本文件只绑定仓库落点和验证命令。

## 使用入口

新增、补全、重构或审查教程，以及反馈规则遗漏、卡面读不懂、操作无理由、流程跳步、重复教学、新交互未教或退出 / 恢复异常时，读取 `tutorial-design`，按其中六个阶段执行。已有来源和上下文可沿用，不要求用户重复回答。

| 主源阶段 | 项目落点与检查对象 |
| --- | --- |
| 一、来源与范围 | 当前游戏规则目录、官方来源、正式 Board / 交互合同、实际查看的参考材料 |
| 二、目标筛选与总账 | 优先更新该游戏已有教程覆盖文档；记录本次选择及游戏内首次教学位置 |
| 三、玩家因果链 | 当前 manifest 的开局、牌序、随机、费用、状态与阶段；先用最窄领域链复演 |
| 四、决策文案 | 对应中英文语言包及 manifest 的首次教学位置 |
| 五、正式交互与生命周期 | 游戏教程注册、正式 UI、教程系统、页面生命周期与进度版本；按受影响 owner 修改 |
| 六、验收 | 当前游戏教程领域测试、真实入口逐步 E2E、明确白名单的关键节点截图链、视觉账本与用户查看器 |

具体游戏的规则取舍、牌序、资源因果与例外只放在该游戏覆盖文档。先完成来源、选择和因果链，再改玩家提示。跨游戏的选材、卡面读法、精简与截图标准只以 [`tutorial-design`](../../knowledge/standards/tutorial-design.md) 为准。

## 仓库验证

改源码 / 测试先遵循 [`code-design`](../../knowledge/standards/code-design.md)。读取当前 `package.json`，选已有安全入口运行直接相关的领域测试；使用 `node scripts/infra/vitest-cli-safe.mjs run <测试文件> --configLoader native` 可限定文件。

真实页面证据遵循 [`e2e-verification`](../../knowledge/standards/e2e-verification.md) 与 [`ui-audit-loop`](../ui-audit-loop/SKILL.md)，运行 `npm run test:e2e:file -- <当前教程 E2E 文件>`；完整走测与逐步断言不等于逐步截图。媒体交付引用 [`show-image-to-user`](../show-image-to-user/SKILL.md)。

- 源码变更：`npm run typecheck -- --pretty false`。
- 规范变更：`npm run spec:lint`、`git diff --check -- .spec`。
- 最终媒体：`npm run verify:e2e-evidence -- <当前 PASS 清单>`。

最终汇报区分：通用流程改动、当前游戏实际改动、规则覆盖 / 操作 / 视觉 / 生命周期各自的证据与缺口。没有实际发布，不能把本地结果称作线上更新。
