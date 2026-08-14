import { describe, expect, it } from 'vitest';
import type { MatchState, RandomFn } from '../../../engine/types';
import { execute } from '../domain/execute';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { getCustomActionHandler, resolveEffectsToEvents } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { validateCommand } from '../domain/commandValidation';
import { isPassiveActionUsable } from '../domain/passiveAbility';
import { reduce } from '../domain/reducer';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    Die,
    HeroState,
    PendingBonusDiceSettlement,
} from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../domain/ids';
import { COMMON_CARDS } from '../domain/commonCards';
import { canAdvancePhase, checkPlayCard } from '../domain/rules';
import { canManuallyAdvancePhase, getFocusPlayerId } from '../hooks/useDiceThroneState';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { monkDiceDefinition } from '../heroes/monk/diceConfig';
import { zhanshujiaDiceDefinition } from '../heroes/zhanshujia/diceConfig';
import { ZHANSHUJIA_PASSIVE_ABILITIES } from '../heroes/zhanshujia/tokens';
import { createCompareRollContext, createEvasionRollContext, createMainRollContext } from '../domain/rollContext';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';

initializeCustomActions();
registerDiceDefinition(monkDiceDefinition);
registerDiceDefinition(zhanshujiaDiceDefinition);

const queuedRandom = (values: number[]): RandomFn => {
    let index = 0;
    const fallback = values.length > 0 ? values[values.length - 1] : 1;
    return {
        random: () => 0,
        d: (max) => Math.min(Math.max(1, values[index++] ?? fallback), max),
        range: (min) => min,
        shuffle: (items) => [...items],
    };
};

const createDie = (id: number, value = 1): Die => ({
    id,
    definitionId: 'zhanshujia-dice',
    value,
    symbol: 'sabre',
    symbols: ['sabre'],
    isKept: false,
});

const createHero = (id: string, withTacticalAdvantage = false): HeroState => ({
    id,
    characterId: withTacticalAdvantage ? 'zhanshujia' : 'monk',
    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
    hand: [],
    deck: [],
    discard: [],
    statusEffects: {},
    tokens: withTacticalAdvantage ? { [TOKEN_IDS.TACTICAL_ADVANTAGE]: 1 } : {},
    tokenStackLimits: {},
    damageShields: [],
    abilities: [],
    abilityLevels: {},
    upgradeCardByAbilityId: {},
    passiveAbilities: withTacticalAdvantage ? ZHANSHUJIA_PASSIVE_ABILITIES : undefined,
});

const createCore = (): DiceThroneCore => ({
    players: {
        '0': createHero('0', true),
        '1': createHero('1'),
    },
    selectedCharacters: { '0': 'zhanshujia', '1': 'monk' },
    readyPlayers: { '0': true, '1': true },
    hostPlayerId: '0',
    hostStarted: true,
    dice: [0, 1, 2, 3, 4].map((id) => createDie(id)),
    rollCount: 0,
    rollLimit: 3,
    rollDiceCount: 5,
    rollConfirmed: false,
    activePlayerId: '0',
    startingPlayerId: '0',
    turnNumber: 1,
    pendingAttack: null,
    tokenDefinitions: [],
});

const roll = (
    state: DiceThroneCore,
    results: number[],
): DiceThroneCore => reduce(state, {
    type: 'DICE_ROLLED',
    payload: { results, rollerId: '0', phase: 'offensiveRoll' },
    timestamp: 1,
} as DiceThroneEvent);

const applyEvents = (
    state: DiceThroneCore,
    events: DiceThroneEvent[],
): DiceThroneCore => events.reduce((current, event) => reduce(current, event), state);

const createBonusSettlement = (
    overrides: Partial<PendingBonusDiceSettlement> = {},
): PendingBonusDiceSettlement => ({
    id: 'bonus-test-1',
    sourceAbilityId: 'test-bonus',
    attackerId: '0',
    targetId: '1',
    dice: [{
        index: 0,
        value: 3,
        face: 'sabre',
        effectParams: { value: 3 },
    }],
    rerollCostTokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
    rerollCostAmount: 1,
    rerollCount: 0,
    readyToSettle: false,
    allowDiceModification: true,
    ...overrides,
});

