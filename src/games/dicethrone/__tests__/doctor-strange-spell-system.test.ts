import { describe, expect, it } from 'vitest';
import type { GameEvent, MatchState, ResolutionFrame } from '../../../engine/types';
import { pushResolutionFrame } from '../../../engine/systems/resolutionStack';
import type { AbilityCard, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { reduce } from '../domain/reducer';
import { createDoctorStrangeSpellSystem, STRANGE_CHOICE_ID } from '../domain/doctorStrange/system';
import type { SpellCandidate, SpellProgram } from '../domain/doctorStrange/types';
import { DiceThroneDomain } from '../domain';
import { DOCTOR_STRANGE_SPELLS } from '../heroes/doctor_strange/cards';
import { STATUS_IDS } from '../domain/ids';
import { DOCTOR_STRANGE_ABILITY } from '../heroes/doctor_strange/constants';
import { createHeroMatchup, fixedRandom } from './test-utils';

const PLAYER_IDS = ['0', '1'];
const WINDS = DOCTOR_STRANGE_SPELLS[4];
const OTHER_SPELL = DOCTOR_STRANGE_SPELLS[3];
const FRAME_KIND = 'dicethrone:doctor-strange-spell';

function createCastingState(): MatchState<DiceThroneCore> {
    const state = createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom);
    const player = state.core.players['0'];
    const inventory = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
    const winds = inventory.find(card => card.id === WINDS.id);
    const other = inventory.find(card => card.id === OTHER_SPELL.id);
    if (!winds || !other) throw new Error('测试起始牌组缺少目标法术');

    player.hand = inventory.filter(card => card.id !== WINDS.id && card.id !== OTHER_SPELL.id);
    player.deck = [];
    player.discard = [other];
    player.preparedSpells = [winds];

    const frame: ResolutionFrame = {
        id: 'doctor-strange-winds-cast-test',
        kind: FRAME_KIND,
        ownerGame: 'dicethrone',
        ownerSystem: 'dicethrone-doctor-strange-spells',
        ordering: 'nested-body',
        status: 'running',
        phase: String(state.sys.phase),
        metadata: {
            program: {
                playerId: '0',
                targetId: '1',
                sourceId: WINDS.id,
                tasks: [{ kind: 'cast', cardId: WINDS.id, zone: 'preparedSpells' }],
            } satisfies SpellProgram,
        },
    };
    return pushResolutionFrame(state, frame);
}

function createIncomeState(premonition = 2): MatchState<DiceThroneCore> {
    const state = createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom);
    const player = state.core.players['0'];
    const [existingHandCard, ...deck] = player.deck;
    if (!existingHandCard || deck.length < 2) throw new Error('测试起始牌组不足以验证收入抽牌');
    player.hand = [existingHandCard];
    player.deck = deck;
    player.tokens.premonition = premonition;
    state.core.activePlayerId = '0';
    state.sys.phase = 'income';

    const frame: ResolutionFrame = {
        id: 'doctor-strange-income-test',
        kind: FRAME_KIND,
        ownerGame: 'dicethrone',
        ownerSystem: 'dicethrone-doctor-strange-spells',
        ordering: 'nested-body',
        status: 'running',
        phase: 'income',
        metadata: {
            program: {
                playerId: '0',
                targetId: '1',
                sourceId: 'strange-income',
                tasks: [{ kind: 'operation', operation: 'income' }],
            } satisfies SpellProgram,
        },
    };
    return pushResolutionFrame(state, frame);
}

function createProgramState(
    card: AbilityCard,
    mode: 'prepare' | 'cast',
    extraDiscardIds: string[] = [],
    opponentCharacter: 'monk' | 'moon_elf' = 'monk',
): MatchState<DiceThroneCore> {
    const state = createHeroMatchup('doctor_strange', opponentCharacter)(PLAYER_IDS, fixedRandom);
    const player = state.core.players['0'];
    const inventory = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
    const selected = inventory.find(candidate => candidate.id === card.id);
    if (!selected) throw new Error(`测试起始牌组缺少法术 ${card.id}`);
    const extras = extraDiscardIds.map(id => inventory.find(candidate => candidate.id === id));
    if (extras.some(candidate => !candidate)) throw new Error('测试起始牌组缺少附加弃牌法术');
    const excluded = new Set([selected.id, ...extraDiscardIds]);
    player.hand = mode === 'prepare' ? [selected] : [];
    player.deck = inventory.filter(candidate => !excluded.has(candidate.id));
    player.discard = extras as AbilityCard[];
    player.preparedSpells = mode === 'cast' ? [selected] : [];

    const frame: ResolutionFrame = {
        id: `doctor-strange-${mode}-${card.id}-test`,
        kind: FRAME_KIND,
        ownerGame: 'dicethrone',
        ownerSystem: 'dicethrone-doctor-strange-spells',
        ordering: 'nested-body',
        status: 'running',
        phase: String(state.sys.phase),
        metadata: {
            program: {
                playerId: '0',
                targetId: '1',
                sourceId: card.id,
                tasks: [{ kind: mode, cardId: card.id, zone: mode === 'prepare' ? 'hand' : 'preparedSpells' }],
            } satisfies SpellProgram,
        },
    };
    return pushResolutionFrame(state, frame);
}

