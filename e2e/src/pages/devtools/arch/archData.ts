/**
 * 架构可视化 v6 — 数据层
 *
 * 包含：类型、节点/边定义、子图数据、布局工具函数。
 * 所有命名面向"不熟悉代码的人"，不用技术术语。
 */

// ============================================================================
// 类型
// ============================================================================

export interface ArchNode {
  id: string;
  label: string;
  desc: string;
  col: number;
  row: number;
  colSpan?: number;
  color: string;
  layer: string;
  details?: string[];
  dashed?: boolean;
  /** 可展开子图的类型 */
  expandable?: 'primitives' | 'pipeline' | 'systems' | 'testing';
  /** 主故事线序号（从 1 开始，0 = 不在主线上） */
  storyIndex?: number;
  /** 接口签名（代码级） */
  iface?: string[];
  /** 数据链路：谁调用我 → 我处理什么 → 产出什么 */
  dataFlow?: string[];
  /** 骰子王座的真实案例 */
  realExample?: string[];
}

export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  color: string;
  type: 'dep' | 'data' | 'event';
  /** 是否属于主故事线 */
  story?: boolean;
}

export interface LayerBand {
  id: string;
  label: string;
  note: string;
  color: string;
  rowStart: number;
  rowEnd: number;
}

/** 基础能力库图标网格项 */
export interface PrimitiveItem {
  emoji: string;
  name: string;
  desc: string;
}

/** 管线步骤 */
export interface PipelineStep {
  emoji: string;
  label: string;
  desc: string;
  /** 右侧标注的系统 */
  systems?: string[];
  /** 骰子王座具体案例 */
  example?: string;
}

/** 系统插件项 */
export interface SystemItem {
  emoji: string;
  name: string;
  desc: string;
  hook: '前置' | '后置' | '前置+后置';
  isDefault: boolean;
}

/** 测试流程步骤 */
export interface TestStep {
  emoji: string;
  label: string;
  desc: string;
  phase: 'record' | 'verify';
  example?: string;
}

// ============================================================================
// 颜色
// ============================================================================

export const C = {
  ui: '#58a6ff',
  game: '#3fb950',
  engine: '#f0883e',
  core: '#bc8cff',
  server: '#8b949e',
  fx: '#f778ba',
} as const;

// ============================================================================
// 节点（重命名为"人话"）
// ============================================================================

