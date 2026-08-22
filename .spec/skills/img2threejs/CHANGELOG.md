# img2threejs Changelog Notes

本文件是上游历史摘要，不是执行规范。BoardGame 任务不应读取它来裁定当前 gate。

## 当前可依赖的能力摘要

- `1.0`：staged sculpt pipeline、spec authoring、render-vs-reference review、action-ready hierarchy。
- `1.1`：`detailInventory` 和 strict-quality gate，防止浅 spec 直接 codegen。
- `1.2`：character / hybrid domain、比例和 landmark pass、角色材质分区。
- `1.3`：deterministic review harness、输入完整性、几何真值、多角度、材质 / 色彩信号、InstancedMesh 修复和 cutout 支持。

## 使用规则

- 需要判断当前流程时读 [`SKILL.md`](SKILL.md) 和 grimoire。
- 需要判断是否支持某能力时，先看 [`ROADMAP.md`](ROADMAP.md) 的 current / deferred 摘要。
- 历史发布说明不能替代当前源码、脚本 gate 或渲染截图证据。
