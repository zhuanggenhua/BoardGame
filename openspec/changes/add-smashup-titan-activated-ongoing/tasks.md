## 1. 规格与建模

- [x] 1.1 为 `smashup-titans` 增补“在场泰坦的主动 ongoing 能力”需求与场景。
- [x] 1.2 明确泰坦静态数据中的主动激活声明字段，以及它与 `abilityTags` 的职责边界。

## 2. 领域与 UI 入口

- [x] 2.1 为在场泰坦 ongoing 主动能力增加独立命令、validator 和 ability registry 解析入口。
- [x] 2.2 在 `BaseZone` / `Board` 中接入新的泰坦可点击状态与 dispatch 路径。
- [x] 2.3 确保该入口不复用 `talentUsed` 或 `ACTIVATE_SPECIAL` 的现有门禁。

## 3. 首个落地场景：Emperor Penguin

- [x] 3.1 用新入口实现 `penguins_emperor_penguin` 的“从牌库顶打出随从到本基地，代替常规随从打出”。
- [x] 3.2 修正 `penguins_emperor_penguin` 的静态能力元数据，确保 `abilityTags` 与触发机制一致。

## 4. 验证

- [x] 4.1 在现有 Smash Up smoke 中补 1-2 条典型用例，覆盖入口可用与出牌消耗。
- [x] 4.2 在 `e2e/smashup-alien-terraform.e2e.ts` 中补 1 条真实浏览器用例，并看图确认。
- [x] 4.3 更新 `evidence/` 与三件套，记录 proposal 落地结果。
