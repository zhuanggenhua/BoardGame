## 1. Specification

- [x] 1.1 为 `betrayal-first-scenario-runtime` 补充起始拓扑与教程前置完备要求。
- [x] 1.2 为 `tutorial-engine` 补充“教程不得建立在临时 runtime 上”的 `betrayal` 落地约束。
- [x] 1.3 运行 `openspec validate update-betrayal-runtime-topology-and-tutorial-readiness --strict --no-interactive`。

## 2. Runtime Topology

- [x] 2.1 把起始三联板拆成真实显式房间节点，补回 `Hallway`。
- [x] 2.2 让起始楼层连接回到规则真相：`Basement Landing <-> Ground Floor Staircase <-> Upper Landing`。
- [x] 2.3 把探索入口改成按开放门位计算，而不是只保留一个预设槽位。

## 3. Runtime Rules

- [x] 3.1 清掉当前首剧本 runtime 里仍然明显是临时/简化的规则逻辑。
- [x] 3.2 更新首剧本 helper / 领域测试 / E2E，使其建立在新拓扑上。

## 4. Documentation

- [x] 4.1 更新 `docs/games/betrayal/README.md` 与相关实现文档，明确当前 topology 真相源与教程前置边界。
