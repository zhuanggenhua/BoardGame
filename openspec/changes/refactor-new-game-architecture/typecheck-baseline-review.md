# 四项目类型基线审查记录（2026-10-26）

对照提交：`b0c1ff2b13c107e29da4f157195d4d9e694656d8`。使用相同锁定依赖及 Node 24.1.0，对照原始 checkout 的四项目诊断；未降低 strict、跳过项目或改动第三方类型。

| 项目 | 原始 HEAD 诊断 | 本次存量 | 门禁新增 / 失效豁免 |
| --- | ---: | ---: | --- |
| tsconfig.app.json | 2545 | 2316 | 0 / 0 |
| tsconfig.node.json | 4 | 0 | 0 / 0 |
| tsconfig.server.json | 2387 | 2139 | 0 / 0 |
| apps/api/tsconfig.json | 27 | 0 | 0 / 0 |

这里的“门禁通过”不等于原始 tsc 无诊断。app/server 尚有业务类型债务，本次将其锁定，后续修改不得添加错误或保留已经消失的豁免。`build:full` 的原始 `tsc -b` 也没有被替换为假通过。

## 来源核对

| 项目 | 同文件同完整诊断 | 拆分迁移同完整诊断 | 原语句诊断消息变化 | 人工复核迁移 |
| --- | ---: | ---: | ---: | ---: |
| app | 2219 | 24 | 62 | 11 |
| server | 2029 | 20 | 79 | 11 |

人工复核迁移的 11 项：Betrayal execute 的 4 项奖励 payload 字面量拓宽（原 game.ts 第 3426/3449/3474/3485 行）；验证分支的 3 项重复比较（原第 1989/1991/2337 行）；scenarioResolution 对 core.turnNumber 的 1 项访问（原第 1679 行）；SU eventSettlement 的 storedCards、TitanLocation 和触发时点联合共 3 项（原 index.ts 第 1713/3329/4211 行）。app/server 中的重复是项目依赖覆盖重叠。

62/79 项消息变化逐组对照：Cardia 判别类型修正后 unknown/never 连锁诊断展开为具体 payload 不匹配；SmashUp 事件联合补全改变联合成员数和展开文本；DT/SW/Mage Wars 仍是原语句对原业务合同的不兼容；少量 UI 是联合或类型名称的展开变化。它们仍是待修的旧业务合同，不被描述为本次已解决。

新增的服务端 manifest telemetry 逆变诊断没有收入最终豁免，已修正异构登记的方法合同；无 any 或 strict 降级。新事件批次/提交/持久化/事务/加载注册模块没有通过新增基线隐藏诊断。

独立只读 reviewer 复核了诊断来源、跨平台指纹和门禁防扩张实现，修正了 scope 去重遗漏与 CRLF/LF 字符偏移差异后通过。完整逐项来源 JSON 和原始日志随验收证据包交付。

## 后续操作

- `npm run typecheck`：四项目全部执行；精确诊断、AST 所有者指纹和数量不能增长，过期豁免也会失败。
- `npm run typecheck:prune`：只删除已经解决的豁免，有新增错误时拒绝写入。
- `npm run typecheck:strict`：直接呈现原始严格诊断，保留清零工作的真实入口。
- `npm run typecheck:guard:test`：真实临时四项目、可信 Git 基线、防扩大/减量、配置异常、编译器崩溃和换行稳定性测试。
- 初次 `--write-baseline` 只允许目标文件不存在。现有文件不能覆写；CI 与可信目标分支比较，不以 PR 自身新提交作为可扩大豁免的依据。

基线以完整诊断和 AST scope 识别错误，改动仍含存量错误的函数可能要求先修正该函数；不能把另一个函数的相同单行错误当成可交换额度。
