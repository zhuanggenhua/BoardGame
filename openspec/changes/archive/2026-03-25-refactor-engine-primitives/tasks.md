## 1. 原语层落地
- [x] 1.1 建立 `src/engine/primitives/` 入口与基础原语：`expression`、`condition`、`target`、`effects`、`zones`、`dice`、`resources`
- [x] 1.2 扩展通用原语：`ability`、`abilityConstraints`、`tags`、`modifier`、`attribute`、`damageCalculation`
- [x] 1.3 补充配套原语与工具：`actionRegistry`、`grid`、`uiHints`、`spriteAtlas`、`actionLogHelpers`、`mulligan`、`visual`

## 2. 游戏接入
- [x] 2.1 DiceThrone 接入 primitives 骰子定义、资源工具、伤害计算与图集/ActionLog 辅助
- [x] 2.2 SummonerWars 接入 expression / condition / target / ability / actionRegistry / grid / uiHints 等 primitives
- [x] 2.3 SmashUp 与 Cardia 接入 primitives 中的 mulligan、modifier、tags、ActionLog 等复用能力

## 3. 骰子口径迁移
- [x] 3.1 将骰子能力从旧 singleton/全局注册口径迁移为显式定义 + 纯函数 API
- [x] 3.2 保留多符号骰面、统计计算、触发判定等跨游戏通用能力

## 4. 文档与测试
- [x] 4.1 补齐 `src/engine/primitives/__tests__/` 下的原语测试
- [x] 4.2 更新 `AGENTS.md`、`.spec/knowledge/standards/engine-systems.md`、`docs/architecture.md` 等文档口径到 primitives 架构
- [x] 4.3 修正 openspec change 文档，使其与当前实现一致并可归档