function resolveProgram(
    state: MatchState<DiceThroneCore>,
    select: (choices: SpellCandidate[]) => number = choices => Math.max(0, choices.findIndex(choice => choice.labelKey === 'doctorStrange.skip')),
    initialEvents: GameEvent[] = [],
): { state: MatchState<DiceThroneCore>; events: GameEvent[] } {
    let current = state;
    const events: GameEvent[] = [];
    let pendingEvents = initialEvents;
    for (let step = 0; step < 80 && (step === 0 || current.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND)); step += 1) {
        const result = advanceSpellSystem(current, pendingEvents);
        pendingEvents = [];
        current = result.state;
        events.push(...result.events);
        const activeFrame = current.sys.resolution?.frames.find(frame => frame.kind === FRAME_KIND);
        if (!activeFrame) break;
        const choices = getProgramFromFrame(activeFrame).choices;
        if (!choices) continue;
        const value = select(choices);
        if (value < 0 || value >= choices.length) throw new Error('测试选择器返回非法法术候选');
        const resolved = advanceSpellSystem(current, [{
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '0', value, customId: STRANGE_CHOICE_ID },
            timestamp: 1,
        }]);
        current = resolved.state;
        events.push(...resolved.events);
    }
    return { state: current, events };
}

function expectSpellCardConservation(state: MatchState<DiceThroneCore>): void {
    const player = state.core.players['0'];
    const cards = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
    expect(cards).toHaveLength(32);
    expect(new Set(cards.map(card => card.id)).size).toBe(32);
}

function getProgram(state: MatchState<DiceThroneCore>): SpellProgram {
    const frame = state.sys.resolution?.frames.find(candidate => candidate.kind === FRAME_KIND);
    if (!frame?.metadata?.program) throw new Error('法术测试帧未保留程序');
    return frame.metadata.program as unknown as SpellProgram;
}

function getProgramFromFrame(frame: ResolutionFrame): SpellProgram {
    if (!frame.metadata?.program) throw new Error('法术测试帧未保留程序');
    return frame.metadata.program as unknown as SpellProgram;
}

function advanceSpellSystem(
    state: MatchState<DiceThroneCore>,
    events: GameEvent[] = [],
): { state: MatchState<DiceThroneCore>; events: GameEvent[] } {
    const result = createDoctorStrangeSpellSystem().afterEvents?.({
        state,
        events,
        command: { type: 'TEST', playerId: '0', payload: {}, timestamp: 1 },
        random: fixedRandom,
        playerIds: PLAYER_IDS,
    });
    const nextEvents = result?.events ?? [];
    let nextState = result?.state ?? state;
    for (const event of nextEvents) {
        nextState = { ...nextState, core: reduce(nextState.core, event as DiceThroneEvent) };
    }
    return { state: nextState, events: nextEvents };
}

function chooseCandidate(state: MatchState<DiceThroneCore>, predicate: (candidate: SpellCandidate) => boolean) {
    const choices = getProgram(state).choices;
    if (!choices) throw new Error('当前法术帧没有等待中的选择');
    const value = choices.findIndex(predicate);
    if (value < 0) throw new Error('法术候选中没有目标卡');
    return advanceSpellSystem(state, [{
        type: 'CHOICE_RESOLVED',
        payload: { playerId: '0', value, customId: STRANGE_CHOICE_ID },
        timestamp: 1,
    }]);
}

function resolveSkipChoice(state: MatchState<DiceThroneCore>): MatchState<DiceThroneCore> {
    const choices = getProgram(state).choices;
    if (!choices) throw new Error('当前法术帧没有等待中的选择');
    const value = choices.findIndex(candidate => candidate.tasks.length === 0);
    if (value < 0) throw new Error('状态移除选择缺少合法跳过项');
    return advanceSpellSystem(state, [{
        type: 'CHOICE_RESOLVED',
        payload: { playerId: '0', value, customId: STRANGE_CHOICE_ID },
        timestamp: 1,
    }]).state;
}

function settleRemainingSpellTasks(state: MatchState<DiceThroneCore>): MatchState<DiceThroneCore> {
    let current = state;
    for (let step = 0; step < 8 && current.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND); step += 1) {
        const result = advanceSpellSystem(current);
        current = result.state;
        if (result.events.some(event => event.type === 'CHOICE_REQUESTED')) {
            current = resolveSkipChoice(current);
        }
    }
    return current;
}