export const NODES: ArchNode[] = [
  // ── 游戏层（User Story: 骰子王座） ──
  { id: 'game', label: '🎮 游戏层 — 骰子王座', desc: '一个完整的游戏案例：骰子·英雄·技能·卡牌·回合对战', col: 0, row: 0, colSpan: 6, color: C.game, layer: 'game', dashed: true, storyIndex: 1, details: ['🎯 骰子王座告诉引擎的 4 件事:', '① 开局摆什么 → 2名玩家 · 6个英雄可选 · 每人5骰子+20HP', '② 这步能不能做 → 校验骰子/技能/卡牌操作是否合法', '③ 做了会发生什么 → 产生伤害/治疗/状态变化事件', '④ 事件怎么改状态 → 目标血量 20→17，骰子 5→4', '🔌 11个系统插件自动处理: 回合管理·撤销·响应窗口·交互·特效·日志·操作记录·重赛·教学·调试·选角', '🧩 能力框架: 注册6英雄技能 + 绑定对应执行逻辑', '🎲 其他游戏也一样: 召唤师战争·SmashUp·井字棋…告诉引擎这4件事就能跑'] },
  // ── 引擎层 ──
  { id: 'pipeline', label: '⚡ 回合执行引擎', desc: '每次操作经过8步处理：校验→执行→更新→通知', col: 0, row: 1, colSpan: 6, color: C.engine, layer: 'engine', expandable: 'pipeline', storyIndex: 2 },
  { id: 'systems', label: '🔌 系统插件', desc: '撤销·教学·日志…不改游戏规则就能加功能', col: 0, row: 2, colSpan: 3, color: C.engine, layer: 'engine', expandable: 'systems' },
  { id: 'primitives', label: '🧩 基础能力库', desc: '骰子、卡牌、资源…现成的积木块，拼出任意游戏', col: 3, row: 2, colSpan: 3, color: C.engine, layer: 'engine', expandable: 'primitives', details: ['🎯 所有游戏都能用的"积木块" — 15个独立模块', '底层: 骰子·卡牌·资源·条件·效果·棋盘格·表达式·目标选择·标签·属性·修饰器·UI提示', '中层: 注册技能 → 绑定执行逻辑 → 自动路由操作 → 图片映射', '游戏挑选需要的积木块，引擎负责组装和调度', '🎲 例: 骰子王座用能力框架注册6英雄技能，底层用[骰子+资源池+目标选择+效果处理+属性+修饰器]'] },
  { id: 'testfw', label: '🧪 自动化测试+AI审计', desc: '五轨验证：命令回放·实体完整性·交互完整性·E2E截图·AI逻辑审计', col: 0, row: 3, colSpan: 3, color: C.engine, layer: 'engine', expandable: 'testing', details: ['🎯 四轨自动化 + 一轨AI审计 确保改代码后游戏不坏', '① 命令驱动(GameTestRunner): 录制对局→回放命令→快照对比（最优先·最可靠）', '② 实体完整性: 注册表+引用链+触发路径+效果契约', '③ 交互完整性: UI状态机payload覆盖 + Handler注册链', '④ E2E截图: Playwright无头浏览器+像素对比+完全隔离端口', '⑤ AI逻辑审计: 描述→实现八层追踪+语义一致性+元数据审计+角色反转+16条反模式', '📊 覆盖率: 2500+用例 · 99.4%通过率 · 46秒全量运行'] },
  { id: 'eventstream', label: '📡 事件广播', desc: '实时通知界面播放特效和音效', col: 3, row: 3, colSpan: 3, color: C.engine, layer: 'engine', details: ['🎯 管线处理完后通知UI"发生了什么" → 驱动表现层', '每个事件有自增ID, 撤销时清空(防止重播旧动画)', '消费时freeze视觉状态 → 动画impact时release → 数值变化与动画同步', '🎲 例: 管线产生[攻击命中, 扣血-3] → freeze HP → 飞行动画 → impact释放HP变化'] },
  // ── 框架核心 ──
  { id: 'matchstate', label: '💾 游戏状态', desc: '当前对局的完整快照：轮到谁、血量多少、骰子几个…', col: 0, row: 4, colSpan: 3, color: C.core, layer: 'core', storyIndex: 3,
    details: ['🎯 当前对局的完整快照 — 所有玩家看到的"真相"', 'sys部分: 当前阶段 · 轮到谁 · 可撤销步数 · 交互请求', 'core部分: 由游戏层定义的状态(血量/手牌/骰子等)'],
    iface: [
      'interface MatchState<TCore> {',
      '  sys: SystemState;   // 引擎管理: 回合、撤销、交互…',
      '  core: TCore;        // 游戏定义: 血量、骰子、手牌…',
      '}',
    ],
    realExample: [
      '// 骰子王座第3回合的实际状态',
      '{',
      '  sys: { phase: "attack", currentPlayer: "A", undoCount: 1 },',
      '  core: {',
      '    players: {',
      '      A: { hp: 18, dice: 4, hero: "pyromancer" },',
      '      B: { hp: 15, dice: 3, hero: "shadow" }',
      '    }',
      '  }',
      '}',
    ],
  },
  { id: 'domaincore', label: '📐 游戏定义', desc: '写4段规则逻辑，引擎就帮你处理回合、联机、撤销等所有事', col: 3, row: 4, colSpan: 3, color: C.core, layer: 'core',
    details: ['🎯 每个游戏必须告诉引擎 4 件事:', '① 开局摆什么 → 例: 每人5骰子+20血', '② 这步能不能做 → 例: "你有骰子可以攻击吗?"', '③ 做了会发生什么 → 例: [扣血-3, 消耗骰子×1]', '④ 发生的事怎么改状态 → 例: 目标血量 20→17', '引擎不关心你的具体规则，只要你回答这 4 个问题'],
    iface: [
      'interface DomainCore<TCore> {',
      '  setup(ctx): TCore;              // ① 开局摆什么',
      '  validate(state, cmd): string|null; // ② 能不能做',
      '  execute(state, cmd): Event[];    // ③ 做了会怎样',
      '  reduce(state, event): TCore;     // ④ 怎么改状态',
      '}',
    ],
    dataFlow: [
      '玩家点击“攻击” → 产生 Command{type:attack, target:B}',
      'Command → validate() 检查是否合法',
      '合法 → execute() 产出事件列表 [命中, 扣血-3]',
      '每个事件 → reduce() 更新状态: B.hp 20→17',
      '更新后的状态 → 广播给所有玩家',
    ],
    realExample: [
      '// 骰子王座的真实代码 (dicethrone/domain.ts)',
      'setup: () => ({ players: { A: {hp:20, dice:5}, B: {hp:20, dice:5} } }),',
      'validate: (s, cmd) => s.players[cmd.playerId].dice > 0 ? null : "没有骰子",',
      'execute: (s, cmd) => [{ type:"damage", target:cmd.target, value:3 }],',
      'reduce: (s, evt) => { s.players[evt.target].hp -= evt.value; return s; }',
    ],
  },
  { id: 'adapter', label: '🔌 模式适配器', desc: '同一套规则代码，自动跑在联机、本地、教学三种模式', col: 0, row: 5, colSpan: 3, color: C.core, layer: 'core',
    details: ['🎯 同一套规则代码 → 三种模式自动切换'],
    dataFlow: [
      '联机模式: 玩家操作 → GameTransportServer 校验+执行 → socket.io 同步给所有人',
      '本地模式: 玩家操作 → 跳过网络 → 本地直接执行（调试/单机）',
      '教学模式: 按脚本引导 → 限制可用操作 → 一步步教新手',
    ],
    realExample: [
      '// 骰子王座接入代码 (dicethrone/game.ts)',
      'export default createGameEngine({',
      '  domain: DiceThroneDomain,  // 规则逻辑',
      '  systems: [                 // 按需组装系统',
      '    createFlowSystem({ hooks }),',
      '    createUndoSystem(), createInteractionSystem(), ...',
      '  ],',
      '  commandTypes: ["ROLL_DICE", "PLAY_CARD", ...],',
      '});',
    ],
  },
  { id: 'assetloader', label: '📦 资源加载', desc: '自动压缩图片、管理音效，开发用原图生产用压缩版', col: 3, row: 5, colSpan: 3, color: C.core, layer: 'core', details: ['🎯 统一管理图片/音频 — 自动压缩·按需加载', '开发用原图, 生产自动切压缩版', '🎲 例: 加载骰子王座 → 预加载48张技能卡图片+12个音效'] },
  // ── UI 层 ──
  { id: 'pages', label: '📄 页面入口', desc: '首页·房间·本地对战', col: 0, row: 6, colSpan: 2, color: C.ui, layer: 'ui', details: ['🎯 玩家打开网站后的第一站 — 路由分发到不同页面', '首页(游戏列表) → 房间页(创建/加入) → 对战页(游戏画面)', '🎲 例: 点击"骰子王座" → 进入房间等人 → 2人齐了开始对战'] },
  { id: 'framework', label: '🧱 骨架层', desc: '所有游戏共用的界面模板：玩家面板、操作栏、手牌区', col: 2, row: 6, colSpan: 2, color: C.ui, layer: 'ui',
    details: ['🎯 写新游戏不用重新做界面，直接用现成模板'],
    dataFlow: [
      '游戏状态(MatchState) → 骨架层提取玩家数据',
      '骨架层 → 渲染: 玩家面板 + 操作栏 + 手牌区 + 骰子区',
      '玩家点击操作栏 → 产生 Command → 送回引擎',
    ],
    realExample: [
      '// 骰子王座的 Board 组件',
      '<GameBoard>',
      '  <PlayerPanel player={A} />  {/* 头像+血量条+骰子数 */}',
      '  <DiceArea dice={myDice} />  {/* 可拖拽的骰子 */}',
      '  <ActionBar actions={["attack","skill"]} /> {/* 操作按钮 */}',
      '  <PlayerPanel player={B} />',
      '</GameBoard>',
    ],
  },
  { id: 'contexts', label: '🔗 全局状态', desc: '认证/音频/弹窗/撤销/游戏模式', col: 4, row: 6, colSpan: 2, color: C.ui, layer: 'ui', details: ['🎯 跨页面共享的状态 — 切换页面不会丢失', '登录态 · 音量开关 · 弹窗控制 · 撤销记录 · 游戏模式', '🎲 例: 你关掉音效 → 切换页面后音效仍然是关的'] },
  { id: 'contract', label: '📋 游戏↔UI 接口', desc: '把游戏数据翻译成界面能画的东西（画在哪、能不能点）', col: 0, row: 7, colSpan: 2, color: C.ui, layer: 'ui', details: ['🎯 游戏逻辑和界面之间的"翻译协议"', '游戏层只产出纯数据(你有3张手牌)', 'UI 层需要知道: 画在哪、画多大、能不能点', '🎲 例: 游戏说"手牌:[火球,治疗,盾击]" → UI 画3张牌, 蓝量不够的变灰'] },
  { id: 'fx', label: '✨ 视觉特效', desc: '表现与逻辑分离 · FX引擎 · 视觉状态缓冲', col: 2, row: 7, colSpan: 2, color: C.fx, layer: 'ui', details: ['🎯 让游戏"有感觉" — 表现与逻辑分离架构', '核心原则: 逻辑层同步完成状态计算，表现层按动画节奏异步展示', '🔧 useVisualStateBuffer: 数值属性视觉冻结/双缓冲(HP在飞行动画到达时才变)', '🔧 useVisualSequenceGate: 动画期间延迟交互弹框', '🎬 FX引擎: Cue注册→FxBus调度→FxLayer渲染→FeedbackPack(视觉+音效+震动)', '🎨 技术栈: Canvas 2D粒子 · WebGL Shader · framer-motion · CSS transition', '🎲 例: 攻击→freeze HP→飞行动画→impact瞬间release→HP数字变化+震动+音效'] },
  { id: 'lib', label: '🛠 工具库', desc: '中英文切换、音效播放、常用工具函数', col: 4, row: 7, colSpan: 2, color: C.ui, layer: 'ui', details: ['🎯 常用工具 — 中英文切换 / 音效播放 / 通用函数', 'i18n(中英文切换) · 音效管理 · 常用工具函数', '🎲 例: 切换语言 → 所有界面文字自动变成英文'] },
  // ── 服务端 ──
  { id: 'transport', label: '🎲 游戏传输层', desc: 'GameTransportServer · 自研传输层 · 状态同步 · 管线执行', col: 0, row: 8, colSpan: 2, color: C.server, layer: 'server', storyIndex: 4, details: ['🎯 保证所有玩家看到一致的游戏状态', '自研传输层: GameTransportServer(Koa+socket.io) 管理对局生命周期', '你的操作 → 服务器校验+管线执行 → 广播给所有人', '结构共享状态更新: 纯函数 reduce, 自动记录历史', '🎲 例: 你点击"攻击" → 服务器确认合法 → 对手画面同步显示你的攻击动画'] },
  { id: 'socketio', label: '💬 实时通信', desc: '大厅/聊天/匹配/重赛投票', col: 2, row: 8, colSpan: 2, color: C.server, layer: 'server', details: ['🎯 非游戏内的实时通信 — 大厅/聊天/邀请', '在线状态 · 好友邀请 · 大厅聊天 · 重赛投票', '🎲 例: 你在大厅看到好友在线 → 发送邀请 → 好友收到弹窗'] },
  { id: 'restapi', label: '🌐 NestJS API', desc: 'Docker web容器 · 认证·社交·管理后台（13个模块）', col: 4, row: 8, colSpan: 2, color: C.server, layer: 'server', details: ['🎯 NestJS 单体服务 — Docker web 容器直接监听 :80', '同域部署: 前端静态文件 + API + WebSocket 代理 → 无CORS', '13个模块: auth·admin·friend·message·invite·review·custom-deck·layout·ugc(搁置)·sponsor·feedback·user-settings·health', '🎲 例: 注册账号 → JWT登录 → 添加好友 → 发送邀请'] },
  { id: 'mongodb', label: '🗄 MongoDB', desc: '游戏状态·用户·自定义卡组（Docker容器）', col: 0, row: 9, colSpan: 2, color: C.server, layer: 'server', storyIndex: 5, details: ['🎯 所有需要长期保存的数据都在这里', '游戏状态(断线重连) · 用户数据(账号) · 自定义卡组', 'Docker 容器内部通信，不暴露端口到宿主机', '🎲 例: 对战到一半掉线 → 重新打开 → 对局还在, 从上次继续'] },
  { id: 'redis', label: '⚡ Redis', desc: '会话缓存·在线状态·实时数据', col: 2, row: 9, colSpan: 2, color: C.server, layer: 'server', details: ['🎯 高速缓存层 — 毫秒级读写', 'Redis 7 Alpine · Docker 容器', '会话管理 · 在线状态 · 实时数据缓存', '🎲 例: 查询好友在线状态 → Redis 直接返回, 无需查数据库'] },
  { id: 'static', label: '☁️ Cloudflare CDN + R2', desc: '全站HTTPS + 静态资源缓存 + 对象存储 + 全球加速', col: 4, row: 9, colSpan: 2, color: C.server, layer: 'server', details: ['🎯 Cloudflare 代理全站流量 — HTTPS + CDN + 防护 + R2对象存储', '架构: Cloudflare(HTTPS) → 服务器:80 → Docker web容器(NestJS)', 'SSL模式: Flexible（源站HTTP，Cloudflare自动加速）', 'R2对象存储: 压缩图片/音频资源 · 自动生成registry.json · 全球CDN加速', '自动缓存静态资源(JS/CSS/图片)，服务器只承担API和WebSocket', '🎲 例: 玩家在海外打开游戏 → CDN就近加载, 秒开'] },
];

