## Context
- `easyboardgame.top` 当前由 Cloudflare Pages 提供，`api.easyboardgame.top` 通过 Cloudflare Tunnel 回源生产机，`assets.easyboardgame.top` 是 R2 桶 `boardgame-assets` 的自定义域名。
- 当前没有 Worker Route 或 Load Balancer。用户不接受付费 Load Balancer，但要求现有素材域名自动检查服务器状态并回退 R2。
- 实测 Cloudflare 请求当前多次命中洛杉矶，服务器 HTTP 公网直连明显更快；但只要公开素材入口仍经过 Worker，就不能承诺获得与客户端直连服务器 IP 相同的延迟。
- 生产机系统盘约 40GB，清理后约 14GB 可用；内存约 1.8GB，游戏服务占用较高。素材镜像必须限定范围并主动保护业务容器。
- R2 `official/` 约 9.68GiB，其中应用更新和移动素材包约占 8GiB，不适合全量镜像到生产机。
- Cloudflare 的 10GiB-month 是免费计费额度，不是上传硬上限。当前 R2 实际为 10,395,737,230 字节，约 9.68GiB，只剩约 341MiB；如果没有项目侧门禁，继续上传可能成功但产生费用。
- 现有 R2 到 `/opt/boardgame-assets-backup` 的定时任务没有产生有效文件，不能作为备份或回滚来源。
- 服务器 25GB 已用空间主要由操作系统、Docker/containerd、数据库和工具链组成，不是 25GB 网页文件；但已经确认以下持续增长或可治理项：
  - 游戏容器 Docker JSON 日志约 232MB，当前没有大小/文件数轮转；
  - MongoDB Docker JSON 日志约 33MB，当前没有轮转；
  - 游戏应用文件日志约 72MB，默认保留 30 天；
  - 生产显式开启训练数据采集，单日已经生成约 518MB，默认保留 30 天；
  - systemd 崩溃转储约 713MB；
  - root npm 缓存约 697MB；
  - `/www/swap` 是正在使用的 1GiB 交换文件，不属于垃圾；
  - `/www/server/panel` 是仍在运行的宝塔面板，不能按缓存删除；
  - `/home/admin/image-preview` 是监听 18080 的第三个 Node 服务，不属于两个生产容器。

## Goals / Non-Goals
- Goals:
  - 公开素材 URL、前端资源基址和协作者上传入口保持不变。
  - 服务器可用时优先提供普通运行时素材；服务器不可用或未同步时自动从 R2 返回。
  - 大型更新包不进入服务器，避免挤占磁盘、内存、磁盘 IO 和公网带宽。
  - 支持 GET、HEAD、Range、ETag、Content-Type、Cache-Control 和 CORS 等现有下载合同。
  - 任何 Cloudflare、服务器镜像或 R2 清理动作都有明确回滚路径。
  - R2 存储长期保持在 9GiB 项目硬门禁以下，不允许因上传自动进入付费区。
- Non-Goals:
  - 不删除 R2，也不把服务器镜像升级为素材真相源。
  - 不改变 `assets:upload`、移动包发布或 OTA 发布的协作者操作入口。
  - 不使用 Cloudflare Load Balancer 或其他付费故障切换产品。
  - 不承诺 Worker 转发链等同于客户端直连服务器 IP。
  - 不尝试在响应字节已经发送给客户端后，把同一次流式响应无损切到 R2。
  - 不允许在 R2 无法容纳新对象时只发布服务器副本；这会使“服务器故障自动回退 R2”对新对象失效。

## Decisions

### Decision: R2 保持真相源，服务器只做可重建镜像
- 所有正式上传仍先写 R2，并完成现有 manifest/file-index 校验。
- 服务器后台只从 R2 拉取允许镜像的运行时对象，不接受协作者直接上传。
- 镜像损坏或服务器丢失时，可从 R2 重新构建，不会形成双向同步冲突。
- 只有通过零付费容量预检后才允许开始上传；R2 空间不足时必须先释放安全历史对象，不能退化为服务器单边发布。

### Decision: 项目侧实施 9GiB 零付费硬门禁
- Cloudflare 不会在 10GiB 免费额度处自动拒绝上传，因此项目必须自己限制。
- 初始参数：
  - 运行硬上限：9GiB，即 9,663,676,416 字节；
  - 首次清理目标：8GiB 以下；
  - 预留缓冲：至少 1GiB，用于发布过程、月度平均波动和对象替换。
- 上传前必须计算：
  - R2 当前对象总字节数；
  - 本批新增对象大小；
  - 覆盖同 key 可释放的旧对象大小；
  - 已隔离且允许删除的历史对象大小。
- 如果预计上传后超过 9GiB：
  1. 只允许删除已经完成引用核对、服务器隔离和恢复演练的候选；
  2. 清理后重新计算；
  3. 仍超过上限时，在上传第一个对象前失败并输出容量报告。
- 禁止“先上传，月底再看费用”，也禁止把 Cloudflare 免费额度当成硬容量限制。

