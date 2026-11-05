# 导出与渲染

## 真实入口与输出

以下链接指向工程自有实现；迁移到其他 H5 工程时先检查依赖和源路径，不复制第三方源码。

| 输入／职责 | 脚本／消费点 | 输出 |
| --- | --- | --- |
| 全角色网格、骨骼、武器、动作、材质 | [export-fgo-character-gallery.py](../../../../scripts/devtools/export-fgo-character-gallery.py) | `public/assets/dev/fgo-characters/catalog.json`、`{id}/model.json`、贴图 |
| Saber 已有皮肤 JSON 的武器和绑定补充 | [export-fgo-saber100100-skin.py](../../../../scripts/devtools/export-fgo-saber100100-skin.py) | 更新 `saber_body_level_1_skin.json` |
| 宝具粒子、网格、材质、事件、相机 | [export-fgo-np100100-effects.py](../../../../scripts/devtools/export-fgo-np100100-effects.py) | `np100100_effects.json`、`np_effect/` |
| 宝具内专用角色模型和动作 | [export-fgo-np100100-cutscene-actors.py](../../../../scripts/devtools/export-fgo-np100100-cutscene-actors.py) | `np100100_cutscene_actors.json` |
| Shader、采样器、相机、属性轨道、背景 | [export-fgo-scene-metadata.py](../../../../scripts/devtools/export-fgo-scene-metadata.py) | `np100100_scene.json` |
| APK 内置最终光束依赖 | [export-fgo-builtin-effects.py](../../../../scripts/devtools/export-fgo-builtin-effects.py) | `np100100_builtin.json` 和相关贴图 |
| 角色动作播放 | [fgoCharacterRuntime.ts](../../../../src/pages/devtools/cutscene/fgoCharacterRuntime.ts) | `__FGO_CHARACTER__` 调试入口 |
| Saber 完整演出 | [fgoSceneRuntime.ts](../../../../src/pages/devtools/cutscene/fgoSceneRuntime.ts) | `__FGO_SOURCE_SCENE__` 调试入口 |
| 中文名称／用途／宝具片段识别 | [fgoCharacterLabels.ts](../../../../src/pages/devtools/cutscene/fgoCharacterLabels.ts) | 只改变显示，不改变原始 clip 键 |
| 页面和抽屉 | [CutsceneThreePreview.tsx](../../../../src/pages/devtools/CutsceneThreePreview.tsx)、[FgoCharacterDrawer.tsx](../../../../src/pages/devtools/cutscene/FgoCharacterDrawer.tsx) | 角色选择、动作、形态、播放控制 |

## 导出命令与前置条件

工作目录为工程根。Python 和路径变量见 [本机入口](local-workspace.md)。

```powershell
& $fgoPython scripts/devtools/export-fgo-character-gallery.py
```

全角色导出器复用 actors、effects、metadata 三个同目录模块，不能只单拷一个文件。读取 `Android/gamedata/unpack_master/mstSvt` 作为原始名称来源。

注意：`--ids 300100` 目前会把 catalog 改写为选中子集。做单角色诊断时先备份 catalog 或把输出定向到临时工程副本；不要把局部成功当成全角色目录。

Saber 导出按以下依赖顺序进行，不需要每次网页修改都重导出：

1. 保留当前有效的 `saber_body_level_1_skin.json`、角色 atlas 及 cut-in 图集。skin 脚本的 `main()` 先读取该 JSON；不是从空目录生成基础皮肤。
2. effects／cutscene-actors 的贴图复制函数从 `work/ExportedGameAssets/06_NoblePhantasmEffect/NoblePhantasm@100101/Texture2D_png/` 查找原贴图；缺失时先用 UnityPy 导出相同 Texture2D 名称的 PNG。
3. 确认 `Servants@100100`、`NoblePhantasm@100101`、`NoblePhantasm@Sequence@100101`、`Battle@Common`、`NoblePhantasm@CutIns`、`Bg@90001` 均可加载。
4. 在上述前提下执行：

```powershell
& $fgoPython scripts/devtools/export-fgo-saber100100-skin.py
& $fgoPython scripts/devtools/export-fgo-np100100-effects.py
& $fgoPython scripts/devtools/export-fgo-np100100-cutscene-actors.py
& $fgoPython scripts/devtools/export-fgo-scene-metadata.py
& $fgoPython scripts/devtools/export-fgo-builtin-effects.py
```

`--sequence-only` 只刷新已有 effects JSON 的角色／相机变换轨道，不重建完整特效。builtin 脚本还依赖 APK UnityData，见 [解包与 APK](unpack-and-apk.md)。

若基础皮肤 JSON 丢失：先检查 Git／已有导出物。需要从零补齐时，按同一个 `chr` 层级导出 body renderer 的全部节点、每个 renderer 的 bones／bindposes、原 mesh、weights、uv、indices 和 clip bindings，参照全角色导出器的数据结构，并验证材质键和贴图路径与 Saber scene 的消费合同一致；不能把现有 skin 补丁脚本当成基础生成器。此分支当前没有独立的已验证一键脚本。

