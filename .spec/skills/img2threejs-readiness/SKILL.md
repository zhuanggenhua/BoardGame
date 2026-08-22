---
name: img2threejs-readiness
description: BoardGame img2threejs 准入门禁。用于图生 Three.js、参考图重建、官方案例对齐或模型代码差异排查，防止缺少官方流程时手写替代。
---

# Img2threejs 准入门禁

本 skill 只做准入判断，不替代正式 [`img2threejs`](../img2threejs/SKILL.md) workflow。缺少官方流程、参考图或验收链路时，必须先阻塞说明，不能手写 Three.js 原型冒充正式生成。

## 必锁前提

写或改模型代码前，先锁定：

- **目标对象**：要重建的具体资产。
- **真相来源**：能证明形体、部件、颜色和材质的参考图或源资产。
- **官方流程**：本项目正式 `img2threejs` skill / pipeline 本地可读、可运行且适合当前任务。
- **输出位置**：临时原型、项目资产候选，还是最终运行时集成。
- **验收证据**：生成 factory、浏览器渲染、参考图对比和 pass/fail 结论。

任一前提缺失时，先停在阻塞说明；只有用户看过阻塞并明确授权“先做手写原型”后，才允许走 fallback。

## 官方来源

默认来源：

- 项目正式入口：[`img2threejs/SKILL.md`](../img2threejs/SKILL.md)
- 官方仓库：`https://github.com/img2threejs/img2threejs`
- 官方 showcase：`https://github.com/img2threejs/img2threejs-showcase`

需要本地 showcase 示例时，先按仓库或任务指定位置确认是否已下载；不可把个人机器上的绝对路径写成项目规范来源。

官方 skill 或 showcase 缺失时，可以尝试从官方仓库下载或更新。若 GitHub、git、zip、认证、代理或文件访问失败，报告失败命令并停止；不得新建同名本地近似流程冒充官方流程。

## 正式流程

官方流程可用时，至少包含：

- 读取 / 检查参考图。
- 形成 pre-spec 与 sculpt/object specification。
- 对 specification 跑严格质量校验。
- 从锁定 specification 生成 Three.js factory。
- 浏览器渲染并截图取证。
- 对比参考图和渲染结果后再判定是否可接受。

用户要求官方质量或官方案例对齐时，不得直接跳到手写 `new THREE.Mesh(...)`。

## Showcase 对齐门禁

用户问“为什么和官方 showcase 不一样”或要求复现官方例子时，先处理 showcase 对齐，再碰用户目标资产。

- 使用同时具备参考图和源码 factory 的真实 showcase 案例；有 spec、几何、贴图或 review evidence 的案例优先。
- 先让官方 spec 经过生成、严格校验和 factory 生成，再放入 showcase 项目临时副本运行其自身构建。
- 分开比较公开参考图、锁定 spec 证据和最终 showcase factory；不要假设单张公开图包含隐藏视角、分类记录、PBR 贴图、描线几何或手工精修信息。
- 公开图无法再生严格 spec 时，只能说“公开图不是完整对齐源”；除非用户明确要人工重建，否则不得手补缺口。
- 生成 factory 无法在同一 showcase viewer 渲染并产出对比证据前，不得声称已达到官方对齐。

## 禁止静默 fallback

以下情况是阻塞，不是实现细节：

- 缺正式 `img2threejs` skill 或 forge 脚本。
- 缺目标物体主体参考图。
- 目标是完整 3D 物体，但只有卡图、贴花、图标或纹理表。
- 严格质量校验失败。
- 渲染 / 截图链路失败。
- 用户要求官方案例对齐，但无法和官方示例比较。

允许汇报：

- "官方 img2threejs skill/pipeline 当前不可用，所以不能按官方流程生成。"
- "当前只有风格贴图，没有书本主体参考图；可以做概念白模，但不能叫参考图重建。"
- "下载官方仓库失败，命令和错误如下；我先停在这里，不手写替代。"

禁止汇报：

- "我先照着感觉做一个。"
- "差不多就是官方流程。"
- "之后再补 spec / 截图 / 对比。"
- "虽然没有官方 skill，但我手写一个等价结果。"

## 汇报

阻塞时说明：

- 用户要的是什么。
- 缺哪个必要输入或工具。
- 哪个命令或文件检查证明缺失。
- 最小补救动作是什么。

成功时说明：

- 使用的正式 skill / pipeline。
- 使用的参考图。
- spec、生成 factory 和渲染证据。
- 对比是否通过；未通过时说明还差什么。