// ============================================================================
// 边（含测试框架补连线 + 主故事线标记）
// ============================================================================

export const EDGES: ArchEdge[] = [
  // 主故事线（①→⑤ 连续路径）
  { from: 'game', to: 'pipeline', label: 'Command', color: C.engine, type: 'data', story: true },
  { from: 'pipeline', to: 'matchstate', label: '读写状态', color: C.core, type: 'data', story: true },
  { from: 'matchstate', to: 'transport', label: '状态同步', color: C.server, type: 'data', story: true },
  { from: 'transport', to: 'mongodb', label: '持久化', color: C.server, type: 'data', story: true },
  // 游戏层→UI（提供 Board 组件）
  { from: 'game', to: 'pages', label: '提供 Board', color: C.game, type: 'dep' },
  { from: 'game', to: 'framework', label: '注入 Board', color: C.game, type: 'dep' },
  // UI 层内部
  { from: 'pages', to: 'framework', label: '组合', color: C.ui, type: 'dep' },
  { from: 'pages', to: 'contexts', label: '注入', color: C.ui, type: 'dep' },
  { from: 'contract', to: 'framework', label: '实现', color: C.ui, type: 'dep' },
  { from: 'framework', to: 'fx', label: '触发特效', color: C.fx, type: 'event' },
  { from: 'contexts', to: 'lib', label: '使用', color: C.ui, type: 'dep' },
  // 引擎层
  { from: 'game', to: 'primitives', label: '使用能力', color: C.engine, type: 'dep' },
  { from: 'pipeline', to: 'systems', label: '前置+后置钩子', color: C.engine, type: 'dep' },
  { from: 'systems', to: 'eventstream', label: '事件发布', color: C.engine, type: 'event' },
  { from: 'eventstream', to: 'fx', label: '驱动特效/音效', color: C.fx, type: 'event' },
  { from: 'pipeline', to: 'domaincore', label: '调用规则函数', color: C.core, type: 'dep' },
  { from: 'systems', to: 'matchstate', label: '读写 sys', color: C.core, type: 'data' },
  { from: 'adapter', to: 'pipeline', label: 'executePipeline', color: C.core, type: 'data' },
  { from: 'domaincore', to: 'matchstate', label: '定义状态结构', color: C.core, type: 'dep' },
  // 测试框架
  { from: 'testfw', to: 'pipeline', label: '命令回放', color: C.engine, type: 'data' },
  { from: 'testfw', to: 'matchstate', label: '快照对比', color: C.engine, type: 'data' },
  { from: 'game', to: 'testfw', label: '测试用例', color: C.engine, type: 'dep' },
  // 框架核心内部
  { from: 'adapter', to: 'transport', label: 'executePipeline', color: C.server, type: 'data' },
  // 服务端
  { from: 'pages', to: 'socketio', label: '大厅通信', color: C.server, type: 'data' },
  { from: 'pages', to: 'restapi', label: 'API 调用', color: C.server, type: 'data' },
  { from: 'restapi', to: 'mongodb', label: 'CRUD', color: C.server, type: 'data' },
  { from: 'restapi', to: 'redis', label: '缓存', color: C.server, type: 'data' },
  { from: 'transport', to: 'redis', label: '会话', color: C.server, type: 'data' },
  { from: 'assetloader', to: 'static', label: '加载资源', color: C.server, type: 'data' },
];