### Decision: 使用 Worker Route 实现免费同域回退
- `assets.easyboardgame.top` 的普通运行时请求进入 Worker。
- Worker 仅允许 `GET` 和 `HEAD`，不会承接上传、删除或对象管理。
- Worker 使用带密钥的隐藏源地址请求服务器静态服务，避免公开绕过限流访问源站。
- 服务器源在以下情况被判定为本次请求不可用：
  - 建立连接失败；
  - 可配置的响应头等待时间超时，初始建议值为 1500ms；
  - 返回 `404`、`408`、`429` 或 `5xx`。
- 上述情况使用 R2 Binding 读取同 key 对象，并通过 `writeHttpMetadata`、`httpEtag`、Range/条件请求参数恢复下载语义。
- 服务器返回 `200`、`206` 或 `304` 时直接流式返回，不复制完整文件到 Worker 内存。
- 一旦服务器响应体已经开始发送，中途断流无法在同一 HTTP 响应内安全切到 R2。该场景依赖客户端重试、Range 续传和服务器固定限流降低概率，不包装为“无损自动切换”。

### Decision: 大型包通过更具体的无脚本 Route 继续直达 R2
- 为以下路径创建比 catch-all Worker Route 更具体的 bypass route：
  - `assets.easyboardgame.top/official/app-updates/*`
  - `assets.easyboardgame.top/official/mobile-packages/*`
  - `assets.easyboardgame.top/official/native-app-updates/*`
- 这些路径继续由当前 R2 自定义域名直接提供，不消耗服务器资源，也不进入服务器镜像。

### Decision: 首版采用固定保护，不做复杂自适应限流
- Nginx 静态源使用独立端口，建议初始保护值：
  - 全局同时传输连接上限 32；
  - 单客户端同时连接上限 4；
  - 每个响应前 1MiB 不限速，之后限制为 2MiB/s；
  - 只开放 `GET`、`HEAD`。
- Nginx 静态服务与 rclone 同步任务使用低 CPU/IO 权重；rclone 初始使用 `--transfers 2 --checkers 4 --bwlimit 2M`。
- Worker 的短超时和 R2 fallback 负责快速卸载源站拥塞。
- 选择固定上限的原因：当前生产机资源较小，CPU/负载自适应算法容易产生抖动和误切换；先用可审计的硬上限更安全。
- 若固定保护上线后仍出现游戏延迟，再单独提案增加基于游戏健康指标的熔断器，不能把首版复杂度隐藏在本次变更中。

### Decision: 素材镜像上线前先停止服务器无界增长
- Docker Compose 必须为四个容器配置 JSON 日志轮转，初始建议 `max-size=20m`、`max-file=3`。
- 应用文件日志初始建议改为：
  - 普通日志单文件 20MB、保留 7 天；
  - 错误日志单文件 20MB、保留 14 天。
- systemd coredump 必须配置最大占用，例如 200MB；历史转储清理前保留文件列表和时间信息。
- `ENABLE_TRAINING_DATA_CAPTURE=true` 当前每天可能产生数百 MB，且默认只把 30 天前文件移动到 archive，并不会压缩或删除。
- 生产素材镜像上线前默认将训练数据采集关闭；如果用户明确要求保留，必须另设独立目录、压缩和总容量上限，不能继续写入容器可写层。
- `/www/swap`、正在运行的宝塔面板、Mongo/Redis 数据卷和 rollback-last 依赖镜像不属于垃圾，不纳入自动清理。

### Decision: 训练数据只按完整合格对局原子提交
- 每条合格座位决策先写入 `pending/`，该目录不属于正式训练数据。
- 只有 `sys.gameover` 已产生、对局持续时间达到门槛时，才把该局完整 JSONL 文件原子改名到 `completed/`；中途退出和异常退出不会产生正式文件。
- 门槛优先读取游戏 manifest 的 `ai.trainingMinCompletedDurationMs`，没有游戏级值时使用全局环境变量；两者都缺失时安全停录，不使用不可解释的硬编码平均时长。
- 每游戏正式数据上限固定为 300MiB，容量统计包含既有 `raw/`、`archive/` 和新 `completed/`；新对局会导致超限时整局拒收，不删除或截断已有文件。
- 同一游戏的提交按进程内队列串行化，容量检查与原子改名处于同一临界区，避免并发终局同时越过上限。
- 生产 `game-server` 将训练根目录挂载到独立 Docker 命名卷，容器重建后 `completed/` 和既有正式数据继续存在。

### Decision: 镜像使用 staging 校验和原子切换
- 运行时镜像放在独立目录，例如：
  - `/home/admin/storage/assets/releases/<sync-id>/`
  - `/home/admin/storage/assets/current` 指向当前通过校验的 release。
- 同步先写新 release，不直接覆盖 `current`。
- 同步完成后按 manifest/file-index 校验路径、大小和哈希，再原子更新 `current` 软链接。
- 同步失败时保留旧 `current`，Worker 继续使用旧镜像或回退 R2。
- release 只保留最近两个已验证版本，删除旧 release 前确认它不是当前或上一个回滚目标。

