# Fate/Domination OpenDesign v6 审计记录

## 结论

- 素材链：通过。继续目录的 57 个 Fate 专属对象与服务器 inventory 的字节数 / SHA-256 一致。
- 视觉候选稿：可继续人工评审。
- 人工设计验收：`not-approved`。
- 运行时合入：未执行，仍等待 OpenDesign 批准。
- 浏览器检查：`1920x1080`，`scrollWidth=1920`，10 个图片元素全部 `naturalWidth>0`，60 个热点、3 张手牌、0 个页面错误。
- 交互检查：A1 点击后选区为 `A1`；攻击牌检查层可打开；阶段球推进到“等待响应”。
- 截图证据：`exports/fate-domination-v6-desktop.png`。

## 结构检查

- 桌面基线保持 `1920x1080` 横屏。
- 手牌保持横向平铺、不旋转、不扇形、不互相遮挡。
- 真实素材已出现在地图、局势、事件、Master、Servant 和手牌表面。
- 没有把 `master-slot-b.webp` 当作 Master 肖像，也没有用卫宫图冒充绮礼或慎二。
- 绮礼、慎二和第三个 Master 位明确显示待补状态，避免错误素材冒充完成。

## 规则与素材边界

- 局势 / 事件牌面只作为登记后的可见对象展示；未逐张锁定的效果继续保持 `partial`。
- Sitonai 的“反转”效果不在本稿中猜写；规则来源继续以 intake evidence 为准。
- 移动适配、触控尺寸和窄屏滚动仍是后续 change，不计入 foundation PASS。