// ============================================================================
// 层色带（含一句话注解）
// ============================================================================

export const LAYER_BANDS: LayerBand[] = [
  { id: 'game', label: '游戏层', note: 'User Story', color: C.game, rowStart: 0, rowEnd: 0 },
  { id: 'engine', label: '引擎层', note: '共享运行时', color: C.engine, rowStart: 1, rowEnd: 3 },
  { id: 'core', label: '框架核心', note: '类型契约+状态', color: C.core, rowStart: 4, rowEnd: 5 },
  { id: 'ui', label: 'UI 层', note: '引擎提供的界面框架', color: C.ui, rowStart: 6, rowEnd: 7 },
  { id: 'server', label: '服务端', note: '网络+存储', color: C.server, rowStart: 8, rowEnd: 9 },
];

// ============================================================================
// 主干边（默认显示）+ 主故事线
// ============================================================================

const TRUNK_PAIRS: [string, string][] = [
  ['game', 'pages'], ['game', 'framework'],
  ['game', 'pipeline'], ['pipeline', 'systems'], ['pipeline', 'matchstate'],
  ['pipeline', 'domaincore'], ['adapter', 'pipeline'], ['adapter', 'transport'],
  ['eventstream', 'fx'], ['matchstate', 'transport'], ['transport', 'mongodb'], ['restapi', 'mongodb'],
  // 测试框架连线
  ['testfw', 'pipeline'], ['testfw', 'matchstate'], ['game', 'testfw'],
];

export const TRUNK_EDGE_IDS = new Set<number>();
EDGES.forEach((edge, i) => {
  if (TRUNK_PAIRS.some(([a, b]) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a))) {
    TRUNK_EDGE_IDS.add(i);
  }
});

/** 主故事线边索引 */
export const STORY_EDGE_IDS = new Set<number>();
EDGES.forEach((edge, i) => {
  if (edge.story) STORY_EDGE_IDS.add(i);
});

// ============================================================================
// 简化版 Overview — 5 层 + 主线流 + 跨层连线
// ============================================================================

/** 简化层卡片 */
export interface OverviewLayer {
  id: string;
  emoji: string;
  label: string;
  /** 这层做什么（一句人话） */
  whatItDoes: string;
  /** 没有它会怎样 */
  whyItExists: string;
  /** 关键组件标签 */
  tags: string[];
  color: string;
  /** 点击可钻取到的子视图 */
  drillDown?: string;
}

export const OVERVIEW_LAYERS: OverviewLayer[] = [
  {
    id: 'game', emoji: '🎮', label: '游戏层',
    whatItDoes: '定义游戏规则：开局摆什么、能做什么、做了会怎样',
    whyItExists: '没有它 → 引擎不知道在玩什么游戏',
    tags: ['骰子王座', '召唤师战争', 'SmashUp', '井字棋'],
    color: C.game,
  },
  {
    id: 'engine', emoji: '⚡', label: '引擎层',
    whatItDoes: '自动处理每一步操作：校验→执行→更新→通知',
    whyItExists: '没有它 → 每个游戏都要自己写回合管理、撤销、联机同步',
    tags: ['8步管线', '11个系统插件', '15个基础能力', '5轨测试+AI审计'],
    color: C.engine, drillDown: 'sub-pipeline',
  },
  {
    id: 'core', emoji: '💎', label: '核心层',
    whatItDoes: '管理对局数据，定义游戏怎么接入引擎，适配联机/本地/教学',
    whyItExists: '没有它 → 状态格式混乱，联机/本地/教学三种模式各写一套',
    tags: ['对局数据管理', '游戏定义', '三模式适配', '资源加载'],
    color: C.core,
  },
  {
    id: 'ui', emoji: '🖥️', label: 'UI 层',
    whatItDoes: '把游戏数据变成看得见摸得着的画面和动效',
    whyItExists: '没有它 → 玩家只能看 JSON 数据打牌',
    tags: ['页面路由', '游戏骨架', '视觉特效', '全局状态'],
    color: C.ui,
  },
  {
    id: 'server', emoji: '🖧', label: '服务端',
    whatItDoes: '联机同步、用户账号、数据存储',
    whyItExists: '没有它 → 只能自己跟自己玩',
    tags: ['GameTransportServer', '实时通信', 'NestJS API', 'MongoDB', 'Redis', 'Cloudflare CDN + R2'],
    color: C.server,
  },
];