function expectCardConservation(state: MatchState<DiceThroneCore>, expectedCardCount: number): void {
    const player = state.core.players['0'];
    const cards = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
    expect(cards).toHaveLength(expectedCardCount);
    expect(new Set(cards.map(card => card.id)).size).toBe(expectedCardCount);
}

describe('奇异博士瓦图姆之风施放', () => {
    it('允许准备自身，并在准备效果完成后仍将同一张牌弃置', () => {
        let state = createCastingState();
        const initialCardCount = [
            ...state.core.players['0'].hand,
            ...state.core.players['0'].deck,
            ...state.core.players['0'].discard,
            ...(state.core.players['0'].preparedSpells ?? []),
        ].length;

        state = advanceSpellSystem(state).state;
        expect(state.core.players['0'].discard.some(card => card.id === WINDS.id)).toBe(true);
        let result = advanceSpellSystem(state);
        state = result.state;
        expect(result.events.some(event => event.type === 'CHOICE_REQUESTED')).toBe(true);
        expect(getProgram(state).choices?.some(candidate => candidate.tasks.some(task => (
            task.kind === 'prepare' && task.cardId === WINDS.id
        )))).toBe(true);

        result = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'prepare' && task.cardId === WINDS.id
        )));
        state = result.state;
        expect(state.core.players['0'].preparedSpells?.some(card => card.id === WINDS.id)).toBe(true);

        result = advanceSpellSystem(state);
        state = result.state;
        expect(result.events.some(event => event.type === 'CHOICE_REQUESTED')).toBe(true);
        state = resolveSkipChoice(state);
        state = settleRemainingSpellTasks(state);

        expect(Boolean(state.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND)), JSON.stringify(state.sys.resolution)).toBe(false);
        expect(state.core.players['0'].discard.filter(card => card.id === WINDS.id)).toHaveLength(1);
        expect(state.core.players['0'].preparedSpells?.some(card => card.id === WINDS.id)).toBe(false);
        expect(state.core.players['0'].spellPreparedTurn).toBeUndefined();
        expectCardConservation(state, initialCardCount);
    });

    it('也能准备弃牌堆中的另一张法术，施放牌仍按原去向弃置且不复制', () => {
        let state = createCastingState();
        const initialCardCount = [
            ...state.core.players['0'].hand,
            ...state.core.players['0'].deck,
            ...state.core.players['0'].discard,
            ...(state.core.players['0'].preparedSpells ?? []),
        ].length;
        state = advanceSpellSystem(state).state;
        state = advanceSpellSystem(state).state;

        const selected = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'prepare' && task.cardId === OTHER_SPELL.id
        )));
        state = selected.state;
        state = advanceSpellSystem(state).state;
        state = settleRemainingSpellTasks(state);

        expect(state.core.players['0'].discard.filter(card => card.id === WINDS.id)).toHaveLength(1);
        expect(state.core.players['0'].preparedSpells?.filter(card => card.id === OTHER_SPELL.id)).toHaveLength(1);
        expect(Boolean(state.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND)), JSON.stringify(state.sys.resolution)).toBe(false);
        expectCardConservation(state, initialCardCount);
    });

    it('弃牌准备选择帧经 JSON 存档恢复后仍保留授权候选与卡牌归属', () => {
        let state = createCastingState();
        state = advanceSpellSystem(state).state;
        state = advanceSpellSystem(state).state;
        expect(getProgram(state).choices?.some(candidate => candidate.tasks.some(task => (
            task.kind === 'prepare' && task.cardId === OTHER_SPELL.id
        )))).toBe(true);

        const restored = JSON.parse(JSON.stringify(state)) as MatchState<DiceThroneCore>;
        const prepared = chooseCandidate(restored, candidate => candidate.tasks.some(task => (
            task.kind === 'prepare' && task.cardId === OTHER_SPELL.id
        )));
        const settled = settleRemainingSpellTasks(prepared.state);

        expect(settled.core.players['0'].preparedSpells?.some(card => card.id === OTHER_SPELL.id)).toBe(true);
        expect(settled.core.players['0'].discard.filter(card => card.id === WINDS.id)).toHaveLength(1);
        expectCardConservation(settled, 32);
    });

    it('对手看不到法术结算帧和卡牌选择细节，准备区仍在公开角色视图中', () => {
        const state = createCastingState();
        const frame = state.sys.resolution?.frames.find(candidate => candidate.kind === FRAME_KIND);
        if (!frame?.metadata?.program) throw new Error('法术测试帧未初始化');
        const program = frame.metadata.program as unknown as SpellProgram;
        frame.metadata = {
            program: {
                ...program,
                choices: [{
                    labelKey: WINDS.name,
                    previewRef: WINDS.previewRef,
                    tasks: [{ kind: 'prepare', cardId: WINDS.id, zone: 'discard' }],
                }],
            } satisfies SpellProgram,
        };
        state.sys.eventStream = {
            entries: [{
                id: 1,
                event: {
                    type: 'CHOICE_REQUESTED',
                    payload: {
                        playerId: '0',
                        sourceAbilityId: WINDS.id,
                        titleKey: 'doctorStrange.prepare',
                        options: [{ value: 0, labelKey: WINDS.name, previewRef: WINDS.previewRef }],
                    },
                    timestamp: 1,
                },
            }, {
                id: 2,
                event: {
                    type: 'STRANGE_OPERATION_RESOLVED',
                    payload: { playerId: '0', sourceId: 'secret-doctor-strange-ability' },
                    timestamp: 2,
                },
            }],
            maxEntries: 100,
            nextId: 3,
        };

        const systemView = createDoctorStrangeSpellSystem().playerView?.(state, '1');
        expect(systemView?.resolution?.frames.find(candidate => candidate.kind === FRAME_KIND)?.metadata).toBeUndefined();
        const privateChoice = systemView?.eventStream?.entries[0]?.event.payload as { titleKey: string; options: unknown[] };
        expect(privateChoice.titleKey).toBe('doctorStrange.privateChoice');
        expect(privateChoice.options).toEqual([]);
        const privateCompletion = systemView?.eventStream?.entries[1]?.event.payload as { sourceId: string };
        expect(privateCompletion.sourceId).toBe('doctor-strange-private');

        const publicCore = DiceThroneDomain.playerView?.(state.core, '1');
        expect(publicCore?.players?.['0'].preparedSpells?.map(card => card.id)).toContain(WINDS.id);
    });

    it('2层预感只提供不用或花1抽2；返还候选只来自本次抽牌', () => {
        let state = createIncomeState();
        const player = state.core.players['0'];
        const oldHandIds = player.hand.map(card => card.id);
        const drawnIds = player.deck.slice(0, 2).map(card => card.id);
        state = advanceSpellSystem(state).state;

        const incomeChoices = getProgram(state).choices ?? [];
        expect(incomeChoices.map(choice => choice.labelKey)).toEqual(['doctorStrange.incomeNormal', 'doctorStrange.income1']);
        let result = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'consume' && task.tokenId === 'premonition' && task.amount === 1
        )));
        state = result.state;

        result = advanceSpellSystem(state);
        state = result.state;
        expect(state.core.players['0'].tokens.premonition).toBe(1);
        expect(result.events.filter(event => event.type === 'CARD_DRAWN')).toHaveLength(2);
        expect(drawnIds.every(id => state.core.players['0'].hand.some(card => card.id === id))).toBe(true);

        state = advanceSpellSystem(state).state;
        const returnChoices = getProgram(state).choices ?? [];
        expect(returnChoices.map(choice => choice.tasks[0])).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'return-position', cardId: drawnIds[0] }),
            expect.objectContaining({ kind: 'return-position', cardId: drawnIds[1] }),
        ]));
        expect(returnChoices.some(choice => choice.tasks.some(task => (
            task.kind === 'return-position' && oldHandIds.includes(task.cardId)
        )))).toBe(false);

        state = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'return-position' && task.cardId === drawnIds[1]
        ))).state;
        state = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'return' && task.cardId === drawnIds[1] && task.position === 'top'
        ))).state;
        state = settleRemainingSpellTasks(state);

        expect(state.core.players['0'].deck[0].id).toBe(drawnIds[1]);
        expect(state.core.players['0'].hand.some(card => card.id === drawnIds[1])).toBe(false);
        expectCardConservation(state, 32);
    });

    it('3层预感可花3抽3，并且只允许把本次抽牌之一放回牌库底', () => {
        let state = createIncomeState(3);
        const player = state.core.players['0'];
        const drawnIds = player.deck.slice(0, 3).map(card => card.id);
        const oldHandIds = player.hand.map(card => card.id);
        state = advanceSpellSystem(state).state;

        expect((getProgram(state).choices ?? []).map(choice => choice.labelKey)).toEqual([
            'doctorStrange.incomeNormal', 'doctorStrange.income1', 'doctorStrange.income3',
        ]);
        state = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'consume' && task.tokenId === 'premonition' && task.amount === 3
        ))).state;

        const drawn = advanceSpellSystem(state);
        state = drawn.state;
        expect(state.core.players['0'].tokens.premonition).toBe(0);
        expect(drawn.events.filter(event => event.type === 'CARD_DRAWN')).toHaveLength(3);
        state = advanceSpellSystem(state).state;
        const returnChoices = getProgram(state).choices ?? [];
        expect(returnChoices.map(choice => choice.tasks[0])).toEqual(expect.arrayContaining(
            drawnIds.map(cardId => expect.objectContaining({ kind: 'return-position', cardId })),
        ));
        expect(returnChoices.some(choice => choice.tasks.some(task => (
            task.kind === 'return-position' && oldHandIds.includes(task.cardId)
        )))).toBe(false);

        state = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'return-position' && task.cardId === drawnIds[1]
        ))).state;
        const positionChoices = getProgram(state).choices ?? [];
        expect(positionChoices.map(choice => choice.tasks[0])).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'return', cardId: drawnIds[1], position: 'top' }),
            expect.objectContaining({ kind: 'return', cardId: drawnIds[1], position: 'bottom' }),
        ]));
        state = chooseCandidate(state, candidate => candidate.tasks.some(task => (
            task.kind === 'return' && task.cardId === drawnIds[1] && task.position === 'bottom'
        ))).state;
        state = settleRemainingSpellTasks(state);

        expect(state.core.players['0'].deck.at(-1)?.id).toBe(drawnIds[1]);
        expect(state.core.players['0'].hand.some(card => card.id === drawnIds[1])).toBe(false);
        expectCardConservation(state, 32);
    });

    it('收入阶段选择常规方式时不消费预感，并且不进入返还选择', () => {
        let state = createIncomeState(2);
        state = advanceSpellSystem(state).state;
        const normalIncome = chooseCandidate(state, candidate => candidate.labelKey === 'doctorStrange.incomeNormal');
        state = settleRemainingSpellTasks(normalIncome.state);

        expect(state.core.players['0'].tokens.premonition).toBe(2);
        expect(normalIncome.events.filter(event => event.type === 'CARD_DRAWN')).toHaveLength(1);
        expect(state.core.players['0'].hand).toHaveLength(2);
        expect(Boolean(state.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND))).toBe(false);
        expectCardConservation(state, 32);
    });
});

