## 1. Specification
- [x] 1.1 新增 `betrayal-scenario-setup-model` capability delta。
- [x] 1.2 运行 `openspec validate refactor-betrayal-scenario-setup-model --strict --no-interactive`。

## 2. Domain Model
- [x] 2.1 抽出 `explorer catalog` 的长期身份数据，移除错误 owner 的起始状态。
- [x] 2.2 为 `betrayal` 新增全局 pre-haunt setup、首剧本配置、随机房间/抽牌池配置层。
- [x] 2.3 让 domain setup / `START_FIRST_SCENARIO` / 探索流程改为读取上述配置，而不是直接依赖散落常量。

## 3. Verification
- [x] 3.1 更新或新增 Vitest，证明 setup owner 与首剧本链路仍然成立。
- [x] 3.2 跑 targeted ESLint 与 targeted Vitest。
- [x] 3.3 若现有 first-scenario/basic-flow E2E 受影响，更新其最小必要夹具或断言。

## 4. Documentation
- [x] 4.1 在 betrayal 文档中明确当前“首剧本代表态”和后续“多剧本正式接入”的边界。