### Decision: 只镜像运行时路径
- 默认镜像：
  - `/official/i18n/**`
  - `/official/common/**` 中非发布包对象
  - `/official/atlas-configs/**`
  - manifest 证明仍被运行时引用的其他普通素材
- 永久排除应用更新、移动素材包、原生更新包和临时/历史发布产物。
- 镜像集合由 manifest/file-index 生成，禁止用“把 `official/` 全量 sync 到系统盘”代替。

### Decision: R2 清理先隔离后删除
- 清理器必须保留：
  - 当前 manifest/file-index 的全部递归引用；
  - 每个游戏最近若干完整包；
  - 当前 full fallback；
  - OTA 桥接版本；
  - 最近发布时间窗内对象；
  - 手工保护清单。
- 删除前生成包含 key、size、etag/hash、lastModified、保留原因或删除原因的不可变清单。
- 候选对象先下载到服务器隔离目录并校验，隔离总量不得让系统盘低于 25% 空闲。
- 隔离校验完成后才允许从 R2 删除；默认隔离 14 天，期间通过同一清单支持回传恢复。
- 隔离空间不足、哈希不一致或引用关系不唯一时停止删除，不使用“看起来旧”作为依据。

### Decision: 实施前轮换已暴露的 R2 凭据
- 被跟踪的 `.env.example` 中存在可用 R2 配置，正式实施前必须：
  1. 创建新密钥；
  2. 更新 CI、本机和服务器；
  3. 验证上传、读取和同步；
  4. 撤销旧密钥；
  5. 将 `.env.example` 改为空占位符。
- 在新密钥完成验证前不撤销旧密钥，避免中断协作者发布。

## Rollout Plan
1. 导出当前 DNS、R2 自定义域名、Tunnel、Worker Route 和脚本配置，形成可执行回滚快照。
2. 清理已确认的服务器缓存/崩溃转储，配置 Docker、应用日志和 coredump 容量上限；关闭或重新预算训练数据采集。
3. 生成 R2 保留/删除清单，把第一批安全候选归档到服务器隔离区并完成恢复演练。
4. 删除已隔离候选，将 R2 降到 8GiB 以下；在上传脚本启用 9GiB 硬门禁。
5. 完成 R2 密钥轮换和现有上传/读取验证。
6. 在服务器安装独立 Nginx 静态源，使用未占用端口并保持公网不可直接访问。
7. 建立隐藏 Tunnel hostname 和源站密钥校验，只允许 Worker 访问。
8. 建立 rclone staging 同步、manifest 校验、原子切换和 systemd timer。
9. 部署未绑定正式域名的 canary Worker，验证服务器命中、R2 强制回退、HEAD、Range、ETag、CORS 和缓存。
10. 对大型路径配置 bypass route，确认仍直接由 R2 提供。
11. 在低流量窗口绑定 `assets.easyboardgame.top/*` catch-all route，观察游戏/API 延迟、服务器内存、磁盘 IO、素材错误率和回退率。

## Rollback Plan
- Worker 异常：删除或禁用 catch-all Worker Route，流量立即恢复到现有 R2 自定义域名。
- 服务器静态源异常：Worker 保留但关闭服务器优先开关，全部请求直接使用 R2 Binding。
- 同步异常：不切换 `current`；必要时把软链接切回上一个已验证 release。
- Tunnel 异常：移除隐藏 hostname，不影响现有 API Tunnel hostname。
- R2 误删：使用删除清单和服务器隔离副本按原 key、元数据和哈希回传。
- 任一回滚都不要求协作者修改上传命令或前端修改资源基址。

## Acceptance Criteria
- 现有公开素材 URL 不变，现有 Web/Android 客户端无需更新即可读取素材。
- 协作者现有上传/发布命令不变，上传完成后 R2 仍是第一落点。
- 服务器源正常时普通运行时素材返回 `X-Asset-Source: server`。
- 停止静态源、制造超时或请求服务器未同步对象时，同 URL 返回 `X-Asset-Source: r2-fallback`。
- 三类大包路径返回 `X-Asset-Source: r2-direct` 或直接绕过 Worker，且服务器无对应下载流量。
- GET、HEAD、Range、ETag、Content-Type、Cache-Control、Content-Length 和 CORS 行为与现有链路兼容。
- 素材压力测试期间游戏/API 健康检查持续成功，游戏容器无新增重启，服务器磁盘保持至少 25% 空闲。
- 移除 Worker Route 后，`assets.easyboardgame.top` 能恢复当前 R2 直出链路。
- 首批 R2 删除前完成一次“隔离对象删除后按原 key 恢复并校验哈希”的演练。
- R2 当前用量降到 8GiB 以下，上传脚本对预计超过 9GiB 的发布在写入前失败。
- R2 容量不足时不得只更新服务器镜像；正式发布必须同时具备 R2 回退副本。
- Docker 日志、应用文件日志、coredump 和训练数据均具有明确容量上限，服务器不再按当前速度无界增长。
