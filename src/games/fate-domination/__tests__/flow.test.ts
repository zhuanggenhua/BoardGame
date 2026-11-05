import { describe, expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import type { MatchState } from '../../../engine/types';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import { FATE_BATTLE_LOCATION_ORDER } from '../domain';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent } from '../domain';
import { FATE_MASTERS, FATE_SERVANTS } from '../data/identities';
import { FATE_ATTACK_BY_ID } from '../data/cards';
import { createInitialSystemState, executePipeline } from '../../../engine';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import type { RandomFn } from '../../../engine/types';

const adapter = createReplayAdapter(FateDominationDomain, 'fate-domination-foundation-test');

const command = <T extends FateDominationCommand['type']>(
    type: T,
    playerId: string,
    payload: Extract<FateDominationCommand, { type: T }>['payload'],
    timestamp = 1,
): Extract<FateDominationCommand, { type: T }> => ({ type, playerId, payload, timestamp } as Extract<FateDominationCommand, { type: T }>);

const apply = (state: MatchState<FateDominationCore>, nextCommand: FateDominationCommand) => adapter.execute(state, nextCommand).state;

const deployAllPlayers = (state: MatchState<FateDominationCore>) => {
    let next = state;
    for (const id of next.core.turnOrder) next = apply(next, command('ADVANCE_PHASE', id, {}));
    next = apply(next, command('DEPLOY_MASTER', '0', { locationId: 'miyama' }));
    next = apply(next, command('ADVANCE_PHASE', '0', {}));
    next = apply(next, command('DEPLOY_MASTER', '1', { locationId: 'workshop' }));
    next = apply(next, command('ADVANCE_PHASE', '1', {}));
    next = apply(next, command('DEPLOY_MASTER', '2', { locationId: 'shinto' }));
    next = apply(next, command('ADVANCE_PHASE', '2', {}));
    return next;
};

