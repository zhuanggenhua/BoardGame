# Fantasy Realms 真实 Chrome 开发端口漂移诊断（2026-06-26）

## 本轮要回答的问题

这份证据只回答一件事：

- 为什么用户手里的某些“真实 Chrome 页面”会和当前代码、当前 E2E、当前真实房间不一致
- 尤其是 `http://127.0.0.1:4276/...` 这类旧链接，当前到底还是不是可用的真实现场

它不重复论证“牌大小不一致”的业务 bug 本体；那条已经由另一份证据收口。

## 当前机器上的活跃开发端口

当前开发运行时记录文件：

- `D:\gongzuo\webgame\BoardGame\.tmp\dev-runtime-ports.json`

读取结果：

- 前端端口：`4275`
- 游戏服务端口：`18002`
- API 端口：`18001`

这说明当前本地前端真相源不是 `4276`，而是 `4275`。

## 本轮正式诊断脚本

脚本：

- [scripts/infra/diagnose-real-chrome-dev-runtime-drift.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/diagnose-real-chrome-dev-runtime-drift.mjs:1)

它做的事：

1. 连接带调试端口的真实 Chrome（`9222`）
2. 枚举当前会话里所有 `127.0.0.1 / localhost` 页
3. 对照 `.tmp/dev-runtime-ports.json` 的当前前端端口
4. 进一步探测各页目标端口是否还能返回开发前端资源（`/@vite/client`）
5. 把每个 tab 判成：
   - `当前活跃开发前端`
   - `仍存活但不是当前前端端口`
   - `失活旧前端端口`
   - `浏览器错误页-失活旧前端端口`

## 诊断产物

总表：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-dev-runtime-drift-2026-06-26.json`

我实际核过的两张关键图：

- 失活旧页：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-dev-runtime-drift-2026-06-26-04-4276-浏览器错误页-失活旧前端端口.png`
- 当前活页：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\fantasyrealms-real-chrome-dev-runtime-drift-2026-06-26-06-4275-当前活跃开发前端.png`

## 我实际看到的结果

### 1. `4276` 这页当前不是应用页面

总表里第 `4` 页显示：

- 原目标链接：`http://127.0.0.1:4276/play/fantasyrealms/match/rEB0NLISCax?playerID=0`
- 当前页面地址：`chrome-error://chromewebdata/`
- 正文直接出现：`ERR_CONNECTION_REFUSED`
- 本地存储不可读
- 页面里没有应用根节点，也没有 Fantasy Realms 牌桌根节点
- 探测 `http://127.0.0.1:4276/@vite/client` 失败

肉眼截图上也直接是浏览器的“无法访问此网站”，不是游戏页。

结论：

- 这页当前只能算“失活旧前端端口上的浏览器错误页”
- 它不能继续当“真实页面截图证据”
- 也不能再拿来否定当前代码或当前 E2E

### 2. `4275` 当前是真正在跑的开发前端

总表里多个 `4275` 页面都被判为 `当前活跃开发前端`，其中第 `6` 页显示：

- 目标链接仍是 `http://127.0.0.1:4275/...`
- `http://127.0.0.1:4275/@vite/client` 返回 `200`
- 页面标题是 `正在对局 幻想国度 | 易桌游`
- 应用根节点、Fantasy Realms 牌桌根节点都存在

肉眼截图上能直接看到当前正式牌桌，不是浏览器错误页，也不是空白壳。

## 和“牌大小不一致”那条线的关系

这份诊断说明：

- 用户之前看到“真实 Chrome 和当前代码/E2E 不一致”，其中至少有一部分并不是牌桌实现再次分叉
- 而是同一个浏览器里同时挂着：
  - 当前活着的 `4275` 开发页
  - 已失活的 `4276` 旧页

所以以后再遇到“真实 Chrome 和当前代码不一致”，第一步不能再只看截图本身，还必须先判活这个页对应的本地开发端口。

## 已补规范

已在 [.spec/knowledge/standards/e2e-verification.md](/D:/gongzuo/webgame/BoardGame/.spec/knowledge/standards/e2e-verification.md:85) 追加两条：

- 死端口旧页 / 浏览器错误页不得当真实现场证据
- 真实浏览器验收前必须先判活当前开发端口

## 当前结论

当前对话里可确认的事实是：

- “牌大小和 E2E 不一致”那条业务问题已经修到真实 Chrome 与 E2E 一致
- `4276` 这条旧链接当前不是应用异常态，而是失活开发端口上的浏览器错误页
- 今后这类页必须先剥离出“真实现场证据”集合，再谈当前 UI 是否仍有实现问题
