import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { createInitialCore } from '../domain/initialCoreSetup';
import {
    buildQidahenOpenGateSurrenderSelection,
    buildQidahenOpenGateSurrenderTroopChoices,
    resolveQidahenOpenGateSurrenderInteraction,
} from '../domain/openGateSurrenderSelection';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';
import { syncQidahenCorePieceCollections } from '../domain/coreDerivedState';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenHandCard,
} from '../domain/types';

const random: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const setInPlayCharacters = (
    core: QidahenCore,
    factionId: QidahenFactionId,
    count: number,
) => {
    core.factions[factionId].characters = core.factions[factionId].characters.map((character, index) => ({
        ...character,
        inPlay: index < count,
        removedFromGame: false,
    }));
};

const prepareCore = (
    ownerFactionId: 'jin' | 'ming',
    jinCharacterCount: number,
    jinTroopCount: number,
): { core: QidahenCore; eventCard: QidahenHandCard } => {
    const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
    setInPlayCharacters(core, 'jin', jinCharacterCount);
    setInPlayCharacters(core, 'ming', 2);
    setInPlayCharacters(core, 'mongol', 2);
    const sourceCard = core.handCards.find((card) => card.faction === ownerFactionId)!;
    const eventCard: QidahenHandCard = {
        ...sourceCard,
        id: `${ownerFactionId}-open-gate-surrender`,
        label: '开门迎降',
        faction: ownerFactionId,
        accent: ownerFactionId,
        status: 'payable',
        cardKind: 'event',
        armamentId: null,
        cardDefId: 'qidahen-atlas05-1621-power-struggle-coup',
        rulesSummary: '第一项、第二项可都执行或择一执行；使用后移出游戏。',
    };
    core.handCards = [
        eventCard,
        ...core.handCards.filter((card) => card.id !== sourceCard.id),
    ];
    core.currentPlayer = core.factions[ownerFactionId].playerId;
    core.regions = core.regions.map((region) => {
        if (region.id === 'city-region-25') {
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
                troops: jinTroopCount,
                specialTroops: jinTroopCount > 0
                    ? [{
                        id: 'open-gate-jin-infantry',
                        label: '后金步兵',
                        faction: 'jin' as const,
                        troopKind: 'infantry' as const,
                        count: 1,
                        level: 2,
                        pieceIds: ['open-gate-jin-infantry-1'],
                    }]
                    : [],
                cityState: null,
                siegeState: null,
            };
        }
        return {
            ...region,
            troops: 0,
            specialTroops: [],
            cityState: null,
            siegeState: null,
        };
    });
    return {
        core: syncQidahenCorePieceCollections(core),
        eventCard,
    };
};

const startSelection = (
    core: QidahenCore,
    ownerFactionId: 'jin' | 'ming',
    eventCard: QidahenHandCard,
): QidahenCore => {
    const selection = buildQidahenOpenGateSurrenderSelection(
        core,
        ownerFactionId,
        eventCard,
        [eventCard.id],
    );
    expect(selection).not.toBeNull();
    return {
        ...core,
        turnPhase: 'open-gate-surrender',
        openGateSurrenderSelection: selection,
    };
};

const countJinTroops = (core: QidahenCore) => (
    buildQidahenOpenGateSurrenderTroopChoices(core).length
);

const stateOf = (core: QidahenCore): MatchState<QidahenCore> => (
    syncQidahenRuntimeInteractionState({
        core,
        sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
    })
);

const execute = (
    state: MatchState<QidahenCore>,
    command: Command,
): ReturnType<typeof executePipeline<QidahenCore>> => (
    executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        state,
        command,
        random,
        ['0', '1', '2'],
    )
);

const respond = (
    state: MatchState<QidahenCore>,
    playerId: string,
    args: { optionId?: string; optionIds?: string[] },
) => execute(state, {
    type: 'SYS_INTERACTION_RESPOND',
    playerId,
    payload: {
        interactionId: state.sys.interaction?.current?.id,
        ...args,
    },
});

