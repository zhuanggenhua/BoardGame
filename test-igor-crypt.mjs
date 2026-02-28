/**
 * 测试 Igor + base_crypt 场景
 * 检查是否会产生两个"放置+1指示物"的交互
 */

import { initAllAbilities } from './src/games/smashup/abilities/index.js';
import { processDestroyTriggers } from './src/games/smashup/domain/reducer.js';
import { SU_EVENTS } from './src/games/smashup/domain/types.js';

// 初始化所有能力
initAllAbilities();

// 创建测试状态
const core = {
    players: {
        '0': {
            id: '0',
            hand: [],
            deck: [],
            discard: [],
            vp: 0,
            actionsPlayed: 0,
            minionsPlayed: 0,
            actionsPlayedThisTurn: 0,
            minionsPlayedThisTurn: 0,
            minionsPlayedPerBase: {},
        },
        '1': {
            id: '1',
            hand: [],
            deck: [],
            discard: [],
            vp: 0,
            actionsPlayed: 0,
            minionsPlayed: 0,
            actionsPlayedThisTurn: 0,
            minionsPlayedThisTurn: 0,
            minionsPlayedPerBase: {},
        },
    },
    bases: [
        {
            defId: 'base_crypt',
            breakpoint: 20,
            minions: [
                {
                    uid: 'igor1',
                    defId: 'frankenstein_igor',
                    owner: '0',
                    controller: '0',
                    power: 2,
                    attachedActions: [],
                },
                {
                    uid: 'monster1',
                    defId: 'frankenstein_the_monster',
                    owner: '0',
                    controller: '0',
                    power: 4,
                    attachedActions: [],
                },
            ],
            ongoingActions: [],
        },
    ],
    currentPlayerIndex: 0,
    turnNumber: 1,
    baseDeck: [],
};

const ms = {
    core,
    sys: {
        phase: 'playCards',
        interaction: {
            current: undefined,
            queue: [],
        },
    },
};

// 创建 MINION_DESTROYED 事件
const destroyEvent = {
    type: SU_EVENTS.MINION_DESTROYED,
    payload: {
        minionUid: 'igor1',
        minionDefId: 'frankenstein_igor',
        fromBaseIndex: 0,
        ownerId: '0',
        destroyerId: '0',
        reason: 'test',
    },
    timestamp: 1000,
};

// 处理消灭事件
const result = processDestroyTriggers([destroyEvent], ms, '0', () => 0.5, 1000);

// 检查交互
const allInteractions = [];
if (result.matchState?.sys.interaction.current) {
    allInteractions.push(result.matchState.sys.interaction.current);
}
allInteractions.push(...(result.matchState?.sys.interaction.queue ?? []));

console.log('=== base_crypt + Igor scenario ===');
console.log('Total interactions:', allInteractions.length);
console.log('Interaction sources:', allInteractions.map(i => i.data.sourceId));

const igorInteractions = allInteractions.filter(i => i.data.sourceId === 'frankenstein_igor');
const cryptInteractions = allInteractions.filter(i => i.data.sourceId === 'base_crypt');

console.log('Igor interactions:', igorInteractions.length);
console.log('Crypt interactions:', cryptInteractions.length);

if (igorInteractions.length === 1 && cryptInteractions.length === 1) {
    console.log('\n✅ 结论：Igor + base_crypt 会产生两个交互');
    console.log('   1. Igor 的 onDestroy（选择放置+1指示物的随从）');
    console.log('   2. base_crypt 的 onMinionDestroyed（消灭者选择放置+1指示物的随从）');
    console.log('   这解释了用户为什么给两个随从各加了+1力量！');
} else {
    console.log('\n❌ 意外结果：交互数量不符合预期');
}
