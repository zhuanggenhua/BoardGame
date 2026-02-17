/**
 * 圣骑士复仇技能玩家选择交互测试
 *
 * @deprecated - 此测试文件测试旧的交互系统（PendingInteraction + tokenGrantConfig）
 * 新的交互系统使用 createSelectPlayerInteraction + onResolve 直接生成 TOKEN_GRANTED 事件
 *
 * 测试场景：
 * 1. custom action 生成 selectPlayer 交互（含 tokenGrantConfig）
 * 2. CONFIRM_INTERACTION 处理 tokenGrantConfig 授予 Token
 */

import { describe, it, expect } from 'vitest';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { VENGEANCE_2 } from '../heroes/paladin/abilities';

initializeCustomActions();

// ============================================================================
// 测试工具
// ============================================================================

// @deprecated - 跳过整个测试文件
describe.skip('圣骑士复仇技能玩家选择交互（旧系统）', () => {

function createState(): DiceThroneCore {
    const attacker: HeroState = {
        id: '0', characterId: 'paladin',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {},
        tokens: {},
        tokenStackLimits: { [TOKEN_IDS.RETRIBUTION]: 3 },
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const defender: HeroState = {
        id: '1', characterId: 'barbarian',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {},
        tokens: {},
        tokenStackLimits: { [TOKEN_IDS.RETRIBUTION]: 3 },
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    return {
        players: { '0': attacker, '1': defender },
        selectedCharacters: { '0': 'paladin', '1': 'barbarian' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: [], rollCount: 1, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
}

function buildCtx(state: DiceThroneCore, actionId: string): CustomActionContext {
    const effectCtx = {
        attackerId: '0' as any, defenderId: '1' as any,
        sourceAbilityId: actionId, state, damageDealt: 0, timestamp: 1000,
    };
    return {
        ctx: effectCtx, targetId: '0' as any, attackerId: '0' as any,
        sourceAbilityId: actionId, state, timestamp: 1000,
        action: { type: 'custom', customActionId: actionId },
    };
}

function eventsOfType(events: DiceThroneEvent[], type: string) {
    return events.filter(e => e.type === type);
}

// ============================================================================
// 测试套件
// ============================================================================

    it('生成 selectPlayer 交互请求，含 tokenGrantConfig', () => {
        const state = createState();
        const handler = getCustomActionHandler('paladin-vengeance-select-player')!;
        expect(handler).toBeDefined();

        const events = handler(buildCtx(state, 'paladin-vengeance-select-player'));

        const interactions = eventsOfType(events, 'INTERACTION_REQUESTED');
        expect(interactions).toHaveLength(1);

        const interaction = (interactions[0] as any).payload.interaction;
        expect(interaction.type).toBe('selectPlayer');
        expect(interaction.titleKey).toBe('interaction.selectPlayerForRetribution');
        expect(interaction.selectCount).toBe(1);
        expect(interaction.targetPlayerIds).toEqual(['0', '1']);
        expect(interaction.tokenGrantConfig).toEqual({
            tokenId: TOKEN_IDS.RETRIBUTION,
            amount: 1,
        });
    });

    it('targetPlayerIds 包含所有玩家（支持多人）', () => {
        const state = createState();
        const handler = getCustomActionHandler('paladin-vengeance-select-player')!;
        const events = handler(buildCtx(state, 'paladin-vengeance-select-player'));

        const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
        // 确保包含自己和对手
        expect(interaction.targetPlayerIds).toContain('0');
        expect(interaction.targetPlayerIds).toContain('1');
    });

    it('复仇 II 主变体使用 custom action 而非直接 grantToken', () => {
        const mainVariant = VENGEANCE_2.variants![1];
        expect(mainVariant.effects[0].action.type).toBe('custom');
        expect(mainVariant.effects[0].action.customActionId).toBe('paladin-vengeance-select-player');
    });

});