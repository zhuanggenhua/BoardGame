# 验证与交付

## 环境与启动

现有验证器使用 `playwright`、`sharp`，并固定访问 `http://127.0.0.1:4290/dev/cutscene-three`。更换端口时同步修改或参数化工程自有验证器，不能只改浏览器地址。

在工程根目录启动：

```powershell
& $fgoNode scripts/infra/vite-cli-safe.mjs --config vite.config.ts --configLoader bundle --host 127.0.0.1 --port 4290 --strictPort
```

后台运行时使用隐藏窗口与独立 stdout／stderr 日志。端口占用先读进程命令行，确认是当前工程再停止；不要结束不明服务。此工程通常关闭 HMR，源码修改后重启实际监听的 Vite 并刷新页面；不把旧缓存的截图作为新实现证据。

浏览器入口：

- 完整演出：`/dev/cutscene-three`，默认 Saber。
- 指定角色：`/dev/cutscene-three?character=300100&mode=motion`。
- 角色页支持左侧抽屉、中文／原始名／ID 搜索、类别筛选、动作分组、形态、循环、进度、速度和视角。展开“动作含义与宝具素材情况”查看具体说明。

## 自动验证

从工程根运行；只在相关实现或导出物变化时重跑对应检查。

```powershell
& $fgoNode scripts/devtools/verify-fgo-character-gallery.mjs
$env:FGO_GALLERY_MOBILE = '1'
& $fgoNode scripts/devtools/verify-fgo-character-gallery.mjs
Remove-Item Env:FGO_GALLERY_MOBILE
```

[角色验证器](../../../../scripts/devtools/verify-fgo-character-gallery.mjs) 通过真实抽屉和表单切换角色、动作和形态；桌面遍历所有片段，手机尺寸遍历所有角色的代表攻击／施法动作。检查唯一 canvas、非空截图、有限坐标、形态选择、暂停／重播／循环结束和视角恢复。

它会写 `test-results/evidence-screenshots/fgo-gallery/{desktop,mobile}/report.json` 和截图。桌面模式还从真实渲染生成 `preview.png` 并更新 catalog 的 thumbnail；它不是纯只读检查。手机模式不更新目录。通过这些检查不能排除所有错切图、错误挂点或未采样帧问题，仍需实际看图。

```powershell
$env:FGO_SCENE_SCREENSHOT_SET = 'skill-check'
$env:FGO_SCENE_COMPARE_PLAYBACK = '1'
$env:FGO_SCENE_COMPLETE_PLAYBACK = '1'
& $fgoNode scripts/devtools/verify-fgo-source-scene.mjs 0 0.5 0.953 1 1.5 2 4 8.7 9.1 10.5 11.680888 12.024013 13.484013 13.5 16.5 18.5
Remove-Item Env:FGO_SCENE_SCREENSHOT_SET, Env:FGO_SCENE_COMPARE_PLAYBACK, Env:FGO_SCENE_COMPLETE_PLAYBACK
```

[演出验证器](../../../../scripts/devtools/verify-fgo-source-scene.mjs) 截取给定时间，检查倒拖清理、暂停／播放、自然播放与定位的状态／像素一致，以及 18.5 秒结束后的清场。`FGO_SCENE_VIEWPORT=mobile` 可检查手机尺寸；`FGO_SCENE_QUERY` 可传页面查询串。结束时清除本轮环境变量，避免污染后续验证。

定向单元测试：

```powershell
& $fgoNode scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/fgoSceneActor.test.ts src/pages/devtools/__tests__/fgoSceneMath.test.ts src/pages/devtools/__tests__/fgoSceneMaterials.test.ts src/pages/devtools/__tests__/fgoSceneBuiltin.test.ts src/pages/devtools/__tests__/fgoSceneCameraShake.test.ts src/pages/devtools/__tests__/fgoSceneParticles.test.ts src/pages/devtools/__tests__/fgoScenePresentation.test.ts --configLoader bundle --maxWorkers 1 --no-file-parallelism
```

Node 22.17.1 环境下 `--configLoader native` 可能无法加载 `.ts`；现有可执行命令使用 bundle loader。Node／依赖版本更换后按当前项目要求重新确认。

只 lint 修改的工程自有文件。根 `tsc --noEmit` 的 project-reference 配置不能代替 app 子项目检查；需要时用 `tsc -p tsconfig.app.json --noEmit`，区分新增错误和已有错误，不靠过滤输出伪装整体成功。

## 画面检查顺序

1. **0–1 秒**：看 0、0.5、0.953、1 秒原尺寸画面，确认身体轮廓、手部和武器连接。必要时在问题帧前后按源采样率逐帧检查，不能只查整数秒。
2. **切换边界**：在角色、动作、形态、镜头或挂点事件前一帧／事件帧／后一帧截图，检查重复 actor、姿势跳变、附件残留、重复 canvas。
3. **后半段**：区分发射光束与终结光束，逐层检查原网格、纹理切片、UVScroll、SimpleAnimation、透明 pass、硬边和渐隐。优先诊断原材质与绘制状态，不靠调透明度掩盖贴图或拓扑错误。
4. **回放**：先到 16.5 秒再回 0.953 秒；播放／暂停、重播、跨角色快速切换后重看同一帧。调试快照一致之外还要比较像素。
5. **响应式与交互**：桌面、手机竖屏及短横屏检查；抽屉搜索、无结果、分类、Esc／焦点回归；说明展开后画布不被底部控件覆盖。

调试接口：

```javascript
window.__FGO_CHARACTER__.snapshot();
window.__FGO_CHARACTER__.seek(0.25);
window.__FGO_SOURCE_SCENE__.snapshot();
window.__FGO_SOURCE_SCENE__.seek(0.953);
```

## 对照资格与停止条件

- 有同版本原游戏录像／截图时，按相同时间点、动作、形态、镜头比较，记录帧率和时间偏移。没有原始参考时，报告“网页自检”，不能声称逐帧原生一致。
- 当前存在显示调整模块，看到画面较好不等于恢复了全部引擎行为。测试通过只证明测试覆盖的条件。
- 用户只要求可用 H5 预览时，完成源数据对应、画面与交互自检后交付；不为假设中的差异反复全量重跑。
- 缺失目标特效或 sequence 时，给出确切资源名／映射／本地存在性；继续可独立完成的角色动作，避免用其他角色的演出补位。
- 输出可打开链接、测试结果、关键截图位置和实际未完成范围。若预览只绑定 127.0.0.1，说明它是本机入口；手机真机不能直接用手机自己的 localhost 访问此服务。