/** 主线流动步骤（一次玩家操作的完整旅程） */
export interface FlowStoryStep {
  emoji: string;
  label: string;
  detail: string;
}

export const OVERVIEW_FLOW: FlowStoryStep[] = [
  { emoji: '👆', label: '玩家点击"攻击"', detail: '产生一条操作指令' },
  { emoji: '📋', label: '游戏判断：合法吗？', detail: '有骰子可以攻击 → 合法 ✓' },
  { emoji: '⚡', label: '管线8步处理', detail: '校验→执行→产出事件[命中,扣血-3]' },
  { emoji: '💾', label: '安全更新状态', detail: 'B.hp 20→17, A.dice 5→4' },
  { emoji: '✨', label: 'UI播放攻击动画', detail: 'freeze HP → 飞行动画 → impact释放数值变化' },
  { emoji: '📡', label: '同步到对手画面', detail: '两人同时看到血条变化' },
];

/** 跨层连线（不走逐层的特殊关系） */
export const OVERVIEW_CROSS_LINKS: { from: string; to: string; label: string; color: string }[] = [
  { from: 'game', to: 'ui', label: '提供游戏界面组件', color: C.game },
  { from: 'engine', to: 'ui', label: '事件驱动特效和音效', color: C.fx },
];

// ============================================================================
// C4 Model 数据
// ============================================================================

/** L1 System Context 实体 */
export interface ContextEntity {
  id: string;
  label: string;
  desc: string;
  type: 'person' | 'system' | 'external' | 'story';
  color: string;
}

export const C4_CONTEXT: ContextEntity[] = [
  { id: 'user', label: '👤 玩家', desc: '通过浏览器玩桌游', type: 'person', color: '#bc8cff' },
  { id: 'story', label: '🎮 骰子王座', desc: '一个具体的桌游游戏（引擎的使用者）', type: 'story', color: C.game },
  { id: 'platform', label: '⚙️ 桌游引擎框架', desc: '自动处理回合、同步、撤销、特效…', type: 'system', color: '#58a6ff' },
  { id: 'ext-db', label: '🗄️ MongoDB + Redis', desc: '持久化 · 缓存 · Docker容器', type: 'external', color: '#8b949e' },
  { id: 'ext-cdn', label: '☁️ Cloudflare CDN', desc: 'HTTPS · 静态缓存 · 全球加速', type: 'external', color: '#8b949e' },
];

export const C4_CONTEXT_LINKS: { from: string; to: string; label: string }[] = [
  { from: 'user', to: 'story', label: '浏览器操作' },
  { from: 'story', to: 'platform', label: '发送操作指令' },
  { from: 'platform', to: 'ext-db', label: '持久化+缓存' },
  { from: 'platform', to: 'ext-cdn', label: 'HTTPS代理+CDN' },
];

/** L2 Container 层间边 */
export const CONTAINER_LINKS: { from: string; to: string; label: string; color: string; dashed?: boolean }[] = [
  { from: 'game', to: 'engine', label: '发送操作指令', color: C.game },
  { from: 'engine', to: 'core', label: '更新游戏状态', color: C.engine },
  { from: 'core', to: 'server', label: '存储和同步', color: C.core },
  { from: 'game', to: 'ui', label: '提供游戏界面', color: C.game, dashed: true },
  { from: 'engine', to: 'ui', label: '驱动动画和音效', color: C.fx, dashed: true },
];

/** 每层组件摘要（L2 容器图显示） */
export const LAYER_SUMMARIES: Record<string, string> = {
  game: '定义游戏规则 · 开局摆什么 · 能做什么 · 做了会怎样',
  engine: '自动处理操作 · 8步管线 · 11个系统插件 · 15个基础能力 · 5轨测试+AI审计',
  core: '管理对局数据 · 游戏定义 · 三种模式自动适配 · 资源加载',
  ui: '页面路由 · 游戏骨架 · 视觉特效 · 全局状态 · 工具库',
  server: '联机同步 · 实时通信 · 用户系统(13模块) · Docker部署 · MongoDB · Redis · Cloudflare CDN',
};

/** L3: 某层内部边 */
export function layerInternalEdges(layerId: string): ArchEdge[] {
  return EDGES.filter(e => {
    const fn = NODE_MAP.get(e.from);
    const tn = NODE_MAP.get(e.to);
    return fn && tn && fn.layer === layerId && tn.layer === layerId;
  });
}

/** L3: 某层与外部的接口 */
export interface ExternalLink {
  direction: 'in' | 'out';
  internalId: string;
  externalNode: ArchNode;
  label: string;
}

export function layerExternalLinks(layerId: string): ExternalLink[] {
  const links: ExternalLink[] = [];
  EDGES.forEach(e => {
    const fn = NODE_MAP.get(e.from);
    const tn = NODE_MAP.get(e.to);
    if (!fn || !tn) return;
    if (fn.layer === layerId && tn.layer !== layerId) {
      links.push({ direction: 'out', internalId: fn.id, externalNode: tn, label: e.label ?? '' });
    } else if (tn.layer === layerId && fn.layer !== layerId) {
      links.push({ direction: 'in', internalId: tn.id, externalNode: fn, label: e.label ?? '' });
    }
  });
  return links;
}

// ============================================================================
// 基础能力库 — 图标网格数据
// ============================================================================

