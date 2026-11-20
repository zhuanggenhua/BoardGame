import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../../engine/systems/InteractionSystem';
import type { MatchState, TutorialAiAction, TutorialCollection, TutorialManifest, TutorialStepSnapshot } from '../../engine/types';
import { MAGE_WARS_COMMANDS as commands, MAGE_WARS_EVENTS as events, type MageWarsCore } from './domain';
import { MAGE_WARS_MAGE_ABILITY_IDS, MAGE_WARS_OBJECT_ABILITY_IDS, STATUS_TOKEN_IDS } from './domain/ids';
import { buildMageWarsCoursePasses, isMageWarsCourseGoal, type MageWarsCourseGoal } from './tutorialCourseFlow';
import { MAGE_WARS_TUTORIAL_PLAYER as learner, MAGE_WARS_TUTORIAL_UNICORN as unicorn, MAGE_WARS_TUTORIAL_WOLF as wolf } from './tutorialStart';

const secondWolf = 'mwobj-0-2819-2';
const cleric = 'mwobj-1-2811-1';
const wand = 'mwobj-0-3725-1';
const lair = 'mwobj-0-2218-1';
const bow = 'mwobj-1-3722-1';
const field = (objectId: string) => `mw-arena-object-${objectId}`;
const prepared = (id: number) => `mw-prepared-card-${id}`;
const zone = (id: string) => `mw-zone-${id}`;
const mage = (id: string) => `mw-mage-entity-${id}`;
const action = (commandType: string, playerId: string, payload = {}): TutorialAiAction => ({ commandType, playerId, payload });
const advance = (playerId: string) => action(FLOW_COMMANDS.ADVANCE_PHASE, playerId);
const text = (id: string) => `game-mage-wars:tutorial.singleMatch.${id}`;

type MageWarsTutorialSelection = {
    selectedObjectId: string | null;
    selectedMageId: string | null;
    selectedSpellCardId: number | null;
    plannedSpells: readonly number[];
    pendingAnimation: boolean;
};

export function getMageWarsTutorialPresentation(
    step: TutorialStepSnapshot | null | undefined,
    { selectedObjectId, selectedMageId, selectedSpellCardId, plannedSpells, pendingAnimation }: MageWarsTutorialSelection,
): TutorialStepSnapshot | undefined {
    if (step?.id === 'guard-wolf' && selectedObjectId === wolf) {
        return {
            ...step,
            content: text('confirm-guard-wolf'),
            tooltipAnchorTarget: 'mw-selected-unit-guard',
            tooltipArrow: 'anchor',
            hideActionHint: true,
        };
    }
    if (step?.id === 'heal-wolf' && pendingAnimation) {
        return {
            ...step,
            content: text('observe-healing-roll'),
            highlightTarget: field(wolf),
            hideActionHint: true,
            avoidOverlapSelectors: [
                '[data-testid="mage-wars-fx-healing-number"]',
                '[data-testid="mage-wars-fx-attack-dice-content"]',
                '[data-testid="mage-wars-fx-attack-dice-summary"]',
                '[data-tutorial-id="mw-self-hud"]',
                '[data-tutorial-id="mw-phase-progress"]',
                '[data-tutorial-id="mw-spellbook"]',
            ],
        };
    }
    if (step?.id === 'heal-wolf' && selectedSpellCardId === 3402) {
        return {
            ...step,
            content: text('choose-heal-target'),
            highlightTarget: field(wolf),
            tooltipAnchorTarget: field(wolf),
            tooltipArrow: 'anchor',
            hideActionHint: true,
        };
    }
    if (step?.id === 'plan-summon' && plannedSpells.includes(2819) && plannedSpells.includes(3403)) {
        return { ...step, content: text('confirm-summon-plan'), hideActionHint: true };
    }
    const [source, destination] = step?.allowedTargets ?? [];
    if (step && source && destination && !pendingAnimation) {
        const isSpellTarget = selectedSpellCardId !== null && source === prepared(selectedSpellCardId);
        const isMoveTarget = (step.allowedCommands?.includes(commands.MOVE_MAGE) && selectedMageId !== null && source === mage(selectedMageId))
            || (step.allowedCommands?.includes(commands.MOVE_ARENA_OBJECT) && selectedObjectId !== null && source === field(selectedObjectId));
        if (isSpellTarget || isMoveTarget) {
            return {
                ...step,
                content: step.id === 'summon-second-wolf' ? text('choose-summon-zone') : step.content,
                highlightTarget: destination,
                tooltipArrow: 'anchor',
                hideActionHint: true,
            };
        }
    }
    if (step?.aiActions?.length && !step.requireAction) {
        return { ...step, requireAction: true, hideActionHint: true };
    }
    return undefined;
}

