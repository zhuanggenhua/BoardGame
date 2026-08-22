# 新游戏收尾与启用清单

本文件只定义新游戏完成前的最后回查。i18n、教学、音频、关键图片、debug、资源和验证的具体做法以对应 standards / skills 为主源。

## 完成判断前置

最终完成判断前必须回查：

- 规则数据录入文件存在，且每项能追溯到规则来源。
- 规则对象 × 素材矩阵覆盖基础版必需对象。
- 基础版必需对象状态只能是 `pass`、`approved-programmatic`、`out-of-scope-approved` 或 `blocked:<最小解阻动作>`。
- 任一 `blocked` 或未裁定对象已同步写入任务、OpenSpec 或 evidence；此时最终状态不能写 complete。
- 运行时 UI 没有用 HTML/CSS、文字占位、程序化图形或 mock 图片冒充正式素材，除非矩阵明确批准。
- 游戏专属风格合同存在，真实截图能证明不是通用壳层、其它游戏换皮或多层框体堆叠。
- 用户点名的 DOM、BGG、截图、规则书、素材文件或其它来源已读取并写入来源合同；未命中时只能 `blocked/in_progress`。
- 桌面主态、桌面结算 / 终局态和移动目标姿态按顺序截图复看；桌面未过不得宣称手机阶段完成。

只要还有可本地推进的缺口，就继续回到 intake、OpenSpec、实现或验证阶段，不发送完成式汇报。

## 一票否决

以下任一成立时，不得写“完成 / 闭环 / 基础版已交付”：

- 规则数据、素材矩阵、来源合同、布局合同或风格合同缺失。
- 用户点名来源未找到、未读取、为空、不可解析，或缺少最小解阻动作。
- 真实截图仍有主对象遮挡、重叠、手机裁切、过多框体、风格不像本游戏或主操作不可读。
- E2E 只证明流程能点通，但截图链、AI 复看、素材 / 布局 / 风格证据仍缺。
- 下一步仍可通过本地文件、脚本、截图、E2E、素材处理或文档更新继续推进。

## 收尾项目

### i18n

- `public/locales/{zh-CN,en}/game-<gameId>.json` 覆盖阶段、命令、事件、UI 和教程文案。
- i18n 完整性测试只能证明 key 完整，不证明语义正确；关键规则文案仍需回主真相源。

### 教程

- 教程必须走项目教程引擎和游戏教程配置。
- 教程步骤绑定真实玩家入口或明确演示状态，不用隐藏调试命令冒充正式教学。
- 用户正在审文案时，先交完整文案稿；获确认后再实施。

### 音频

- 先读 [`audio-assets`](../../../knowledge/standards/audio-assets.md) 和 [`audio-integration`](../../audio-integration/SKILL.md)。
- 音效 key 以共享 registry 为唯一来源，不在游戏层声明短 key、`basePath` 或手写 `compressed/`。
- 同一动作只能走一条播放路径：反馈 resolver、FX、动画 impact、UI 按钮或拒绝音。

### 关键图片预加载

- 先读 [`asset-pipeline`](../../../knowledge/standards/asset-pipeline.md)。
- 游戏只实现或注册 critical / warm resolver；路径格式、manifest、上传和远端回查按资源主源执行。

### Debug 配置

- 若附加能力矩阵裁定本轮实施 debug，则创建游戏专属 debug 配置并挂到 Board 内正式 debug 入口。
- 调试动作走 `SYS_CHEAT_*` 或项目批准的系统命令，禁止直接改 core。
- 调试页、区域编辑器和配置工具不得默认注册为全局工具，除非用户明确要求或它服务多个游戏。

### 资源命名与落盘

- 随机名、默认名、扫描流水号和下载哈希默认按图片语义重命名；用户语义名默认保留或先确认。
- 缩略图、atlas、角色板、棋盘、地图、token 等先按素材矩阵裁定，再移动、压缩、manifest、上传和远端回查。
- 大拼版、扫描页和多对象说明图必须先裁成运行时单对象资源；不得整页图直接进正式运行时目录。

## 最终验证命令

按本轮改动范围运行：

```bash
npm run generate:manifests
npx vitest run src/games/<gameId>
npm run typecheck
npm run assets:check
npm run assets:upload
npm run dev
```

说明：

- `assets:upload` 只在本轮新增 / 变更运行时资源且远端缺失时执行。
- `npm run dev` 的验收重点是大厅可见、可创建对局、真实入口可玩和关键截图成立，不是只看服务启动。

## 完成口径

最终汇报必须说明：

- 当前完成到哪个阶段。
- 验证命令和关键结果。
- 截图 / evidence 落点。
- 仍为 `blocked`、`deferred` 或用户确认后续范围的对象。
- 若有未跑校验，说明现实原因和最小补救动作。