describe('DiceThrone 单槽当前骰区', () => {
    it('展示型临时骰确认时只按专属最终骰面收口，不生成默认伤害', () => {
        const state = {
            ...roll(createCore(), [1, 2, 3, 4, 5]),
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
            },
        } as DiceThroneCore;
        const settlement: PendingBonusDiceSettlement = {
            ...createBonusSettlement(),
            sourceAbilityId: 'pyro-get-fired-up-roll',
            displayOnly: true,
            customResolutionId: 'pyro-get-fired-up-roll',
            dice: [{ index: 0, value: 6, face: 'fire' }],
        };

        const events = buildBonusDiceSettlementEvents({
            state,
            settlement,
            random: queuedRandom([1]),
            timestamp: 10,
            sourceCommandType: 'TEST_CONFIRM_TEMPORARY_DIE',
        });

        expect(events.filter(event => event.type === 'BONUS_DAMAGE_ADDED')).toHaveLength(1);
        expect(events.find(event => event.type === 'BONUS_DAMAGE_ADDED')).toMatchObject({
            payload: { amount: 3, playerId: '0' },
        });
        expect(events.filter(event => event.type === 'DAMAGE_DEALT')).toHaveLength(0);
    });

    it('主骰投掷会创建当前骰区，再次投掷会覆盖旧骰区', () => {
        const first = roll(createCore(), [1, 2, 3, 4, 5]);
        const firstContext = first.currentRollContext;

        expect(firstContext).toMatchObject({
            kind: 'offensive',
            ownerPlayerId: '0',
            phase: 'offensiveRoll',
        });
        expect(firstContext?.dice.map((die) => die.value)).toEqual([1, 2, 3, 4, 5]);
        expect(firstContext).not.toHaveProperty('coveredPreviousRollRef');

        const second = roll(first, [6, 5, 4, 3, 2]);

        expect(second.currentRollContext?.id).not.toBe(firstContext?.id);
        expect(second.currentRollContext?.dice.map((die) => die.value)).toEqual([6, 5, 4, 3, 2]);
        expect(second.currentRollContext).not.toHaveProperty('coveredPreviousRollRef');
        expect(second).not.toHaveProperty('rollContextRecovery');
    });

    it('修改主骰会同步更新当前骰区', () => {
        const rolled = roll(createCore(), [1, 2, 3, 4, 5]);
        const modified = reduce(rolled, {
            type: 'DIE_MODIFIED',
            payload: {
                dieId: 0,
                oldValue: 1,
                newValue: 6,
                playerId: '0',
                ownerId: '0',
                target: 'activeDie',
            },
            timestamp: 2,
        } as DiceThroneEvent);

        expect(modified.dice[0].value).toBe(6);
        expect(modified.currentRollContext?.dice[0]?.value).toBe(6);
    });

    it('可改奖励骰会暂时挂起主骰，并使用实际掷骰者的骰子定义', () => {
        const rolled = roll(createCore(), [1, 2, 3, 4, 5]);
        const rolledContext = rolled.currentRollContext;

        const bonusOpened = reduce(rolled, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);

        expect(bonusOpened.currentRollContext).toMatchObject({
            id: 'bonus:bonus-test-1',
            kind: 'bonus',
            ownerPlayerId: '0',
            targetPlayerId: '1',
            dice: [{ definitionId: 'zhanshujia-dice', value: 3 }],
            suspendedParent: {
                id: rolledContext?.id,
                kind: 'offensive',
                ownerPlayerId: '0',
                dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
            },
        });
        expect(bonusOpened.currentRollContext).not.toHaveProperty('coveredPreviousRollRef');
        expect(bonusOpened).not.toHaveProperty('rollContextRecovery');
        expect(bonusOpened.currentRollContext?.dice.map((die) => die.value)).toEqual([3]);

        const modified = reduce(bonusOpened, {
            type: 'DIE_MODIFIED',
            payload: {
                dieId: 0,
                oldValue: 3,
                newValue: 5,
                playerId: '0',
                ownerId: '0',
                target: 'pendingBonusDie',
            },
            timestamp: 4,
        } as DiceThroneEvent);

        expect(modified.pendingBonusDiceSettlement?.dice[0]?.value).toBe(5);
        expect(modified.currentRollContext?.dice[0]?.value).toBe(5);
        expect(modified.dice[0].value).toBe(1);
    });

    it('攻击型临时奖励骰确认后恢复被挂起的主攻击骰', () => {
        const settlement: PendingBonusDiceSettlement = {
            ...createBonusSettlement(),
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
            dice: [
                ...createBonusSettlement().dice,
                { index: 1, value: 4, face: 'sabre', effectParams: { value: 4 } },
            ],
        };
        const parent = {
            ...roll(createCore(), [1, 2, 3, 4, 5]),
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                sourceAbilityId: 'parent-attack',
                bonusDamage: 0,
            },
        } as DiceThroneCore;
        const opened = reduce(parent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const modified = reduce(opened, {
            type: 'DIE_MODIFIED',
            payload: {
                dieId: 0,
                oldValue: 3,
                newValue: 6,
                playerId: '0',
                ownerId: '0',
                target: 'pendingBonusDie',
            },
            timestamp: 4,
        } as DiceThroneEvent);

        const settled = reduce(modified, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: true },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(settled.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.currentRollContext).toMatchObject({
            kind: 'offensive',
            ownerPlayerId: '0',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
        });
        expect(settled.pendingAttack?.bonusDiceResolved).toBe(true);
        expect(settled.pendingAttack?.settlementStage).toBe('preDamage');
        expect(settled.currentRollContext?.suspendedParent).toBeUndefined();
    });

    it('嵌套奖励骰确认后只恢复上一层奖励骰，不恢复主攻击骰', () => {
        const parentSettlement = createBonusSettlement({
            id: 'parent-bonus',
            dice: [{ index: 0, value: 4, face: 'sabre' }],
        });
        const childSettlement = createBonusSettlement({
            id: 'child-bonus',
            dice: [{ index: 0, value: 6, face: 'banner' }],
        });
        const parentOpened = reduce(roll(createCore(), [1, 2, 3, 4, 5]), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: parentSettlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const childOpened = reduce(parentOpened, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: childSettlement },
            timestamp: 4,
        } as DiceThroneEvent);

        expect(childOpened.currentRollContext).toMatchObject({
            id: 'bonus:child-bonus',
            kind: 'bonus',
            suspendedParent: {
                id: 'bonus:parent-bonus',
                kind: 'bonus',
                dice: [{ value: 4 }],
            },
        });

        const childSettled = reduce(childOpened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(childSettled.pendingBonusDiceSettlement).toMatchObject({
            id: 'parent-bonus',
        });
        expect(childSettled.currentRollContext).toMatchObject({
            id: 'bonus:parent-bonus',
            kind: 'bonus',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 4 }],
            suspendedParent: {
                kind: 'offensive',
                dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
            },
        });
    });

    it('complete 奖励骰确认后不恢复旧进攻骰，避免阻塞阶段继续', () => {
        const settlement = createBonusSettlement({
            continuation: { kind: 'complete' },
            dice: [
                { index: 0, value: 6, face: 'sabre' },
                { index: 1, value: 4, face: 'banner' },
            ],
        });
        const parent = roll(createCore(), [1, 2, 3, 4, 5]);
        const opened = reduce(parent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const settled = reduce(opened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 4,
        } as DiceThroneEvent);

        expect(settled.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.currentRollContext).toMatchObject({
            id: `bonus:${settlement.id}`,
            kind: 'bonus',
            status: 'settled',
            policy: {
                modifiableBy: 'none',
                rerollableBy: 'none',
                allowDiceCardTargeting: false,
                blocksPhaseFlow: false,
            },
            display: { replayOnly: true },
            dice: [{ value: 6 }, { value: 4 }],
        });
        expect(settled.currentRollContext?.suspendedParent).toBeUndefined();
    });

    it('重复或迟到的奖励骰结算事件不应清掉已结算的右侧骰盘回看', () => {
        const settlement = createBonusSettlement({
            dice: [{ index: 0, value: 6, face: 'sabre' }],
        });
        const opened = reduce(createCore(), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const settled = reduce(opened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 4,
        } as DiceThroneEvent);
        const duplicateSettle = reduce(settled, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(duplicateSettle.currentRollContext).toMatchObject({
            id: `bonus:${settlement.id}`,
            kind: 'bonus',
            status: 'settled',
            display: { replayOnly: true },
            dice: [{ value: 6 }],
        });
    });

    it('奖励骰普通确认进入 main2 后仍保留右侧骰盘只读回看', () => {
        const settlement = createBonusSettlement({
            dice: [
                { index: 0, value: 6, face: 'sabre' },
                { index: 1, value: 4, face: 'banner' },
            ],
        });
        const opened = reduce(createCore(), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const settled = reduce(opened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 4,
        } as DiceThroneEvent);

        const main2 = reduce(settled, {
            type: FLOW_EVENTS.PHASE_CHANGED,
            payload: { from: 'offensiveRoll', to: 'main2', activePlayerId: '0' },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(main2.pendingBonusDiceSettlement).toBeUndefined();
        expect(main2.currentRollContext).toMatchObject({
            id: `bonus:${settlement.id}`,
            kind: 'bonus',
            status: 'settled',
            display: { replayOnly: true },
            policy: {
                modifiableBy: 'none',
                rerollableBy: 'none',
                allowDiceCardTargeting: false,
            },
            dice: [{ value: 6 }, { value: 4 }],
        });
    });

    it('奖励骰普通确认后的只读回看应穿过非投掷阶段切换，直到下一次投掷覆盖', () => {
        const settlement = createBonusSettlement({
            dice: [
                { index: 0, value: 6, face: 'sabre' },
                { index: 1, value: 4, face: 'banner' },
            ],
        });
        const opened = reduce(createCore(), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const settled = reduce(opened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 4,
        } as DiceThroneEvent);

        const discard = reduce(settled, {
            type: FLOW_EVENTS.PHASE_CHANGED,
            payload: { from: 'main2', to: 'discard', activePlayerId: '0' },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(discard.currentRollContext).toMatchObject({
            id: `bonus:${settlement.id}`,
            kind: 'bonus',
            status: 'settled',
            display: { replayOnly: true },
            dice: [{ value: 6 }, { value: 4 }],
        });

        const nextRoll = roll(discard, [1, 2, 3, 4, 5]);

        expect(nextRoll.currentRollContext).toMatchObject({
            kind: 'offensive',
            ownerPlayerId: '0',
            dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
        });
        expect(nextRoll.rollCount).toBe(1);
        expect(nextRoll.rollDiceCount).toBe(5);
    });

    it('奖励骰普通确认后的只读回看应穿过新掷骰阶段进入，直到真实 DICE_ROLLED 覆盖', () => {
        const core = createCore();
        const coreWithoutRegisteredDice = {
            ...core,
            players: {
                ...core.players,
                '1': { ...core.players['1'], characterId: 'unselected' },
            },
        };
        const settlement = createBonusSettlement({
            dice: [{ index: 0, value: 6, face: 'sabre' }],
        });
        const opened = reduce(coreWithoutRegisteredDice, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const settled = reduce(opened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 4,
        } as DiceThroneEvent);

        const targetingEntered = reduce(settled, {
            type: FLOW_EVENTS.PHASE_CHANGED,
            payload: { from: 'offensiveRoll', to: 'targetingRoll', activePlayerId: '1' },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(targetingEntered.currentRollContext).toMatchObject({
            id: `bonus:${settlement.id}`,
            kind: 'bonus',
            status: 'settled',
            display: { replayOnly: true },
            dice: [{ value: 6 }],
        });
        expect(targetingEntered.rollDiceCount).toBe(1);

        const targetingRolled = reduce(targetingEntered, {
            type: 'DICE_ROLLED',
            payload: { results: [2], rollerId: '1', phase: 'targetingRoll' },
            timestamp: 6,
        } as DiceThroneEvent);

        expect(targetingRolled.currentRollContext).toMatchObject({
            kind: 'targeting',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 2 }],
        });
    });

    it('奖励骰普通确认后的只读回看应穿过进攻掷骰阶段进入，直到真实进攻投掷覆盖', () => {
        const settlement = createBonusSettlement({
            dice: [{ index: 0, value: 6, face: 'sabre' }],
        });
        const opened = reduce(createCore(), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const settled = reduce(opened, {
            type: 'BONUS_DICE_SETTLED',
            payload: { displayOnly: false },
            timestamp: 4,
        } as DiceThroneEvent);

        const offensiveEntered = reduce(settled, {
            type: FLOW_EVENTS.PHASE_CHANGED,
            payload: { from: 'main2', to: 'offensiveRoll', activePlayerId: '0' },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(offensiveEntered.currentRollContext).toMatchObject({
            id: `bonus:${settlement.id}`,
            kind: 'bonus',
            status: 'settled',
            display: { replayOnly: true },
            dice: [{ value: 6 }],
        });
        expect(offensiveEntered.rollDiceCount).toBe(5);
        expect(offensiveEntered.rollConfirmed).toBe(false);

        const offensiveRolled = reduce(offensiveEntered, {
            type: 'DICE_ROLLED',
            payload: { results: [2, 2, 2, 2, 2], rollerId: '0', phase: 'offensiveRoll' },
            timestamp: 6,
        } as DiceThroneEvent);

        expect(offensiveRolled.currentRollContext).toMatchObject({
            kind: 'offensive',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 2 }, { value: 2 }, { value: 2 }, { value: 2 }, { value: 2 }],
        });
    });

    it('死亡盛放 II 攻击型奖励骰确认后恢复父攻击骰，攻击收口后清理骰区', () => {
        const settlement = createBonusSettlement({
            id: 'death-blossom-2-test',
            sourceAbilityId: 'death-blossom-2',
            customResolutionId: 'ninja-death-blossom-2',
            resolutionMode: 'attackBonus',
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
            dice: [
                { index: 0, value: 6, face: NINJA_DICE_FACE_IDS.MASK },
                { index: 1, value: 6, face: NINJA_DICE_FACE_IDS.MASK },
                { index: 2, value: 1, face: NINJA_DICE_FACE_IDS.KATANA },
                { index: 3, value: 4, face: NINJA_DICE_FACE_IDS.SHURIKEN },
                { index: 4, value: 4, face: NINJA_DICE_FACE_IDS.SHURIKEN },
            ],
        });
        const parent = {
            ...roll(createCore(), [1, 2, 3, 4, 5]),
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'death-blossom-2',
                isDefendable: true,
                damage: 20,
                bonusDamage: 0,
            },
        } as DiceThroneCore;
        const opened = reduce(parent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);
        const events = buildBonusDiceSettlementEvents({
            state: opened,
            settlement: opened.pendingBonusDiceSettlement!,
            random: queuedRandom([1]),
            timestamp: 4,
            sourceCommandType: 'TEST_CONFIRM_TEMPORARY_DIE',
        });
        const settled = applyEvents(opened, events);

        expect(settled.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.currentRollContext).toMatchObject({
            kind: 'offensive',
            ownerPlayerId: '0',
            status: 'open',
            display: { replayOnly: false },
            dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
        });
        expect(settled.pendingAttack?.bonusDiceResolved).toBe(true);
        expect(settled.pendingAttack?.settlementStage).toBe('preDamage');

        const attackResolved = reduce(settled, {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'death-blossom-2',
                totalDamage: 25,
            },
            sourceCommandType: 'TEST',
            timestamp: 5,
        } as DiceThroneEvent);
        const main2 = reduce(attackResolved, {
            type: FLOW_EVENTS.PHASE_CHANGED,
            payload: { from: 'offensiveRoll', to: 'main2', activePlayerId: '0' },
            timestamp: 6,
        } as DiceThroneEvent);

        expect(attackResolved.currentRollContext).toBeUndefined();
        expect(main2.currentRollContext).toBeUndefined();
    });

    it('普通确认命令结算攻击型奖励骰后恢复父攻击骰', () => {
        const settlement = createBonusSettlement({
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
            dice: [{ index: 0, value: 6, face: 'sabre', effectParams: { value: 6 } }],
        });
        const parent = {
            ...roll(createCore(), [1, 2, 3, 4, 5]),
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'parent-attack',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                settlementStage: 'preDamage',
            },
        } as DiceThroneCore;
        const opened = reduce(parent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);

        const events = execute({
            core: opened,
            sys: { phase: 'offensiveRoll' },
        }, {
            type: 'SKIP_BONUS_DICE_REROLL',
            playerId: '0',
            payload: {},
            timestamp: 4,
        } as any, queuedRandom([1]));
        const settled = applyEvents(opened, events);

        expect(events.map((event) => event.type)).toContain('BONUS_DICE_SETTLED');
        expect(settled.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.currentRollContext).toMatchObject({
            kind: 'offensive',
            ownerPlayerId: '0',
            display: { replayOnly: false },
            dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
        });
        expect(settled.pendingAttack?.bonusDiceResolved).toBe(true);
        expect(settled.pendingAttack?.settlementStage).toBe('postDamagePending');
        expect(settled.currentRollContext?.suspendedParent).toBeUndefined();
    });

    it('临时奖励骰未确认时禁止推进原攻击阶段', () => {
        const parent = roll(createCore(), [1, 2, 3, 4, 5]);
        const bonusOpened = reduce(parent, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);

        expect(canAdvancePhase(bonusOpened, 'offensiveRoll')).toBe(false);
        expect(validateCommand(bonusOpened, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        } as any, 'offensiveRoll')).toMatchObject({
            valid: false,
            error: 'cannot_advance_phase',
        });
    });

    it('响应窗口把响应者设为焦点时，不授予手动结束攻击或防御权限', () => {
        const core = createCore();
        core.activePlayerId = '0';
        core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            settlementStage: 'afterDefense',
            isDefendable: true,
            sourceAbilityId: 'main-attack',
            defenseAbilityId: 'basic-defense',
            damageResolved: false,
            resolvedDamage: 0,
            preDefenseResolved: true,
            defenseResolved: true,
        } as any;
        core.rollCount = 1;
        core.rollConfirmed = true;

        const state = {
            core,
            sys: {
                phase: 'defensiveRoll',
                interaction: { current: undefined },
                responseWindow: {
                    current: {
                        id: 'after-defense-response-window',
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
        } as MatchState<DiceThroneCore>;

        expect(getFocusPlayerId(state)).toBe('0');
        expect(canAdvancePhase(core, 'defensiveRoll')).toBe(true);
        expect(canManuallyAdvancePhase(state)).toBe(false);

        state.sys.responseWindow.current = undefined;
        expect(canManuallyAdvancePhase(state)).toBe(true);
    });

    it('奖励骰被新投掷覆盖后，旧奖励骰字段不再是可操作当前骰', () => {
        const rolled = roll(createCore(), [1, 2, 3, 4, 5]);
        const bonusOpened = reduce(rolled, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);

        const covered = roll(bonusOpened, [6, 5, 4, 3, 2]);

        expect(covered.pendingBonusDiceSettlement?.id).toBe('bonus-test-1');
        expect(covered.currentRollContext).toMatchObject({
            kind: 'offensive',
            dice: [{ value: 6 }, { value: 5 }, { value: 4 }, { value: 3 }, { value: 2 }],
        });
        expect(covered.currentRollContext).not.toHaveProperty('coveredPreviousRollRef');
        expect(covered).not.toHaveProperty('rollContextRecovery');
        expect(validateCommand(covered, {
            type: 'SKIP_BONUS_DICE_REROLL',
            playerId: '0',
            payload: {},
        } as any, 'main1').valid).toBe(false);
        expect(validateCommand(covered, {
            type: 'REROLL_BONUS_DIE',
            playerId: '0',
            payload: { dieIndex: 0 },
        } as any, 'main1').valid).toBe(false);

        const modified = reduce(covered, {
            type: 'DIE_MODIFIED',
            payload: {
                dieId: 0,
                oldValue: 3,
                newValue: 5,
                playerId: '0',
                ownerId: '0',
                target: 'pendingBonusDie',
            },
            timestamp: 4,
        } as DiceThroneEvent);

        expect(modified.pendingBonusDiceSettlement?.dice[0]?.value).toBe(3);
        expect(modified.currentRollContext?.kind).toBe('offensive');
        expect(modified.currentRollContext?.dice[0]?.value).toBe(6);
    });

    it('奖励骰命令以当前骰区为准，不接受与当前骰区不一致的旧 settlement 骰面', () => {
        const opened = reduce(roll(createCore(), [1, 2, 3, 4, 5]), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);
        const staleCurrentRoll = {
            ...opened,
            currentRollContext: opened.currentRollContext
                ? { ...opened.currentRollContext, dice: [] }
                : undefined,
        };

        expect(validateCommand(staleCurrentRoll, {
            type: 'REROLL_BONUS_DIE',
            playerId: '0',
            payload: { dieIndex: 0 },
        } as any, 'main1')).toMatchObject({
            valid: false,
            error: 'invalid_die_index',
        });
    });

    it('当前可改奖励骰不会放宽掷骰牌的主要阶段限制', () => {
        const opened = reduce(createCore(), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);
        const playSix = COMMON_CARDS.find((card) => card.id === 'card-play-six');

        expect(playSix).toBeDefined();
        if (!playSix) return;

        expect(opened.currentRollContext).toMatchObject({
            kind: 'bonus',
            policy: { allowDiceCardTargeting: true },
        });
        expect(checkPlayCard(opened, '0', playSix, 'main1')).toEqual({
            ok: false,
            reason: 'wrongPhaseForRoll',
        });
    });

    it('奖励骰只在掷骰阶段允许骰子牌以它为目标', () => {
        const opened = reduce(createCore(), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);
        const playSix = COMMON_CARDS.find((card) => card.id === 'card-play-six');

        expect(playSix).toBeDefined();
        if (!playSix) return;

        expect(checkPlayCard(opened, '0', playSix, 'offensiveRoll')).toEqual({ ok: true });

        const lockedTarget = {
            ...opened,
            currentRollContext: opened.currentRollContext && {
                ...opened.currentRollContext,
                policy: {
                    ...opened.currentRollContext.policy,
                    allowDiceCardTargeting: false,
                },
            },
        };
        expect(checkPlayCard(lockedTarget, '0', playSix, 'offensiveRoll')).toEqual({
            ok: false,
            reason: 'rollContextLocked',
        });
    });

    it('新投掷覆盖后不产生无规则来源的玩家恢复步骤', () => {
        const first = roll(createCore(), [1, 2, 3, 4, 5]);
        const covered = roll(first, [6, 5, 4, 3, 2]);
        expect(covered.currentRollContext?.id).not.toBe(first.currentRollContext?.id);
        expect(covered.currentRollContext?.dice.map((die) => die.value)).toEqual([6, 5, 4, 3, 2]);
        expect(covered.currentRollContext).not.toHaveProperty('coveredPreviousRollRef');
        expect(covered).not.toHaveProperty('rollContextRecovery');
    });

    it('展示型与终极来源的临时骰仍允许战术优势重掷', () => {
        const settlement: PendingBonusDiceSettlement = {
            ...createBonusSettlement(),
            id: 'all-temporary-dice-modifiable',
            displayOnly: true,
            allowDiceModification: false,
            ultimateLocked: true,
            rerollCostTokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
            rerollCostAmount: 1,
            maxRerollCount: 1,
        };
        const opened = reduce({ ...createCore(), rollCount: 1 }, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement },
            timestamp: 3,
        } as DiceThroneEvent);

        expect(opened.currentRollContext).toMatchObject({
            id: 'bonus:all-temporary-dice-modifiable',
            kind: 'bonus',
            status: 'open',
            policy: {
                modifiableBy: 'owner',
                rerollableBy: 'owner',
                allowPassiveReroll: true,
                allowDiceCardTargeting: true,
                ultimateLocked: false,
            },
        });
        expect(isPassiveActionUsable(
            opened,
            '0',
            'zhanshujia-tactical-advantage',
            1,
            'main1',
        )).toBe(true);

        const playSix = COMMON_CARDS.find((card) => card.id === 'card-play-six');
        expect(playSix).toBeDefined();
        if (!playSix) return;
        expect(checkPlayCard(opened, '0', playSix, 'offensiveRoll')).toEqual({ ok: true });
    });

    it('攻击已选定时重掷奖励骰不会要求重选技能或清空攻击', () => {
        const opened = reduce(roll(createCore(), [1, 2, 3, 4, 5]), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);
        const state: DiceThroneCore = {
            ...opened,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'war-monger',
                isDefendable: true,
                damage: 5,
            },
        };

        const events = execute(
            { core: state, sys: { phase: 'offensiveRoll' } } as MatchState<DiceThroneCore>,
            {
                type: 'USE_PASSIVE_ABILITY',
                playerId: '0',
                payload: {
                    passiveId: 'zhanshujia-tactical-advantage',
                    actionIndex: 1,
                    targetDieId: 0,
                },
            } as any,
            queuedRandom([1]),
        );
        const rerolled = events.reduce((current, event) => reduce(current, event), state);

        expect(events.some(event => event.type === 'ABILITY_RESELECTION_REQUIRED')).toBe(false);
        expect(rerolled.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'war-monger',
            damage: 5,
        });
        expect(rerolled.pendingBonusDiceSettlement?.dice[0]?.value).toBe(1);
    });

    it('攻击已选定时专用奖励骰重掷不会清空攻击', () => {
        const opened = reduce(roll(createCore(), [1, 2, 3, 4, 5]), {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);
        const state: DiceThroneCore = {
            ...opened,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'war-monger',
                isDefendable: true,
                damage: 5,
            },
        };

        const events = execute(
            { core: state, sys: { phase: 'offensiveRoll' } } as MatchState<DiceThroneCore>,
            {
                type: 'REROLL_BONUS_DIE',
                playerId: '0',
                payload: { dieIndex: 0 },
            } as any,
            queuedRandom([6]),
        );
        const rerolled = events.reduce((current, event) => reduce(current, event), state);

        expect(events.some(event => event.type === 'ABILITY_RESELECTION_REQUIRED')).toBe(false);
        expect(rerolled.pendingAttack).toMatchObject({
            sourceAbilityId: 'war-monger',
            damage: 5,
        });
        expect(rerolled.pendingBonusDiceSettlement?.dice[0]?.value).toBe(6);
    });

    it('攻击已选定时重掷进攻比较骰不会要求重选技能或清空攻击', () => {
        const state: DiceThroneCore = {
            ...createCore(),
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'showdown',
                isDefendable: true,
                damage: 5,
            },
            currentRollContext: createCompareRollContext(createCore(), {
                id: 'compare:showdown-reroll-regression',
                ownerPlayerId: '0',
                targetPlayerId: '1',
                sourceAbilityId: 'showdown',
                dice: [
                    { ...createDie(0, 4), ownerId: '0' },
                    { ...createDie(1, 2), ownerId: '1' },
                ],
                metadata: { compareKind: 'gunslingerShowdown' },
            }),
        };

        const events = execute(
            { core: state, sys: { phase: 'offensiveRoll' } } as MatchState<DiceThroneCore>,
            {
                type: 'USE_PASSIVE_ABILITY',
                playerId: '0',
                payload: {
                    passiveId: 'zhanshujia-tactical-advantage',
                    actionIndex: 1,
                    targetDieId: 0,
                },
            } as any,
            queuedRandom([1]),
        );
        const rerolled = events.reduce((current, event) => reduce(current, event), state);

        expect(events.some(event => event.type === 'ABILITY_RESELECTION_REQUIRED')).toBe(false);
        expect(rerolled.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'showdown',
            damage: 5,
        });
        expect(rerolled.currentRollContext?.dice[0]?.value).toBe(1);
    });

    it('攻击已选定时修改进攻比较骰也不会要求重选技能或清空攻击', () => {
        const state: DiceThroneCore = {
            ...createCore(),
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'showdown',
                isDefendable: true,
                damage: 5,
            },
            currentRollContext: createCompareRollContext(createCore(), {
                id: 'compare:showdown-modify-regression',
                ownerPlayerId: '0',
                targetPlayerId: '1',
                sourceAbilityId: 'showdown',
                dice: [
                    { ...createDie(0, 4), ownerId: '0' },
                    { ...createDie(1, 2), ownerId: '1' },
                ],
                metadata: { compareKind: 'gunslingerShowdown' },
            }),
        };

        const events = execute(
            { core: state, sys: { phase: 'offensiveRoll' } } as MatchState<DiceThroneCore>,
            {
                type: 'MODIFY_DIE',
                playerId: '0',
                payload: { dieId: 0, newValue: 6 },
            } as any,
            queuedRandom([]),
        );
        const modified = events.reduce((current, event) => reduce(current, event), state);

        expect(events.some(event => event.type === 'ABILITY_RESELECTION_REQUIRED')).toBe(false);
        expect(modified.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'showdown',
            damage: 5,
        });
        expect(modified.currentRollContext?.dice[0]?.value).toBe(6);
    });

    it.each([
        'defensive',
        'targeting',
        'effect',
        'bonus',
        'evasion',
        'compare',
    ] as const)('攻击已选定时普通重掷 %s 临时骰不会要求重选技能', (kind) => {
        const base = { ...createCore(), rollCount: 1 };
        const state: DiceThroneCore = {
            ...base,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'war-monger',
                isDefendable: true,
                damage: 5,
            },
            currentRollContext: {
                ...createMainRollContext(base, {
                    phase: 'offensiveRoll',
                    dice: [createDie(0, 4)],
                }),
                id: `${kind}:reroll-regression`,
                kind,
            },
        };

        const events = execute(
            { core: state, sys: { phase: 'offensiveRoll' } } as MatchState<DiceThroneCore>,
            {
                type: 'REROLL_DIE',
                playerId: '0',
                payload: { dieId: 0 },
            } as any,
            queuedRandom([6]),
        );

        expect(events).toContainEqual(expect.objectContaining({
            type: 'DIE_REROLLED',
            payload: expect.objectContaining({ newValue: 6 }),
        }));
        expect(events.some(event => event.type === 'ABILITY_RESELECTION_REQUIRED')).toBe(false);
    });

    it('战术家的战术优势可在非投掷阶段重掷当前奖励骰', () => {
        const rolled = roll(createCore(), [1, 2, 3, 4, 5]);
        const bonusOpened = reduce(rolled, {
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: createBonusSettlement() },
            timestamp: 3,
        } as DiceThroneEvent);

        expect(isPassiveActionUsable(
            bonusOpened,
            '0',
            'zhanshujia-tactical-advantage',
            1,
            'main1',
        )).toBe(true);

        const events = execute(
            { core: bonusOpened, sys: { phase: 'main1' } } as MatchState<DiceThroneCore>,
            {
                type: 'USE_PASSIVE_ABILITY',
                playerId: '0',
                payload: {
                    passiveId: 'zhanshujia-tactical-advantage',
                    actionIndex: 1,
                    targetDieId: 0,
                },
            } as any,
            queuedRandom([6]),
        );
        const rerolled = events.find((event) => event.type === 'DIE_REROLLED');

        expect(rerolled).toMatchObject({
            payload: {
                dieId: 0,
                oldValue: 3,
                newValue: 6,
                target: 'pendingBonusDie',
            },
        });

        const afterReroll = events.reduce((current, event) => reduce(current, event), bonusOpened);
        expect(afterReroll.pendingBonusDiceSettlement?.dice[0]?.value).toBe(6);
        expect(afterReroll.currentRollContext?.dice[0]?.value).toBe(6);
        expect(afterReroll.dice[0].value).toBe(1);
    });

    it('闪避骰进入当前骰区后，战术家重掷会重新决定免伤结果', () => {
        let state = createCore();
        state.players['1'].passiveAbilities = ZHANSHUJIA_PASSIVE_ABILITIES;
        state.players['1'].tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] = 1;
        state.pendingDamage = {
            id: 'damage-evasion-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };

        state = reduce(state, {
            type: 'TOKEN_USED',
            payload: {
                playerId: '1',
                tokenId: TOKEN_IDS.EVASIVE,
                amount: 1,
                effectType: 'evasionAttempt',
                evasionRoll: { value: 1, success: true },
            },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(state.currentRollContext).toMatchObject({
            kind: 'evasion',
            ownerPlayerId: '1',
            targetPlayerId: '1',
            sourceTokenId: TOKEN_IDS.EVASIVE,
            dice: [{ id: 0, definitionId: 'monk-dice', value: 1 }],
        });
        expect(state.pendingDamage?.isFullyEvaded).toBe(true);
        expect(state.pendingDamage?.currentDamage).toBe(0);

        const events = execute(
            { core: state, sys: { phase: 'main1' } } as MatchState<DiceThroneCore>,
            {
                type: 'USE_PASSIVE_ABILITY',
                playerId: '1',
                payload: {
                    passiveId: 'zhanshujia-tactical-advantage',
                    actionIndex: 1,
                    targetDieId: 0,
                },
            } as any,
            queuedRandom([6]),
        );
        const afterReroll = events.reduce((current, event) => reduce(current, event), state);

        expect(events.find((event) => event.type === 'DIE_REROLLED')).toMatchObject({
            payload: { target: 'evasionDie', newValue: 6 },
        });
        expect(afterReroll.currentRollContext?.dice[0]?.value).toBe(6);
        expect(afterReroll.pendingDamage?.isFullyEvaded).toBe(false);
        expect(afterReroll.pendingDamage?.currentDamage).toBe(5);
    });

    it('目标骰与技能 rollDie 都覆盖为唯一当前骰区', () => {
        const targetingState: DiceThroneCore = {
            ...createCore(),
            dice: [createDie(0)],
            rollDiceCount: 1,
        };
        const targetingRolled = reduce(targetingState, {
            type: 'DICE_ROLLED',
            payload: { results: [6], rollerId: '0', phase: 'targetingRoll' },
            timestamp: 6,
        } as DiceThroneEvent);

        expect(targetingRolled.currentRollContext).toMatchObject({
            kind: 'targeting',
            ownerPlayerId: '0',
            phase: 'targetingRoll',
            dice: [{ id: 0, value: 6 }],
        });

        const rollDieEvents = resolveEffectsToEvents([
            {
                action: {
                    type: 'rollDie',
                    target: 'self',
                    diceCount: 1,
                    conditionalEffects: [{ face: 'sabre', bonusDamage: 2, effectKey: 'bonusDie.effect.sabre' }],
                },
                timing: 'immediate',
            },
        ] as any, 'immediate', {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'roll-context-test',
            state: targetingRolled,
            damageDealt: 0,
            timestamp: 7,
        }, { random: queuedRandom([2]) });
        const rollDieOpened = rollDieEvents.reduce((state, event) => reduce(state, event), targetingRolled);

        expect(rollDieOpened.currentRollContext).toMatchObject({
            kind: 'bonus',
            ownerPlayerId: '0',
            sourceAbilityId: 'roll-context-test',
            dice: [{ id: 0, value: 2 }],
        });
        expect(rollDieOpened.currentRollContext).not.toHaveProperty('coveredPreviousRollRef');
        expect(rollDieOpened).not.toHaveProperty('rollContextRecovery');
    });

    it('策略声明任意人可改的闪避骰允许响应方修改', () => {
        const state: DiceThroneCore = {
            ...createCore(),
            currentRollContext: createEvasionRollContext({
                ownerPlayerId: '1',
                diceDefinitionId: 'monk-dice',
                targetPlayerId: '1',
                sourceTokenId: TOKEN_IDS.EVASIVE,
                value: 1,
                successRange: [1, 2],
                damageBeforeEvasion: 5,
                pendingDamageId: 'damage-any-modify',
            }),
        };
        const responseModifyInteraction = {
            id: 'response-modify-evasion',
            playerId: '0',
            sourceCardId: 'card-test',
            type: 'modifyDie',
            titleKey: 'interaction.selectDieToModify',
            selectCount: 1,
            selected: [],
            allowedDieIds: [0],
        } as any;

        expect(validateCommand(state, {
            type: 'MODIFY_DIE',
            playerId: '0',
            payload: { dieId: 0, newValue: 6 },
        } as any, 'main1', responseModifyInteraction)).toEqual({ valid: true });
    });

    it('2v2 当前骰区的队友与对手被动重掷权限都由同一策略裁决', () => {
        const context = createEvasionRollContext({
            ownerPlayerId: '0',
            diceDefinitionId: 'zhanshujia-dice',
            targetPlayerId: '1',
            sourceTokenId: TOKEN_IDS.EVASIVE,
            value: 1,
            successRange: [1, 2],
            damageBeforeEvasion: 5,
            pendingDamageId: 'damage-allies-policy',
        });
        const state: DiceThroneCore = {
            ...createCore(),
            players: {
                '0': createHero('0', true),
                '1': createHero('1', true),
                '2': createHero('2', true),
                '3': createHero('3'),
            },
            selectedCharacters: { '0': 'zhanshujia', '1': 'monk', '2': 'monk', '3': 'monk' },
            readyPlayers: { '0': true, '1': true, '2': true, '3': true },
            seatingOrder: ['0', '1', '2', '3'],
            teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
            currentRollContext: {
                ...context,
                policy: { ...context.policy, rerollableBy: 'allies' },
            },
        };

        expect(isPassiveActionUsable(state, '2', 'zhanshujia-tactical-advantage', 1, 'main1')).toBe(true);
        expect(isPassiveActionUsable(state, '1', 'zhanshujia-tactical-advantage', 1, 'main1')).toBe(false);
    });

    it('枪手摊牌会先进入 compare 当前骰区，确认时按修改后的骰面决定胜负', () => {
        const handler = getCustomActionHandler('gunslinger-showdown-bonus');
        expect(handler).toBeDefined();
        if (!handler) return;

        const events = handler({
            ctx: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'showdown',
                state: createCore(),
                damageDealt: 4,
                timestamp: 10,
            },
            attackerId: '0',
            targetId: '1',
            sourceAbilityId: 'showdown',
            state: createCore(),
            damageDealt: 4,
            timestamp: 10,
            random: queuedRandom([2, 5]),
            action: {
                type: 'custom',
                target: 'self',
                customActionId: 'gunslinger-showdown-bonus',
                params: { amount: 2 },
            },
        } as any);

        const opened = events.reduce((current, event) => reduce(current, event), createCore());

        expect(opened.currentRollContext).toMatchObject({
            kind: 'compare',
            ownerPlayerId: '0',
            targetPlayerId: '1',
            sourceAbilityId: 'showdown',
            dice: [
                { id: 0, value: 2, ownerId: '0' },
                { id: 1, value: 5, ownerId: '1' },
            ],
            settlement: {
                mode: 'compare',
                metadata: {
                    compareKind: 'gunslingerShowdown',
                    bonusDamageOnWin: 2,
                },
            },
        });

        const modified = reduce(opened, {
            type: 'DIE_MODIFIED',
            payload: {
                dieId: 0,
                oldValue: 2,
                newValue: 6,
                playerId: '0',
                ownerId: '0',
                target: 'activeDie',
            },
            timestamp: 11,
        } as DiceThroneEvent);

        const confirmEvents = execute(
            { core: modified, sys: { phase: 'main1' } } as MatchState<DiceThroneCore>,
            {
                type: 'CONFIRM_COMPARE_ROLL',
                playerId: '0',
                payload: {},
            } as any,
            queuedRandom([]),
        );

        expect(confirmEvents).toContainEqual(expect.objectContaining({
            type: 'CHOICE_REQUESTED',
            payload: expect.objectContaining({
                sourceAbilityId: 'showdown',
                compareRoll: expect.objectContaining({
                    contestants: [
                        expect.objectContaining({ playerId: '0', roll: 6 }),
                        expect.objectContaining({ playerId: '1', roll: 5 }),
                    ],
                    resultTextKey: 'compareRoll.gunslingerShowdown.win',
                    confirmValue: { value: 2, customId: 'gunslinger-showdown-apply-bonus' },
                }),
            }),
        }));
    });

    it('枪手对决会先进入 compare 当前骰区，确认时按修改后的骰面决定胜负', () => {
        const handler = getCustomActionHandler('gunslinger-duel-resolve');
        expect(handler).toBeDefined();
        if (!handler) return;

        const baseState: DiceThroneCore = {
            ...createCore(),
            activePlayerId: '1',
            rollDiceCount: 1,
            dice: [createDie(0, 2), ...[1, 2, 3, 4].map((id) => createDie(id, 1))],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'revolver',
                defenseAbilityId: 'duel',
                isDefendable: true,
            },
        };
        baseState.dice[0] = { ...baseState.dice[0], ownerId: '1' };
        baseState.currentRollContext = createMainRollContext(baseState, {
            phase: 'defensiveRoll',
            ownerPlayerId: '1',
            dice: [
                baseState.dice[0],
                { ...createDie(1, 5), ownerId: '0' },
            ],
        });

        const events = handler({
            ctx: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'duel',
                state: baseState,
                damageDealt: 0,
                timestamp: 20,
            },
            attackerId: '1',
            targetId: '0',
            sourceAbilityId: 'duel',
            state: baseState,
            damageDealt: 0,
            timestamp: 20,
            random: queuedRandom([]),
            action: {
                type: 'custom',
                target: 'self',
                customActionId: 'gunslinger-duel-resolve',
            },
        } as any);

        const opened = events.reduce((current, event) => reduce(current, event), baseState);

        expect(opened.currentRollContext).toMatchObject({
            kind: 'compare',
            ownerPlayerId: '1',
            targetPlayerId: '0',
            sourceAbilityId: 'duel',
            dice: [
                { id: 0, value: 2, ownerId: '1' },
                { id: 1, value: 5, ownerId: '0' },
            ],
            settlement: {
                mode: 'compare',
                metadata: {
                    compareKind: 'gunslingerDuel',
                    winOnTie: false,
                },
            },
        });

        const modified = reduce(opened, {
            type: 'DIE_MODIFIED',
            payload: {
                dieId: 0,
                oldValue: 2,
                newValue: 6,
                playerId: '1',
                ownerId: '1',
                target: 'activeDie',
            },
            timestamp: 21,
        } as DiceThroneEvent);

        const confirmEvents = execute(
            { core: modified, sys: { phase: 'defensiveRoll' } } as MatchState<DiceThroneCore>,
            {
                type: 'CONFIRM_COMPARE_ROLL',
                playerId: '1',
                payload: {},
            } as any,
            queuedRandom([]),
        );

        expect(confirmEvents).toContainEqual(expect.objectContaining({
            type: 'CHOICE_REQUESTED',
            payload: expect.objectContaining({
                playerId: '1',
                sourceAbilityId: 'duel',
                titleKey: 'choices.gunslingerDuel.title',
                options: [
                    expect.objectContaining({ customId: 'gunslinger-duel-deal-3' }),
                    expect.objectContaining({ customId: 'gunslinger-duel-prevent-half' }),
                ],
                compareRoll: expect.objectContaining({
                    contestants: [
                        expect.objectContaining({ playerId: '1', roll: 6 }),
                        expect.objectContaining({ playerId: '0', roll: 5 }),
                    ],
                    resultTextKey: 'compareRoll.gunslingerDuel.win',
                    resultTone: 'success',
                }),
            }),
        }));
    });
});
