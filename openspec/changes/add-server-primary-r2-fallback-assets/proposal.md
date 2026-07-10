# Change: 服务端优先的同域素材分发与 R2 自动回退

## Why
- 当前 `assets.easyboardgame.top` 直接由 R2 提供素材，但目标网络多次命中洛杉矶节点，运行时素材下载明显慢于服务器公网直连。
- 用户要求继续使用现有素材域名、协作者继续使用现有上传命令，并在服务器异常时自动回退 R2；同时不接受付费 Load Balancer。
- 当前生产机只有约 1.8GB 内存，素材分发不能抢占游戏/API 服务资源；R2 当前约 9.68GiB，只剩约 0.32GiB 免费空间，也需要一套可回滚的历史对象清理和零付费容量门禁。

## What Changes
- 保持 `https://assets.easyboardgame.top/official/...` 公开地址不变，在该域名前增加免费的 Cloudflare Worker Route。
- R2 继续作为上传真相源和完整回退源；协作者仍执行现有 R2 上传/发布命令，不需要知道服务器镜像的存在。
- 上传脚本新增 9GiB 运行上限：上传前计算 R2 当前用量和本批净增量，超过上限时先应用已隔离、已验证的安全清理清单；仍无法降到上限以下时，在写入任何对象前失败，禁止静默产生费用。
- 首次上线前先把已确认未引用的历史发布包归档到服务器隔离区并从 R2 清理，将 R2 用量降到 8GiB 以下，为后续正常发布预留至少 1GiB 缓冲。
- 服务器通过受限速、低并发的后台任务，从 R2 增量同步运行时素材到独立静态目录；同步完成并校验后原子切换当前版本。
- Worker 对普通运行时素材优先请求服务器隐藏源；连接失败、响应头超时、`404` 或 `5xx` 时，使用 R2 Binding 返回同一个对象。
- 以下大文件发布路径始终直接由 R2 提供，不请求生产服务器：
  - `/official/app-updates/**`
  - `/official/mobile-packages/**`
  - `/official/native-app-updates/**`
- 服务器静态源设置固定连接数、单连接速率、CPU/IO 优先级上限；Worker 使用短超时快速卸载异常请求。首版不引入复杂的 CPU 自适应限流。
- 素材镜像上线前先治理服务器持续增长项：Docker 日志必须轮转，系统崩溃转储必须限额；生产训练数据采集默认关闭，只有用户明确需要时才改为单独容量预算和短期保留。
- 训练数据改为完整对局原子提交：中途退出不进入正式目录，游戏级最低完成时长优先、全局配置兜底，每游戏达到 300MiB 后停止接收新对局。
- 响应增加 `X-Asset-Source` 诊断头，明确本次命中服务器、R2 回退或大包直出。
- R2 清理必须先生成保留/删除清单，将候选对象带哈希归档到服务器隔离目录，再删除 R2 对象；隔离期内支持一键回传恢复。
- 上线使用 canary Worker 和隐藏源验证，最后才绑定现有素材域名；回滚只需要移除 Worker Route，现有 R2 自定义域名继续提供原链路。

## Impact
- Affected specs:
  - `asset-routing`
  - `asset-manifest`
  - `ai-training-data`
- Affected systems:
  - Cloudflare Workers Route、R2 Binding、Tunnel 配置
  - 生产服务器 Nginx 静态源、systemd/rclone 同步任务
  - R2 历史对象保留、隔离与恢复流程
- Expected repository areas:
  - `infra/cloudflare/asset-router/`
  - `scripts/assets/`
  - `scripts/deploy/`
  - `docs/deploy.md`
  - `docs/ai-rules/asset-pipeline.md`
  - `server/trainingDataRecorder.ts`
  - `src/engine/transport/server.ts`
  - `docker-compose.prod.yml`
