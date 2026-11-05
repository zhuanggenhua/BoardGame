# 外部方法吸收台账

本文件只记录外部候选方法的吸收裁决，不是第二套动态证据规范。可执行规则以 [`../SKILL.md`](../SKILL.md) 为唯一真相源。

## 已吸收

| 外部候选方法 | 吸收内容 | BoardGame 落地方式 |
| --- | --- | --- |
| `playwright-visual-testing` | 用真实浏览器上下文产生可复核视觉证据，而不是只做 DOM 断言 | 继续使用项目 Playwright runtime；媒体必须绑定真实 game / match route 和同次测试运行 |
| `browser-record` | 把浏览器操作过程保留成可回放媒体，便于定位“测试通过但玩家看不到”的问题 | 录制来源、过程、命中 / 结果和稳定收口四段，并保留原始帧 / GIF |
| `recording-browser-flow-as-test` | 让录制动作与测试动作保持同一操作路径，避免另做一条只为截图的旁路 | 真实点击、选择、确认和阶段推进必须与正常 E2E 使用同一入口和命中区 |
| `visual-evidence` | 证据需要有媒体、动作说明和验收结论的绑定关系 | PASS manifest 同时记录动作、语义状态、媒体路径、运行和缺口 |
| `record-browser-gif` / `visual-flow-gif` | 动态行为需要 GIF / 过程媒体，而不是只交静态首尾帧 | 对攻击、召唤、移动、投骰等连续行为建立动态媒体合同；GIF 必须保留真实时间比例 |

## 不吸收

- 不安装外部 skill，不引入其命令、目录、浏览器插件或第二套查看器。
- 不把外部通用录制器当成 BoardGame 的规则真相源；规则、FX cue、tuning 和正式页面仍以仓库实现为准。
- 不允许外部录制工具通过内部状态、测试专用按钮或隐藏标签替代玩家真实操作。
- 不用外部工具的“文件生成成功”替代 BoardGame 的目标本体、过程、命中 / 结果和稳定收口验收。
- 不把外部候选的截图命名、manifest 字段或默认帧率复制成项目硬规则；项目字段和文件名仍由 `e2e-animation-evidence` 与 `e2e-verification` 共同约束。

## 吸收状态

- 状态：方法已吸收进项目 skill，外部 skill 未安装。
- 活跃入口：`.spec/skills/e2e-animation-evidence/SKILL.md`
- 后续实现验证：必须回到正式 Mage Wars E2E，分别补远程和近战动态证据；旧远程 GIF 只能保留为历史 / 诊断材料，不能直接升级为当前 PASS。
