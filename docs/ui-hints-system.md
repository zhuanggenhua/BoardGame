# UI 提示系统索引

本文记录 UI 提示系统的代码入口和使用边界，不承载玩家交互规则。可点对象、目标高亮和权限判断以 [`rule-driven-interaction-design`](../.spec/knowledge/standards/rule-driven-interaction-design.md) 与 [`ui-change-gates`](../.spec/knowledge/standards/ui-change-gates.md) 为准。

## 定位

UI hint 是派生提示：它帮助 UI 展示“当前哪些对象值得提示”，但不拥有业务权限。是否能移动、攻击、发动能力或选择目标，仍由领域规则、命令校验和当前交互合同决定。

## 当前入口

| 对象 | 入口 |
| --- | --- |
| 引擎 primitive | [`src/engine/primitives/uiHints.ts`](../src/engine/primitives/uiHints.ts) |
| 游戏层实现 | `src/games/<gameId>/domain/` 中派生 UI hint 的代码 |
| UI 消费 | `src/games/<gameId>/ui/` 中把 hint 转成高亮、边框或辅助标记的 hook / 组件 |
| 相关测试 | `src/games/<gameId>/**/__tests__/` 中覆盖 hint 与命令验证一致性的测试 |

## 数据流

```text
Domain / rules
  -> UIHintProvider 生成派生 hints
  -> UI hook 按视角、阶段和类型过滤
  -> UI 组件渲染高亮、边框、波纹或辅助标记
```

## 使用边界

- UI hint 不写入 `core`，只在需要时从当前状态派生。
- UI 层可以过滤和展示 hint，但不能在 UI 层重新计算业务合法性。
- 若 hint 与命令验证不一致，修唯一规则来源或交互合同，不在展示层补第二套判断。
- 隐藏测试锚点、DOM 属性和 hint 数据只能辅助验证；玩家可见目标仍必须在真实对象本体上有明确反馈。

## 适合保留的内容

- 类型定义、工具函数和示例入口。
- 当前游戏怎样从规则状态派生提示。
- 性能上需要按类型、玩家或阶段过滤的事实。

旧版长代码示例、单游戏教程和未来扩展示意已删除；需要看实际写法时直接读对应游戏源码。