const confirmFirstTwoCards = (state: MatchState<FateDominationCore>, playerId: string) => {
    let next = apply(state, command('SELECT_ATTACK_CARD', playerId, { cardId: nextPlayer(state, playerId).hand[0].id }));
    next = apply(next, command('SELECT_ATTACK_CARD', playerId, { cardId: nextPlayer(next, playerId).hand[1].id }));
    next = apply(next, command('CONFIRM_ATTACK', playerId, {}));
    return apply(next, command('PASS_ACTION', playerId, {}));
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
        expect(first.core.players['0'].hand).toHaveLength(0);
        expect(first.core.players['0'].deck).toHaveLength(12);
        expect(first.core.players['0'].deck.map(card => card.definitionId)).toEqual(saberDeck);
        const shirou = FATE_MASTERS.find((master) => master.name === '卫宫士郎');
        expect(first.core.players['0'].masterId).toBe(shirou?.id);
        expect(first.core.players['0'].mana).toBe((shirou?.initMana ?? 4) + first.core.situation.printedMana);
        expect(first.core.players['0'].skills.map((skill) => skill.name)).toEqual([
            ...(shirou?.skills ?? []),
            ...(FATE_SERVANTS.find((servant) => servant.id === 'servant-saber')?.skillCards ?? []),
        ].map((skill) => skill.name));
        expect(engineConfig.gameId).toBe('fate-domination');
    });

    it('从者仍可在身份锁定前更改；首次完成准备后才洗最终牌堆并发三张手牌', () => {
        let state = adapter.setup(['0','1','2']);
        state = apply(state, command('SELECT_SERVANT','0',{servantId:'servant-archer'}));
        expect(state.core.players['0'].servantId).toBe('servant-archer');
        expect(state.core.players['0'].hand).toHaveLength(0);
        expect(state.core.players['0'].deck).toHaveLength(12);
        expect(state.core.players['0'].deck.map(card => card.definitionId)).toEqual(FATE_SERVANTS.find(servant => servant.id === 'servant-archer')?.deck);
        state = apply(state, command('ADVANCE_PHASE','0',{}));
        expect(state.core.players['0'].hand).toHaveLength(3);
        expect(state.core.players['0'].deck).toHaveLength(9);
        expect([...state.core.players['0'].hand, ...state.core.players['0'].deck].map(card => card.definitionId).sort())
            .toEqual([...FATE_SERVANTS.find(servant => servant.id === 'servant-archer')!.deck].sort());
        expect(state.core.phaseCompletedPlayerIds).toContain('0');
        expect(FateDominationDomain.validate(state, command('SELECT_SERVANT','0',{servantId:'servant-saber'})).error).toBe('identityLocked');
    });

    it('非当前席位可确认自己的候选身份，但不能替本人完成准备', () => {
        let state = adapter.setup(['0','1','2']);
        expect(state.core.currentPlayerId).toBe('0');
        expect(FateDominationDomain.validate(state, command('SELECT_MASTER','2',{masterId:'m_kirei'})).valid).toBe(true);
        state = apply(state, command('SELECT_MASTER','2',{masterId:'m_kirei'}));
        expect(FateDominationDomain.validate(state, command('SELECT_SERVANT','2',{servantId:'servant-archer'})).valid).toBe(true);
        state = apply(state, command('SELECT_SERVANT','2',{servantId:'servant-archer'}));
        expect(state.core.players['2'].hand).toEqual([]);
        expect(state.core.currentPlayerId).toBe('0');
        expect(FateDominationDomain.validate(state, command('ADVANCE_PHASE','2',{}))).toMatchObject({ valid:false, error:'notYourTurn' });
        expect(state.core.phaseCompletedPlayerIds).toEqual([]);
    });

    it('同 ID 与 A→B→A 预选不发牌；三人确认只转入部署一次', () => {
        let state = adapter.setup(['0','1','2']);
        for (const servantId of ['servant-saber','servant-saber','servant-archer','servant-saber']) {
            state = apply(state, command('SELECT_SERVANT','0',{servantId}));
            expect(state.core.players['0'].hand).toHaveLength(0);
            expect(state.core.players['0'].deck).toHaveLength(12);
        }
        expect(state.core.players['0'].servantId).toBe('servant-saber');
        expect(state.core.players['0'].deck.map(card => card.definitionId))
            .toEqual(FATE_SERVANTS.find(servant => servant.id === 'servant-saber')?.deck);
        state = apply(state, command('ADVANCE_PHASE','0',{}));
        expect(state.core.phase).toBe('preparation');
        expect(state.core.players['0'].hand).toHaveLength(3);
        expect(state.core.phaseCompletedPlayerIds).toEqual(['0']);
        state = apply(state, command('ADVANCE_PHASE','1',{}));
        expect(state.core.phase).toBe('preparation');
        expect(state.core.players['1'].hand).toHaveLength(3);
        expect(state.core.phaseCompletedPlayerIds).toEqual(['0','1']);
        state = apply(state, command('ADVANCE_PHASE','2',{}));
        expect(state.core.phase).toBe('outpost');
        expect(state.core.players['2'].hand).toHaveLength(3);
        expect(state.core.phaseCompletedPlayerIds).toEqual([]);
        expect(FateDominationDomain.validate(state, command('SELECT_SERVANT','0',{servantId:'servant-archer'})).error).toBe('identityLocked');
        const duplicateConfirm = FateDominationDomain.validate(state, command('ADVANCE_PHASE','0',{}));
        expect(duplicateConfirm.valid).toBe(false);
        expect(state.core.phase).toBe('outpost');
    });

    it('未锁定前改选御主会重算初始资源并与最终从者技能组合一致', () => {
        let state = adapter.setup(['0','1','2']);
        const player = state.core.players['0'];
        const defaultMaster = FATE_MASTERS.find(master => master.id === player.masterId)!;
        const defaultServant = FATE_SERVANTS.find(servant => servant.id === player.servantId)!;
        const situationBonus = state.core.situation.printedMana;

        state = apply(state, command('SELECT_MASTER','0',{masterId:'m_zouken'}));
        expect(state.core.players['0'].mana).toBe(10 + situationBonus);
        expect(state.core.players['0'].commandSpells).toBe(0);
        state = apply(state, command('SELECT_SERVANT','0',{servantId:'servant-archer'}));
        state = apply(state, command('SELECT_MASTER','0',{masterId:defaultMaster.id}));
        state = apply(state, command('SELECT_SERVANT','0',{servantId:defaultServant.id}));

        const selected = state.core.players['0'];
        expect(selected.mana).toBe((defaultMaster.initMana ?? 4) + situationBonus);
        expect(selected.commandSpells).toBe(defaultMaster.initialCommandSpells ?? 3);
        expect(selected.hand).toEqual([]);
        expect(selected.deck.map(card => card.definitionId)).toEqual(defaultServant.deck);
        expect(selected.skills.map(skill => skill.name)).toEqual([
            ...(defaultMaster.skills ?? []),
            ...(defaultServant.skillCards ?? []),
        ].map(skill => skill.name));
        expect(selected.activeSkills).toEqual([]);
    });

    it('旧存档规范化幂等地保留已经发出的手牌、牌堆顺序和撤销随机游标，并锁定身份', () => {
        const state = adapter.setup(['0','1','2']);
        const legacyUnconfirmed = structuredClone(state);
        const unconfirmed = legacyUnconfirmed.core.players['0'];
        unconfirmed.hand = unconfirmed.deck.slice(0,3);
        unconfirmed.deck = unconfirmed.deck.slice(3);
        legacyUnconfirmed.sys.undo = {
            ...legacyUnconfirmed.sys.undo,
            snapshots: [structuredClone(legacyUnconfirmed)],
            snapshotCursors: [17],
            restoredRandomCursor: 17,
        };
        const legacyConfirmed = structuredClone(state);
        const confirmed = legacyConfirmed.core.players['0'];
        confirmed.hand = confirmed.deck.slice(0,3);
        confirmed.deck = confirmed.deck.slice(3);
        legacyConfirmed.core.phaseCompletedPlayerIds = ['0'];

        const migratedUnconfirmed = FateDominationDomain.normalizeRuntimeState!(legacyUnconfirmed);
        const migratedConfirmed = FateDominationDomain.normalizeRuntimeState!(legacyConfirmed);

        expect(migratedUnconfirmed.core.players['0'].hand).toEqual(unconfirmed.hand);
        expect(migratedUnconfirmed.core.players['0'].deck).toEqual(unconfirmed.deck);
        expect(migratedUnconfirmed.core.initialAttackHandDealtPlayerIds).toContain('0');
        expect(FateDominationDomain.validate(migratedUnconfirmed, command('SELECT_SERVANT','0',{servantId:'servant-archer'})))
            .toMatchObject({valid:false,error:'identityLocked'});
        expect(migratedUnconfirmed.sys.undo).toEqual(legacyUnconfirmed.sys.undo);
        expect(migratedUnconfirmed.sys.undo.restoredRandomCursor).toBe(17);
        let reconnected = migratedUnconfirmed;
        for (let reconnect = 0; reconnect < 3; reconnect += 1) {
            reconnected = FateDominationDomain.normalizeRuntimeState!(reconnected);
            expect(reconnected.core.players['0'].hand).toEqual(unconfirmed.hand);
            expect(reconnected.core.players['0'].deck).toEqual(unconfirmed.deck);
            expect(reconnected.sys.undo.snapshotCursors).toEqual([17]);
            expect(reconnected.sys.undo.restoredRandomCursor).toBe(17);
        }
        expect(reconnected).toEqual(migratedUnconfirmed);
        expect(migratedConfirmed.core.players['0'].hand).toEqual(confirmed.hand);
        expect(migratedConfirmed.core.players['0'].deck).toEqual(confirmed.deck);
        expect(migratedConfirmed.core.initialAttackHandDealtPlayerIds).toContain('0');
    });

    it('历史 SERVANT_SELECTED 事件重放仍按事件内牌序还原原手牌与牌堆', () => {
        const state = adapter.setup(['0','1','2']);
        const servant = FATE_SERVANTS.find(item => item.id === 'servant-archer')!;
        const legacyDeck = [...servant.deck].reverse().map((definitionId, index) => ({
            id: `legacy-${index}`,
            definitionId,
        }));
        const replayed = FateDominationDomain.reduce!(state.core, {
            type: 'SERVANT_SELECTED',
            payload: { playerId: '0', servantId: servant.id, deck: legacyDeck },
            sourceCommandType: 'SELECT_SERVANT',
            timestamp: 21,
        } as FateDominationEvent);
        expect(replayed.players['0'].hand).toEqual(legacyDeck.slice(0,3));
        expect(replayed.players['0'].deck).toEqual(legacyDeck.slice(3));
        expect(replayed.initialAttackHandDealtPlayerIds).toContain('0');
        const normalized = FateDominationDomain.normalizeRuntimeState!({sys:state.sys,core:replayed});
        expect(normalized.core.players['0'].hand).toEqual(legacyDeck.slice(0,3));
        expect(normalized.core.players['0'].deck).toEqual(legacyDeck.slice(3));
        expect(FateDominationDomain.validate(normalized, command('SELECT_SERVANT','0',{servantId:'servant-saber'})))
            .toMatchObject({valid:false,error:'identityLocked'});
    });

    it('旧存档首次确认准备只推进阶段，不重新洗牌或重发已经见过的手牌', () => {
        const ids = ['0','1','2'];
        const state = structuredClone(adapter.setup(ids));
        const oldPlayer = state.core.players['0'];
        oldPlayer.hand = oldPlayer.deck.slice(0,3);
        oldPlayer.deck = oldPlayer.deck.slice(3);
        const handBefore = structuredClone(oldPlayer.hand);
        const deckBefore = structuredClone(oldPlayer.deck);
        let randomCursor = 0;
        const random: RandomFn = {
            random: () => { randomCursor += 1; return 0.5; },
            d: max => Math.floor(random.random() * max) + 1,
            range: (min, max) => Math.floor(random.random() * (max - min + 1)) + min,
            shuffle: <T>(items: T[]) => {
                const result = [...items];
                for (let index = result.length - 1; index > 0; index -= 1) {
                    const swap = Math.floor(random.random() * (index + 1));
                    [result[index], result[swap]] = [result[swap], result[index]];
                }
                return result;
            },
        };
        const cursorBefore = randomCursor;
        const result = executePipeline(
            { domain: FateDominationDomain, systems: engineConfig.systems },
            state,
            command('ADVANCE_PHASE','0',{}),
            random,
            ids,
        );
        expect(result.success).toBe(true);
        expect(randomCursor).toBe(cursorBefore);
        expect(result.events.map(event => event.type)).not.toContain('INITIAL_ATTACK_HAND_DEALT');
        expect(result.state.core.players['0'].hand).toEqual(handBefore);
        expect(result.state.core.players['0'].deck).toEqual(deckBefore);
        expect(result.state.core.initialAttackHandDealtPlayerIds).toContain('0');
        expect(result.state.core.phaseCompletedPlayerIds).toContain('0');
    });

    it('候选角色变更不消费随机游标；每人首次确认只洗牌一次，重连投影不重洗', () => {
        const ids = ['0','1','2'];
        let randomCursor = 0;
        const shuffleSizes: number[] = [];
        const random: RandomFn = {
            random: () => { randomCursor += 1; return 0.99; },
            d: max => Math.floor(random.random() * max) + 1,
            range: (min, max) => Math.floor(random.random() * (max - min + 1)) + min,
            shuffle: <T>(items: T[]) => {
                shuffleSizes.push(items.length);
                const result = [...items];
                for (let index = result.length - 1; index > 0; index -= 1) {
                    const swap = Math.floor(random.random() * (index + 1));
                    [result[index], result[swap]] = [result[swap], result[index]];
                }
                return result;
            },
        };
        let state: MatchState<FateDominationCore> = {
            core: FateDominationDomain.setup(ids, random),
            sys: createInitialSystemState(ids, engineConfig.systems, 'role-selection-rng'),
        };
        const selectionCursor = randomCursor;
        const applyChecked = (nextCommand: FateDominationCommand) => {
            const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, nextCommand, random, ids);
            expect(result.success, nextCommand.type).toBe(true);
            state = result.state;
            return result;
        };

        for (const servantId of ['servant-saber','servant-saber','servant-archer','servant-saber']) {
            applyChecked(command('SELECT_SERVANT','0',{servantId}));
        }
        expect(randomCursor).toBe(selectionCursor);
        expect(state.core.players['0'].hand).toEqual([]);

        for (const playerId of ids) {
            const cursorBeforeDeal = randomCursor;
            const result = applyChecked(command('ADVANCE_PHASE',playerId,{}));
            expect(randomCursor - cursorBeforeDeal).toBe(11);
            expect(shuffleSizes.at(-1)).toBe(12);
            expect(result.events.map(event => event.type)).toContain('INITIAL_ATTACK_HAND_DEALT');
            expect(state.core.players[playerId].hand).toHaveLength(3);
            const cursorAfterDeal = randomCursor;
            applyPlayerViewToState(engineConfig, state, playerId);
            state = FateDominationDomain.normalizeRuntimeState!(state);
            expect(randomCursor).toBe(cursorAfterDeal);
        }
        expect(state.core.phase).toBe('outpost');
        expect(FateDominationDomain.validate(state, command('ADVANCE_PHASE','0',{})).error).toBe('deploymentRequired');
    });

    it('只允许在部署阶段选择地点，并在地点容量与玩家资源上留下领域结果', () => {
        let state = adapter.setup(['0', '1', '2']);
        expect(FateDominationDomain.validate(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' })).error).toBe('wrongPhase');
        for (const id of state.core.turnOrder) state = apply(state, command('ADVANCE_PHASE', id, {}));
        expect(FateDominationDomain.validate(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' })).valid).toBe(true);
        const manaBeforeDeployment=state.core.players['0'].mana;
        state = apply(state, command('DEPLOY_MASTER', '0', { locationId: 'miyama' }));
        state = apply(state, command('ADVANCE_PHASE', '0', {}));
        expect(state.core.phase).toBe('outpost');
        expect(state.core.shintoEventFaceDown).toBe(true);
        expect(state.core.currentPlayerId).toBe('1');
        expect(state.core.players['0'].locationId).toBe('miyama');
        expect(state.core.players['0'].mana).toBe(manaBeforeDeployment);
        expect(FateDominationDomain.validate(state, command('DEPLOY_MASTER', '0', { locationId: 'workshop' })).error).toBe('notYourTurn');
        state = apply(state, command('DEPLOY_MASTER', '1', { locationId: 'workshop' }));
        state = apply(state, command('ADVANCE_PHASE', '1', {}));
        expect(state.core.phase).toBe('outpost');
        expect(state.core.currentPlayerId).toBe('2');
        state = apply(state, command('DEPLOY_MASTER', '2', { locationId: 'shinto' }));
        state = apply(state, command('ADVANCE_PHASE', '2', {}));
        expect(state.core.phase).toBe('action');
        expect(state.core.shintoEventFaceDown).toBe(false);
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
        expect(state.core.currentPlayerId).toBe('0');
        expect(state.core.players['0'].normalAttackPlayed).toBe(true);
        state = apply(state, command('PASS_ACTION', '0', {}));
        expect(state.core.currentPlayerId).toBe('1');
    });

    it('检视公开或自己的卡牌不改变核心状态', () => {
        let state = adapter.setup(['0', '1', '2']);
        for (const playerId of state.core.turnOrder) state = apply(state, command('ADVANCE_PHASE', playerId, {}));
        const cardId = state.core.players['0'].hand[0].id;
        expect(FateDominationDomain.validate(state, command('INSPECT_CARD', '0', { cardId })).valid).toBe(true);
        const inspected = adapter.execute(state, command('INSPECT_CARD', '0', { cardId })).state;
        expect(inspected.core).toEqual(state.core);
    });

    it('各玩家结束战斗后完成一轮结算并进入第二轮准备', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        state = confirmFirstTwoCards(state, '0');
        state = confirmFirstTwoCards(state, '1');
        state = confirmFirstTwoCards(state, '2');
        for (const id of state.core.turnOrder) state = apply(state, command('ADVANCE_PHASE', id, {}));
        expect(state.core.phase).toBe('battle');
        expect(state.core.battleResolution?.step).toBe('locations');
        for (const locationId of FATE_BATTLE_LOCATION_ORDER) {
            state = apply(state, command('RESOLVE_LOCATION', '2', { locationId }));
        }
        expect(state.core.players['2'].victoryPoints).toBeGreaterThan(0);
        expect(state.core.round).toBe(2);
        expect(state.core.phase).toBe('preparation');
        expect(state.core.shintoEventFaceDown).toBe(true);
    });

    it('无事件限制时沿单向路线移动并按累计路线成本扣除魔力', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        // 只测路线成本；随机事件的进出限制由 movement-framework 单独覆盖。
        state.core.currentEvents = { miyama: [], shinto: [] };
        state.core.battlefield.miyama.eventCards = [];
        state.core.battlefield.shinto.eventCards = [];
        expect(FateDominationDomain.validate(state, command('MOVE_PLAYER', '0', { locationId: 'shinto' })).valid).toBe(true);
        const manaBeforeMovement=state.core.players['0'].mana;
        state = apply(state, command('MOVE_PLAYER', '0', { locationId: 'shinto' }));
        expect(state.core.players['0'].locationId).toBe('shinto');
        expect(state.core.players['0'].mana).toBe(manaBeforeMovement-2);
    });

    it('未注册技能不会被伪实现为已激活或扣除资源', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        const skill = state.core.players['0'].skills[0];
        expect(skill).toBeDefined();
        expect(FateDominationDomain.validate(state, command('PLAY_SKILL', '0', { skillId: skill.id })).error).toBe('abilityNotImplemented');
        const mana = state.core.players['0'].mana;
        state = apply(state, command('PLAY_SKILL', '0', { skillId: skill.id }));
        expect(state.core.players['0'].activeSkills).not.toContain(skill.id);
        expect(state.core.players['0'].mana).toBe(mana);
    });

    it('确认攻击时重新校验当前魔力，避免资源已消耗后仍确认超额攻击', () => {
        let state = deployAllPlayers(adapter.setup(['0', '1', '2']));
        const hand = state.core.players['0'].hand;
        // This rejection case deliberately draws a costly card; normal initial hands contain only three cards.
        const deck = state.core.players['0'].deck;
        const costlyIndex = deck.findIndex(card => (FATE_ATTACK_BY_ID[card.definitionId]?.manaCost ?? 0) > 0);
        expect(costlyIndex).toBeGreaterThanOrEqual(0);
        [hand[hand.length - 1], deck[costlyIndex]] = [deck[costlyIndex], hand[hand.length - 1]];
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

it('后续回合的准备阶段不得重新任选身份', () => {
 const state=adapter.setup(['0','1','2']);state.core.round=2;
 expect(FateDominationDomain.validate(state,command('SELECT_MASTER','0',{masterId:FATE_MASTERS[0].id})).error).toBe('identityLocked');
 expect(FateDominationDomain.validate(state,command('SELECT_SERVANT','0',{servantId:FATE_SERVANTS[0].id})).error).toBe('identityLocked');
});

it('前哨部署不能直接进入侦察，必须按规则移动进入', () => {
 const state=adapter.setup(['0','1','2']);state.core.phase='outpost';
 expect(FateDominationDomain.validate(state,command('DEPLOY_MASTER','0',{locationId:'recon'})).error).toBe('cannotDeployToRecon');
});