const activation = (id: string, highlightTarget: string | undefined, command: string, event: string, match?: Record<string, unknown>): TutorialStepSnapshot => ({
    id, content: text(id), highlightTarget, position: 'top', requireAction: true,
    allowedCommands: [command], advanceOnEvents: [{ type: event, ...(match ? { match } : {}) }],
});
const targets = (step: TutorialStepSnapshot, ...ids: string[]): TutorialStepSnapshot => ({ ...step, allowedTargets: ids });
const cast = (id: string, cardId: number, targetIds: string[], event: string = events.SPELL_CAST_RESOLVED) => targets(
    activation(id, prepared(cardId), commands.CAST_SPELL, event, event === events.SPELL_CAST_RESOLVED ? { spellCardId: cardId } : undefined),
    prepared(cardId), ...targetIds,
);
const explain = (id: string, highlightTarget?: string): TutorialStepSnapshot => ({
    id, content: text(id), highlightTarget, position: 'top', infoStep: true,
});
const opponent = (id: string, actions: TutorialAiAction[], event: string, highlightTarget?: string, match?: Record<string, unknown>): TutorialStepSnapshot => ({
    ...explain(id, highlightTarget),
    allowedCommands: [...new Set(actions.map((item) => item.commandType))],
    aiActions: actions, aiDelayMs: 450,
    advanceOnEvents: [{ type: event, ...(match ? { match } : {}) }],
});
const respond = (id: string, sourceId: string): TutorialStepSnapshot => ({
    ...activation(id, 'mw-interaction-options', INTERACTION_COMMANDS.RESPOND, INTERACTION_EVENTS.RESOLVED, { sourceId }),
    position: 'bottom', hideActionHint: true,
});
const legend = (id: string, highlightTarget: string, src: string, key: string): TutorialStepSnapshot => ({
    ...explain(id, highlightTarget),
    visual: { src, alt: `game-mage-wars:tutorial.visuals.${key}Alt`, caption: `game-mage-wars:tutorial.visuals.${key}Caption` },
});
const hudReadingRegions = [
    '[data-testid="fab-menu"] button[data-fab-id]',
    '[data-testid="fab-panel-settings"]',
    '[data-testid="fab-panel-action-log"]',
];
const animated = (step: TutorialStepSnapshot): TutorialStepSnapshot => ({ ...step, waitForAnimation: true });
const finishAction = (id: string, phase: string) => activation(
    id, 'mw-turn-end', FLOW_COMMANDS.ADVANCE_PHASE, events.PHASE_WINDOW_COMPLETED, { phase, playerId: '0' },
);

const plans = new Map<string, readonly number[]>();
const links = new Map<string, { goal: MageWarsCourseGoal; plans?: Record<string, number[]> }>();
const phaseTransitions = {
    planning: 'course-to-planning',
    deployment: 'course-to-deployment',
    initiativeQuickcast: 'course-to-quickcast',
    creatureAction: 'course-to-action',
    upkeep: 'course-to-upkeep',
};
const plan = (id: string, ...cards: number[]): TutorialStepSnapshot => {
    plans.set(id, cards);
    return {
        ...activation(id, 'mw-spellbook', commands.PLAN_SPELLS, events.SPELLS_PLANNED, { playerId: '0' }),
        allowedTargets: [
            ...cards.map((card) => `mw-spellbook-card-${card}`),
            ...['all', 'attack', 'enchantment', 'creature', 'incantation', 'equipment'].map((key) => `mw-spellbook-category-${key}`),
            'mw-spellbook-next-page', 'mw-spellbook-previous-page', 'mw-plan-spells',
        ],
    };
};
const link = (id: string, round: number, phase: keyof typeof phaseTransitions, actor?: string, plansForRound?: Record<string, number[]>): TutorialStepSnapshot => {
    links.set(id, { goal: { round, phase, actor }, plans: plansForRound });
    return {
        ...explain(id, 'mw-stage'), content: text(phaseTransitions[phase]), allowedCommands: [
            commands.PLAN_SPELLS, commands.CREATURE_NO_ACTION, FLOW_COMMANDS.ADVANCE_PHASE,
        ],
        aiDelayMs: 0,
    };
};
export const getMageWarsTutorialPlan = (stepId: string | undefined) => stepId ? plans.get(stepId) : undefined;

