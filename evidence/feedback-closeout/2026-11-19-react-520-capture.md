# React 可恢复错误的诊断采集验证

- 线上反馈原文：`[auto][window.error] Minified React error #520; visit https://react.dev/errors/520 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`
- 反馈记录没有保存被 React 包装的原始异常，不能从一个 `sw:faction_selected` 上下文事件判断具体出错页面或原因，状态保持 `open`。
- 本地 Vite 生产构建使用真实 React 并发更新，组件第一次渲染抛出 `TypeError`，React 同步重试成功；真实 Chromium 页面出现 `recovered`，项目现有自动反馈产生同样的 #520，包含 `causeName=TypeError` 和正式直连域名下的构建文件行列。请求由测试路由拦截，没有发送生产反馈。
- 项目 E2E 正式入口 `node scripts/infra/run-e2e-single.mjs ci e2e/platform/react-recoverable-feedback.e2e.ts` 通过 1 项；测试文件 ESLint 通过。后端只保存白名单错误类型与构建指纹、行列的行为由既有服务端真实 Mongo 定向测试分别覆盖，本次浏览器测试未连接该数据库。
- 采集改进尚未部署；它只能用于后续新异常，不恢复历史 `cause`，不能说明历史故障已修复。
- 2026-11-19 线上只读复查：此记录无私密回放、原始 cause 和堆栈；没有用户、会话、房间、对局或请求标识，按已有 chainId / captureId 在反馈库中没有找到其他关联记录。客户端快照标记为游戏页且有弹窗，最后一次点击比采集时间早约 2.9 秒，最近一次路由变化早约 42.7 秒，事件尾部包含 `sw:faction_selected`；这些只能缩小候选状态，不能证明是哪一个页面组件或操作触发异常。
- nginx 日志在入库同秒有唯一一条反馈 POST，其同 IP 和 User-Agent 在前后 5 分钟内有 URL 前缀为 `/play/summonerwars/match/` 的请求；核对发现这些请求的路径层级比实际游戏页面路由更深，不能当作成功打开对局页面的证据。同 IP 和 User-Agent 也不是可靠会话标识，不能单独证明对应玩家或同一次渲染。该来源在反馈前约 3.5–4.7 分钟有王权骰铸雷神状态图集 JSON 的 404；当前代码会批量读取各角色图集，因此不能据此判断玩家选择了雷神。时间、游戏和错误机制均不足以将它归因为 #520。没有修改该反馈状态。
- 额外只读检查：当前线上页面域名和默认官方资源域名对应雷神图集 JSON 的请求仍返回 404；本地中文图集文件存在。该资源缺口与本条 React 告警的因果关系未建立，未将相邻资源问题冒充为本条反馈的根因或修复。
- 2026-11-19 只读核对当前生产 web 镜像 revision `626d7ca3556a9b64ce584c72ef350f34f8ab3ebc`：当前前端入口构建中的 `VITE_SENTRY_DSN` 为空，前端 Sentry 初始化条件不成立；当前 HTML 也不含本地新增的预加载恢复脚本和启动失败事件。容器启动时间为 `2026-11-17T18:58:22Z`，晚于本条反馈 `2026-11-17T12:56:33Z`，因此此检查不能证明历史告警时前端监控是否启用或有无历史 Sentry 事件。后端存在 Sentry 配置不等于前端已启用；本地相关修复尚未在该生产镜像中验证。
- 追查告警前构建：GitHub Actions 的生产输送运行 `43928204987` 构建 revision `77344b3b41f739e9473520d5ff25d3600412e5b9`，日志显示 `2026-11-16T18:30:13Z` 部署完成，web 构建两处 `VITE_SENTRY_DSN` 参数均为空。查询 Actions 后续运行，直至告警时刻未发现另一条 Docker 发布运行。该证据表明最近一条可见的 CI 生产发布未配置前端 Sentry；但不能排除其他发布渠道或浏览器缓存旧入口，因此不能断言历史页面一定没有 Sentry 记录。
