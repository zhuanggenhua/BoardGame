import { describe, expect, it } from 'vitest';
import {
    resolveMapObjectInteraction,
    resolveMapObjectMonsterSelectionEligibility,
} from '../mapObjectInteractionModel';

const ordinaryActions = [
    { id: 'move', label: '移动' },
    { id: 'explore', label: '探索' },
];

const baseInput = {
    formalActionItems: ordinaryActions,
    visibleActionItems: [
        ...ordinaryActions,
        { id: 'endTurn', label: '结束回合' },
    ],
    interactionMode: 'default' as const,
    isViewerTurn: true,
    visualBusy: false,
    hasPendingDecision: false,
    isExclusiveMonsterTurn: false,
    isDeadControlledMonster: false,
    hasLegalMoveTargets: true,
};

const baseMonsterSelectionInput = {
    interactionMode: 'default' as const,
    isViewerTurn: true,
    visualBusy: false,
    hasPendingDecision: false,
    isHelpingHandsMonsterTurnController: false,
};

describe('map object action ownership', () => {
    it('keeps an idle dock free of unavailable trade and unselected use placeholders', () => {
        const actions = [...ordinaryActions, { id: 'trade', label: '交易', disabled: true }, { id: 'use', label: '使用' }, { id: 'endTurn', label: '结束回合' }];
        const result = resolveMapObjectInteraction({ ...baseInput, formalActionItems: actions, visibleActionItems: actions });
        expect(result.dockActions.map(action => action.id)).toEqual(['endTurn']);
    });

    it('only exposes a use or trade confirmation for its selected context, preserving special haunt actions', () => {
        const actions = [{ id: 'trade', label: '提交交易', disabled: true }, { id: 'use', label: '使用' }, { id: 'endTurn', label: '结束回合' }];
        const resolve = (extra: object) => resolveMapObjectInteraction({ ...baseInput, formalActionItems: actions, visibleActionItems: actions, ...extra });
        expect(resolve({ hasInventorySelection: true }).dockActions.map(action => action.id)).toEqual(['use', 'endTurn']);
        expect(resolve({ hasTradeSelection: true }).dockActions.map(action => action.id)).toEqual(['trade', 'endTurn']);
        expect(resolve({ hasHauntAction: true, hasSicknessExchangeAction: true }).dockActions.map(action => action.id)).toEqual(['trade', 'use', 'endTurn']);

    });

    it('retains an available trade entry so inspecting a pawn does not silently change into trading', () => {
        const result = resolveMapObjectInteraction({ ...baseInput, visibleActionItems: [{ id: 'trade', label: '交易', disabled: false }] });
        expect(result.dockActions.map(action => action.id)).toEqual(['trade']);
    });

    it('uses formal ordinary actions even when the dock filters them out', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            visibleActionItems: [{ id: 'endTurn', label: '结束回合' }],
        });

        expect(result.canSelectExplorer).toBe(true);
        expect(result.canExplore).toBe(true);
        expect(result.canMoveToRoom).toBe(true);
        expect(result.dockActions.map((action) => action.id)).toEqual(['endTurn']);
    });

    it('lets the default current actor move directly and removes movement actions from the dock', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            visibleActionItems: [
                { id: 'move', label: '移动' },
                { id: 'monsterMove', label: '移动木乃伊' },
                { id: 'explore', label: '探索' },
                { id: 'monsterMovementRoll', label: '木乃伊移动骰' },
                { id: 'endTurn', label: '结束回合' },
            ],
        });

        expect(result.canMoveToRoom).toBe(true);
        expect(result.dockActions.map((action) => action.id)).toEqual([
            'monsterMovementRoll',
            'endTurn',
        ]);
    });

    it('does not advertise disabled commands, other turns, blocked decisions or animations', () => {
        for (const override of [
            { isViewerTurn: false },
            { visualBusy: true },
            { hasPendingDecision: true },
            { interactionMode: 'trade' as const },
            { formalActionItems: ordinaryActions.map((action) => ({ ...action, disabled: true })) },
        ]) {
            const result = resolveMapObjectInteraction({ ...baseInput, ...override });
            expect(result.canSelectExplorer).toBe(false);
            expect(result.canExplore).toBe(false);
        }
    });

    it('gates direct monster selection by the viewer turn or the Helping Hands controller', () => {
        expect(
            resolveMapObjectMonsterSelectionEligibility(baseMonsterSelectionInput)
                .canSelectMonsterMoveMonster,
        ).toBe(true);
        for (const override of [
            { isViewerTurn: false },
            { visualBusy: true },
            { hasPendingDecision: true },
            { interactionMode: 'trade' as const },
        ]) {
            const result = resolveMapObjectMonsterSelectionEligibility({
                ...baseMonsterSelectionInput,
                ...override,
            });
            expect(result.canSelectMonsterMoveMonster).toBe(false);
        }

        const helpingHandsController = resolveMapObjectMonsterSelectionEligibility({
            ...baseMonsterSelectionInput,
            isViewerTurn: false,
            isHelpingHandsMonsterTurnController: true,
        });
        expect(helpingHandsController.canSelectHelpingHandsMonsterMoveMonster).toBe(true);

        for (const override of [
            { isHelpingHandsMonsterTurnController: false },
            { isHelpingHandsMonsterTurnController: true, visualBusy: true },
            { isHelpingHandsMonsterTurnController: true, hasPendingDecision: true },
        ]) {
            const result = resolveMapObjectMonsterSelectionEligibility({
                ...baseMonsterSelectionInput,
                isViewerTurn: false,
                ...override,
            });
            expect(result.canSelectHelpingHandsMonsterMoveMonster).toBe(false);
        }
    });

    it('keeps normal move and explore available beside a standard monster action panel', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            visibleActionItems: [
                { id: 'monsterMove', label: '移动木乃伊' },
                { id: 'endTurn', label: '结束回合' },
            ],
        });

        expect(result.canSelectExplorer).toBe(true);
        expect(result.canExplore).toBe(true);
        expect(result.dockActions.map((action) => action.id)).toEqual(['endTurn']);
    });

    it('blocks ordinary movement and exploration in exclusive monster turns but preserves their special controls', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            visibleActionItems: [
                { id: 'move', label: '移动巨魔手' },
                { id: 'use', label: '攻击' },
                { id: 'endTurn', label: '结束巨魔手回合' },
            ],
            isExclusiveMonsterTurn: true,
        });

        expect(result.canSelectExplorer).toBe(false);
        expect(result.canExplore).toBe(false);
        expect(result.dockActions.map((action) => action.id)).toEqual(['use', 'endTurn']);
    });

    it('allows controlled dead-token movement from the map without granting exploration', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            interactionMode: 'default',
            visibleActionItems: [
                { id: 'move', label: '移动杰克之灵' },
                { id: 'endTurn', label: '结束回合' },
            ],
            isDeadControlledMonster: true,
        });

        expect(result.canSelectExplorer).toBe(false);
        expect(result.canExplore).toBe(false);
        expect(result.canMoveToRoom).toBe(true);
        expect(result.dockActions.map((action) => action.id)).toEqual(['endTurn']);
    });

    it('does not let a turn-end discovery flag leak ordinary map movement', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            formalActionItems: ordinaryActions.map((action) => ({
                ...action,
                disabled: action.id === 'move',
            })),
        });

        expect(result.canSelectExplorer).toBe(false);
        expect(result.canMoveToRoom).toBe(false);
    });

    it('does not keep target selection active when no legal map targets remain', () => {
        const result = resolveMapObjectInteraction({
            ...baseInput,
            interactionMode: 'move',
            hasLegalMoveTargets: false,
        });

        expect(result.canSelectExplorer).toBe(false);
        expect(result.canMoveToRoom).toBe(false);
    });
});
