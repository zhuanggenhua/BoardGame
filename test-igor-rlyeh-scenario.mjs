/**
 * 重现用户场景：base_rlyeh 上消灭 Igor
 * 检查是否会产生两个 Igor 交互
 */

import { initAllAbilities } from './src/games/smashup/abilities/index.js';
import { triggerBaseAbility, getInteractionHandler } from './src/games/smashup/domain/baseAbilities.js';
import { processDestroyTriggers } from './src/games/smashup/domain/reducer.js';
import { SU_EVENTS } from './src/games/smashup/domain/types.js';

// 初始化所有能力
initAllAbilities();

// 创建测试状态（模拟用户的场景）
const core = {
    players: {
        '0': {
            id: '0',
            hand: [],
            deck: [],
            discard: [],
            vp: 1,
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
            defId: 'base_rlyeh',
            breakpoint: 20,
            minions: [
                {
                    uid: 'c9',
                    defId: 'frankenstein_the_monster',
                    owner: '0',
                    controller: '0',
                    power: 4,
                    powerCounters: 1,
                    attachedActions: [],
                },
                {
                    uid: 'c1',
                    defId: 'frankenstein_igor',
                    owner: '0',
                    controller: '0',
                    power: 2,
                    attachedActions: [],
                },
                {
                    uid: 'c29',
                    defId: 'werewolf_loup_garou',
                    owner: '0',
                    controller: '0',
                    power: 4,
                    powerCounters: 1,
                    attachedActions: [],
                },
                {
                    uid: 'c48',
                    defId: 'cthulhu_servitor',
                    owner: '1',
                    controller: '1',
                    power: 2,
                    attachedActions: [],
                },
                {
                    uid: 'c47',
                    defId: 'cthulhu_servitor',
                    owner: '1',
                    controller: '1',
                    power: 2,
                    attachedActions: [],
                },
            ],
            ongoingActions: [],
        },
    ],
    currentPlayerIndex: 0,
    turnNumber: 4,
    baseDeck: [],
};

let ms = {
    core,
    sys: {
        phase: 'playCards',
        interaction: {
            current: undefined,
            queue: [],
        },
    },
};

console.log('=== 步骤1：触发 base_rlyeh 的 onTurnStart ===');
const baseResult = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
    state: ms.core,
    matchState: ms,
    baseIndex: 0,
    baseDefId: 'base_rlyeh',
    playerId: '0',
    now: 1000,
});

console.log('base_rlyeh 交互:', baseResult.matchState?.sys.interaction.current?.data.sourceId);
ms = baseResult.matchState;

console.log('\n=== 步骤2：玩家选择消灭 Igor ===');
const handler = getInteractionHandler('base_rlyeh');
const handlerResult = handler(ms, '0', {
    minionUid: 'c1',
    baseIndex: 0,
}, undefined, () => 0.5, 1001);

const destroyEvents = handlerResult.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
console.log('MINION_DESTROYED 事件数量:', destroyEvents.length);
console.log('MINION_DESTROYED 事件:', destroyEvents.map(e => e.payload));

console.log('\n=== 步骤3：处理 MINION_DESTROYED 事件 ===');
const destroyResult = processDestroyTriggers(handlerResult.events, handlerResult.state, '0', () => 0.5, 1002);

// 检查交互
const allInteractions = [];
if (destroyResult.matchState?.sys.interaction.current) {
    allInteractions.push(destroyResult.matchState.sys.interaction.current);
}
allInteractions.push(...(destroyResult.matchState?.sys.interaction.queue ?? []));

console.log('\n=== 结果 ===');
console.log('总交互数:', allInteractions.length);
console.log('交互来源:', allInteractions.map(i => i.data.sourceId));

const igorInteractions = allInteractions.filter(i => i.data.sourceId === 'frankenstein_igor');
console.log('Igor 交互数:', igorInteractions.length);

if (igorInteractions.length > 1) {
    console.log('\n❌ BUG 确认：Igor 触发了', igorInteractions.length, '次！');
} else if (igorInteractions.length === 1) {
    console.log('\n✅ 正常：Igor 只触发了 1 次');
} else {
    console.log('\n⚠️  意外：没有 Igor 交互');
}
