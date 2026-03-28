## ADDED Requirements

### Requirement: 官方资源清单（Manifest）
系统 SHALL 为官方资源生成权威资源清单（manifest），用于描述资源集合、变体、以及可验证的内容标识（hash）。

#### Scenario: 生成官方资源清单
- **WHEN** 执行资源清单生成脚本
- **THEN** 系统 MUST 输出一份官方资源 manifest 文件

#### Scenario: 清单可用于完整性校验
- **WHEN** 某资源文件缺失或变体不完整（例如缺 `.avif` 或 `.webp`）
- **THEN** 校验步骤 MUST 失败并给出可定位的错误信息

### Requirement: Manifest 格式与版本
官方资源 manifest MUST 具备版本字段与稳定结构，以便扩展与向后兼容。

#### Scenario: manifestVersion
- **WHEN** 读取 manifest
- **THEN** MUST 存在 `manifestVersion` 且为整数

#### Scenario: 稳定排序
- **WHEN** 在相同资源输入集合上重复生成 manifest
- **THEN** 输出 MUST 在文本层面保持稳定（例如 files key 排序一致），以便 diff 与审计

### Requirement: 逻辑路径与变体描述
系统 SHALL 使用“逻辑路径”（不含域名）作为资源标识，并允许对同一逻辑资源记录多个变体（例如 `.avif`/`.webp`/`.ogg`）。

#### Scenario: 无扩展名 base path 变体
- **WHEN** 逻辑资源为 `dicethrone/images/monk/compressed/dice-sprite`
- **THEN** manifest MUST 能表达其存在 `avif` 与 `webp` 两种变体

#### Scenario: 显式扩展名文件
- **WHEN** 资源为 atlas 配置 `.../monk-ability-cards.atlas.json`
- **THEN** manifest MUST 将其作为独立逻辑路径记录（不依赖无扩展名推断）

### Requirement: 内容哈希
manifest MUST 为每个变体记录内容哈希（推荐 `sha256`），以支持内容校验与缓存策略。

#### Scenario: 哈希一致性
- **WHEN** 资源内容未改变
- **THEN** manifest 中对应变体的 hash MUST 保持不变

#### Scenario: 内容改变导致 hash 变化
- **WHEN** 资源内容改变
- **THEN** manifest 中对应变体的 hash MUST 改变

### Requirement: 发布闭环（官方资源）
系统 SHALL 将“资源构建/准备 → 生成 manifest → 校验 → 上传/发布”作为可自动化的发布闭环。

#### Scenario: 发布前校验
- **WHEN** 执行发布流程
- **THEN** MUST 在上传/发布前完成 manifest 校验并阻止缺资源的发布