## 骨骼、网格和片段

- 使用 `chr` 层级，避免把 `model` 中重复层级混入。renderer 的骨骼索引、bindpose、权重必须一一对应；不同 renderer 的本地骨骼索引先映射到导出 skin 索引。
- [fgoSceneActor.ts](../../../../src/pages/devtools/cutscene/fgoSceneActor.ts) 在同一 actor model 空间内求 `inverse(modelWorld) × boneWorld × bindPose`，再做四权重蒙皮。Unity 的 position／scale／Euler／quaternion 绑定分量数不同，不能一概按 `bindingIndex * 3` 计算。
- 路径 hash 要用原始相对层级路径计算；不是仅按末级骨骼名查找。四元数不能当 Euler 值；当前 Euler 转换使用 YXZ 约定。
- StreamedClip 中 `-FLT_MAX` 哨兵帧保存通道初值。真实首帧也可能是极小负时间；不能把全部负时间丢弃。[fgoSceneMath.ts](../../../../src/pages/devtools/cutscene/fgoSceneMath.ts) 是实际采样实现，保留常量、streamed、dense 通道偏移的区分。
- 同名 clip 保留 `sourcePathId`／`sourceName`，只给菜单键增加可区分后缀；不要因重名删除动画。
- 局部 `eye_open`／`eye_close` 不包含全身姿势。角色预览在待机姿态上覆盖眼部绑定；独立播放并重置其余节点会让备用肢体回到拆分布局。
- body／weapon 的 `level_…` 是形态可见性，不把所有形态叠起来；切动作时也重置 renderer 可见性，避免上一片段的隐藏状态残留。
- 武器既可能是蒙皮 mesh，也可能依赖挂点和独立变换曲线。开头数帧就检查手部与武器，不能等特效出现后再判断。
- 备用肢体会缩到约 `0.001` 倍并移到场外。取景排除这些已缩小部件，保留实际渲染几何；当前 `bounds(true)` 同时检查蒙皮变换和相对三角面面积。不要用完整几何包围盒把可见角色缩成一个点，也不要把预览取景策略当成原游戏镜头轨道。

## 材质、特效、相机和事件

- [fgoSceneMaterials.ts](../../../../src/pages/devtools/cutscene/fgoSceneMaterials.ts) 使用导出的原 GLES shader 和 pass state；renderer 按原 shader 的 pass 数量创建视图。不要按猜测写死所有角色都是一遍或两遍绘制。
- 核对每个 submesh 的材质与贴图、UV scale／offset、纹理方向、wrap／filter／mipmap、颜色／透明度、BlendSrc／Dst、ZWrite／ZTest、Cull、render queue。颜色发白、奇怪描边和硬边亮面都先查这些数据，不能直接加 bloom 或重画切图。
- 透明排序要结合原 render queue、变形后的 renderer 中心和材质 pass；直接按对象加入顺序会让武器、身体和光束前后关系错误。
- [fgoSceneParticles.ts](../../../../src/pages/devtools/cutscene/fgoSceneParticles.ts) 消费导出的粒子模块、原网格和动画。逐项核对 local／world simulation、父层级 scale、start／lifetime 曲线、velocity／force、纹理表行列、rotation、billboard／mesh、alignment、子发射器、UVScroll 和 SimpleAnimation。
- 粒子随机种子和模拟步进保持可复现，倒拖时间必须清空并从正确状态重建；相同时间的直接定位与自然播放应一致。
- `NoblePhantasm@Sequence@…` 是动作切换、角色显示、挂点、特效启停、相机等事件的依据。编号不保证顺序，不能只按 `treasureArms1…7` 顺放。
- 宝具内的 `chr_100100`／`chr_100101` 与战斗 servant 不是天然可互换的模型；在切换事件处查各自 mesh、clip、形态和附件。
- 带外部引用的 final ray 需从 APK 内置 Unity 资源解出，`apk:<assets file>:<PathID>` 保留命名空间，不能拿其他光束代替。

## 网页显示调整的证据边界

[fgoScenePresentation.ts](../../../../src/pages/devtools/cutscene/fgoScenePresentation.ts) 明确包含网页观感调整：增益／透明度、部分镜头偏移、光束厚度和朝向等。它们不是恢复出的 Unity 原参数。用户接受“网页效果合适”时可保留；要求原生 1:1 时必须隔离核对，不能引用这些值作为 APK 证据，也不能把自检通过写成原生一致。

## 可复用与需适配部分

角色 mesh／skin／动作／已支持 shader 可以直接走全角色管线。新 shader、刚性附件、外部依赖、特殊可见性轨道要在对应 owner 扩展。每个完整宝具的事件编排、专用模型、粒子与镜头都需自身数据；共享的是解码与运行机制，不是同一份演出时间轴。
