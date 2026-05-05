## ADDED Requirements
### Requirement: Smash Up ability prompt SHALL 绑定所属 resolution frame
当 Smash Up 能力运行时产出 prompt 时，InteractionSystem SHALL 把该 prompt 绑定到其所属 resolution frame，而不是允许游戏能力层自行持有第二套 continuation 主链。

#### Scenario: Prompt 恢复回同一 frame
- **GIVEN** Smash Up ability runtime 在某个 resolution frame 中产出了 prompt
- **WHEN** 该 prompt 进入 `sys.interaction.current` 并在之后被解决
- **THEN** InteractionSystem MUST 把结果回传给同一 resolution frame
- **AND** 后续继续执行 MUST 由该 frame 对应的 ability runtime 驱动

#### Scenario: Prompt 不得借 continuationContext 逃逸出 runtime owner
- **GIVEN** 一个 Smash Up prompt 需要多步上下文
- **WHEN** runtime 保存上下文供下一步使用
- **THEN** 该上下文 MUST 作为 ability runtime / frame owned data 存在
- **AND** InteractionSystem MUST NOT 要求能力层再维护第二条私有 continuation 主链

