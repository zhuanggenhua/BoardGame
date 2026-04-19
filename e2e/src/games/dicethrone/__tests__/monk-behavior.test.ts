/**
 * 僧侣 (Monk) Custom Action 运行时行为断言测试
 */

import { describe, it, expect } from 'vitest';
import { TOKEN_IDS, DICE_FACE_IDS, STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, Die, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { monkDiceDefinition } from '../heroes/monk/diceConfig';

initializeCustomActions();
registerDiceDefinition(monkDiceDefinition);

// ============================================================================
// 测试工具
// ============================================================================

function createMonkDie(value: number): Die {
    const faceMap: Record<number, string> = {
        1: DICE_FACE_IDS.FIST, 2: DICE_FACE_IDS.FIST,
        3: DICE_FACE_IDS.PALM,
        4: DICE_FACE_IDS.TAIJI, 5: DICE_FACE_IDS.TAIJI,
        6: DICE_FACE_IDS.LOTUS,
    };
    return {
        id: 0, definitionId: 'monk-dice', value,
        symbol: faceMap[value] as any, symbols: [faceMap[value]], isKept: false,
    };
}

function createState(opts: {
    dice?: Die[];
    taiji?: number;
    taijiLimit?: number;
    evasive?: number;
    purify?: number;
    cp?: number;
    rollLimit?: number;
}): DiceThroneCore {
    const player: HeroState = {
        id: '0', characterId: 'monk',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: opts.cp ?? 5 },
        hand: [], deck: [{ id: 'card-1', name: '', type: 'action', cpCost: 0, timing: 'main', description: '' }],
        discard: [],
        statusEffects: {},
        tokens: {
            [TOKEN_IDS.TAIJI]: opts.taiji ?? 0,
            [TOKEN_IDS.EVASIVE]: opts.evasive ?? 0,
            [TOKEN_IDS.PURIFY]: opts.purify ?? 0,
        },
        tokenStackLimits: { [TOKEN_IDS.TAIJI]: opts.taijiLimit ?? 4 },
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const opponent: HeroState = {
        id: '1', characterId: 'barbarian',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    return {
        players: { '0': player, '1': opponent },
        selectedCharacters: { '0': 'monk', '1': 'barbarian' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: opts.dice ?? [1, 2, 3, 4, 5].map(v => createMonkDie(v)),
        rollCount: 1, rollLimit: opts.rollLimit ?? 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
}


function buildCtx(
    state: DiceThroneCore, actionId: string,
    opts?: { random?: () => number; targetSelf?: boolean }
): CustomActionContext {
    const targetId = opts?.targetSelf ? '0' : '1';
    const effectCtx = {
        attackerId: '0' as any, defenderId: '1' as any,
        sourceAbilityId: actionId, state, damageDealt: 0, timestamp: 1000,
    };
    const randomFn = opts?.random
        ? { d: (n: number) => Math.ceil(opts.random!() * n) } as any
        : undefined;
    return {
        ctx: effectCtx, targetId: targetId as any, attackerId: '0' as any,
        sourceAbilityId: actionId, state, timestamp: 1000, random: randomFn,
        action: { type: 'custom', customActionId: actionId },
    };
}

function eventsOfType(events: DiceThroneEvent[], type: string) {
    return events.filter(e => e.type === type);
}

// ============================================================================
// 测试套件
// ============================================================================

describe('僧侣 Custom Action 运行时行为断言', () => {

    // ========================================================================
    // meditation-taiji: 根据太极骰面数获得太极Token
    // ========================================================================
    describe('meditation-taiji (冥想-太极)', () => {
        it('2个太极面获得2太极', () => {
            // 骰子: fist,fist,palm,taiji,taiji → 2个taiji
            const dice = [1, 2, 3, 4, 5].map(v => createMonkDie(v));
            const state = createState({ dice, taiji: 0 });
            const handler = getCustomActionHandler('meditation-taiji')!;
            const ctx = buildCtx(state, 'meditation-taiji', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const token = eventsOfType(events, 'TOKEN_GRANTED');
            expect(token).toHaveLength(1);
            expect((token[0] as any).payload.amount).toBe(2);
            expect((token[0] as any).payload.newTotal).toBe(2);
        });

        it('太极已满时再次获得会把事件数量压成实际到账量', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createMonkDie(v));
            const state = createState({ dice, taiji: 4, taijiLimit: 4 });
            const handler = getCustomActionHandler('meditation-taiji')!;
            const ctx = buildCtx(state, 'meditation-taiji', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const token = eventsOfType(events, 'TOKEN_GRANTED');
            expect(token).toHaveLength(1);
            expect((token[0] as any).payload.amount).toBe(0);
            expect((token[0] as any).payload.newTotal).toBe(4);
        });
    });

    // ========================================================================
    // meditation-damage: 根据拳骰面数造成伤害
    // ========================================================================
    describe('meditation-damage (冥想-伤害)', () => {
        it('2个拳面造成2点伤害', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createMonkDie(v));
            const state = createState({ dice });
            const handler = getCustomActionHandler('meditation-damage')!;
            const events = handler(buildCtx(state, 'meditation-damage'));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(2);
        });
    });

    // ========================================================================
    // meditation-3-taiji: 获得太极，同时投出太极+莲花时弹出选择
    // ========================================================================
    describe('meditation-3-taiji (冥想III-太极)', () => {
        it('同时投出太极+莲花时弹出闪避/净化选择', () => {
            // 骰子: fist,fist,taiji,taiji,lotus → 有太极+莲花
            const dice = [1, 2, 4, 5, 6].map(v => createMonkDie(v));
            const state = createState({ dice, taiji: 0 });
            const handler = getCustomActionHandler('meditation-3-taiji')!;
            const ctx = buildCtx(state, 'meditation-3-taiji', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect(eventsOfType(events, 'TOKEN_GRANTED')).toHaveLength(1);
            expect(eventsOfType(events, 'CHOICE_REQUESTED')).toHaveLength(1);
        });

        it('只有太极没有莲花时不弹出选择', () => {
            // 骰子: fist,fist,fist,taiji,taiji → 有太极但没莲花
            const dice = [1, 1, 1, 4, 5].map(v => createMonkDie(v));
            const state = createState({ dice, taiji: 0 });
            const handler = getCustomActionHandler('meditation-3-taiji')!;
            const ctx = buildCtx(state, 'meditation-3-taiji', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect(eventsOfType(events, 'CHOICE_REQUESTED')).toHaveLength(0);
        });

        it('只有莲花没有太极时不弹出选择', () => {
            // 骰子: fist,fist,palm,palm,lotus → 有莲花但没太极
            const dice = [1, 2, 3, 3, 6].map(v => createMonkDie(v));
            const state = createState({ dice, taiji: 0 });
            const handler = getCustomActionHandler('meditation-3-taiji')!;
            const ctx = buildCtx(state, 'meditation-3-taiji', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect(eventsOfType(events, 'CHOICE_REQUESTED')).toHaveLength(0);
        });
    });

    // ========================================================================
    // one-throw-fortune-cp: 投1骰，获得ceil(value/2)CP
    // ========================================================================
    describe('one-throw-fortune-cp (一掷千金)', () => {
        it('投出6获得3CP', () => {
            const state = createState({ cp: 5 });
            const handler = getCustomActionHandler('one-throw-fortune-cp')!;
            const ctx = buildCtx(state, 'one-throw-fortune-cp', {
                random: () => 1, targetSelf: true, // d(6)→6
            });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(3); // ceil(6/2)
        });

        it('投出1获得1CP', () => {
            const state = createState({ cp: 5 });
            const handler = getCustomActionHandler('one-throw-fortune-cp')!;
            const ctx = buildCtx(state, 'one-throw-fortune-cp', {
                random: () => 1 / 6, targetSelf: true, // d(6)→1
            });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect((eventsOfType(events, 'CP_CHANGED')[0] as any).payload.delta).toBe(1);
        });
    });

    // ========================================================================
    // lotus-palm-unblockable-choice: 太极>=2时弹出选择
    // ========================================================================
    describe('lotus-palm-unblockable-choice (莲花掌不可防御)', () => {
        it('太极>=2时弹出选择', () => {
            const state = createState({ taiji: 3 });
            const handler = getCustomActionHandler('lotus-palm-unblockable-choice')!;
            const ctx = buildCtx(state, 'lotus-palm-unblockable-choice', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect(eventsOfType(events, 'CHOICE_REQUESTED')).toHaveLength(1);
        });

        it('太极<2时不弹出', () => {
            const state = createState({ taiji: 1 });
            const handler = getCustomActionHandler('lotus-palm-unblockable-choice')!;
            const ctx = buildCtx(state, 'lotus-palm-unblockable-choice', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect(events).toHaveLength(0);
        });
    });

    // ========================================================================
    // lotus-palm-taiji-cap-up-and-fill: 太极上限+1并补满
    // ========================================================================
    describe('lotus-palm-taiji-cap-up-and-fill (莲花掌上限+1)', () => {
        it('上限4→5，太极2→5', () => {
            const state = createState({ taiji: 2, taijiLimit: 4 });
            const handler = getCustomActionHandler('lotus-palm-taiji-cap-up-and-fill')!;
            const ctx = buildCtx(state, 'lotus-palm-taiji-cap-up-and-fill', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const limit = eventsOfType(events, 'TOKEN_LIMIT_CHANGED');
            expect(limit).toHaveLength(1);
            expect((limit[0] as any).payload.newLimit).toBe(5);

            const token = eventsOfType(events, 'TOKEN_GRANTED');
            expect(token).toHaveLength(1);
            expect((token[0] as any).payload.amount).toBe(3); // 5-2
            expect((token[0] as any).payload.newTotal).toBe(5);
        });
    });

    // ========================================================================
    // grant-cp-2: 获得2CP
    // ========================================================================
    describe('grant-cp-2 (获得2CP)', () => {
        it('CP增加2', () => {
            const state = createState({ cp: 3 });
            const handler = getCustomActionHandler('grant-cp-2')!;
            const ctx = buildCtx(state, 'grant-cp-2', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(2);
            expect((cp[0] as any).payload.newValue).toBe(5);
        });
    });

    // ========================================================================
    // grant-extra-roll-defense: 投掷次数+1
    // ========================================================================
    describe('grant-extra-roll-defense (额外投掷)', () => {
        it('rollLimit从3变为4', () => {
            const state = createState({ rollLimit: 3 });
            const handler = getCustomActionHandler('grant-extra-roll-defense')!;
            const ctx = buildCtx(state, 'grant-extra-roll-defense', { targetSelf: true });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const roll = eventsOfType(events, 'ROLL_LIMIT_CHANGED');
            expect(roll).toHaveLength(1);
            expect((roll[0] as any).payload.newLimit).toBe(4);
        });
    });
});