describe('开门迎降', () => {
    it('只执行第一项时可一张人物都不弃；兵力不足则弃尽全部可用部队', () => {
        const { core, eventCard } = prepareCore('jin', 2, 3);
        let resolved = startSelection(core, 'jin', eventCard);

        resolved = resolveQidahenOpenGateSurrenderInteraction(
            resolved,
            ['jin-effect'],
            100,
        );
        expect(resolved.openGateSurrenderSelection?.phase).toBe('jin-characters');

        resolved = resolveQidahenOpenGateSurrenderInteraction(
            resolved,
            [],
            101,
        );
        expect(resolved.openGateSurrenderSelection).toMatchObject({
            phase: 'jin-troops',
            rawRequiredJinTroopLoss: 4,
            requiredJinTroopLoss: 3,
        });

        const troopIds = buildQidahenOpenGateSurrenderTroopChoices(resolved).map((choice) => choice.id);
        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, troopIds, 102);

        expect(resolved.openGateSurrenderSelection).toBeNull();
        expect(resolved.handCards.some((card) => card.id === eventCard.id)).toBe(false);
        expect(resolved.discardPileCount).toBe(core.discardPileCount);
        expect(countJinTroops(resolved)).toBe(0);
        expect(resolved.factions.jin.characters.filter((character) => character.inPlay)).toHaveLength(2);
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('场上只有 3 个，因此弃尽全部可用部队');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('开门迎降使用后移出游戏');
    });

    it('只执行第一项时可弃掉部分后金人物，并按剩余人物数选择具体兵牌', () => {
        const { core, eventCard } = prepareCore('jin', 2, 4);
        const originalCharacters = core.factions.jin.characters.filter((character) => character.inPlay);
        let resolved = startSelection(core, 'jin', eventCard);
        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, ['jin-effect'], 200);
        resolved = resolveQidahenOpenGateSurrenderInteraction(
            resolved,
            [originalCharacters[0].id],
            201,
        );

        expect(resolved.openGateSurrenderSelection).toMatchObject({
            phase: 'jin-troops',
            rawRequiredJinTroopLoss: 2,
            requiredJinTroopLoss: 2,
        });
        const troopIds = buildQidahenOpenGateSurrenderTroopChoices(resolved)
            .slice(0, 2)
            .map((choice) => choice.id);
        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, troopIds, 202);

        expect(resolved.factions.jin.characters.find((character) => character.id === originalCharacters[0].id)?.inPlay).toBe(false);
        expect(resolved.factions.jin.characters.find((character) => character.id === originalCharacters[1].id)?.inPlay).toBe(true);
        expect(countJinTroops(resolved)).toBe(2);
    });

    it('两项都执行时先允许后金弃尽人物，再由大明选择派系弃掉全部在场人物', () => {
        const { core, eventCard } = prepareCore('jin', 2, 4);
        const jinCharacterIds = core.factions.jin.characters
            .filter((character) => character.inPlay)
            .map((character) => character.id);
        let resolved = startSelection(core, 'jin', eventCard);
        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, ['both'], 300);
        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, jinCharacterIds, 301);

        expect(resolved.openGateSurrenderSelection).toMatchObject({
            phase: 'ming-faction',
            requiredJinTroopLoss: 0,
        });
        expect(countJinTroops(resolved)).toBe(4);

        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, ['mongol'], 302);
        expect(resolved.openGateSurrenderSelection).toBeNull();
        expect(resolved.factions.jin.characters.some((character) => character.inPlay)).toBe(false);
        expect(resolved.factions.mongol.characters.some((character) => character.inPlay)).toBe(false);
        expect(resolved.factions.ming.characters.filter((character) => character.inPlay)).toHaveLength(2);
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('选择依次执行第一项和第二项效果');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('大明选择蒙古，弃掉该派系全部 2 张在场人物');
    });

    it('大明使用时效果相同，可只执行第二项并选择后金弃掉全部人物', () => {
        const { core, eventCard } = prepareCore('ming', 2, 2);
        let resolved = startSelection(core, 'ming', eventCard);
        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, ['ming-effect'], 400);
        expect(resolved.openGateSurrenderSelection?.phase).toBe('ming-faction');

        resolved = resolveQidahenOpenGateSurrenderInteraction(resolved, ['jin'], 401);
        expect(resolved.openGateSurrenderSelection).toBeNull();
        expect(resolved.factions.jin.characters.some((character) => character.inPlay)).toBe(false);
        expect(resolved.handCards.some((card) => card.id === eventCard.id)).toBe(false);
        expect(resolved.discardPileCount).toBe(core.discardPileCount);
    });

    it('运行时按阶段把操作权交给出牌者、后金和大明，错误席位不能响应', () => {
        const { core, eventCard } = prepareCore('ming', 1, 2);
        let state = stateOf(startSelection(core, 'ming', eventCard));
        expect(state.sys.interaction?.current?.playerId).toBe(core.factions.ming.playerId);

        let result = respond(state, core.factions.ming.playerId, { optionId: 'both' });
        expect(result.success).toBe(true);
        state = result.state;
        expect(state.core.openGateSurrenderSelection?.phase).toBe('jin-characters');
        expect(state.sys.interaction?.current?.playerId).toBe(core.factions.jin.playerId);

        result = respond(state, core.factions.ming.playerId, { optionIds: [] });
        expect(result.success).toBe(false);

        result = respond(state, core.factions.jin.playerId, { optionIds: [] });
        expect(result.success).toBe(true);
        state = result.state;
        expect(state.core.openGateSurrenderSelection?.phase).toBe('jin-troops');
        expect(state.sys.interaction?.current?.playerId).toBe(core.factions.jin.playerId);

        const troopIds = buildQidahenOpenGateSurrenderTroopChoices(state.core)
            .slice(0, 2)
            .map((choice) => choice.id);
        result = respond(state, core.factions.jin.playerId, { optionIds: troopIds });
        expect(result.success).toBe(true);
        state = result.state;
        expect(state.core.openGateSurrenderSelection?.phase).toBe('ming-faction');
        expect(state.sys.interaction?.current?.playerId).toBe(core.factions.ming.playerId);

        result = respond(state, core.factions.jin.playerId, { optionId: 'mongol' });
        expect(result.success).toBe(false);
        result = respond(state, core.factions.ming.playerId, { optionId: 'mongol' });
        expect(result.success).toBe(true);
        expect(result.state.core.openGateSurrenderSelection).toBeNull();
    });
});
