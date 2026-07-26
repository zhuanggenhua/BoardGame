# 大杀四方迪士尼四派系预审批证据

## 当前结论

- 状态：`blocked: awaiting OpenSpec approval`
- 对象范围：超能陆战队、冰雪奇缘、狮子王、花木兰。
- OpenSpec change：`openspec/changes/add-smashup-disney-four-factions/`
- 严格校验：`openspec validate add-smashup-disney-four-factions --strict --no-interactive` 通过。
- 当前尚未进入运行时代码、正式资源、玩法实现、E2E 或上传阶段。

## 主真相源

| 字段 | 值 |
| --- | --- |
| 原图路径 | `C:/Users/Dqm/.codex/attachments/11666c73-73f5-40e1-ad6c-9d72601bd77c/image-1.png` |
| 文件大小 | `41,387,810 bytes` |
| 尺寸 | `4888 x 4096` |
| SHA-256 | `4e28237e91b60a3a4faa48aa57b6c0404574cdd372017fa5104781219e1216b0` |
| 用途 | 中文卡图、中文名称、中文规则文本、row-major 顺序、四派系范围识别 |

## 网格与派系范围

| 范围 | 派系 | 初步 slot |
| --- | --- | --- |
| 第 1 组 | 超能陆战队（Big Hero 6） | `0-14` |
| 第 2 组 | 冰雪奇缘（Frozen） | `15-29` |
| 第 3 组 | 狮子王（The Lion King） | `30-44` |
| 第 4 组 | 花木兰（Mulan） | `45-59` |

- 整图可按 `10 x 6` 切分，共 `60` 个卡牌格。
- 每格约 `489 x 683`。
- 已生成 `60` 张完整单卡预裁图。

## 临时预检产物

| 产物 | 路径 | 用途 |
| --- | --- | --- |
| 轻量总览 | `temp/smashup-disney-four-factions-intake/overview-2200w.png` | 审批前范围复核 |
| 单卡裁图 | `temp/smashup-disney-four-factions-intake/cards/slot-00-r1c1.png` 至 `slot-59-r6c10.png` | 审批后逐卡录入主工作面 |
| 元数据 JSON | `temp/smashup-disney-four-factions-intake/source-and-grid-feasibility.json` | 尺寸、hash、格子坐标与裁图路径 |

## 批准后第一步

批准 `add-smashup-disney-four-factions` 后，按以下顺序继续：

1. 消费 `temp/smashup-disney-four-factions-intake/cards/` 的完整单卡裁图，建立逐卡合同。
2. 对每张卡锁定中文名、英文名、类型、力量、效果原文、原子子句、数量与 `previewRef`。
3. 查找或登记基地来源；找不到基地 atlas 时先标 `blocked`，不得猜造基地。
4. intake 合同达到 `locked / blocked / disputed` 后，再进入静态注册、资源链、玩法实现与测试/E2E。

## Worktree 风险

- 当前分支：`codex/smashup-pod-card-art`。
- 当前工作区已有 POD 批次未提交改动，涉及 Smash Up 共享注册文件、locale、manifest、测试和 faction data。
- 迪士尼四派系实现前需要用户指定：
  - 继续在当前 dirty worktree 增量做；或
  - 新建/切换到干净 worktree，避免与 POD 批次混入同一推送范围。

## 阻塞项

| 阻塞项 | 原因 | 最小解阻动作 |
| --- | --- | --- |
| OpenSpec approval | 新增四派系属于新能力，项目 OpenSpec 流程要求 proposal 批准后才能 implementation | 用户明确说“批准 `add-smashup-disney-four-factions`，按当前/干净 worktree 实施” |
| worktree scope | 当前分支已有其他 Smash Up 未提交改动，直接实装会混合推送范围 | 用户指定继续当前 worktree 或开干净 worktree |
