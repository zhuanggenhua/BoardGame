import { describe, expect, it } from 'vitest';
import { DICETHRONE_CHARACTER_CATALOG, DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG } from '../domain/core-types';
import { TOKEN_IDS as TOKEN, THOR_DICE_FACE_IDS as FACE } from '../domain/ids';
import { RESOURCE_IDS as RESOURCE } from '../domain/resources';
import { DiceThroneDomain } from '../domain';
import { reduce } from '../domain/reducer';
import { getCustomActionHandler, type CustomActionContext } from '../domain/effects';
import { getChoiceResolvedEventHandler } from '../domain/choiceResolvedEvents';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from '../domain/passiveAbility';
import { getMjolnirHolder, collectThorCompanionFollowups } from '../domain/customActions/thor';
import { isRemovableStatusId, isTransferableStatusId } from '../domain/statusRemoval';
import { thorDiceDefinition } from '../heroes/thor/diceConfig';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { createHeroMatchup, fixedRandom } from './test-utils';
import { createInitialSystemState } from '../../../engine/pipeline';

const scene = () => createHeroMatchup('thor', 'monk')(['0', '1'], fixedRandom);
const apply = (state: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore => {
    const next = events.reduce(reduce, state);
    const followups = collectThorCompanionFollowups(next, events);
    return followups.length ? apply(next, followups) : next;
};
const action = (state: DiceThroneCore, id: string, params?: Record<string, number | string | boolean>) => {
    const ctx: CustomActionContext = {
        state, attackerId: '0', targetId: '1', sourceAbilityId: id, timestamp: 1, random: fixedRandom,
        ctx: { state, attackerId: '0', defenderId: '1', sourceAbilityId: id, damageDealt: 0 },
        action: { type: 'custom', target: 'self', customActionId: id, params },
    };
    const handler = getCustomActionHandler(id);
    expect(handler, id).toBeTypeOf('function');
    return handler!(ctx);
};
const choose = (state: DiceThroneCore, id: string, value: number) => {
    const sourceAbilityId = state.currentChoiceSourceAbilityId!;
    const followup = getChoiceResolvedEventHandler(id)!({ state, playerId: '0', sourceAbilityId, customId: id, value, timestamp: 2, random: fixedRandom });
    return apply(state, [{ type: 'CHOICE_RESOLVED', payload: { playerId: '0', customId: id, value, sourceAbilityId, interactionBacked: true }, timestamp: 2 } as DiceThroneEvent, ...followup]);
};

describe('索尔独一同伴与状态授权', () => {
    it('索尔作为实施中英雄出现在真人入口并允许直接选择', () => {
        expect(DICETHRONE_CHARACTER_CATALOG.find(c => c.id === 'thor')?.setupOptionStatus).toBe('in_progress');
        expect(DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG.some(c => c.id === 'thor')).toBe(true);
        const match = { core: DiceThroneDomain.setup(['0','1'],fixedRandom), sys: createInitialSystemState(['0','1'],[]) };
        match.sys.phase='setup';
        const result=DiceThroneDomain.validate(match, { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'thor' }, timestamp: 1 });
        expect(result.valid).toBe(true);
    });

    it('六面保留3神锤、2当之无愧、1雷电及正式骰子精灵', () => {
        expect(thorDiceDefinition.faces.map(d => d.symbols[0])).toEqual([FACE.HAMMER, FACE.HAMMER, FACE.HAMMER, FACE.WORTHY, FACE.WORTHY, FACE.THUNDER]);
        expect(thorDiceDefinition.assets?.spriteSheet).toBe('dicethrone/images/thor/dice');
    });

    it('1v1 的唯一锤子目标自动飞掷/召回，飞掷独立扣1，召回获得1驭电', () => {
        let state = scene().core;
        expect(getMjolnirHolder(state)).toBe('0');
        expect(isRemovableStatusId(state, TOKEN.MJOLNIR)).toBe(false);
        expect(isTransferableStatusId(state, TOKEN.MJOLNIR)).toBe(false);
        state = apply(state, action(state, 'thor-hammer-moves', { count: 1 }));
        expect(getMjolnirHolder(state)).toBe('1');
        expect(state.players['1'].resources[RESOURCE.HP]).toBe(49);
        state = apply(state, action(state, 'thor-hammer-moves', { count: 1 }));
        expect(getMjolnirHolder(state)).toBe('0');
        expect(state.players['0'].tokens[TOKEN.ELECTROKINESIS]).toBe(1);
        expect(Object.values(state.players).reduce((n, p) => n + (p.tokens[TOKEN.MJOLNIR] ?? 0), 0)).toBe(1);
    });

    it('多人局仍要求从多个合法飞掷目标中选择', () => {
        const state = scene().core;
        state.players['2'] = { ...state.players['1'] };
        state.seatingOrder = ['0', '1', '2'];
        const request = action(state, 'thor-hammer-moves', { count: 1 });
        const choice = request.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choice?.type === 'CHOICE_REQUESTED' && choice.payload.options.map(option => option.targetPlayerId)).toEqual(['1', '2']);
    });

    it('多人局连锁闪电仍要求从多个附属伤害目标中选择', () => {
        const state = scene().core;
        state.players['2'] = { ...state.players['1'] };
        state.seatingOrder = ['0', '1', '2'];
        state.currentChoiceContext = { collateral: 2 };
        const followup = getChoiceResolvedEventHandler('thor-chain-pair')!({
            state, playerId: '0', sourceAbilityId: 'thor-chain-lightning', customId: 'thor-chain-pair', value: 5, timestamp: 2, random: fixedRandom,
        });
        const choice = followup.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choice?.type === 'CHOICE_REQUESTED' && choice.payload.options.map(option => option.targetPlayerId)).toEqual(['1', '2']);
    });

    it('弃牌飞掷请求通用手牌交互并声明弃牌后的续接动作', () => {
        const state = scene().core;
        state.players['0'].hand = [state.players['0'].deck.shift()!];
        const request = action(state, 'thor-paid-throw');
        const interaction = request.find(event => event.type === 'INTERACTION_REQUESTED');
        expect(interaction?.type === 'INTERACTION_REQUESTED' && interaction.payload.interaction).toMatchObject({
            type: 'selectHandCard',
            titleKey: 'interaction.selectHandCardToDiscard',
            selectCount: 1,
            allowCancel: true,
            resolveCustomActionId: 'thor-mjolnir-paid-throw',
        });
    });

    it('至多4次允许直接停止，亦可四次移动，飞掷两段独立伤害', () => {
        let state = scene().core;
        const first = action(state, 'thor-hammer-moves', { count: 4, optional: true });
        const skipped = choose(apply(state, first), 'thor-mjolnir-move', -1);
        expect(getMjolnirHolder(skipped)).toBe('0');
        state = apply(state, first);
        for (const destination of [1, 0, 1, 0]) state = choose(state, 'thor-mjolnir-move', destination);
        expect(state.players['1'].resources[RESOURCE.HP]).toBe(48);
        expect(state.players['0'].tokens[TOKEN.ELECTROKINESIS]).toBe(2);
        expect(getMjolnirHolder(state)).toBe('0');
    });
    it.each([2,3,6])('至多%d次逐步选择可达上限，飞掷与召回分别结算', count => {
        let state=scene().core;
        state=apply(state,action(state,'thor-hammer-moves',{count,optional:true}));
        for(let i=0;i<count;i++)state=choose(state,'thor-mjolnir-move',i%2===0?1:0);
        expect(state.players['1'].resources[RESOURCE.HP]).toBe(50-Math.ceil(count/2));
        expect(state.players['0'].tokens[TOKEN.ELECTROKINESIS]).toBe(Math.floor(count/2));
        expect(state.currentChoiceSourceAbilityId).toBeUndefined();
    });

    it('敌人持锤败北触发召回，重复无新伤害时不再次获得驭电', () => {
        const state = scene().core;
        state.players['0'].tokens[TOKEN.MJOLNIR] = 0;
        state.players['1'].tokens[TOKEN.MJOLNIR] = 1;
        state.players['1'].resources[RESOURCE.HP] = 0;
        const next = apply(state, collectThorCompanionFollowups(state, [{ type: 'DAMAGE_DEALT', timestamp: 1 }]));
        expect(getMjolnirHolder(next)).toBe('0');
        expect(next.players['0'].tokens[TOKEN.ELECTROKINESIS]).toBe(1);
        expect(collectThorCompanionFollowups(next, [{ type: 'DAMAGE_DEALT', timestamp: 2 }])).toEqual([]);
    });

    it('转移给其他英雄的驭电仍可在自己主要阶段花4抽1，次数跨主要阶段共享', () => {
        const state = scene().core;
        state.activePlayerId = '1';
        state.players['1'].tokens[TOKEN.ELECTROKINESIS] = 4;
        expect(getPlayerPassiveAbilities(state, '1').some(p => p.id === 'electrokinesis-draw')).toBe(true);
        expect(isPassiveActionUsable(state, '1', 'electrokinesis-draw', 0, 'main1')).toBe(true);
        expect(isPassiveActionUsable(state, '1', 'electrokinesis-draw', 0, 'offensiveRoll')).toBe(false);
        state.passiveActionUsedThisTurn = { '1': { 'electrokinesis-draw': true } };
        expect(isPassiveActionUsable(state, '1', 'electrokinesis-draw', 0, 'main2')).toBe(false);
    });
});
