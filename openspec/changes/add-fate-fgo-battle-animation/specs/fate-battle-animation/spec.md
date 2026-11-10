## ADDED Requirements

### Requirement: 非阻塞角色战斗演出
系统 SHALL 对具备素材且真名已公开的从者，在已确认的战斗结果发生时展示相应攻击和受击动作。

#### Scenario: 素材未就绪
- **WHEN** 战斗结算发生时素材仍在下载或不可用
- **THEN** 系统 MUST 跳过本次演出并允许行动和结算继续

#### Scenario: 真名隐藏
- **WHEN** 从者的真名尚未公开
- **THEN** 系统 MUST 不展示该从者演出，并 MAY 在后台低优先级预加载已支持角色资源

### Requirement: Saber 宝具演出
系统 SHALL 在确认使用「誓约胜利之剑」且素材就绪时播放对应宝具演出。

#### Scenario: 宝具确认
- **WHEN** 阿尔托莉雅确认使用其「誓约胜利之剑」
- **THEN** 系统 MUST 播放其宝具演出，前提是素材已就绪且真名已公开

### Requirement: PC 本地素材下载
系统 SHALL 允许 PC 用户下载所需战斗素材并在以后优先从本地读取。

#### Scenario: 再次打开对局
- **WHEN** 本地已有与服务器清单匹配的素材
- **THEN** 系统 MUST 复用本地素材而不重复下载
