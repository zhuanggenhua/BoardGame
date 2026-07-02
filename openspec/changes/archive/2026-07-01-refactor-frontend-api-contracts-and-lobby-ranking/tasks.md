## 1. Contract Design
- [x] 1.1 定义前端后台请求合同 Module，集中管理 `/admin/stats` 等后台入口。
- [x] 1.2 定义大厅热度加载结果类型，区分成功、失败、禁用和空数据。
- [x] 1.3 定义大厅排序解释因子类型，覆盖实施状态、热度分、精选回退顺序和原始顺序。

## 2. Implementation
- [x] 2.1 新增后台统计读取 Adapter，并迁移首页热度 hook 使用它。
- [x] 2.2 将 `useGamePopularityRanking` 从纯数字表返回升级为带状态的结果，同时保留兼容入口或小范围迁移调用方。
- [x] 2.3 将 `sortGamesForLobbyDirectory` 拆成排名解释与排序输出两个 Interface。
- [x] 2.4 确保实施中游戏始终排在已上线游戏之后，再比较热度与固定回退顺序。
- [x] 2.5 为请求失败保留 UI 降级展示，但让开发态日志/状态能明确暴露失败。

## 3. Guardrails
- [x] 3.1 增加统计入口合同测试，断言首页热度读取命中真实 `/admin/stats`。
- [x] 3.2 增加首页渲染测试，后台返回 Dice Throne 最高热度时首个游戏为 Dice Throne。
- [x] 3.3 增加排序解释测试，断言实施状态优先级高于热度。
- [x] 3.4 增加静态检查或测试，阻止首页/大厅新增直接拼 `ADMIN_API_URL` / `AUTH_API_URL`。

## 4. Verification
- [x] 4.1 运行相关 ESLint。
- [x] 4.2 运行热度 hook 与大厅排序测试。
- [x] 4.3 运行首页/大厅渲染合同测试。
- [x] 4.4 回到原始症状验证：Dice Throne 在真实热度数据生效时排第一，实施中游戏不再靠空热度或异常热度排第一。