describe('奇异博士九张法术的逐卡结算', () => {
    it('准备九张法术时分别消费准备效果，卡区始终保持32张且唯一归属', () => {
        for (const spell of DOCTOR_STRANGE_SPELLS) {
            const state = createProgramState(spell, 'prepare', [], spell.spell?.index === 4 ? 'moon_elf' : 'monk');
            const player = state.core.players['0'];
            const opponent = state.core.players['1'];
            player.resources.hp = 30;
            opponent.resources.hp = 40;
            opponent.resources.cp = 2;
            opponent.statusEffects[STATUS_IDS.BLINDED] = 1;

            const result = resolveProgram(state, choices => {
                if (spell.spell?.index === 2 || spell.spell?.index === 5) {
                    const opponentTarget = choices.findIndex(choice => choice.targetPlayerId === '1');
                    if (opponentTarget >= 0) return opponentTarget;
                }
                const removeStatus = choices.findIndex(choice => choice.tasks.some(task => task.kind === 'remove-status-target'));
                if (removeStatus >= 0) return removeStatus;
                return Math.max(0, choices.findIndex(choice => choice.labelKey === 'doctorStrange.skip'));
            });
            const resolvedPlayer = result.state.core.players['0'];
            const resolvedOpponent = result.state.core.players['1'];

            expect(Boolean(result.state.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND)), spell.id).toBe(false);
            expect(resolvedPlayer.preparedSpells?.some(card => card.id === spell.id), spell.id).toBe(true);
            expectSpellCardConservation(result.state);

            switch (spell.spell?.index) {
                case 0:
                    expect(resolvedOpponent.resources.hp).toBe(opponent.resources.hp - 1);
                    break;
                case 1:
                    expect(resolvedPlayer.tokens.premonition).toBe(1);
                    break;
                case 2:
                    expect(resolvedPlayer.resources.hp).toBe(30);
                    expect(resolvedOpponent.resources.hp).toBe(41);
                    break;
                case 3:
                    expect(resolvedPlayer.resources.cp).toBe(player.resources.cp + 1);
                    break;
                case 4:
                    expect(resolvedOpponent.statusEffects[STATUS_IDS.BLINDED] ?? 0).toBe(0);
                    break;
                case 5:
                    expect(resolvedPlayer.tokens['deja-vu'] ?? 0).toBe(0);
                    expect(resolvedOpponent.tokens['deja-vu']).toBe(1);
                    break;
                case 6:
                    expect(resolvedOpponent.statusEffects['crimson-bands']).toBe(1);
                    break;
                case 7:
                    expect(resolvedOpponent.resources.cp).toBe(1);
                    break;
                case 8:
                    expect(result.events.some(event => event.type === 'DAMAGE_DEALT' || event.type === 'TOKEN_GRANTED' || event.type === 'CP_CHANGED')).toBe(false);
                    break;
            }
        }
    });

    it('施放逐卡匹配伤害来源、资源、回手/弃置和手牌计数上限', () => {
        const flames = resolveProgram(createProgramState(DOCTOR_STRANGE_SPELLS[0], 'cast'));
        expect(flames.events.some(event => event.type === 'BONUS_DAMAGE_ADDED' && event.payload.amount === 1)).toBe(true);
        expect(flames.state.core.players['0'].hand.some(card => card.id === DOCTOR_STRANGE_SPELLS[0].id)).toBe(true);
        expect(flames.state.core.players['0'].preparedSpells?.some(card => card.id === DOCTOR_STRANGE_SPELLS[0].id)).toBe(false);
        expectSpellCardConservation(flames.state);

        const premonition = resolveProgram(createProgramState(DOCTOR_STRANGE_SPELLS[2], 'cast'));
        expect(premonition.state.core.players['0'].tokens.premonition).toBe(3);
        expect(premonition.state.core.players['0'].discard.some(card => card.id === DOCTOR_STRANGE_SPELLS[2].id)).toBe(true);

        const bolts = createProgramState(DOCTOR_STRANGE_SPELLS[3], 'cast');
        const opponentHp = bolts.core.players['1'].resources.hp;
        const boltResult = resolveProgram(bolts);
        expect(boltResult.state.core.players['1'].resources.hp).toBe(opponentHp - 3);
        expect(boltResult.events.some(event => event.type === 'DAMAGE_DEALT')).toBe(true);

        const mist = createProgramState(DOCTOR_STRANGE_SPELLS[5], 'cast');
        mist.core.players['0'].resources.hp = 30;
        mist.core.players['1'].resources.hp = 40;
        const mistResult = resolveProgram(mist, choices => {
            const opponentTarget = choices.findIndex(choice => choice.targetPlayerId === '1');
            return opponentTarget >= 0 ? opponentTarget : Math.max(0, choices.findIndex(choice => choice.labelKey === 'doctorStrange.skip'));
        });
        expect(mistResult.state.core.players['0'].resources.hp).toBe(30);
        expect(mistResult.state.core.players['1'].resources.hp).toBe(43);

        const unblockable = resolveProgram(createProgramState(DOCTOR_STRANGE_SPELLS[6], 'cast'));
        expect(unblockable.events.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);

        const bonus = resolveProgram(createProgramState(DOCTOR_STRANGE_SPELLS[7], 'cast'));
        expect(bonus.events.some(event => event.type === 'BONUS_DAMAGE_ADDED' && event.payload.amount === 3)).toBe(true);

        const handCountState = createProgramState(DOCTOR_STRANGE_SPELLS[8], 'cast');
        const player = handCountState.core.players['0'];
        player.hand = player.deck.slice(0, 5);
        player.deck = player.deck.slice(5);
        const handCountResult = resolveProgram(handCountState);
        expect(handCountResult.events.some(event => event.type === 'BONUS_DAMAGE_ADDED' && event.payload.amount === 4)).toBe(true);
        expectSpellCardConservation(handCountResult.state);
    });

    it('罗格达之戒顺序施放弃牌堆中两个不同法术且不复制卡牌', () => {
        const state = createProgramState(DOCTOR_STRANGE_SPELLS[1], 'cast', [
            DOCTOR_STRANGE_SPELLS[3].id,
            DOCTOR_STRANGE_SPELLS[7].id,
        ]);
        const result = resolveProgram(state, choices => {
            const castChoice = choices.findIndex(choice => choice.tasks.some(task => task.kind === 'cast'));
            return castChoice >= 0 ? castChoice : choices.findIndex(choice => choice.labelKey !== 'doctorStrange.skip');
        });
        const player = result.state.core.players['0'];

        expect(player.discard.filter(card => [
            DOCTOR_STRANGE_SPELLS[1].id,
            DOCTOR_STRANGE_SPELLS[3].id,
            DOCTOR_STRANGE_SPELLS[7].id,
        ].includes(card.id as typeof DOCTOR_STRANGE_SPELLS[number]['id']))).toHaveLength(3);
        expect(result.events.filter(event => event.type === 'DAMAGE_DEALT')).toHaveLength(1);
        expect(result.events.some(event => event.type === 'BONUS_DAMAGE_ADDED' && event.payload.amount === 3)).toBe(true);
        expectSpellCardConservation(result.state);
    });
});

