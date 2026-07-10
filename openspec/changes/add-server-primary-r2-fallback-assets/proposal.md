# Change: 服务器主源的同域素材分发与 R2 灾备回退

## Why
- 当前 `assets.easyboardgame.top` 直接由 R2 提供素材，但目标网络多次命中洛杉矶节点，运行时素材下载明显慢于服务器公网直连。
- 用户要求继续使用现有素材域名、协作者继续使用现有上传命令，并在服务器异常时自动回退 R2；同时不接受付费 Load Balancer。
- 当前生产机只有约 1.8GB 内存，素材分发不能抢占游戏/API 服务资源；R2 当前约 9.68GiB，只剩约 0.32GiB 免费空间，也需要一套可回滚的历史对象清理和零付费容量门禁。
- 三类更新路径的历史对象合计约 8.25GiB，但当前公开清单递归引用的活动对象只有约 493MiB，适合在服务器只保留当前活动集合，而不是镜像全部历史包。

## What Changes
- 保持 `https://assets.easyboardgame.top/official/...` 公开地址不变，在该域名前增加免费的 Cloudflare Worker Route。
- 服务器 `/home/admin/storage/assets/current` 成为公开下载主源；R2 只保留同 key 灾备副本和服务器重建来源。协作者仍执行现有上传/发布命令，不需要改 URL 或直接登录服务器。
- 发布脚本通过受限 SSH 将本批对象直接写入服务器 staging，完成哈希校验和活动集合裁剪后原子切换 `current`；R2 不再是正式发布前置。
- 服务器切换后将本批对象加入异步 R2 灾备队列；预计超过 9GiB 时暂停灾备并告警，等待安全清理后重试，但不得阻塞或撤销服务器发布。
- 首次上线前先把已确认未引用的历史发布包归档到服务器隔离区并从 R2 清理，将 R2 用量降到 8GiB 以下，为后续正常发布预留至少 1GiB 缓冲。
- 原有 R2 到服务器同步器只保留为灾难重建命令，不再定时运行或覆盖服务器正式发布结果。
- 活动集合从各平台、各频道的 `latest.json`、游戏包指针和共享包指针递归解析，只保留仍被当前清单引用的 bundle、manifest、file-index 和安装包，不把历史发布全集复制到服务器。
- Worker 对所有 `official/**` 下载路径优先请求服务器隐藏源；连接失败、响应头超时、`404` 或 `5xx` 时，使用 R2 Binding 返回同一个对象。
- 服务器静态源设置固定连接数、单连接速率、CPU/IO 优先级上限；Worker 使用短超时快速卸载异常请求。首版不引入复杂的 CPU 自适应限流。
- 素材镜像上线前先治理服务器持续增长项：Docker 日志必须轮转，系统崩溃转储必须限额；生产训练数据采集默认关闭，只有用户明确需要时才改为单独容量预算和短期保留。
- 训练数据改为完整对局原子提交：中途退出不进入正式目录，游戏级最低完成时长优先、全局配置兜底，每游戏达到 300MiB 后停止接收新对局。
- 响应增加 `X-Asset-Source` 诊断头，明确本次命中服务器或 R2 灾备回退。
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
