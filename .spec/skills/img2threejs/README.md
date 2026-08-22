# img2threejs 资料索引

本目录是 `img2threejs` 官方工具链的项目内固定副本，只在图生 Three.js、参考图重建、官方 showcase 对齐或模型差异排查时读取。它不是 BoardGame 通用 gameplay / UI / E2E 规范。

## 执行入口

- [`SKILL.md`](SKILL.md)：官方 pipeline 主入口。
- [`../img2threejs-readiness/SKILL.md`](../img2threejs-readiness/SKILL.md)：BoardGame 准入门禁，防止缺 pipeline 时手写替代。
- [`../img2threejs-reconstruction/SKILL.md`](../img2threejs-reconstruction/SKILL.md)：BoardGame 项目内参考图到临时 Three.js 原型的落点与验收。

## 参考目录

- `forge/`：pipeline 脚本，负责 intake、spec、pass orchestration、factory generation 和 review record。
- `grimoire/`：通用 intake、quality contract、geometry、material、review、action-ready 和 attachment 规则。
- `docs/cs2/`：CS2 route-specific 技术参考，只在 CS2 任务中读取。
- `docs/cs2-anatomy/`：CS2 物品 anatomy 词表，只在对应 CS2 family 任务中读取。
- `skills/cs2-*.md`：CS2 专项提示片段，不是 BoardGame 通用规范。
- `ROADMAP.md`、`CHANGELOG.md`、`CONTRIBUTING.md`：上游项目资料；执行任务时通常不需要读取。

## 使用提醒

- 先读 BoardGame 准入 skill，再读本目录主入口。
- 不按任务无差别加载 CS2 技术资料。
- 官方 showcase 对齐必须使用完整 bundle 和渲染对比，不用公开缩略图手补。
- 单张参考图不能证明隐藏侧、精确纹理或完整几何；缺证据时必须标 `request-input` 或 approximation。