const dialogue: TutorialStepSnapshot[] = [
    {
        ...targets(activation('guard-wolf', field(wolf), commands.GUARD, events.GUARD_GAINED, { targetObjectId: wolf }), field(wolf)),
        avoidOverlapSelectors: [
            `[data-tutorial-id="${mage(learner)}"]`,
            `[data-tutorial-object-id="${field(unicorn)}"]`,
            '[data-tutorial-id="mw-selected-unit-guard"]',
            '[data-tutorial-id="mw-phase-progress"]',
            '[data-tutorial-id="mw-spellbook"]',
            '.mw-phase-tooltip',
        ],
    },
    animated({ ...cast('heal-wolf', 3402, [field(wolf)], events.SPELL_HEALING_ROLLED), randomPolicy: { mode: 'sequence', values: [2, 2, 2, 2, 1] } }),
    explain('healing-result', field(wolf)),
    animated(opponent('unicorn-attacks', [advance('0'), action(commands.DECLARE_OBJECT_ATTACK, '1', {
        attackerObjectId: unicorn, attackProfileId: 'attack-0', targetObjectId: wolf,
    })], events.COUNTERSTRIKE_AVAILABLE, field(wolf))),
    animated(respond('guard-response', 'mw.counterstrike.choice')),
    opponent('enemy-turn-ends', [advance('1')], events.PHASE_WINDOW_COMPLETED, 'mw-stage', { phase: 'creatureAction' }),
    activation('pass-final', 'mw-turn-end', FLOW_COMMANDS.ADVANCE_PHASE, events.TURN_ADVANCED),
    link('reach-round-six', 6, 'planning'),
    explain('check-discard', 'mw-discard'),
    {
        ...legend('spell-card-reading', 'mw-spellbook', 'mage-wars/references/compressed/spell-card-legend', 'spellCardLegend'),
        avoidOverlapSelectors: hudReadingRegions,
    },
    plan('plan-summon', 2819, 3403),
    link('reach-deploy', 6, 'deployment', '0'),
    finishAction('pass-deploy', 'deployment'),
    link('reach-priority', 6, 'initiativeQuickcast', '0'),
    finishAction('pass-priority', 'initiativeQuickcast'),
    opponent('unicorn-retreats', [action(commands.MOVE_ARENA_OBJECT, '1', { objectId: unicorn, toZoneId: 'a2' }), advance('1')],
        events.PHASE_WINDOW_COMPLETED, field(unicorn), { phase: 'creatureAction', playerId: '1' }),
    targets(activation('pursue-unicorn', field(wolf), commands.MOVE_ARENA_OBJECT, events.ARENA_OBJECT_MOVED, { objectId: wolf, toZoneId: 'a2' }), field(wolf), zone('a2')),
    legend('attack-bar-reading', field(wolf), 'mage-wars/references/attack-bar-legend', 'attackBarLegend'),
    animated(targets(activation('bite-unicorn', field(unicorn), commands.DECLARE_OBJECT_ATTACK, events.ARENA_OBJECT_ATTACK_DECLARED, { attackerObjectId: wolf }), field(wolf), field(unicorn))),
    finishAction('end-wolf-action', 'creatureAction'),
    opponent('priestess-moves', [action(commands.MOVE_MAGE, '1', { toZoneId: 'c1' }), advance('1')],
        events.PHASE_WINDOW_COMPLETED, 'mw-mage-entity-1', { phase: 'creatureAction', playerId: '1' }),
    animated(cast('summon-second-wolf', 2819, [zone('a3')], events.ARENA_OBJECT_SUMMONED)),
    cast('rouse-second-wolf', 3403, [field(secondWolf)], events.ARENA_OBJECT_ROUSED),
    finishAction('end-summon-action', 'creatureAction'),
    targets(activation('move-new-wolf', field(secondWolf), commands.MOVE_ARENA_OBJECT, events.ARENA_OBJECT_MOVED, { objectId: secondWolf, toZoneId: 'b3' }), field(secondWolf), zone('b3')),
    finishAction('end-new-wolf-action', 'creatureAction'),
    link('prepare-wall-round', 7, 'planning'),
    plan('plan-wall-and-push', 25700, 3425),
    link('reach-wall-turn', 7, 'creatureAction', '0'),
    targets(activation('move-for-wall', mage('0'), commands.MOVE_MAGE, events.MAGE_MOVED, { playerId: '0', toZoneId: 'a2' }), mage('0'), zone('a2')),
    cast('place-wall', 25700, ['mw-wall-edge-b1-b2'], events.WALL_SUMMONED),
    opponent('priestess-nears-wall', [advance('0'), action(commands.MOVE_MAGE, '1', { toZoneId: 'b1' }), advance('1')],
        events.PHASE_WINDOW_COMPLETED, 'mw-mage-entity-1', { phase: 'creatureAction', playerId: '1' }),
    targets(activation('skip-wolf-action', field(wolf), commands.CREATURE_NO_ACTION, events.CREATURE_NO_ACTION, { objectId: wolf }),
        field(wolf), 'mw-turn-end'),
    explain('pass-repeated-windows', 'mw-stage'),
    link('prepare-push-round', 8, 'planning'),
    plan('plan-push', 3425),
    link('reach-push-turn', 8, 'creatureAction', '0'),
    targets(activation('move-for-push', mage('0'), commands.MOVE_MAGE, events.MAGE_MOVED, { playerId: '0', toZoneId: 'a1' }), mage('0'), zone('a1')),
    animated({
        ...cast('push-through-wall', 3425, [mage('1'), zone('b2')], events.SPELL_PUSH_RESOLVED),
        randomPolicy: { mode: 'sequence', values: [1, 1, 6, 6, 3, 3, 3, 3, 3, 3] },
    }),
    explain('wall-rolls', 'mw-wall-edge-b1-b2'),
    link('prepare-counter-round', 9, 'planning'),
    plan('plan-ward', 1901),
    link('reach-hidden-ward', 9, 'initiativeQuickcast', '0', { '1': [3411] }),
    cast('set-ward', 1901, [field(wolf)]),
    opponent('opponent-casts-sleep', [advance('0'), action(commands.CAST_SPELL, '1', { spellCardId: 3411, manaCost: 5, targetObjectId: wolf })],
        events.ENCHANTMENT_RESPONSE_REQUIRED, field(wolf)),
    respond('pay-counter', 'mw.enchantment-response.reveal'),
    link('prepare-armor-round', 10, 'planning'),
    { ...plan('plan-armor', 3711), avoidOverlapSelectors: hudReadingRegions },
    link('reach-armor-window', 10, 'initiativeQuickcast', '0', { '1': [2811] }),
    cast('equip-armor', 3711, [mage('0')]),
    opponent('opponent-summons-cleric', [advance('0'), action(commands.CAST_SPELL, '1', {
        spellCardId: 2811, manaCost: 5, targetZoneId: 'b2',
    })], events.ARENA_OBJECT_SUMMONED, 'mw-zone-b2'),
    link('reach-approach-turn', 10, 'creatureAction', '0'),
    targets(activation('approach-cleric', mage('0'), commands.MOVE_MAGE, events.MAGE_MOVED, { playerId: '0', toZoneId: 'a2' }), mage('0'), zone('a2')),
    link('prepare-fountain-round', 11, 'planning'),
    plan('plan-fountain', 1710),
    link('reach-fountain-window', 11, 'initiativeQuickcast', '0'),
    animated({ ...cast('cast-fountain', 1710, [field(cleric)], events.SPELL_ATTACK_ROLLED), randomPolicy: { mode: 'sequence', values: [3, 3, 3, 11] } }),
    opponent('restore-cleric', [advance('0'), action(commands.USE_MAGE_ABILITY, '1', {
        abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK, manaCost: 2,
        targetObjectId: cleric, statusTokenIds: [STATUS_TOKEN_IDS.DAZE],
    })], events.MAGE_ABILITY_RESOLVED, field(cleric)),
    link('reach-cleric-heal', 11, 'creatureAction', '1'),
    opponent('cleric-heals-unicorn', [action(commands.USE_ARENA_OBJECT_ABILITY, '1', {
        abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT, objectId: cleric, manaCost: 0,
        targetObjectId: unicorn,
    }), advance('1')], events.PHASE_WINDOW_COMPLETED, field(unicorn), { phase: 'creatureAction', playerId: '1' }),
    link('reach-unicorn-wound', 11, 'creatureAction', '1'),
    animated({
        ...opponent('unicorn-wounds-wolf', [action(commands.DECLARE_OBJECT_ATTACK, '1', {
            attackerObjectId: unicorn, attackProfileId: 'attack-0', targetObjectId: wolf,
        })], events.ARENA_OBJECT_ATTACK_DECLARED, field(wolf), { attackerObjectId: unicorn }),
        randomPolicy: { mode: 'sequence', values: [6, 6, 6] },
    }),
    link('prepare-wand-round', 12, 'planning'),
    plan('plan-wand', 3725),
    link('reach-wand-window', 12, 'initiativeQuickcast', '0'),
    cast('bind-wand', 3725, [mage('0'), 'mw-bound-card-3408']),
    link('reach-first-bound-cast', 13, 'initiativeQuickcast', '0', { '1': [1815] }),
    animated(targets(activation('cast-bound-major-heal', field(wand), commands.CAST_SPELL, events.SPELL_HEALING_ROLLED),
        field(wand), field(wolf))),
    targets(activation('rebind-wand', field(wand), commands.USE_ARENA_OBJECT_ABILITY, events.ARENA_OBJECT_ABILITY_RESOLVED), field(wand), 'mw-bound-card-3402'),
    opponent('attach-essence-drain', [advance('0'), action(commands.CAST_SPELL, '1', {
        spellCardId: 1815, manaCost: 6, targetObjectId: secondWolf,
    })], events.SPELL_CAST_RESOLVED, field(secondWolf), { spellCardId: 1815 }),
    link('reach-unicorn-bite', 13, 'creatureAction', '1'),
    animated(opponent('unicorn-bites-wolf', [action(commands.DECLARE_OBJECT_ATTACK, '1', {
        attackerObjectId: unicorn, attackProfileId: 'attack-0', targetObjectId: wolf,
    })], events.ARENA_OBJECT_ATTACK_DECLARED, field(wolf), { attackerObjectId: unicorn })),
    link('reach-first-upkeep', 14, 'upkeep'),
    respond('first-upkeep', 'mw.upkeep-cost.choice'),
    plan('plan-lair', 2218),
    link('reach-lair-window', 14, 'initiativeQuickcast', '0'),
    cast('place-lair', 2218, [zone('a2')], events.ARENA_OBJECT_SUMMONED),
    link('reach-lair-planning', 15, 'planning'),
    respond('second-upkeep', 'mw.upkeep-cost.choice'),
    targets(
        activation('plan-lair-fox', field(lair), commands.PLAN_OBJECT_SPELL, events.OBJECT_SPELL_PLANNED, { objectId: lair, spellCardId: 2812 }),
        field(lair), 'mw-spellbook-card-2812', 'mw-spellbook-category-all', 'mw-spellbook-category-creature',
        'mw-spellbook-next-page', 'mw-spellbook-previous-page',
    ),
    link('reach-lair-deployment', 15, 'deployment', '0', { '1': [3722] }),
    animated(targets(activation('deploy-fox', field(lair), commands.CAST_SPELL, events.ARENA_OBJECT_SUMMONED), field(lair), zone('a2'))),
    link('reach-bound-cast', 15, 'initiativeQuickcast', '0'),
    animated(targets(activation('cast-bound-heal', field(wand), commands.CAST_SPELL, events.SPELL_HEALING_ROLLED),
        field(wand), field(wolf))),
    opponent('opponent-equips-bow', [advance('0'), action(commands.CAST_SPELL, '1', { spellCardId: 3722, manaCost: 8, targetPlayerId: '1' })],
        events.SPELL_CAST_RESOLVED, mage('1'), { spellCardId: 3722 }),
    link('prepare-defense-round', 16, 'planning'),
    opponent('opponent-prepares-spell', [action(commands.PLAN_SPELLS, '1', { spellCardIds: [3408] })],
        events.SPELLS_PLANNED, 'mw-opponent-prepared', { playerId: '1' }),
    explain('opponent-public-view', 'mw-opponent-view-toggle'),
    explain('back-to-self-view', 'mw-back-to-self-view'),
    plan('plan-defense', 1809),
    link('reach-bow-window', 16, 'initiativeQuickcast', '0'),
    cast('grant-wolf-defense', 1809, [field(wolf)]),
    link('reach-bow-attack', 16, 'creatureAction', '1'),
    opponent('bow-attacks', [action(commands.DECLARE_EQUIPMENT_ATTACK, '1', {
        equipmentObjectId: bow, attackProfileId: 'attack-0', targetObjectId: wolf,
    })], events.DEFENSE_AVAILABLE, field(wolf)),
    animated(respond('bow-defense', 'mw.defense.choice')),
    link('reach-final-approach', 16, 'creatureAction', '0'),
    targets(activation('approach-priestess', mage('0'), commands.MOVE_MAGE, events.MAGE_MOVED, { playerId: '0', toZoneId: 'b2' }), mage('0'), zone('b2')),
    link('reach-duel-17', 17, 'creatureAction', '0'),
    animated(targets(
        activation('duel-17', mage('1'), commands.DECLARE_ATTACK, events.ATTACK_DECLARED, { attackerId: '0' }),
        mage('0'), mage('1'),
    )),
    explain('duel-finished', 'mw-board'),
];