describe('奇异博士奖励骰结果', () => {
    it('星际侵入、寒冰藤蔓与塞拉芬之盾逐骰结算四种骰面', () => {
        const cases = [
            { operation: 'astral-results', values: [1, 3, 5, 6], bonus: [3], prevent: [], token: 1, bands: 1 },
            { operation: 'tendrils-results', values: [1, 3, 5, 6], bonus: [1, 2], prevent: [], token: 0, bands: 1 },
            { operation: 'shield-results', values: [1, 3, 5, 6], bonus: [], prevent: [1, 2, 3], token: 1, bands: 0 },
        ] as const;

        for (const item of cases) {
            const state = createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom);
            if (item.operation === 'shield-results') {
                state.core.pendingDamage = {
                    id: 'doctor-strange-shield-results',
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: 20,
                    currentDamage: 20,
                    sourceAbilityId: 'test-incoming-attack',
                    damageScope: 'attack',
                    responseType: 'beforeDamageReceived',
                    responderId: '0',
                };
            } else {
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: `test-${item.operation}`,
                };
            }
            const result = resolveProgram(state, undefined, [{
                type: 'STRANGE_OPERATION_REQUESTED',
                payload: { playerId: '0', targetId: '1', sourceId: `test-${item.operation}`, operation: item.operation, values: [...item.values] },
                timestamp: 40,
            }]);

            expect(Boolean(result.state.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND)), item.operation).toBe(false);
            expect(result.events.filter(event => event.type === 'BONUS_DAMAGE_ADDED').map(event => event.payload.amount)).toEqual(item.bonus);
            expect(result.events.filter(event => event.type === 'PREVENT_DAMAGE').map(event => event.payload.amount)).toEqual(item.prevent);
            expect(result.state.core.players['0'].tokens.premonition ?? 0).toBe(item.token);
            expect(result.state.core.players['1'].statusEffects['crimson-bands'] ?? 0).toBe(item.bands);
            if (item.operation === 'shield-results') {
                expect(result.state.core.pendingDamage?.currentDamage).toBe(14);
            } else {
                expect(result.state.core.pendingAttack?.bonusDamage).toBe(item.bonus.reduce((total, amount) => total + amount, 0));
            }
        }
    });

    it('全知之眼允许不准备法术并将顶五牌逆序放回', () => {
        const state = createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom);
        const player = state.core.players['0'];
        const topFive = player.deck.slice(0, 5).map(card => card.id);
        const result = resolveProgram(state, choices => {
            if (choices.some(choice => choice.labelKey === 'doctorStrange.skip')) {
                return choices.findIndex(choice => choice.labelKey === 'doctorStrange.skip');
            }
            return choices.length - 1;
        }, [{
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', targetId: '1', sourceId: DOCTOR_STRANGE_ABILITY.ULTIMATE, operation: 'ultimate' },
            timestamp: 41,
        }]);

        expect(result.state.core.players['0'].deck.slice(0, 5).map(card => card.id)).toEqual([...topFive].reverse());
        expect(result.events.some(event => event.type === 'STRANGE_DECK_ORDERED')).toBe(true);
        expect(result.state.core.players['0'].preparedSpells?.some(card => topFive.includes(card.id))).toBe(false);
        expect(Boolean(result.state.sys.resolution?.frames.some(frame => frame.kind === FRAME_KIND))).toBe(false);
    });

    it('全知之眼最多准备两张顶牌法术、重排其余三张并最多施放两张不同法术', () => {
        const state = createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom);
        const player = state.core.players['0'];
        const allCards = [...player.hand, ...player.deck, ...player.discard, ...(player.preparedSpells ?? [])];
        const prepareIds = [DOCTOR_STRANGE_SPELLS[3].id, DOCTOR_STRANGE_SPELLS[7].id];
        const prepareCards = prepareIds.map(id => allCards.find(card => card.id === id));
        const startingSpell = player.preparedSpells?.find(card => card.id === DOCTOR_STRANGE_SPELLS[0].id);
        if (prepareCards.some(card => !card) || !startingSpell) throw new Error('测试牌组缺少顶牌法术');
        const remaining = allCards.filter(card => ![DOCTOR_STRANGE_SPELLS[0].id, ...prepareIds].includes(card.id));
        const topFive = [...prepareCards as AbilityCard[], ...remaining.slice(0, 3)];
        player.hand = [];
        player.discard = [];
        player.preparedSpells = [startingSpell];
        player.deck = [...topFive, ...remaining.slice(3)];

        const frame: ResolutionFrame = {
            id: 'doctor-strange-ultimate-positive-test', kind: FRAME_KIND,
            ownerGame: 'dicethrone', ownerSystem: 'dicethrone-doctor-strange-spells',
            ordering: 'nested-body', status: 'running', phase: String(state.sys.phase),
            metadata: { program: { playerId: '0', targetId: '1', sourceId: DOCTOR_STRANGE_ABILITY.ULTIMATE,
                tasks: [{ kind: 'operation', operation: 'ultimate' }, { kind: 'operation', operation: 'ultimate-cast' }] } satisfies SpellProgram },
        };
        const selectedPreparations = new Set<string>();
        const selectedCasts = new Set<string>();
        const orderedCards: string[] = [];
        const result = resolveProgram(pushResolutionFrame(state, frame), choices => {
            const prepareIndex = choices.findIndex(choice => choice.tasks.some(task => (
                task.kind === 'prepare' && prepareIds.includes(task.cardId)
            )) && selectedPreparations.size < 2);
            if (prepareIndex >= 0) {
                const task = choices[prepareIndex].tasks.find((candidate): candidate is Extract<SpellProgram['tasks'][number], { kind: 'prepare' }> => (
                    candidate.kind === 'prepare'
                ));
                if (task) selectedPreparations.add(task.cardId);
                return prepareIndex;
            }

            const castIndex = choices.findIndex(choice => choice.tasks.some(task => (
                task.kind === 'cast' && prepareIds.includes(task.cardId) && !selectedCasts.has(task.cardId)
            )));
            if (castIndex >= 0) {
                const task = choices[castIndex].tasks.find((candidate): candidate is Extract<SpellProgram['tasks'][number], { kind: 'cast' }> => (
                    candidate.kind === 'cast'
                ));
                if (task) selectedCasts.add(task.cardId);
                return castIndex;
            }

            const skipIndex = choices.findIndex(choice => choice.tasks.length === 0);
            if (skipIndex >= 0) return skipIndex;

            const reorderIndex = choices.findIndex(choice => choice.tasks.some(task => task.kind === 'reorder'));
            if (reorderIndex >= 0) {
                const task = choices[reorderIndex].tasks.find(candidate => candidate.kind === 'reorder');
                const last = task?.ordered?.at(-1);
                if (last) orderedCards.push(last);
                return reorderIndex;
            }
            return 0;
        });

        expect(selectedPreparations).toEqual(new Set(prepareIds));
        expect(selectedCasts).toEqual(new Set(prepareIds));
        expect(orderedCards).toEqual(topFive.slice(2).map(card => card.id));
        expect(result.events.some(event => event.type === 'STRANGE_DECK_ORDERED')).toBe(true);
        expect(result.events.some(event => event.type === 'DAMAGE_DEALT')).toBe(true);
        expect(result.state.core.players['0'].preparedSpells?.map(card => card.id)).toEqual([DOCTOR_STRANGE_SPELLS[0].id]);
        expectCardConservation(result.state, 32);
    });
});

