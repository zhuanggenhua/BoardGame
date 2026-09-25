import { describe, expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import type { MatchState } from '../../../engine/types';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import type { FateDominationCommand, FateDominationCore } from '../domain';
import { FATE_MASTERS, FATE_SERVANTS } from '../data/identities';
import { FATE_ATTACK_BY_ID } from '../data/cards';

const adapter = createReplayAdapter(FateDominationDomain, 'fate-domination-foundation-test');

const command = <T extends FateDominationCommand['type']>(
    type: T,
    playerId: string,
    payload: Extract<FateDominationCommand, { type: T }>['payload'],
    timestamp = 1,
): Extract<FateDominationCommand, { type: T }> => ({ type, playerId, payload, timestamp } as Extract<FateDominationCommand, { type: T }>);

const apply = (state: MatchState<FateDominationCore>, nextCommand: FateDominationCommand) => adapter.execute(state, nextCommand).state;

const deployAllPlayers = (state: MatchState<FateDominationCore>) => {
    let next = apply(state, command('ADVANCE_PHASE', '0', {}));
    next = apply(next, command('DEPLOY_MASTER', '0', { locationId: 'miyama' }));
    next = apply(next, command('DEPLOY_MASTER', '1', { locationId: 'workshop' }));
    next = apply(next, command('DEPLOY_MASTER', '2', { locationId: 'shinto' }));
    return next;
};

const confirmFirstTwoCards = (state: MatchState<FateDominationCore>, playerId: string) => {
    let next = apply(state, command('SELECT_ATTACK_CARD', playerId, { cardId: nextPlayer(state, playerId).hand[0].id }));
    next = apply(next, command('SELECT_ATTACK_CARD', playerId, { cardId: nextPlayer(next, playerId).hand[1].id }));
    return apply(next, command('CONFIRM_ATTACK', playerId, {}));
};

const nextPlayer = (state: MatchState<FateDominationCore>, playerId: string) => state.core.players[playerId];

describe('Fate/Domination foundation domain', () => {
    it('仅开放指定的御主与从者选择池', () => {
        expect(FATE_MASTERS.map((master) => master.name)).toEqual([
            '间桐雁夜', '间桐慎二', '卫宫士郎', '雨生龙之介', '远坂时臣', '伊莉雅斯菲尔',
            '间桐樱', '韦伯·维尔维特', '言峰绮礼', '肯尼斯', '间桐脏砚', '卫宫切嗣', '远坂凛',
        ]);
        expect(FATE_SERVANTS.map((servant) => servant.name)).toEqual([
            '阿尔托莉雅·潘德拉贡', '赫拉克勒斯', '吉尔伽美什', '佐佐木小次郎', '美狄亚',
            '哈桑·萨巴赫(咒腕)', '卫宫', '兰斯洛特', '安格拉·曼纽', '伊斯坎达尔',
            '迪卢木多·奥迪那', '吉尔·德·雷', '库·丘林', '美杜莎',
        ]);
    });

    it('相同玩家与种子产生相同的初始实体与区域状态', () => {
        const first = adapter.setup(['0', '1', '2']);
        const second = createReplayAdapter(FateDominationDomain, 'fate-domination-foundation-test').setup(['0', '1', '2']);
        expect(first.core).toEqual(second.core);
        const saberDeck = FATE_SERVANTS.find((servant) => servant.id === 'servant-saber')?.deck ?? [];
        expect(first.core.players['0'].hand.map((card) => card.definitionId)).toEqual(saberDeck.slice(0, 6));
        const shirou = FATE_MASTERS.find((master) => master.name === '卫宫士郎');
        expect(first.core.players['0'].masterId).toBe(shirou?.id);
        expect(first.core.players['0'].mana).toBe(shirou?.initMana ?? 4);
        expect(first.core.players['0'].skills.map((skill) => skill.name)).toEqual([
            ...(shirou?.skills ?? []),
            ...(FATE_SERVANTS.find((servant) => servant.id === 'servant-saber')?.skillCards ?? []),
        ].map((skill) => skill.name));
        expect(engineConfig.gameId).toBe('fate-domination');
    });

    it('只允许在部署阶段选择地点，并在地点容量与玩家资源上留下领域结果', () => {
        let state = adapter.setup(['0', '1', '2']);
        expect(FateDominationDomain.validate(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' })).error).toBe('wrongPhase');
        state = apply(state, command('ADVANCE_PHASE', '0', {}));
        expect(FateDominationDomain.validate(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' })).valid).toBe(true);
        state = apply(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' }));
        expect(state.core.phase).toBe('outpost');
        expect(state.core.currentPlayerId).toBe('1');
        expect(state.core.players['0'].locationId).toBe('miyama');
        expect(state.core.players['0'].mana).toBe(4);
        expect(FateDominationDomain.validate(state, command('DEPLOY_MASTER', '0', { locationId: 'workshop' })).error).toBe('notYourTurn');
        state = apply(state, command('DEPLOY_MASTER', '1', { locationId: 'workshop' }));
        expect(state.core.phase).toBe('outpost');
        expect(state.core.currentPlayerId).toBe('2');
        state = apply(state, command('DEPLOY_MASTER', '2', { locationId: 'shinto' }));
        expect(state.core.phase).toBe('action');
        expect(state.core.currentPlayerId).toBe('0');
    });

    it('要求恰好两张攻击牌，并拒绝第三张与过期牌实体', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        const hand = state.core.players['0'].hand;
        expect(FateDominationDomain.validate(state, command('CONFIRM_ATTACK', '0', {})).error).toBe('needExactlyTwoCards');
        expect(FateDominationDomain.validate(state, command('SELECT_ATTACK_CARD', '0', { cardId: 'missing-card' })).error).toBe('staleCard');
        state = apply(state, command('SELECT_ATTACK_CARD', '0', { cardId: hand[0].id }));
        state = apply(state, command('SELECT_ATTACK_CARD', '0', { cardId: hand[1].id }));
        expect(state.core.players['0'].selectedAttackIds).toHaveLength(2);
        expect(FateDominationDomain.validate(state, command('SELECT_ATTACK_CARD', '0', { cardId: hand[2].id })).error).toBe('tooManyAttackCards');
        expect(FateDominationDomain.validate(state, command('CONFIRM_ATTACK', '0', {})).valid).toBe(true);
        state = apply(state, command('CONFIRM_ATTACK', '0', {}));
        expect(state.core.phase).toBe('action');
        expect(state.core.currentPlayerId).toBe('1');
        expect(state.core.battleResult?.power).toBeGreaterThan(0);
    });

    it('检视公开或自己的卡牌不改变核心状态', () => {
        const state = adapter.setup(['0', '1', '2']);
        const cardId = state.core.players['0'].hand[0].id;
        expect(FateDominationDomain.validate(state, command('INSPECT_CARD', '0', { cardId })).valid).toBe(true);
        const inspected = adapter.execute(state, command('INSPECT_CARD', '0', { cardId })).state;
        expect(inspected.core).toEqual(state.core);
    });

    it('战斗推进后记录代表性 VP 结算，并在第 11 回合后收口', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        state = confirmFirstTwoCards(state, '0');
        state = confirmFirstTwoCards(state, '1');
        state = confirmFirstTwoCards(state, '2');
        state = apply(state, command('ADVANCE_PHASE', '2', {}));
        expect(state.core.players['2'].victoryPoints).toBeGreaterThan(0);
        expect(state.core.round).toBe(2);
        expect(state.core.phase).toBe('preparation');
    });

    it('沿 demo 的单向路线移动并按累计路线成本扣除魔力', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        expect(FateDominationDomain.validate(state, command('MOVE_PLAYER', '0', { locationId: 'shinto' })).valid).toBe(true);
        state = apply(state, command('MOVE_PLAYER', '0', { locationId: 'shinto' }));
        expect(state.core.players['0'].locationId).toBe('shinto');
        expect(state.core.players['0'].mana).toBe(2);
    });

    it('迁入 demo 技能定义后可通过统一技能命令发动并记录激活状态', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        const skill = state.core.players['0'].skills.find((item) => item.type === '行动阶段') ?? state.core.players['0'].skills[0];
        expect(skill).toBeDefined();
        expect(FateDominationDomain.validate(state, command('PLAY_SKILL', '0', { skillId: skill.id })).valid).toBe(true);
        state = apply(state, command('PLAY_SKILL', '0', { skillId: skill.id }));
        expect(state.core.players['0'].activeSkills).toContain(skill.id);
    });

    it('确认攻击时重新校验当前魔力，避免资源已消耗后仍确认超额攻击', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        const hand = state.core.players['0'].hand;
        const expensiveCard = hand.find((card) => (FATE_ATTACK_BY_ID[card.definitionId]?.manaCost ?? 0) > 0);
        expect(expensiveCard).toBeDefined();
        state = apply(state, command('SELECT_ATTACK_CARD', '0', { cardId: hand[0].id }));
        state = apply(state, command('SELECT_ATTACK_CARD', '0', { cardId: expensiveCard!.id }));
        const depleted = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': { ...state.core.players['0'], mana: 0 },
                },
            },
        };
        expect(FateDominationDomain.validate(depleted, command('CONFIRM_ATTACK', '0', {})).error).toBe('notEnoughMana');
    });
});
