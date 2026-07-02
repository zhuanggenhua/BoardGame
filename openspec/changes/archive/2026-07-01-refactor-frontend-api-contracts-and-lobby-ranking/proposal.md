# Change: 前端请求合同与大厅排序框架化

## Why
这次“实施中游戏没人玩却排第一”的问题暴露的不是单个排序条件写漏，而是首页热度链路缺少框架级合同：前端 hook 可以手拼错误后台入口，请求失败又静默回退成“无热度数据”，排序结果也没有可审计的解释面。商业游戏不能靠每个页面作者记住路径和排序细节，必须把这些规则收进可复用 Module，并用同一个 Interface 承接请求、错误状态、排序因子与测试。

## What Changes
- 建立前端后台请求合同 Module，集中声明后台入口、路径拼接、响应校验与失败模式，禁止首页/大厅链路继续直接拼 `ADMIN_API_URL` 或 `AUTH_API_URL`。
- 将大厅热度加载从“返回一个数字表”升级为“返回数据 + 加载状态 + 失败原因”的 Interface，让请求失败不能被伪装成真实无数据。
- 将大厅游戏排序收敛为可解释的排名 Module，统一输出实施状态、热度分、回退优先级、原始顺序等排序因子。
- 增加合同级测试：统计入口路径必须命中真实 `/admin/stats`；Dice Throne 热度最高时首页第一；实施中游戏即使热度异常也必须排在已上线游戏之后。
- 增加开发态防线：新增首页/大厅请求时必须走集中请求 Module；排序规则变更必须覆盖解释因子测试。

## Impact
- Affected specs: `frontend-api-contracts`（新增）, `game-registry`
- Affected code: `src/hooks/useGamePopularityRanking.ts`, `src/components/home-v2/lobbyDirectorySorting.ts`, `src/components/home-v2/LobbyDirectory.tsx`, `src/api/`, `src/config/server.ts`
- Affected tests: `src/hooks/__tests__/useGamePopularityRanking.test.ts`, `src/components/home-v2/__tests__/LobbyDirectory.continueMatch.test.tsx`, 新增首页/大厅合同测试
