## Context
- `easyboardgame.top` 当前由 Cloudflare Pages 提供，`api.easyboardgame.top` 通过 Cloudflare Tunnel 回源生产机，`assets.easyboardgame.top` 是 R2 桶 `boardgame-assets` 的自定义域名。
- 当前没有 Worker Route 或 Load Balancer。用户不接受付费 Load Balancer，但要求现有素材域名自动检查服务器状态并回退 R2。
- 实测 Cloudflare 请求当前多次命中洛杉矶，服务器 HTTP 公网直连明显更快；但只要公开素材入口仍经过 Worker，就不能承诺获得与客户端直连服务器 IP 相同的延迟。
- 生产机系统盘约 40GB，清理后约 14GB 可用；内存约 1.8GB，游戏服务占用较高。素材镜像必须限定范围并主动保护业务容器。
- R2 `official/` 约 9.68GiB，其中三类发布路径的历史对象约占 8.25GiB，不适合全量镜像到生产机；但当前公开清单递归引用的活动对象约 493MiB，可以纳入服务器主源。
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
  - 公开素材 URL、前端资源基址和协作者发布命令保持不变。
  - 正式发布先原子更新服务器活动版本；服务器不可用或缺少对象时自动从 R2 返回。
  - 应用更新、移动素材包和原生安装包只同步当前清单递归引用的活动对象，不复制历史全集。
  - 支持 GET、HEAD、Range、ETag、Content-Type、Cache-Control 和 CORS 等现有下载合同。
  - 任何 Cloudflare、服务器镜像或 R2 清理动作都有明确回滚路径。
  - R2 灾备长期保持在 9GiB 项目硬门禁以下；超限时保留服务器灾备队列并告警，不阻塞正式发布。
- Non-Goals:
  - 不删除 R2；R2 继续保存同 key 灾备副本和服务器重建来源，但不再作为默认下载源。
  - 不改变 `assets:upload`、移动包发布或 OTA 发布的协作者操作入口。
  - 不使用 Cloudflare Load Balancer 或其他付费故障切换产品。
  - 不承诺 Worker 转发链等同于客户端直连服务器 IP。
  - 不尝试在响应字节已经发送给客户端后，把同一次流式响应无损切到 R2。
  - 不承诺服务器发布完成时 R2 已同步到零延迟；灾备队列允许短暂恢复点延迟，并持续重试。

## Decisions

### Decision: 服务器是在线主源，R2 是同 key 灾备和重建来源
- 所有正式发布先通过受限 SSH 写入服务器 staging，完成路径、大小、哈希和活动引用校验后原子切换 `current`；协作者命令和公开 URL 不变。
- 服务器切换后把同批对象移动到本机灾备队列，由低优先级 timer 异步上传 R2。
- 发布脚本必须等待版本化 bundle、游戏包或安装包返回 `X-Asset-Source: server` 后才报告成功。
- R2 到服务器的同步器只保留为人工灾难重建命令，不配置 timer，禁止用旧 R2 状态自动覆盖服务器正式发布结果。
- R2 空间不足、凭据失效或临时不可达时，服务器发布保持成功，灾备队列保留并在恢复后重试。

### Decision: 项目侧实施 9GiB 零付费硬门禁
- Cloudflare 不会在 10GiB 免费额度处自动拒绝上传，因此项目必须自己限制。
- 初始参数：
  - 运行硬上限：9GiB，即 9,663,676,416 字节；
  - 首次清理目标：8GiB 以下；
  - 预留缓冲：至少 1GiB，用于发布过程、月度平均波动和对象替换。
- R2 灾备前必须计算：
  - R2 当前对象总字节数；
  - 当前灾备队列新增对象大小；
  - 覆盖同 key 可释放的旧对象大小；
  - 已隔离且允许删除的历史对象大小。
- 如果预计灾备后超过 9GiB：
  1. 只允许删除已经完成引用核对、服务器隔离和恢复演练的候选；
  2. 清理后重新计算；
  3. 仍超过上限时保留灾备队列、暂停 R2 上传并输出容量报告。
- 9GiB 门禁不得回滚或阻止服务器原子发布；禁止“先备份到付费区，月底再看费用”。

### Decision: 使用 Worker Route 实现全部正式对象的免费同域回退
- `assets.easyboardgame.top` 的全部 `official/**` 请求进入 Worker。
- Worker 仅允许 `GET` 和 `HEAD`，不会承接上传、删除或对象管理。
- Worker 使用带密钥的隐藏源地址请求服务器静态服务，避免公开绕过限流访问源站。
- 服务器源在以下情况被判定为本次请求不可用：
  - 建立连接失败；
  - 可配置的响应头等待时间超时，初始建议值为 1500ms；
  - 返回 `404`、`408`、`429` 或 `5xx`。
