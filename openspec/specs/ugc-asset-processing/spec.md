# ugc-asset-processing Specification

## Purpose
TBD - created by archiving change add-ugc-prototype-builder. Update Purpose after archive.
## Requirements
### Requirement: 资源自动压缩（不保留原始）
系统 SHALL 在上传时对图片/音频进行压缩处理，仅保留压缩后的变体以节省云端空间。

#### Scenario: 图片压缩
- **WHEN** 用户上传 PNG/JPEG 图片
- **THEN** 系统 MUST 生成压缩变体（如 WebP）并仅存储压缩后的版本

#### Scenario: 音频压缩
- **WHEN** 用户上传 WAV 音频
- **THEN** 系统 MUST 生成压缩变体（如 OGG/MP3）并仅存储压缩后的版本

### Requirement: 已压缩格式跳过处理
系统 SHALL 在检测到已是压缩格式时跳过压缩处理。

#### Scenario: 跳过压缩图片
- **WHEN** 用户上传 WebP/AVIF 图片
- **THEN** 系统 MUST 跳过压缩并直接存储

#### Scenario: 跳过压缩音频
- **WHEN** 用户上传 OGG/MP3 音频
- **THEN** 系统 MUST 跳过压缩并直接存储

### Requirement: 资源元数据与变体记录
系统 SHALL 保存资源元数据（宽高/时长/格式/变体列表）以便加载与校验。

#### Scenario: 记录元数据
- **WHEN** 系统完成资源处理
- **THEN** 系统 MUST 记录宽高、时长、格式与变体信息

### Requirement: 对象存储前缀隔离
系统 SHALL 将 UGC 资源存储在对象存储的隔离前缀下，保持兼容扩展。

#### Scenario: 资源前缀
- **WHEN** 资源上传完成
- **THEN** 系统 MUST 使用 `ugc/<userId>/<packageId>/` 作为资源前缀

