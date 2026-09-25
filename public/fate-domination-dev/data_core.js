// ====== data_core.js ======
// 存放游戏的基础机制（场地、规则）、局势(situations)和事件(events)

const LOC_SLOTS = {
    '魔术工房': [
        { lbl: '+2魔', cls: 'label-dili1', cirCls: 'slot-dili1' },
        { lbl: '+1魔', cls: 'label-dili2', cirCls: 'slot-dili2' },
        { lbl: '+1魔', cls: 'label-dili2', cirCls: 'slot-dili2' },
        { lbl: '+1魔', cls: 'label-dili2', cirCls: 'slot-dili2' }
    ],
    '深山町': [
        { lbl: '+3威力', cls: 'label-dili1', cirCls: 'slot-dili1' },
        { lbl: '+1威力', cls: 'label-dili2', cirCls: 'slot-dili2' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' }
    ],
    '新都': [
        { lbl: '+3威力', cls: 'label-dili1', cirCls: 'slot-dili1' },
        { lbl: '+1威力', cls: 'label-dili2', cirCls: 'slot-dili2' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' },
        { lbl: '&nbsp;', cls: 'label-normal', cirCls: '' }
    ]
};

const MOVE_RULES = {
    '魔术工房': { next: '深山町', cost: 1 },
    '深山町': { next: '新都', cost: 2 },
    '新都': { next: '侦察', cost: 2 },
    '侦察': { next: null, cost: 0 }
};

// 全局数据容器，在此初始化
const DB = {
    situations: [
        { id: "sit1", name: "转机", mana: 2, desc: "于深山町和新都各增加一张正面事件牌。恢复2点魔力" },
        { id: "sit2", name: "新都之战", mana: 2, desc: "于新都增加一张正面事件牌。恢复2点魔力" },
        { id: "sit3", name: "深山町的杀人魔", mana: 2, desc: "于深山町增加一张正面事件牌。恢复2点魔力" },
        { id: "sit4", name: "怒不可遏", mana: 2, desc: "力量攻击于深山町和新都获得威力+2。恢复两点魔力" },
        { id: "sit5", name: "暴风雨前的宁静", mana: 2, desc: "迅捷攻击于深山町和新都获得威力+2。恢复两点魔力" },
        { id: "sit6", name: "完美的流动", mana: 2, desc: "魔法攻击于深山町和新都获得威力+2。恢复两点魔力" },
        { id: "sit7", name: "安哥拉·曼纽的实质", mana: 0, desc: "魔法攻击于深山町和新都获得威力+1。宝具禁止使用" },
        { id: "sit8", name: "安哥拉·曼纽的阴影", mana: 0, desc: "迅捷攻击于深山町和新都获得威力+1。宝具禁止使用" },
        { id: "sit9", name: "安哥拉·曼纽的诅咒", mana: 0, desc: "力量攻击于深山町和新都获得威力+1。宝具禁止使用" },
        { id: "sit10", name: "对未来的憧憬", mana: 0, desc: "位于深山町和新都的玩家，若其所有攻击至少有一种属性相同，则合计威力+3。" },
        { id: "sit11", name: "命运之夜", mana: 4, isClimax: true, desc: "高潮：剩余4+人。于深山町和新都增加一张正面事件牌。恢复魔力4点" },
        { id: "sit12", name: "身处地狱之门", mana: 4, isClimax: true, desc: "高潮：剩余3+人。无法部署/进入新都于侦察。魔术工坊仅限一人部署。于深山町增加一张正面事件牌。恢复魔力4点" },
        { id: "sit13", name: "天之杯", mana: 6, isClimax: true, desc: "高潮：剩余2+人。无法部署/进入新都于侦察。魔术工坊仅限一人部署。于深山町增加两张正面事件牌。恢复魔力6点" }
    ],
    masters: [],  // 由 data_masters.js 填充
    servants: [], // 由 data_servants.js 填充
    cards: {}     // 由 data_cards.js 填充
};

// 每个事件组固定20张。新增事件组时只需在此数组追加同结构条目；每局由房主随机选用其中一组。
const RAW_EVENT_GROUPS = [
    {
        id: "fuyuki",
        name: "冬木",
        events: [
            ["夺回伊莉雅", 5, "赢区域者得3魔"], ["铤而走险", 4, "末位+12,次末+8,倒三+4威"], ["铤而走险", 4, "末位+12,次末+8,倒三+4威"],
            ["圣地", 3, "魔法+3威力"], ["火力压制", 3, "迅捷+3威力"], ["强度测验", 3, "力量+3威力"], ["命运之战", 3, "威力1或2的卡威力升至5"],
            ["占领高地", 3, "地利翻倍"], ["归零地", 3, "无地利"], ["光荣决斗", 2, "力量+2威力"], ["祭祀之地", 2, "魔法+2威力"],
            ["险恶之地", 2, "迅捷+2威力"], ["遏制威胁", 2, "威≥4得+1威,胜者回1令咒/4魔"], ["偷袭", 2, "真名隐藏+5威力"], ["偷袭", 2, "真名隐藏+5威力"],
            ["协同", 2, "所有攻击有同属性则+4威"], ["固有结界", 2, "禁特殊攻击,禁进出此地"], ["固有结界", 2, "禁特殊攻击,禁进出此地"],
            ["地脉", 2, "战斗后得2魔力"], ["地脉", 2, "战斗后得2魔力"]
        ]
    }
];

const EVENT_GROUPS = RAW_EVENT_GROUPS.map(group => {
    if(group.events.length !== 20) throw new Error(`事件组【${group.name}】必须正好包含20张事件牌，当前为${group.events.length}张。`);
    return {
        id: group.id,
        name: group.name,
        cards: group.events.map((e, i) => ({ id: `${group.id}_E${i}`, groupId: group.id, groupName: group.name, name: e[0], vp: e[1], desc: e[2] }))
    };
});

const getEventGroupById = id => EVENT_GROUPS.find(group => group.id === id) || EVENT_GROUPS[0];
const EVENT_CARDS = EVENT_GROUPS[0].cards; // 旧逻辑兼容；新局实际使用 State.eventGroupId 对应的组。

// 【文明废墟】是阿蒂拉【军神之剑·泪之星】专用的游戏外事件池，不参与普通事件组轮换。
const CIVILIZATION_RUINS_EVENTS = [
    { id: "civilization_ruins_E0", groupId: "civilization_ruins", groupName: "文明废墟", name: "被摧毁的城市", vp: 4, type: "迅捷", desc: "于此战场上，基本威力印刷为5或更高的迅捷攻击获得威力+4。" },
    { id: "civilization_ruins_E1", groupId: "civilization_ruins", groupName: "文明废墟", name: "被摧毁的码头", vp: 4, type: "力量", desc: "于此战场上，基本威力印刷为5或更高的力量攻击获得威力+4。" }
];
