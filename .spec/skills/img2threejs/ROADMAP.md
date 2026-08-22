# img2threejs Roadmap Notes

本文件是上游资料摘要，不是 BoardGame 执行规范。任务执行以 [`SKILL.md`](SKILL.md)、BoardGame 准入 skill 和对应 grimoire 参考为准。

## 当前有效能力

- **Object pipeline**：参考图 intake、sculpt spec、pass-gated Three.js factory、render-review 记录。
- **Detail-first gates**：`detailInventory`、strict-quality、细节映射到 component / material 后才进入 codegen。
- **Character / hybrid track**：比例、landmark、pose、材质分区和 stylized fallback。
- **Deterministic review**：输入完整性、几何真值、多角度、色彩 / 材质信号和有界修正循环。
- **CS2 route**：只在明确 CS2 任务中读取；BoardGame 通用任务不加载 CS2 技术词表。

## Deferred / 不可默认承诺

- 摄影级真人 / 动物 / 大场景单图重建。
- 静默下载 mesh、贴图包或外部生成资产。
- Unity / Unreal / Blender / glTF 生产导出链。
- 自动 rig、skin weights、morph targets、lip-sync 或动画导出。
- 多视角世界生成、Web UI、云渲染、公开 API。

若用户要求 deferred 能力，先回到 `request-input` / `unsupported` 口径说明缺口，不用手写近似品冒充官方 pipeline。
