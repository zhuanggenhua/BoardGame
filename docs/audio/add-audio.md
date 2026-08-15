# 新增音频素材合同

> 本文是“新增外部音频素材”这条链路的目录、命名、产物和验收合同。
> 查已有库里的 key 并接到代码不属于本文；本文只记录新增素材产物合同。

## 0. 适用范围

仅适用于：

- 往 `public/assets/common/audio/` 新增源文件
- 需要压缩、重建 registry、补中文友好名、刷新文档和目录

如果不是新增素材，而是复用现有音效库 key，请只参考 `docs/audio/audio-usage.md` 的检索资料。

## 1. 前置条件

1. 命令行可直接执行 `ffmpeg`
2. 只使用公共目录，禁止在 `src/games/<gameId>/` 下放音频
3. 原始素材保留在原路径，压缩产物写入同级 `compressed/`

## 2. 目录与命名合同

### 2.1 目录结构

```text
public/assets/common/audio/
├── bgm/
├── ui/
├── card/
└── ...
```

- `bgm/` 根目录下的文件视为背景音乐
- 其余目录默认视为音效
- 目录层级就是后续 key 语义，必须稳定可读

### 2.2 命名规则

- 推荐：全英文 + 数字 + 下划线
- 避免：空格、中文、特殊符号
- 变体命名：同类音效使用 `_01/_02/_03`

### 2.3 key 生成规则

生成脚本：`scripts/audio/generate_common_audio_registry.js`

规则：

- 去除扩展名
- 全部小写
- 非字母数字字符转为 `_`
- 多段目录用 `.` 拼接
- `bgm/` 统一归类为 `bgm`
- 其他目录以第一级目录作为 `group`

## 3. 必要产物

新增素材后，至少要更新：

1. `public/assets/common/audio/registry.json`
2. `src/assets/audio/registry.json`
3. `docs/audio/common-audio-assets.md`
4. `public/assets/common/audio/phrase-mappings.zh-CN.json`（如需补中文友好名）
5. `docs/audio/registry.ai.json`（当精简 registry 需要刷新时）
6. `docs/audio/audio-catalog.md`（当语义目录需要刷新时）

## 4. 必跑命令入口

命令定义和可选压缩参数统一见 `docs/audio/audio-usage.md` §3，本文件规定新增素材的执行顺序：

1. 压缩新增素材并确认产物存在。
2. 生成运行时 registry 和资源清单。
3. 按需要刷新 AI 精简 registry、语义目录和中文友好名。
4. 按本文第 6 节完成 `/dev/audio` 浏览器验收，再进入代码接入。

## 5. 中文友好名合同

文件位置：

```text
public/assets/common/audio/phrase-mappings.zh-CN.json
```

- 这里的 key 是英文短语，不是完整 registry key
- `/dev/audio` 仍显示英文时，优先补这里
- 补完后刷新 `/dev/audio` 再核对

## 6. 浏览器验收合同

入口：

```text
/dev/audio
```

最低验收项：

- 新增音效能出现
- 分类/子分类正确
- 中文友好名命中
- 点击播放正常

如果没做这一步，不能把新增素材说成“完整接入”。

## 7. 代码接入合同

- 代码里只能使用 registry key
- 禁止手写路径
- 禁止手写 `compressed/`
- `getOptimizedAudioUrl()` 会自动选择压缩产物

## 8. 常见问题

### 8.1 重复 key 报错

- 检查目录和文件名是否会归一成同一个 key
- 保证一个 key 只对应一个稳定语义对象

### 8.2 registry 没更新

- 是否漏跑 `generate_common_audio_registry.js`
- 是否指向了错误的 source 路径

### 8.3 中文名不生效

- 是否遗漏 `phrase-mappings.zh-CN.json`
- 是否没有刷新 `/dev/audio`
- 是否用了错误的英文词干