export const PRIMITIVE_ITEMS: PrimitiveItem[] = [
  { emoji: '🎲', name: '骰子', desc: '投掷·统计' },
  { emoji: '🃏', name: '卡牌区域', desc: '手牌·牌库·弃牌堆' },
  { emoji: '📐', name: '棋盘格', desc: '坐标·距离·邻接' },
  { emoji: '💰', name: '资源池', desc: '增减·消耗·边界' },
  { emoji: '🎯', name: '目标选择', desc: '选中谁·攻击谁' },
  { emoji: '⚡', name: '效果处理', desc: '定义·执行效果' },
  { emoji: '🔀', name: '条件判断', desc: '满足条件才触发' },
  { emoji: '📊', name: '表达式', desc: '数值计算' },
  { emoji: '🖼️', name: '视觉解析', desc: '实体→图片映射' },
  { emoji: '📋', name: '动作注册', desc: 'actionId→处理器' },
  { emoji: '🎯', name: '能力框架', desc: '注册·查找·检查·调度' },
  { emoji: '📊', name: '属性系统', desc: '基础值+修饰器叠加' },
  { emoji: '🔧', name: '修饰器', desc: '叠加·优先级·过期' },
  { emoji: '🏷️', name: '标签系统', desc: '分类·过滤·匹配' },
  { emoji: '💡', name: 'UI提示', desc: '可操作性·高亮·禁用' },
];

// ============================================================================
// 管线子图 — 8 步 + halt 旁路
// ============================================================================

export const PIPELINE_STEPS: PipelineStep[] = [
  { emoji: '📥', label: '命令到达', desc: '玩家点击按钮产生的操作指令', example: '玩家A点击“攻击” → {type:attack, target:B}' },
  { emoji: '🔒', label: '系统前置拦截', desc: '可拦截/消费命令，跳过规则层', systems: ['撤销(Undo)', '回合管理(Flow)', '响应窗口', '教学系统', '交互系统', '调试工具', '选角系统'], example: '撤销系统检查: 不是撤销命令 → 放行' },
  { emoji: '✅', label: '规则校验', desc: '这个操作合法吗？不合法直接拒绝', example: 'validate: A有骰子 → 攻击合法 ✓' },
  { emoji: '⚙️', label: '执行命令', desc: '合法操作 → 产生游戏事件列表', example: 'execute: → [命中, 扣血-3, 消耗骰子×1]' },
  { emoji: '🔄', label: '后处理', desc: '自动补充缺失事件（如检测死亡）', example: 'B血量>0 → 存活, 无需补充事件' },
  { emoji: '📝', label: '逐事件更新', desc: '每个事件修改游戏状态（纯函数）', example: 'reduce: B.hp 20→17, A.dice 5→4' },
  { emoji: '📡', label: '系统后置响应', desc: '可产生新事件，最多迭代 10 轮', systems: ['原始日志(Log)', '事件推送(EventStream)', '操作记录(ActionLog)', '回合管理(Flow)', '响应窗口'], example: '事件推送 → UI播放攻击动画+音效' },
  { emoji: '📤', label: '广播结果', desc: '更新后的状态发给所有玩家', example: '两个玩家画面同步更新血量和骰子数' },
];

// ============================================================================
// 系统插件子图 — 11 个系统，分默认/按需两组
// ============================================================================

export const SYSTEM_ITEMS: SystemItem[] = [
  // 默认启用（8 个）
  { emoji: '🔒', name: '撤销系统', desc: 'Ctrl+Z 撤回上一步', hook: '前置', isDefault: true },
  { emoji: '🎯', name: '统一交互', desc: '阻塞式玩家选择，可扩展 kind', hook: '前置', isDefault: true },
  { emoji: '🪟', name: '响应窗口', desc: '打断对手回合进行响应', hook: '前置+后置', isDefault: true },
  { emoji: '📖', name: '教学系统', desc: '新手引导步骤控制', hook: '前置', isDefault: true },
  { emoji: '📋', name: '原始日志', desc: '记录所有操作（审计用）', hook: '后置', isDefault: true },
  { emoji: '📡', name: '事件推送', desc: '驱动特效和音效', hook: '后置', isDefault: true },
  { emoji: '📝', name: '操作记录', desc: '玩家可见的操作历史', hook: '后置', isDefault: true },
  { emoji: '🔁', name: '重赛投票', desc: '结束后再来一局', hook: '前置', isDefault: true },
  // 按需配置（3 个）
  { emoji: '🔄', name: '回合管理', desc: '阶段流转，需游戏提供 FlowHooks', hook: '前置+后置', isDefault: false },
  { emoji: '🎮', name: '调试工具', desc: '开发时修改资源/状态', hook: '前置', isDefault: false },
  { emoji: '👤', name: '选角系统', desc: '开局选角色', hook: '前置', isDefault: false },
];

// ============================================================================
// 测试框架子图 — 录制→回放→对比 全流程
// ============================================================================

export const TEST_FLOW_STEPS: TestStep[] = [
  { emoji: '🎮', label: '正常对局', desc: '玩家正常玩一局游戏，框架在后台记录', phase: 'record', example: '开一局骰子王座，玩家A攻击B、B防御、A释放技能…' },
  { emoji: '📋', label: '录制命令序列', desc: '每一步操作自动转为 Command 对象存入数组', phase: 'record', example: '[{type:attack,target:B}, {type:defend}, {type:skill,id:fireball}]' },
  { emoji: '📸', label: '保存状态快照', desc: '对局结束后序列化完整游戏状态作为"标准答案"', phase: 'record', example: 'snapshot: {A:{hp:12,dice:2}, B:{hp:0}, winner:A}' },
  { emoji: '💾', label: '持久化测试用例', desc: '命令序列 + 快照 存为 JSON 文件', phase: 'record', example: 'dice-throne/tests/attack-combo.test.json' },
  { emoji: '✏️', label: '修改代码', desc: '开发者修改了游戏规则 / 引擎逻辑', phase: 'verify', example: '重构攻击伤害计算公式' },
  { emoji: '▶️', label: '回放命令序列', desc: '读取 JSON，用相同命令序列重新执行一遍', phase: 'verify', example: '逐条执行: attack→defend→skill→…(无需UI)' },
  { emoji: '🔍', label: '快照对比', desc: '将回放后的状态与保存的快照逐字段深度对比', phase: 'verify', example: 'diff: A.hp 期望12 实际12 ✓, B.hp 期望0 实际3 ✗' },
  { emoji: '✅', label: '结果判定', desc: '全部字段一致 → 通过; 有差异 → 报错 + 定位', phase: 'verify', example: '❌ B.hp 不一致 → 攻击伤害计算有bug!' },
];

// ============================================================================
// E2E 截图测试流程
// ============================================================================

