## ADDED Requirements

### Requirement: 服务器单文件更新驱动素材包索引刷新
系统 SHALL 在 package-managed 游戏资源发布到服务器主源后，刷新对应游戏或共享资源包的远端文件索引与最新 manifest，并默认避免重新上传完整 ZIP。

#### Scenario: 单个游戏素材变更
- **WHEN** `assets:upload` 发布的服务器对象路径属于某个 package-managed 游戏
- **THEN** 系统 MUST 重新生成该游戏目标版本的 `file-index`
- **AND** MUST 更新 `mobile-packages/android/<channel>/games/<gameId>.json`
- **AND** MUST NOT 默认上传新的完整 ZIP

#### Scenario: 共享音频素材变更
- **WHEN** `assets:upload` 发布的服务器对象路径属于共享音频包
- **THEN** 系统 MUST 刷新共享音频包的 `file-index` 与共享包 manifest
- **AND** MUST 刷新依赖共享音频包的游戏 manifest 指针

#### Scenario: 显式完整包重建
- **WHEN** 发布命令显式要求完整包重建、首次发布或兼容兜底
- **THEN** 系统 MAY 生成并发布完整 ZIP
- **AND** MUST 同时生成对应 `file-index` 与 manifest

#### Scenario: 差异发布成功判据
- **WHEN** index/manifest-only 发布写入新的单文件对象、`file-index` 和最新 manifest
- **THEN** 发布命令 MUST 从服务器主源读取本次唯一 `file-index`
- **AND** MUST 校验其正文大小和 `fileIndexChecksum`
- **AND** MUST NOT 使用旧完整 ZIP 或 fallback URL 可读取作为差异发布成功证据

### Requirement: 远端文件索引作为 App 素材包更新真相源
系统 SHALL 使用服务器单文件对象、远端 `file-index` 和游戏包 manifest 共同定义 App 素材包目标状态，完整 ZIP 仅作为首装与回退载体。

#### Scenario: Manifest 携带文件索引
- **WHEN** 游戏包 manifest 包含 `assetPack.fileIndexUrl`
- **THEN** 客户端 MUST 优先按文件索引执行差异安装判断
- **AND** MUST NOT 仅因为 `assetPack.url` 存在就默认下载完整 ZIP

#### Scenario: 文件索引校验
- **WHEN** 客户端下载远端 `file-index`
- **THEN** 客户端 MUST 使用 `fileIndexChecksum` 校验索引完整性
- **AND** 校验失败时 MUST 回退完整 ZIP 安装

#### Scenario: 路径合同一致
- **WHEN** `file-index.files[].path` 描述一个素材文件
- **THEN** 该路径 MUST 与服务器公开对象 `official/<path>`、原生落盘 `current/assets/<path>`、H5 读取 `readInstalledAsset(gameId, <path>)` 保持同构

### Requirement: 客户端文件级差异安装
系统 SHALL 在具备远端文件索引和本地已安装文件索引时，仅下载本地缺失或哈希不一致的文件，并复用未变更文件。

#### Scenario: 部分文件变更
- **WHEN** 远端 `file-index` 中只有部分文件哈希不同
- **THEN** 客户端 MUST 只从服务器公开对象下载哈希不同或本地缺失的文件
- **AND** MUST 从当前安装目录复用哈希相同的文件
- **AND** MUST 在安装完成后得到与同版本完整 ZIP 安装等价的文件集合

#### Scenario: 文件被远端移除
- **WHEN** 本地已安装文件存在但不在远端 `file-index` 中
- **THEN** 客户端 MUST NOT 将该旧文件带入新的 `current/assets`

#### Scenario: 跨版本跳转
- **WHEN** 本地版本不是远端 manifest 的上一版本
- **THEN** 客户端 MUST 仍然按文件哈希复用相同文件
- **AND** MUST 只下载目标版本缺失或哈希变化的文件

### Requirement: 本地已安装文件索引维护
系统 SHALL 在全量安装和差异安装完成后维护 `installed-files-index.json`，作为后续差异更新的本地真相源。

#### Scenario: 全量安装完成
- **WHEN** 完整 ZIP 安装成功
- **THEN** 系统 MUST 生成 `installed-files-index.json`
- **AND** 该索引 MUST 包含当前 `current/assets` 下每个文件的相对路径和 sha256 哈希

#### Scenario: 差异安装完成
- **WHEN** 文件级差异安装成功
- **THEN** 系统 MUST 将 `installed-files-index.json` 更新为远端目标版本的完整文件索引
- **AND** MUST 原子写入，避免中断导致索引半写入

#### Scenario: 本地索引不可用
- **WHEN** 本地 `installed-files-index.json` 缺失、损坏或无法解析
- **THEN** 客户端 MUST 回退完整 ZIP 安装
- **AND** 完整安装成功后 MUST 重建本地索引

### Requirement: 差异安装失败回退全量
系统 SHALL 在差异安装无法安全完成时自动回退完整 ZIP 安装，并明确标注该路径是 fallback。

#### Scenario: 单文件下载失败
- **WHEN** 差异安装中的某个文件下载超过重试上限仍失败
- **THEN** 系统 MUST 清理 staging 临时文件
- **AND** MUST 回退完整 ZIP 安装

#### Scenario: 合并后校验失败
- **WHEN** staging 文件集合与远端 `file-index` 的哈希或文件列表不一致
- **THEN** 系统 MUST 拒绝切换到该 staging 目录
- **AND** MUST 回退完整 ZIP 安装

#### Scenario: 原生增量入口不可用
- **WHEN** 当前 Android 原生壳不支持文件级差异入口
- **THEN** JS 层 MUST 回退完整 ZIP 安装
- **AND** MUST 将该状态标注为 full fallback

### Requirement: 差异更新验收必须证明真实变更下载
系统 SHALL 在发布侧和客户端侧分别证明差异更新链路生效，不能只用完整 ZIP 可读或安装成功替代。

#### Scenario: 单图替换验收
- **WHEN** 替换 DiceThrone 某一个玩家面板素材
- **THEN** 发布验收 MUST 证明远端 manifest/file-index 已更新
- **AND** App 验收 MUST 证明只下载该变更素材及必要派生产物
- **AND** 本地文件哈希 MUST 与远端 `file-index` 一致
