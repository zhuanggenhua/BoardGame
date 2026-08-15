# DiceThrone Token ActiveUse Custom Action

本文档只约束 DiceThrone 的 Token 主动使用建模，不属于跨游戏引擎通用规则。

## DiceThrone Token ActiveUse Custom Action（强制）

当 `TokenDef.activeUse` 的真实效果依赖 custom action，而不是 `effect.value` 本身时，必须显式声明 `activeUse.customActionId`。

```ts
activeUse: {
  timing: ['beforeDamageDealt'],
  consumeAmount: 1,
  customActionId: 'shadow_thief-sneak-attack-use',
  effect: { type: 'modifyDamageDealt', value: 0 },
}
```

- 禁止在执行层根据 `tokenId`、当前持有者英雄、前缀拼接等隐式规则去“猜” custom action。
- 原因：token 可以被转移、共享、复制；持有者不一定等于 token 的原始语义来源。靠持有者英雄推断会导致 token 被消耗，但 custom action 没触发。
- 执行层规则：优先读取 `activeUse.customActionId`；只有旧定义未声明时，才允许走兼容性兜底。
- 审计重点：`TokenDef.passiveTrigger.actions[].customActionId` 和 `TokenDef.activeUse.customActionId` 都必须纳入引用链检查与注册表校验。
- 特别注意：`effect.value === 0` 不等于“没有效果”。如果真实效果在 custom action 里，必须显式建模，不能把语义埋在命名推断里。