export interface E2EStep {
  emoji: string;
  label: string;
  desc: string;
  example?: string;
}

/** 实体交互链完整性测试流程 */
export interface IntegrityTestStep {
  emoji: string;
  label: string;
  desc: string;
  example?: string;
}

export const INTEGRITY_TEST_STEPS: IntegrityTestStep[] = [
  { emoji: '📦', label: '收集游戏定义', desc: '扫描英雄/卡牌/技能/效果注册表', example: 'getDefs() → 6英雄 × 12技能 = 72定义' },
  { emoji: '🔍', label: '注册表完整性', desc: '无重复ID · 必填字段 · 数量阈值', example: '72个定义全部有 id+timing+effects' },
  { emoji: '🔗', label: '引用链检测', desc: '断链 · 孤儿节点 · 过时白名单', example: 'fireball→burn ✓  healX→missing ✗' },
  { emoji: '🎯', label: '触发路径声明', desc: 'CONFIRMED / TODO / 分支完整性', example: '52 CONFIRMED + 8 TODO + 3 分支' },
  { emoji: '📐', label: '效果契约验证', desc: '隐式数据契约 · 类型安全守卫', example: 'rollDie必须有conditionalEffects' },
  { emoji: '📊', label: '覆盖率报告', desc: '引用覆盖 / 分支覆盖统计', example: '引用87% · 分支92% · 无孤儿' },
];

/** 交互完整性审计步骤 */
export interface InteractionAuditStep {
  emoji: string;
  label: string;
  desc: string;
  example?: string;
}

export const INTERACTION_AUDIT_STEPS: InteractionAuditStep[] = [
  { emoji: '🅰️', label: 'Mode A: 声明完整性', desc: '多步交互技能必须声明interactionChain', example: '移动技能需选单位+选目标 → chain声明 ✓' },
  { emoji: '📋', label: 'Mode A: 步骤覆盖', desc: 'chain.steps产出字段⊇payloadContract.required', example: 'required:[unitId,targetCell] → 2步全覆盖 ✓' },
  { emoji: '🔄', label: 'Mode A: 契约对齐', desc: 'AbilityDef契约与执行器契约双向校验', example: 'def.required ⊆ executor.required∪optional ✓' },
  { emoji: '🅱️', label: 'Mode B: Handler覆盖', desc: '所有sourceId都有对应handler注册', example: 'zombie_lord_choose → handler注册 ✓' },
  { emoji: '⛓️', label: 'Mode B: 链式完整性', desc: 'handler产出的后续sourceId也有handler', example: 'choose_minion→choose_base → 两端都有 ✓' },
  { emoji: '👻', label: '孤儿Handler检测', desc: '注册了handler但无能力引用=死代码', example: '38个handler · 0孤儿 · 2白名单' },
];

/** AI 逻辑审计步骤 */
export interface AIAuditStep {
  emoji: string;
  label: string;
  desc: string;
  example?: string;
}

export const AI_AUDIT_STEPS: AIAuditStep[] = [
  { emoji: '📖', label: '锁定权威描述', desc: '规则文档/用户描述→逐动词拆解原子步骤', example: '"打出时抽2张" → 拆3条链+语义边界锁定' },
  { emoji: '🔀', label: '拆分交互链', desc: '独立触发/输入/状态路径+作用目标语义边界', example: '无限定词=不区分敌我 · "代替X做Y"拆两步' },
  { emoji: '🔍', label: '八层逐链追踪', desc: '定义→注册→执行→状态→验证→UI→i18n→测试', example: '限定条件全程约束 · 额度/权限泄漏检查' },
  { emoji: '🔗', label: 'grep消费点+一致性', desc: '原始字段绕过统一入口 · 元数据语义一致性', example: '.card.abilities绕过 · categories≠实际事件' },
  { emoji: '⚡', label: '效果语义+角色反转', desc: '实现语义≟描述 · 角色反转上下文验证', example: '测试按错误实现编写→测试通过≠正确' },
  { emoji: '📊', label: '交叉影响+反模式', desc: '连锁反应检查 · 16条反模式逐条核对', example: '推拉触发被动 · 可选效果无确认UI' },
];

export const E2E_TEST_STEPS: E2EStep[] = [
  { emoji: '🌐', label: '启动浏览器', desc: 'Playwright 打开 Chromium 无头浏览器', example: 'npx playwright test dice-throne.spec.ts' },
  { emoji: '🔗', label: '进入游戏页面', desc: '导航到本地开发服务器的对战页面', example: 'page.goto("/play/dice-throne/local")' },
  { emoji: '🎮', label: '模拟玩家操作', desc: '点击按钮/拖拽卡牌/选择目标', example: 'page.click("[data-action=attack]")' },
  { emoji: '📸', label: '截取屏幕快照', desc: '关键帧截图保存为 PNG', example: 'expect(page).toHaveScreenshot("after-attack.png")' },
  { emoji: '🔍', label: '像素级对比', desc: '新截图与基线图逐像素比较', example: '允许 0.1% 像素差异阈值' },
  { emoji: '✅', label: '结果判定', desc: '差异超阈值 → 失败; 否则通过', example: '更新基线: --update-snapshots' },
];

// ============================================================================
// 用户故事 — 如何用框架开发一个游戏
// ============================================================================

export interface StoryStep {
  emoji: string;
  label: string;
  desc: string;
  /** 关联的架构组件 ID */
  relatedIds: string[];
  /** 对应的层 */
  layer: string;
  example?: string;
}

