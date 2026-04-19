## ADDED Requirements

### Requirement: 文件级哈希索引生成
系统 SHALL 在 asset pack 构建时自动生成文件级哈希索引（file-index.json），包含每个文件的相对路径、sha256 哈希和字节数。

#### Scenario: 构建 asset pack 时生成索引
- **WHEN** 执行 asset pack 构建发布流程
- **THEN** 系统 MUST 在 asset pack 产物目录下生成 `file-index.json`
- **AND** 该文件 MUST 包含所有文件的 `path`、`hash`、`size` 字段
- **AND** 该文件 MUST 包含 `assetPackVersion` 和 `totalSize` 字段

#### Scenario: 索引哈希与 asset-manifest 一致
- **WHEN** 同一文件在 `file-index.json` 和 `asset-manifest` 中均有哈希记录
- **THEN** 两者 MUST 报告相同的 sha256 哈希值

### Requirement: 发布清单携带文件索引地址
发布清单 SHALL 在 `fileIndexUrl` 字段中提供文件级哈希索引的下载地址，并在 `fileIndexChecksum` 中提供索引文件自身的校验哈希。

#### Scenario: 发布清单包含文件索引
- **WHEN** 某个游戏的 asset pack 已生成 file-index.json 并部署到 CDN
- **THEN** 发布清单 MUST 包含 `fileIndexUrl` 指向该索引文件
- **AND** MUST 包含 `fileIndexChecksum` 用于校验索引完整性

#### Scenario: 发布清单不含文件索引
- **WHEN** 某个游戏的 asset pack 尚未生成 file-index.json
- **THEN** 发布清单 MUST NOT 包含 `fileIndexUrl` 字段
- **AND** 客户端 MUST 回退到全量安装

### Requirement: 增量安装决策
系统 SHALL 在安装游戏资源包时，根据是否具备增量条件自动选择增量或全量安装模式。

#### Scenario: 具备增量条件
- **WHEN** 发布清单包含 `fileIndexUrl` 且本地存在已安装文件索引
- **THEN** 系统 MUST 选择增量安装模式

#### Scenario: 不具备增量条件
- **WHEN** 发布清单不包含 `fileIndexUrl` 或本地不存在已安装文件索引
- **THEN** 系统 MUST 选择全量安装模式

#### Scenario: 首次安装
- **WHEN** 游戏资源包尚未安装（状态为 `not-installed`）
- **THEN** 系统 MUST 选择全量安装模式

### Requirement: 文件级增量下载与合并
系统 SHALL 在增量安装模式下，仅下载本地未安装或哈希不一致的文件，并与本地已有文件合并形成完整的新版本安装。

#### Scenario: 部分文件变更
- **WHEN** 新版本 file-index 中有 30% 文件的哈希与本地不同
- **THEN** 系统 MUST 仅下载这 30% 变更文件
- **AND** 保留 70% 未变更文件的本地副本
- **AND** 合并后本地文件集合 MUST 与全量安装结果等价

#### Scenario: 跨版本跳转
- **WHEN** 本地安装版本为 v1，最新版本为 v3，且 v1 与 v3 之间有部分文件哈希相同
- **THEN** 系统 MUST 复用哈希相同的文件，仅下载哈希不同的文件
- **AND** 不要求用户先安装 v2

#### Scenario: 所有文件变更
- **WHEN** 新版本所有文件的哈希都与本地不同
- **THEN** 系统 MUST 下载所有文件，效果等价于全量安装

### Requirement: 增量安装失败自动回退全量
系统 SHALL 在增量安装失败时自动回退到全量安装，无需用户手动干预。

#### Scenario: 文件索引获取失败
- **WHEN** 下载 `file-index.json` 失败（网络错误、404、校验不通过）
- **THEN** 系统 MUST 自动回退到全量安装

#### Scenario: 单文件下载连续失败
- **WHEN** 增量下载中某个文件连续失败 3 次
- **THEN** 系统 MUST 清理临时文件并自动回退到全量安装

#### Scenario: 合并后校验不通过
- **WHEN** 增量合并完成后文件哈希校验失败
- **THEN** 系统 MUST 清理临时文件并自动回退到全量安装

#### Scenario: 已安装文件索引损坏
- **WHEN** 本地已安装文件索引文件损坏或无法解析
- **THEN** 系统 MUST 自动回退到全量安装

### Requirement: 全量安装后生成已安装文件索引
系统 SHALL 在全量安装完成后自动生成本地已安装文件索引，为后续增量更新提供对比依据。

#### Scenario: 全量安装完成
- **WHEN** 游戏资源包全量安装成功
- **THEN** 系统 MUST 在本地生成 `installed-files-index.json`
- **AND** 该索引 MUST 包含每个已安装文件的路径与 sha256 哈希

#### Scenario: 增量安装完成
- **WHEN** 游戏资源包增量安装成功
- **THEN** 系统 MUST 更新本地 `installed-files-index.json` 为新版本的完整索引

### Requirement: 增量安装进度汇报
系统 SHALL 在增量安装过程中汇报进度，包含变更文件数和已下载字节数。

#### Scenario: 增量下载进度
- **WHEN** 增量安装正在下载变更文件
- **THEN** 系统 MUST 汇报已下载文件数 / 总变更文件数
- **AND** MUST 汇报已下载字节数 / 总变更字节数