describe('奇异博士专属行动牌效果', () => {
    it('看见未来给予2层预感，时间回溯可指定目标获得即视感', () => {
        const seeTheFuture = resolveProgram(createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom), undefined, [{
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', targetId: '1', sourceId: 'card-strange-see-the-future', operation: 'premonition-two' },
            timestamp: 50,
        }]);
        expect(seeTheFuture.state.core.players['0'].tokens.premonition).toBe(2);

        const timeLoop = resolveProgram(createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom), choices => {
            const opponentChoice = choices.findIndex(choice => choice.targetPlayerId === '1');
            return opponentChoice >= 0 ? opponentChoice : Math.max(0, choices.findIndex(choice => choice.labelKey === 'doctorStrange.skip'));
        }, [{
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', targetId: '1', sourceId: 'card-strange-time-loop', operation: 'grant-deja-vu' },
            timestamp: 51,
        }]);
        expect(timeLoop.state.core.players['1'].tokens['deja-vu']).toBe(1);
        expect(timeLoop.state.core.players['0'].tokens['deja-vu'] ?? 0).toBe(0);
    });

    it('转瞬即逝只施放一张已准备法术并保留原牌去向', () => {
        const initial = createHeroMatchup('doctor_strange', 'monk')(PLAYER_IDS, fixedRandom);
        const castAway = resolveProgram(initial, choices => {
            const castIndex = choices.findIndex(choice => choice.tasks.some(task => (
                task.kind === 'cast' && task.cardId === DOCTOR_STRANGE_SPELLS[0].id
            )));
            return castIndex >= 0 ? castIndex : Math.max(0, choices.findIndex(choice => choice.labelKey === 'doctorStrange.skip'));
        }, [{
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', targetId: '1', sourceId: 'card-strange-cast-away', operation: 'cast-one' },
            timestamp: 52,
        }]);

        expect(castAway.state.core.players['0'].hand.some(card => card.id === DOCTOR_STRANGE_SPELLS[0].id)).toBe(true);
        expect(castAway.state.core.players['0'].preparedSpells?.some(card => card.id === DOCTOR_STRANGE_SPELLS[0].id)).toBe(false);
        expect(castAway.events.some(event => event.type === 'BONUS_DAMAGE_ADDED' && event.payload.amount === 1)).toBe(true);
        expectCardConservation(castAway.state, 32);
    });
});
