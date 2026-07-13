# The Gang 流程收口审计

## 结论

- 这次失败不是“没有 proposal”这一项能解释的。更严重的问题是：阶段 0 的规则对象到素材矩阵没有先闭合，执行却先把 Board、E2E 和收口文档当作完成证据。
- The Gang 当前仍不能直接称为完成。真实页面 E2E 已证明桌面运行时代码链路、基础素材和中局满元素过程态能走通；The Gang 本轮新增 77 个压缩资源当时已完成远端上传与回查；手机验收、用户桌面验收和最终完成口径仍需继续实施。当前资源完成态必须以服务器素材主源发布和回查为准，历史 R2/CDN 证据不再作为新流程入口。
- 当前已纠偏：`add-the-gang-data-and-runtime-closeout` 的 Approval Gate 重新打开；素材矩阵成为完成前置门禁；本轮已把牌面、警报、金条、桌面/牌槽和规则参考继续推进到运行时接入。
- 当前已接入的基础版运行时素材包括：24 个基础筹码、牌背、52 张普通牌面、警报、金条、桌面/牌槽和规则参考。2026-07-05 已纠正“白块截图误判为通过”的问题：资源文件本体已重建，The Gang 两条 E2E 均增加真实图片加载断言。
- action-log、AI、tutorial、undo UI 等 change 即使各自具备 proposal/design/tasks/spec，也只能说明对应附加能力局部成立；它们不能替代基础素材 intake，也不能把整体 The Gang 标为完成。

## Change 矩阵

| change | proposal | design | tasks | spec delta | Approval Gate |
| --- | --- | --- | --- | --- | --- |
| `add-the-gang-foundation` | 有 | 有 | 有 | 有 | foundation 局部成立；不能代表整体完成 |
| `add-the-gang-data-and-runtime-closeout` | 有 | 有 | 有 | 有 | 实施中；素材矩阵、桌面过程态、桌面教程端到端、The Gang 压缩资源远端发布和回查已补齐，手机验收、用户桌面验收和最终完成口径待继续 |
| `add-the-gang-action-log` | 有 | 已补 | 有 | 有 | 局部能力成立；不关闭整体素材门禁 |
| `add-the-gang-ai-test-path` | 有 | 已补 | 有 | 有 | 局部能力成立；不关闭整体素材门禁 |
| `add-the-gang-tutorial` | 有 | 已补 | 有 | 有 | 局部能力成立；不关闭整体素材门禁 |
| `add-the-gang-undo-ui` | 有 | 已补 | 有 | 有 | 局部能力成立；不关闭整体素材门禁 |

## 当前口径

- 可以说：The Gang 的代码链路、真实页面核心流程 E2E、桌面中局满元素截图、桌面教程端到端截图链、24 个基础筹码、牌背、52 张普通牌面、警报、金条、桌面/牌槽和规则参考接入已有证据；最新运行时和教程 E2E 已按 1920×1080 基线断言牌与筹码图片真实加载，PureRef 已打开 4 张关键截图，AI 已复看 `temp/the-gang-intake/the-gang-1920-desktop-contact.jpg` 确认不再是白块。
- 不能说：The Gang 基础版完整闭环已经完成；不能说 Approval Gate 已关闭；不能说 E2E 通过等于素材 intake 闭合。
- 待验证：手机验收、用户桌面验收和最终完成口径；远端资源状态裁定与桌面教程端到端已补齐，不再列为待打磨缺口。当前远端资源状态以后只看服务器素材主源。
- 当前合并口径：允许作为 `in_progress` 检查点合入主分支继续实施，不允许归档为“最终完成”。
