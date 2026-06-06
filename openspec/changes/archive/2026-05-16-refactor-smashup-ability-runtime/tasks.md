## 1. OpenSpec
- [x] 1.1 新增 `smashup-ability-runtime` spec，定义 ability program / prompt / flow / bridge / fail-fast 规则
- [x] 1.2 更新 `interaction-system`，规定 Smash Up prompt 必须绑定所属 resolution frame，不能作为第二条 continuation 主链
- [x] 1.3 更新 `systems-layer`，规定系统层允许游戏 runtime 通过声明式 program 驱动交互与 bridge，但不得旁路系统所有权
- [x] 1.4 运行 `openspec validate refactor-smashup-ability-runtime --strict --no-interactive`

## 2. 运行时骨架
- [x] 2.1 新增 Smash Up ability runtime 类型与解释器骨架
- [x] 2.2 把 trigger executor registry 收束到统一 runtime executor contract
- [x] 2.3 把 queued trigger 缺 executor 从静默吞掉改成 fail-fast
- [x] 2.4 给 base ability queued trigger 接到统一 runtime contract

## 3. 首批迁移入口
- [x] 3.1 让 trigger/base ability 集中入口可以执行简单 declarative program
- [x] 3.2 补充最小单测，覆盖简单 effect program 与缺 executor 报错
- [x] 3.3 审查当前入口，禁止本轮新增新的 raw queued-trigger 旁路
