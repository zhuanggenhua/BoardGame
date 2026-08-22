# img2threejs Upgrade Notes

本文件只保留上游升级背景摘要，不再作为执行规范。当前可执行规则已经拆到：

- [`../SKILL.md`](../SKILL.md)：pipeline 入口、gate、CS2 路由和汇报口径。
- [`../grimoire/intake/detail_inventory.md`](../grimoire/intake/detail_inventory.md)：细节清单和 strict-quality 约束。
- [`../grimoire/character/reconstruction.md`](../grimoire/character/reconstruction.md)：角色比例、landmark、pose、stylized 材质。
- [`../grimoire/character/likeness_maximization.md`](../grimoire/character/likeness_maximization.md)：projection-first 高相似度路线。
- [`../ROADMAP.md`](../ROADMAP.md)：当前能力和 deferred 能力摘要。

## 已吸收的有效升级

- **Detail inventory**：复杂对象必须逐区域列出身份细节，并映射到真实 geometry / material 消费点。
- **Character track**：角色与 hybrid 对象需要 anatomy、landmark、pose 和独立比例 gate。
- **Projection-first likeness**：高相似度目标优先走 template fit、camera match、de-light、projection bake；单图隐藏侧必须标低置信或请求更多视角。
- **Deterministic review**：脚本负责可确定信号和状态记录，agent 只判断图面语义和下一动作。
- **Generative assist**：只能作为显式 opt-in 的非 procedural 模式；默认 code-only pipeline 不下载 mesh 或素材。

## 不再保留在本文件中的内容

- 旧版本实现日记、文件逐项改动清单和测试数量。
- 对未来版本的营销式路线图。
- Web research 长摘要和外部链接清单。
- 已迁入 grimoire / SKILL 的重复规范正文。

需要判断当前怎么做时，不读本文件；按上面的主源进入。
