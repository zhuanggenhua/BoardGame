# 山屋惊魂 3D 前端实验

该原型保存在 `artifacts/betrayal-3d-prototype/`，是独立的本地实验入口，不注册到正式游戏路由。模型与贴图放在此目录的 `public/`，不会进入项目正式构建使用的根 `public/`。

原型 Vite 配置单独指定该目录为静态资源根。PathFinding.js 0.4.18 在原型自己的 `package.json` 中声明，heap 0.2.5 由它传递安装；运行 `npm ci --prefix artifacts/betrayal-3d-prototype` 按锁文件安装到原型私有目录，不修改项目根依赖。

本实验只做基础前端效果，不改正式 Betrayal 规则、联机、存档或胜负结算。当前目标是验证原版房间板块、TTS 探索者模型、免费怪物模型、3D 墙体/家具和俯视角自由镜头能否组成可读的恐怖回合制地图原型。

## 启动

```powershell
npm ci --prefix artifacts/betrayal-3d-prototype
node node_modules/vite/bin/vite.js --config artifacts/betrayal-3d-prototype/src/vite.config.mjs
```

打开 `http://127.0.0.1:5188/artifacts/betrayal-3d-prototype/betrayal-3d.html`。左键拖动平移、右键拖动旋转、滚轮缩放；触屏单指平移、双指缩放旋转。

点击房间或底部房间名选择，点击移动播放探索者位移动画。结束回合只递增演示计数。属性是静态演示数据。

## 当前实现

- 12 个房间使用用户本地 TTS 资源导出的原版房间贴图。
- 三个探索者使用 TTS AssetBundle 导出的不同原模型，运行时高度归一到桌面棋子比例，不再按摆正前高度缩放。
- 探索者材质接入 diffuse、normal、metal、occlusion、emissive 贴图；模型姿态仍使用已验证的 Mesh 层 `-90deg X` 摆正。
- 墓地接入 `Animated Monsters by Quaternius` 的 Skeleton OBJ；包内 License 为 CC0 1.0，来源文件保留在 `artifacts/betrayal-3d-prototype/public/betrayal-3d/monster-license-quaternius-animated-monsters.txt`。
- 墙体按真实门位生成：相邻房间只有两侧都有对应门才开通；不匹配的相邻边保持实墙；通向地图外的门显示为关门且不可通行。
- 家具和棋子都进入同一份空间网格，移动路径会避开餐桌、椅子、书桌、书架、其他探索者和怪物。
- 房间贴图、墙体、门框、移动网格都共用同一份房间门位/坐标逻辑，避免视觉门和可走路线分裂。

## 验收

验证命令：

```powershell
node node_modules/vite/bin/vite.js build --config artifacts/betrayal-3d-prototype/src/vite.config.mjs
node artifacts/betrayal-3d-prototype/src/verify.mjs
```

迁入前的本地验收记录位于 `evidence/betrayal-3d-prototype/pass-current/checks.json` 和同目录截图；截图目录遵循仓库忽略规则，不随本次原型代码上传。此次迁入后未重跑验证。

验证覆盖：

- 当前入口无浏览器错误，canvas 非空。
- 共用墙只生成一次，门位按双方真实门判断。
- 温室-书房、画廊-墓地等相邻无匹配门边不会被路径穿过。
- 厨房、储藏室、书房、温室多段移动能沿合法门路径到达。
- 移动路径逐点避开家具和其它棋子。
- 三个探索者加一个怪物保持棋子级尺寸且不互相重叠。
- 桌面、正俯视、设置控件、手机横屏和手机竖屏截图都来自当前运行入口。

## 已知限制

- 这还是前端原型，不是正式规则对局；速度、事件、预兆、物品、怪物行动和玩家回合没有接真实规则。
- Skeleton 是 CC0 免费模型，不是 TTS 原包里的正式山屋怪物；TTS `Models/*.obj` 目前只证明有牌/标记类模型，没有闭合到可用立体怪物。
- 房间布局为演示布局，目的是验证门墙、路径和视觉，不代表正式探索随机发现流程。
- 角色动画目前是平移棋子；没有骨骼行走动画。

## 2026-09-06 续做优化

- 增加合法路线预览：选中目标房间后，画面用琥珀脚印和终点圈显示真实寻路结果；执行移动时复用同一条路径，避免“看得到”和“走得到”变成两套逻辑。
- 增强门墙辨识：可通行连接处增加黄铜门槛，俯视模式增加说明条；无匹配门位的相邻墙仍按实墙处理。
- 增强场景细节：餐桌布、书架书脊、书房桌面烛台、骷髅威胁圈全部是视觉表现层，不改变碰撞真相源。
- 优化俯视验收：俯视模式会把底部信息面板压低，保留房间条，避免遮住地图下方房间。
- 最后一次迁入前验证：上述 build 和 verify 均通过；证据位于 `evidence/betrayal-3d-prototype/pass-current/`。本次迁入后未重跑验证。
