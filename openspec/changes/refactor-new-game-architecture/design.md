## 已批准边界

以统一静态审计的 A01–A09、E01–E08、N01–N03 为清单；保持正常输入、拒绝、中间态、时序与最终玩家结果。修复明确的原子性、信息丢失与生命周期缺陷属于整改范围；不添加新玩法或改造产品漏斗。

## Owner 与消费者

| 职责 | Owner | 消费者与等价性 |
| --- | --- | --- |
| 业务动作提交 | authoritativeCommandTransaction / 本地 Provider 批次 | 玩家、正常 AI、watchdog；失败丢弃 state / RNG 草稿，提交后效果隔离 |
| 终局归档 | shared/matchRecord + 共享 Mongo schema | 游戏服务、API、后台、排行榜；保留旧 winnerID，完整表达新多人结果 |
| 客户端注册 | 各游戏 client.ts，由 Board 客户端入口载入 | manifest 既有 Board 加载路径；规则 game.ts 不再执行浏览器注册 |
| 多步交互 | 可序列化 MultistepChoiceData + 客户端 runtime | 本地、网络、恢复、DiceThrone UI / AI；元数据与用户选择不变，函数不进入状态 |
| 选择落地 | 游戏 command event builder / reducer | 七大恨普通命令与交互响应；共用领域事件事实 |
| 事实触发 | prepareEventBatch 单一批次 owner 与已有 ResolutionFrame | 大杀四方普通与系统命令；逐候选接纳后推进前缀；事实工作队列保留离场前信息；新增派生事实继续处理；不并绑旧后处理 |
| 存档接收 | 引擎持久化合同 + 游戏 data owner | 在线加载、本地续玩；源版本、迁移、拒绝与重新开始可区分 |
| 本地保留 | localSession / useLocalProviderSession | 普通本地续玩、教程；保持同 seed 覆盖与刷新恢复 |
| 遗留职责 | 对应 domain / read model / Surface owner | 既有公共入口继续导出原合同；移动实现，不按行数切壳 |

## 静态等价性记录

实现前保存文本边界与引用关系；逐职责迁移后核对参数、拒绝条件、fallback 顺序、状态写入及回调顺序。AST 解析不执行游戏代码、不启动编译。共享行为和多文件迁移由项目 reviewer 独立只读审查。

终局效果的进程内重试不升级为分布式 outbox。旧存档仅迁移有已知语义的字段，不补造丢失历史事实。生成器保持严格正式清单条件，不手改 generated 文件。

## 2026-10-26 扩展合同

服务端 manifest 只登记元数据与动态规则加载器，GameEngineRegistry 合并同游戏在途加载并隔离失败。真实模块初始化失败在该进程内保持失败，代码重载后再试，避免开发打包器返回半初始化 exports。房间恢复同样合并在途任务；卸载使旧任务失效。生产 ESM 产物包含独立 chunks，镜像复制整个构建目录。

交互执行标识由对局 sys.interactionSequence 决定，queueInteraction 接受交互时推进，continuation 从来源和交互标识派生。丢弃的事务草稿不改变权威游标；持久化恢复保留游标。新增 domain/abilities 禁止时钟、非注入随机源与模块级数值游标写入。

跨游戏缓存预算：运行时空闲 3 项，已挂载租约 pin；图片 512 项/估算解码 128 MiB，音频元素 64 项/估算 32 MiB；Howl SFX 128 项/估算 64 MiB，BGM 3 项。相同对象的多个 URL 仅计一次字节。播放与加载中的资源可暂时超预算，完成后回收；这些估算不是浏览器进程 RSS 上限。离场递增加载代际并撤销在途任务，资源租约最后释放在 microtask 清理，兼容 React StrictMode。音频实例处置后不得被旧 fallback/load 回调复活，停止或切曲后也须重新检查播放所有权。

浏览器 ESM 模块缓存由浏览器持有，不能靠 delete Map 卸载已求值代码；预算针对项目持有的运行时和重资源引用。静态卡图元数据保持可用，图片 DOM 本身不因 LRU 淘汰而被破坏。

四项目类型检查保留 strict。当前采用审查过的存量诊断基线，详见 typecheck-baseline-review.md；新增诊断和失效豁免均失败。首次初始化不等于审查通过；基线进入受信任分支后，PR 不得通过编辑 JSON 扩大豁免。npm run typecheck:strict 仍报告真实存量，npm run typecheck:prune 只能删除已消失的诊断。
