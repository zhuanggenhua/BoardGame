---
name: img2threejs
description: Turn an object or character reference image into a quality-gated, animation-ready procedural Three.js model built in code. Use for image-to-3D reconstruction, detail-accurate object rebuilds, stylized/likeness-maximized human characters, sculpt specs, and staged code generation.
---

# img2threejs

## 角色

把参考图中的对象重建为 **code-only procedural Three.js** 模型。它不是摄影测量、mesh 抽取、素材包下载或手写近似原型。BoardGame 项目里的准入和落点先看 [`../img2threejs-readiness/SKILL.md`](../img2threejs-readiness/SKILL.md) 与 [`../img2threejs-reconstruction/SKILL.md`](../img2threejs-reconstruction/SKILL.md)；本文件只定义官方 pipeline 本体。

## 使用条件

适用：

- 用户提供对象 / 角色参考图，要求 Three.js 程序化重建。
- 要输出 sculpt spec、结构拆解、动画就绪模型或项目内临时原型。
- 要和官方 showcase 或已有 img2threejs 产物对齐。

最低输入：

- 可读参考图路径、截图、URL 或附件。
- 目标用途：浏览器实时 prop、游戏对象、角色 bust、可动画 / 可破坏对象等；未指定时默认实时浏览器 prop。
- 若是 CS2 路线，必须有权威分类记录或明确要求用户 / vision provider 补分类；启发式识别不能单独选择 adapter。

缺输入时停下说明缺什么，不用泛主题模型补位。

## 核心流程

脚本从 skill 根目录运行，Python 3.10+ stdlib 即可。脚本负责 gate 和状态，视觉判断由 agent 完成。

1. **状态入口**：先运行 `python3 forge/next.py <spec>`，确认当前解锁 pass、下一条命令和未满足标准。
2. **读图与适配性**：按 `grimoire/intake/validation_rubric.md` 判断图是否适合 3D 重建；再用 `forge/stage1_intake/probe_image.py <image>` 只读元数据。
3. **图面观察**：先按 `grimoire/intake/image_analysis.md` 做 macro -> meso -> micro 分解，列部件、材料、拓扑、身份特征和单视角缺失。
4. **本地知识检索**：需要领域 anatomy、PBR、wear、runtime 或 physics 规格时，运行 pre-spec assessment 的 local spec search；CS2 走 `cs2` collection，其它对象走 `core_3d`。
5. **Pre-spec assessment**：`forge/stage2_spec/new_pre_spec_assessment.py "Name" --image <img> --out assessment.json`，写对象类别、复杂度、qualityContract、detailInventory。
6. **Detail inventory**：中等以上复杂对象必须跑 `forge/stage1_intake/build_detail_inventory.py`，每个细节都映射到 component localFeatures 或 material localOverrides。
7. **Spec**：`forge/stage2_spec/new_sculpt_spec.py "Name" --image <img> --assessment assessment.json --out object-sculpt-spec.json`，写 component hierarchy、materials、lighting、pivots、sockets、action anchors。
8. **严格校验**：`forge/stage2_spec/validate_sculpt_spec.py object-sculpt-spec.json --strict-quality`；浅 spec 不准 codegen。
9. **锁 pass 构建**：只改当前解锁 pass，使用 `forge/stage3_build/orchestrate_passes.py` 和 `forge/stage3_build/generate_threejs_factory.py`。
10. **渲染截图**：在浏览器 / 项目 preview 中渲染当前 pass，截当前 review viewpoint。
11. **对比审查**：`forge/stage4_review/make_comparison_sheet.py` 生成参考图 + render 对比图；agent 必须逐图判断。
12. **记录结论**：`forge/stage4_review/append_review.py ... --action continue|refine-spec|refine-code|request-input|stop --in-place`。

每轮只能选一个下一动作：

- `continue`：当前 pass 通过，可进入下一 pass。
- `refine-spec`：spec 错、浅或缺身份特征；先修 spec 并重校验。
- `refine-code`：spec 正确但 geometry / material / lighting 实现不符。
- `request-input`：参考图、分类、隐藏视角或来源不足。
- `stop`：当前目标不可达或用户目标已结束。

## 官方 showcase 对齐

复现官方 showcase 时，公开参考图不等于完整重建源。声称对齐前必须解析可用 bundle：