export const USER_STORY_STEPS: StoryStep[] = [
  {
    emoji: '📁', label: '目录骨架与Manifest',
    desc: '创建游戏目录 + manifest.ts + domain/types/ids占位 + Board占位 + i18n基础文案',
    relatedIds: ['domaincore', 'matchstate'],
    layer: 'core',
    example: 'src/games/<gameId>/ 完整目录 → npm run generate:manifests 通过，大厅可见',
  },
  {
    emoji: '📋', label: '数据录入',
    desc: '规则书→rule/*.md + 按5项判断原则录入必要信息(规则判定/状态区分/UI渲染/引用关系/数量分布) + 类型定义 + 引擎原语选型',
    relatedIds: ['domaincore', 'primitives'],
    layer: 'core',
    example: '每批实体录入后输出核对表(列覆盖全部必要字段) → 用户确认 → 需新原语的标记DEFERRED',
  },
  {
    emoji: '⚙️', label: '领域内核实现',
    desc: 'validate校验 → execute生成事件 → reduce纯函数更新状态 → isGameOver胜负判定',
    relatedIds: ['domaincore', 'pipeline', 'testfw'],
    layer: 'engine',
    example: 'Command{attack} → validate合法 → execute[命中,扣血-3] → reduce: hp 20→17',
  },
  {
    emoji: '🔌', label: 'FlowSystem与系统组装',
    desc: 'FlowHooks阶段流转 + game.ts组装11个系统 + CheatModifier调试 + ActionLog操作记录',
    relatedIds: ['systems', 'eventstream', 'adapter'],
    layer: 'engine',
    example: 'createFlowSystem(hooks) + createBaseSystems() + commandTypes业务命令列表',
  },
  {
    emoji: '🎨', label: 'Board/UI与交互闭环',
    desc: '游戏专属设计规范 → Board.tsx布局组装 → UI子模块拆分 → 操作映射到Command',
    relatedIds: ['framework', 'fx', 'pages', 'contexts'],
    layer: 'ui',
    example: '<GameBoard> + <HandArea> + <PhaseTracker> + useGameEvents()驱动动画+音效',
  },
  {
    emoji: '🚀', label: '收尾与启用',
    desc: 'i18n双语补齐 + 教学系统配置 + 音频接入 + 图片预加载 + 全流程验证上线',
    relatedIds: ['adapter', 'transport', 'assetloader'],
    layer: 'server',
    example: 'tutorial.ts + audio.config.ts + criticalImageResolver → 大厅可见·完整可玩',
  },
];

// ============================================================================
// 布局常量与工具函数
// ============================================================================

export const GRID = {
  cols: 6, rows: 10,
  padX: 80, padY: 30,
  cellW: 170, cellH: 56,
  gapX: 12, gapY: 24,
} as const;

export const SVG_W = GRID.padX + GRID.cols * (GRID.cellW + GRID.gapX) + 10;
export const SVG_H = GRID.padY + GRID.rows * (GRID.cellH + GRID.gapY) + 30;

export function nodeRect(n: ArchNode) {
  const span = n.colSpan ?? 1;
  const x = GRID.padX + n.col * (GRID.cellW + GRID.gapX);
  const y = GRID.padY + n.row * (GRID.cellH + GRID.gapY);
  const w = span * GRID.cellW + (span - 1) * GRID.gapX;
  return { x, y, w, h: GRID.cellH };
}

export function nodeCenter(n: ArchNode) {
  const r = nodeRect(n);
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

export function bandRect(band: LayerBand) {
  const step = GRID.cellH + GRID.gapY;
  const y = GRID.padY + band.rowStart * step - 16;
  const h = (band.rowEnd - band.rowStart + 1) * step - 4;
  return { x: GRID.padX - 18, y, w: GRID.cols * (GRID.cellW + GRID.gapX) + 24, h };
}

export const NODE_MAP = new Map(NODES.map(n => [n.id, n]));

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

type Rect = { x: number; y: number; w: number; h: number };

/** 两个矩形之间的正交路径（圆角） — 通用版 */
export function rectEdgePath(fromR: Rect, toR: Rect): string {
  const fCx = fromR.x + fromR.w / 2, fCy = fromR.y + fromR.h / 2;
  const tCx = toR.x + toR.w / 2, tCy = toR.y + toR.h / 2;
  const r = 7;

  // 下行
  if (toR.y > fromR.y + fromR.h - 10) {
    const sx = clamp(tCx, fromR.x + 14, fromR.x + fromR.w - 14);
    const sy = fromR.y + fromR.h;
    const tx = clamp(fCx, toR.x + 14, toR.x + toR.w - 14);
    const ty = toR.y;
    if (Math.abs(sx - tx) < 4) return `M${sx},${sy} V${ty}`;
    const my = (sy + ty) / 2, d = tx > sx ? 1 : -1;
    return `M${sx},${sy} V${my - r} Q${sx},${my} ${sx + d * r},${my} H${tx - d * r} Q${tx},${my} ${tx},${my + r} V${ty}`;
  }

  // 上行
  if (toR.y + toR.h < fromR.y + 10) {
    const sx = clamp(tCx, fromR.x + 14, fromR.x + fromR.w - 14);
    const sy = fromR.y;
    const tx = clamp(fCx, toR.x + 14, toR.x + toR.w - 14);
    const ty = toR.y + toR.h;
    if (Math.abs(sx - tx) < 4) return `M${sx},${sy} V${ty}`;
    const my = (sy + ty) / 2, d = tx > sx ? 1 : -1;
    return `M${sx},${sy} V${my + r} Q${sx},${my} ${sx + d * r},${my} H${tx - d * r} Q${tx},${my} ${tx},${my - r} V${ty}`;
  }

  // 同行水平
  if (tCx > fCx) return `M${fromR.x + fromR.w},${fCy} H${toR.x}`;
  return `M${fromR.x},${fCy} H${toR.x + toR.w}`;
}

/** 边路径（全局布局用，内部调 rectEdgePath） */
export function edgePath(edge: ArchEdge): string {
  const fn = NODE_MAP.get(edge.from);
  const tn = NODE_MAP.get(edge.to);
  if (!fn || !tn) return '';
  return rectEdgePath(nodeRect(fn), nodeRect(tn));
}

export function edgeLabelPos(edge: ArchEdge) {
  const fromNode = NODE_MAP.get(edge.from);
  const toNode = NODE_MAP.get(edge.to);
  if (!fromNode || !toNode) return { x: 0, y: 0 };
  const fromC = nodeCenter(fromNode);
  const toC = nodeCenter(toNode);
  return { x: (fromC.cx + toC.cx) / 2, y: (fromC.cy + toC.cy) / 2 };
}

/** 主故事线边的颜色（按层色带过渡） */
export function storyEdgeColor(edge: ArchEdge): string {
  const fromNode = NODE_MAP.get(edge.from);
  if (!fromNode) return '#e3b341';
  const layerColors: Record<string, string> = {
    game: '#3fb950', engine: '#f0883e', core: '#bc8cff',
    ui: '#58a6ff', server: '#8b949e',
  };
  return layerColors[fromNode.layer] ?? '#e3b341';
}