export const MageWarsTutorial: TutorialManifest = {
    id: 'mage-wars-basic', revision: 12, playerId: '0', numPlayers: 2,
    allowManualSkip: true, closeOnGameOver: true,
    stayOnMatchAfterCompletion: true, continueWithLocalAiAfterCompletion: true,
    randomPolicy: { mode: 'fixed', values: [3] },
    steps: dialogue,
    resolveStep: (given, step) => {
        const state = given as MatchState<MageWarsCore>;
        const transition = links.get(step.id);
        if (transition) {
            const aiActions = buildMageWarsCoursePasses(state, transition.goal, transition.plans);
            const canCompress =
                state.core.turnNumber >= 6
                && transition.goal.round > 6
                && transition.goal.phase !== 'upkeep'
                && step.id !== 'prepare-wall-round'
                && aiActions.length > 0
                && aiActions.every(({ commandType, playerId }) => playerId !== learner || commandType === FLOW_COMMANDS.ADVANCE_PHASE);
            if (canCompress) {
                return {
                    ...step,
                    infoStep: undefined,
                    highlightTarget: undefined,
                    aiActions,
                    hiddenAutomation: {
                        kind: 'compressed-repeat',
                        reason: '本局已经实际教学计划、部署、快速施法和行动交接。此处仅执行这些阶段的重复交接与对手输入。',
                        equivalentStepIds: ['plan-summon', 'pass-deploy', 'pass-priority', 'end-wolf-action', 'pass-final'],
                    },
                };
            }
            return { ...step, aiActions };
        }
        return step;
    },
    stepValidator: (given, step) => {
        const state = given as MatchState<MageWarsCore>;
        const transition = links.get(step.id);
        if (transition) {
            const waitingForUpkeep = state.core.turnNumber === transition.goal.round
                && state.sys.phase === 'upkeep' && transition.goal.phase === 'planning';
            return !waitingForUpkeep && !isMageWarsCourseGoal(state, transition.goal);
        }
        if (step.id === 'restore-cleric') return Boolean(state.core.objects[cleric]?.statusTokens.daze);
        if (step.id === 'second-upkeep') return state.sys.phase === 'upkeep';
        return true;
    },
};

export const MageWarsTutorialCatalog: TutorialCollection = {
    defaultTutorialId: MageWarsTutorial.id,
    tutorials: {
        [MageWarsTutorial.id]: {
            titleKey: 'tutorial.catalog.basic.title',
            descriptionKey: 'tutorial.catalog.basic.description',
            manifest: MageWarsTutorial,
        },
    },
};

export default MageWarsTutorialCatalog;