- `object-sculpt-spec.json`。
- intake / classification manifest，例如 `cs2-intake.json`。
- 几何 sidecar，例如 `geo.json`。
- PBR / projection / roughness / metalness / normal / AO 等贴图来源。
- 官方 showcase factory source。

缺任一关键输入时，只能报告缺口；不得手补并声称官方 replay。生成 factory 必须在 showcase 项目临时副本中 build、render、无 console / texture 错误，并有当前 side-by-side 截图后，才允许说已对齐。

## CS2 路线

CS2 是 route-specific reference，不是 BoardGame 通用规范。只有任务明确是 CS2 物品、皮肤或官方 CS2 showcase 对齐时才读 `docs/cs2/**`、`docs/cs2-anatomy/**` 和 `skills/cs2-*.md`。

硬规则：

- 初始支持边界是 **knife**；pistol、rifle、SMG、sniper、heavy、glove 和未知刀型必须停在 `unsupported-family` 或 `unsupported-subtype`，不能套 generic knife tree。
- `cs2-intake.json` 是层间 handoff；状态只能是 `proceed / request-input / fallback / rejected / unsupported-family / unsupported-subtype`。
- family / subtype 由权威分类记录裁定；`detect_cs2.py` 只能作路由提示。
- route 与 exactness 分开：`reference-projection`、`authored-texture`、`procedural-finish`；exactness 是 `image-only / metadata-assisted / exact-texture`。
- 特定参考图的纹理优先走 de-lit reference projection；程序化 Doppler / Fade / Gamma / Marble 只能作为明确近似 fallback。
- albedo、roughness、metalness、normal / height、AO、mask、wear 必须保持独立通道；低置信 PBR 推断是 refine-input 信号，不是 exact material 证明。
- review 必须看固定视角和至少两个有意义 orbit 视角；全局分数不能覆盖 wrong family、missing projection、critical detail fail 或 degenerate orbit。

CS2 细节只在需要时下钻：

- `docs/cs2/review-gates.md`：knife review 阈值和 fixture。
- `docs/cs2/*.md`：CS2 PBR / wear / terminology reference。
- `docs/cs2-anatomy/*.md`：具体 CS2 family anatomy 词表。
- `skills/cs2-knife.md`、`skills/cs2-pistol.md`：专项提示片段。

## 关键 Gate

- **适配性 / 来源完整性**：不可读、空图、主体太小、重复视角或碎片图先拒绝。
- **Pre-spec / strict-quality**：复杂对象必须有足够 component、repetition、local override、detail inventory。
- **投影优先**：角色 likeness、CS2 pattern、贴花 / painted surface 等参考匹配目标，优先 solved camera + de-light + projection bake。
- **多角度**：非平面对象必须在至少两个 orbit 视角仍成立；平面假体不能通过。
- **截图反馈**：`continue` 需要 render、comparison sheet、全局阈值和关键特征阈值同时通过。
- **Action-ready**：模型要有 pivots、sockets、colliders、destruction groups 或等价 runtime hierarchy，不能只是 inert lump。
- **Attachment**：子部件必须有 parent socket、localStart / localEnd、contactType、embedDepth / overlap 和 gapTolerance，禁止悬空。
- **材质 / 灯光**：PBR 通道独立，真实灯光和 tone mapping 可解释，不用单 diffuse 图冒充材质。
- **有界修正循环**：发现 repeated defect、oscillation、plateau 或 hard ceiling 时转 `request-input`，不得无限微调。

## 汇报口径

每个 pass 后必须说明：

- 本轮改了什么，落在哪些组件 / 参数 / 材质上。
- 哪张参考图或哪条 spec 证据支持这个改动。
- 当前仍不匹配什么。
- 下一动作是 `continue`、`refine-spec`、`refine-code`、`request-input` 还是 `stop`。

禁止：

- feature 只是 improved 就说 done。
- 用全局分数掩盖关键身份特征失败。
- 在缺侧面、背面、分类、exact texture 或渲染证据时声称精确。
- 直接手写 `new THREE.Mesh(...)` 当作官方 img2threejs 流程。

## 输出

- **只分析**：适配性结论、对象分解、geometry / material strategy、动画可行性、风险和缺输入。
- **实现**：编辑 Three.js factory 或项目目标代码，并用 typecheck / build + 浏览器截图验证。
- **不可达**：说明缺少的参考图、视角、分类、纹理、pipeline 或验收能力；给出最小补救动作。