- 上述情况使用 R2 Binding 读取同 key 对象，并通过 `writeHttpMetadata`、`httpEtag`、Range/条件请求参数恢复下载语义。
- 服务器返回 `200`、`206` 或 `304` 时直接流式返回，不复制完整文件到 Worker 内存。
- 一旦服务器响应体已经开始发送，中途断流无法在同一 HTTP 响应内安全切到 R2。该场景依赖客户端重试、Range 续传和服务器固定限流降低概率，不包装为“无损自动切换”。

### Decision: 三类发布路径不再绕过 Worker
- 移除 `app-updates`、`mobile-packages`、`native-app-updates` 的更具体 bypass route。
- 三类路径与普通素材使用同一套服务器优先、R2 回退合同。
- Nginx 固定连接数和单连接限速继续保护游戏/API；大包请求达到源站上限时由 Worker 回退 R2。

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

### Decision: 服务器发布使用 staging 校验和原子切换
- 运行时镜像放在独立目录，例如：
  - `/home/admin/storage/assets/releases/<sync-id>/`
  - `/home/admin/storage/assets/current` 指向当前通过校验的 release。
- 发布先写新 release，不直接覆盖 `current`。
- 发布完成后按批次清单和 manifest/file-index 校验路径、大小、哈希及递归引用，再原子更新 `current` 软链接。
- 发布校验失败时保留旧 `current`，Worker 继续使用旧活动版本或回退 R2。
- release 只保留最近两个已验证版本，删除旧 release 前确认它不是当前或上一个回滚目标。

### Decision: 普通素材全量镜像，发布路径只镜像当前活动集合
- 默认镜像：
  - `/official/i18n/**`
  - `/official/common/**` 中非发布包对象
  - `/official/atlas-configs/**`
  - manifest 证明仍被运行时引用的其他普通素材
  - 各平台、各频道 `app-updates/**/latest.json` 递归引用的当前 OTA bundle
  - `mobile-packages/**/(games|shared)/*.json` 递归引用的当前 bundle、manifest 和 file-index
  - `native-app-updates/**/latest.json` 递归引用的当前安装包
- 永久排除未被当前清单引用的历史发布产物、临时对象和孤儿对象。
- 镜像集合由 manifest/file-index 生成，活动发布集合设置 2GiB 上限，并在切换前保证服务器至少保留 5GiB 空闲；禁止用“把 `official/` 全量 sync 到系统盘”代替。

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
4. 删除已隔离候选，将 R2 降到 8GiB 以下；在后台灾备队列启用 9GiB 硬门禁。
5. 完成 R2 密钥轮换和现有上传/读取验证。
6. 在服务器安装独立 Nginx 静态源，使用未占用端口并保持公网不可直接访问。
7. 建立隐藏 Tunnel hostname 和源站密钥校验，只允许 Worker 访问。
8. 建立受限 SSH staging、当前清单递归解析、大小/哈希校验、原子切换和 R2 后台灾备 timer；R2 拉取同步只保留为人工重建入口。
9. 部署未绑定正式域名的 canary Worker，验证服务器命中、R2 强制回退、HEAD、Range、ETag、CORS 和缓存。
10. 移除大型路径 bypass route，确认三类发布路径均由服务器优先提供并可回退 R2。
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
- 协作者现有上传/发布命令不变，服务器活动版本是第一落点。
- 服务器源正常时普通素材和三类发布路径均返回 `X-Asset-Source: server`。
- 停止静态源、制造超时或请求服务器未同步对象时，同 URL 返回 `X-Asset-Source: r2-fallback`。
- 停止服务器静态源或请求未同步对象时，三类发布路径返回 `X-Asset-Source: r2-fallback`。
- 服务器活动集合只包含当前清单递归引用对象，当前三类路径总量不超过 2GiB，且同步后服务器至少保留 5GiB 空闲。
- GET、HEAD、Range、ETag、Content-Type、Cache-Control、Content-Length 和 CORS 行为与现有链路兼容。
- 素材压力测试期间游戏/API 健康检查持续成功，游戏容器无新增重启，服务器磁盘保持至少 25% 空闲。
- 移除 Worker Route 后，`assets.easyboardgame.top` 能恢复当前 R2 直出链路。
- 首批 R2 删除前完成一次“隔离对象删除后按原 key 恢复并校验哈希”的演练。
- R2 当前用量目标降到 8GiB 以下；后台灾备预计超过 9GiB 时保留队列并停止写入 R2。
- R2 停止或容量不足时服务器正式发布仍可完成；灾备恢复后队列能够补传同 key 对象。
- Docker 日志、应用文件日志、coredump 和训练数据均具有明确容量上限，服务器不再按当前速度无界增长。
