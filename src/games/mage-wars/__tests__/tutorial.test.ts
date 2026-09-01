import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import type { Command, MatchState, RandomFn, TutorialAiAction, TutorialManifest } from '../../../engine/types';
import { engineConfig } from '../game';
import MageWarsTutorialCatalog, {
    MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID,
    MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID,
    MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID,
    MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID,
    MageWarsGuardTutorial,
    MageWarsHealingTutorial,
    MageWarsRestoreAndBurnTutorial,
    MageWarsTutorial,
    MageWarsWallAndLineOfSightTutorial,
} from '../tutorial';
import { MageWarsDomain, MAGE_WARS_COMMANDS, MAGE_WARS_EVENTS } from '../domain';
import type { MageWarsCommand, MageWarsCore } from '../domain/types';
import { MAGE_WARS_MAGE_ABILITY_IDS, MAGE_WARS_OBJECT_ABILITY_IDS, STATUS_TOKEN_IDS } from '../domain/ids';

const playerIds = ['0', '1'];
const JUNGLE_WOLF_CARD_ID = 2819;
const ROUSE_THE_BEAST_CARD_ID = 3403;
const ASYRAN_CLERIC_CARD_ID = 2811;
const PILLAR_OF_LIGHT_CARD_ID = 1706;
const PLAYER_ZERO_WOLF_OBJECT_ID = 'mwobj-0-2819-1';
const PLAYER_ONE_CLERIC_OBJECT_ID = 'mwobj-1-2811-1';
const THORNS_WALL_CARD_ID = 25700;
const WALL_EDGE_A3_B3 = 'a3-b3';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

const loadLocale = (locale: 'zh-CN' | 'en') => JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'public', 'locales', locale, 'game-mage-wars.json'),
    'utf8',
)) as Record<string, unknown>;

const resolveLocaleKey = (locale: Record<string, unknown>, content: string): unknown => {
    const key = content.replace(/^game-mage-wars:/, '');
    return key.split('.').reduce<unknown>((current, part) => {
        if (!current || typeof current !== 'object') return undefined;
        return (current as Record<string, unknown>)[part];
    }, locale);
};

const flattenStrings = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object') return [];
    return Object.values(value).flatMap(flattenStrings);
};

const allTutorialManifests = (): TutorialManifest[] => Object.values(MageWarsTutorialCatalog.tutorials)
    .map((entry) => entry.manifest);

function setupState(): MatchState<MageWarsCore> {
    return {
        core: MageWarsDomain.setup(playerIds, fixedRandom),
        sys: createInitialSystemState(playerIds, engineConfig.systems, 'local:mage-wars-tutorial-test'),
    };
}

function runCommand(
    state: MatchState<MageWarsCore>,
    command: Command<string, unknown>,
): MatchState<MageWarsCore> {
    const result = executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems,
            systemsConfig: engineConfig.systemsConfig,
        },
        state,
        command as unknown as MageWarsCommand,
        fixedRandom,
        playerIds,
    );
    expect(result.success, `${command.type} failed with ${result.error ?? 'unknown error'}`).toBe(true);
    return result.state;
}

function runTutorialAiActions(
    state: MatchState<MageWarsCore>,
    actions: readonly TutorialAiAction[] | undefined,
): MatchState<MageWarsCore> {
    // 模拟运行时机制练习 setup 步骤的显式标记：夹具推进阶段时不触发正式自动流程。
    state = {
        ...state,
        sys: {
            ...state.sys,
            tutorial: {
                ...state.sys.tutorial,
                active: true,
                step: { id: 'mechanism-setup', content: '', skipAutomaticFlow: true },
            },
        },
    };
    return (actions ?? []).reduce((nextState, action) => runCommand(nextState, {
        type: action.commandType,
        playerId: action.playerId ?? nextState.core.currentPlayerId,
        payload: action.payload ?? {},
    }), state);
}

const advancePhaseCommand = (playerId: string): Command<typeof FLOW_COMMANDS.ADVANCE_PHASE, Record<string, never>> => ({
    type: FLOW_COMMANDS.ADVANCE_PHASE,
    playerId,
    payload: {},
});

const castSpellCommand = (
    playerId: string,
    payload: Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.CAST_SPELL }>['payload'],
): Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.CAST_SPELL }> => ({
    type: MAGE_WARS_COMMANDS.CAST_SPELL,
    playerId,
    payload,
});

describe('mage-wars tutorial', () => {
    it('exports the basic flow and mechanism practice tutorials without hiding entries', () => {
        expect(MageWarsTutorialCatalog.defaultTutorialId).toBe('mage-wars-basic');
        expect(Object.keys(MageWarsTutorialCatalog.tutorials)).toEqual([
            'mage-wars-basic',
            'mage-wars-wall-and-line-of-sight',
            'mage-wars-guard',
            'mage-wars-healing',
            'mage-wars-restore-and-burn',
        ]);
        expect(Object.values(MageWarsTutorialCatalog.tutorials).map((entry) => entry.hiddenFromCatalog)).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
        expect(Object.entries(MageWarsTutorialCatalog.tutorials)
            .filter(([, entry]) => entry.hiddenFromCatalog !== true)
            .map(([tutorialId]) => tutorialId)).toEqual([
            'mage-wars-basic',
            'mage-wars-wall-and-line-of-sight',
            'mage-wars-guard',
            'mage-wars-healing',
            'mage-wars-restore-and-burn',
        ]);
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-basic'].nextTutorialId)
            .toBe('mage-wars-wall-and-line-of-sight');
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-wall-and-line-of-sight'].nextTutorialId)
            .toBe('mage-wars-guard');
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-guard'].nextTutorialId)
            .toBe('mage-wars-healing');
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-healing'].nextTutorialId)
            .toBe('mage-wars-restore-and-burn');
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-restore-and-burn'].nextTutorialId)
            .toBeUndefined();
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-wall-and-line-of-sight'].manifest)
            .toBe(MageWarsWallAndLineOfSightTutorial);
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-guard'].manifest)
            .toBe(MageWarsGuardTutorial);
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-healing'].manifest)
            .toBe(MageWarsHealingTutorial);
        expect(MageWarsTutorialCatalog.tutorials['mage-wars-restore-and-burn'].manifest)
            .toBe(MageWarsRestoreAndBurnTutorial);
    });

    it('defines a basic Beastmaster apprentice flow with stable anchors and commands', () => {
        expect(MageWarsTutorial).toMatchObject({
            id: 'mage-wars-basic',
            numPlayers: 2,
            allowManualSkip: true,
        });
        expect(MageWarsTutorial.randomPolicy).toEqual({ mode: 'fixed', values: [3] });

        const stepIds = MageWarsTutorial.steps.map((step) => step.id);
        expect(stepIds).toEqual([
            'intro',
            'self-hud',
            'opponent-hud',
            'stage',
            'channel-result',
            'plan-wolf',
            'prepare-opponent-spells',
            'prepared-and-hidden',
            'deploy-wolf',
            'rouse-wolf',
            'pass-your-deployment',
            'opponent-deploy',
            'opponent-attack-spell',
            'discard-reading',
            'opponent-pass-deployment',
            'skip-initiative-quickcast',
            'opponent-pass-initiative-quickcast',
            'move-wolf',
            'finish',
        ]);

        const commandCoverage = new Set(MageWarsTutorial.steps.flatMap((step) => step.allowedCommands ?? []));
        expect([...commandCoverage]).toEqual(expect.arrayContaining([
            FLOW_COMMANDS.ADVANCE_PHASE,
            MAGE_WARS_COMMANDS.PLAN_SPELLS,
            MAGE_WARS_COMMANDS.CAST_SPELL,
            MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
        ]));

        const planWolf = MageWarsTutorial.steps.find((step) => step.id === 'plan-wolf');
        expect(planWolf?.allowedTargets).toEqual(expect.arrayContaining([
            'mw-spellbook-category-creature',
            'mw-spellbook-next-page',
            `mw-spellbook-card-${JUNGLE_WOLF_CARD_ID}`,
            'mw-spellbook-category-incantation',
            `mw-spellbook-card-${ROUSE_THE_BEAST_CARD_ID}`,
            'mw-plan-spells',
        ]));

        const rouseWolf = MageWarsTutorial.steps.find((step) => step.id === 'rouse-wolf');
        expect(rouseWolf).toMatchObject({
            requireAction: true,
            highlightTarget: `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
        });
        expect(rouseWolf?.advanceOnEvents).toContainEqual({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED,
            match: { ownerId: '0' },
        });

        const passYourDeployment = MageWarsTutorial.steps.find((step) => step.id === 'pass-your-deployment');
        expect(passYourDeployment).toMatchObject({
            requireAction: true,
            highlightTarget: 'mw-turn-end',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            allowedTargets: ['mw-turn-end'],
        });
        expect(passYourDeployment?.aiActions).toBeUndefined();
        expect(passYourDeployment?.advanceOnEvents).toContainEqual({
            type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
            match: { playerId: '0', phase: 'deployment' },
        });

        const skipInitiativeQuickcast = MageWarsTutorial.steps.find((step) => step.id === 'skip-initiative-quickcast');
        expect(skipInitiativeQuickcast).toMatchObject({
            requireAction: true,
            highlightTarget: 'mw-turn-end',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            allowedTargets: ['mw-turn-end'],
        });
        expect(skipInitiativeQuickcast?.aiActions).toBeUndefined();
        expect(skipInitiativeQuickcast?.advanceOnEvents).toContainEqual({
            type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
            match: { playerId: '0', phase: 'initiativeQuickcast' },
        });

        expect(MageWarsTutorial.steps.map((step) => step.highlightTarget).filter(Boolean)).toEqual(expect.arrayContaining([
            'mw-board',
            'mw-self-hud',
            'mw-opponent-hud',
            'mw-stage',
            'mw-spellbook',
            'mw-opponent-prepared',
            'mw-discard',
            `mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`,
            `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
            `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
        ]));
    });

    it('has localized tutorial text and no implementation-facing wording', () => {
        const locales = [loadLocale('zh-CN'), loadLocale('en')];
        for (const locale of locales) {
            for (const [tutorialId, entry] of Object.entries(MageWarsTutorialCatalog.tutorials)) {
                expect(resolveLocaleKey(locale, `game-mage-wars:${entry.titleKey}`), `${tutorialId} title is missing`)
                    .toEqual(expect.any(String));
                expect(resolveLocaleKey(locale, `game-mage-wars:${entry.descriptionKey}`), `${tutorialId} description is missing`)
                    .toEqual(expect.any(String));
                for (const step of entry.manifest.steps) {
                    expect(resolveLocaleKey(locale, step.content), `${step.content} is missing`).toEqual(expect.any(String));
                }
            }
        }

        const forbiddenTerms = [
            '同一画面',
            '结果面板',
            '摘要',
            '队列',
            '为了演示',
            '主视区',
            '待放置状态',
            'E2E',
            '真实链路',
            '运行态',
            '女祭司：守卫',
            '守卫、治疗与状态',
            '位置选择本身变成威胁',
            '三类不同承接',
            '能力小卡片',
            '必须先选来源',
            '这一章',
            '本章',
            '五章节',
            'result panel',
            'queue',
            'for demonstration',
            'runtime',
            'priestess: guard',
            'guard, healing, status',
            'position becomes a threat',
            'mini-card',
            'source first',
            'this chapter',
            'chapter teaches',
            'chapter covered',
            'five-chapter',
            '点击“回合结束”',
            'click “end turn”',
        ];
        const tutorialText = locales.flatMap((locale) => flattenStrings(locale.tutorial)).join('\n').toLowerCase();
        for (const term of forbiddenTerms) {
            expect(tutorialText).not.toContain(term.toLowerCase());
        }
    });

    it('keeps the tutorial command chain legal through rousing and moving Jungle Wolf', () => {
        let state = setupState();

        // 仅触发一次正式流程；reset/channel/upkeep 自动推进到首个玩家决策点 planning。
        state = runCommand(state, advancePhaseCommand('0'));
        expect(state.sys.phase).toBe('planning');
        expect(state.core.players['0'].mana).toBe(20);
        expect(state.core.players['1'].mana).toBe(20);

        state = runCommand(state, {
            type: MAGE_WARS_COMMANDS.PLAN_SPELLS,
            playerId: '1',
            payload: { spellCardIds: [ASYRAN_CLERIC_CARD_ID, PILLAR_OF_LIGHT_CARD_ID] },
        });
        state = runCommand(state, {
            type: MAGE_WARS_COMMANDS.PLAN_SPELLS,
            playerId: '0',
            payload: { spellCardIds: [JUNGLE_WOLF_CARD_ID, ROUSE_THE_BEAST_CARD_ID] },
        });
        expect(state.sys.phase).toBe('deployment');
        expect(state.core.players['0'].preparedSpellCardIds).toEqual([
            JUNGLE_WOLF_CARD_ID,
            ROUSE_THE_BEAST_CARD_ID,
        ]);

        state = runCommand(state, castSpellCommand('0', {
            spellCardId: JUNGLE_WOLF_CARD_ID,
            manaCost: 9,
            targetZoneId: 'a3',
        }));
        expect(state.core.objects[PLAYER_ZERO_WOLF_OBJECT_ID]).toMatchObject({
            sourceSpellCardId: JUNGLE_WOLF_CARD_ID,
            zoneId: 'a3',
            actionReady: false,
        });

        state = runCommand(state, castSpellCommand('0', {
            spellCardId: ROUSE_THE_BEAST_CARD_ID,
            manaCost: 2,
            targetObjectId: PLAYER_ZERO_WOLF_OBJECT_ID,
        }));
        expect(state.core.objects[PLAYER_ZERO_WOLF_OBJECT_ID]).toMatchObject({
            actionReady: true,
            rousedBySpellTurnNumber: state.core.turnNumber,
        });
        expect(state.core.players['0'].discardSpellCardIds).toEqual([
            ROUSE_THE_BEAST_CARD_ID,
            JUNGLE_WOLF_CARD_ID,
        ]);

        state = runCommand(state, advancePhaseCommand('0'));
        expect(state.sys.phase).toBe('deployment');
        expect(state.core.phaseActorId).toBe('1');

        state = runCommand(state, castSpellCommand('1', {
            spellCardId: ASYRAN_CLERIC_CARD_ID,
            manaCost: 5,
            targetZoneId: 'd1',
        }));
        expect(state.core.objects[PLAYER_ONE_CLERIC_OBJECT_ID]).toMatchObject({
            sourceSpellCardId: ASYRAN_CLERIC_CARD_ID,
            zoneId: 'd1',
        });

        state = runCommand(state, castSpellCommand('1', {
            spellCardId: PILLAR_OF_LIGHT_CARD_ID,
            manaCost: 5,
            targetObjectId: PLAYER_ONE_CLERIC_OBJECT_ID,
        }));
        expect(state.core.objects[PLAYER_ONE_CLERIC_OBJECT_ID].damage).toBeGreaterThan(0);
        expect(state.core.players['1'].discardSpellCardIds).toEqual([
            PILLAR_OF_LIGHT_CARD_ID,
            ASYRAN_CLERIC_CARD_ID,
        ]);

        state = runCommand(state, advancePhaseCommand('1'));
        expect(state.sys.phase).toBe('initiativeQuickcast');
        expect(state.core.phaseActorId).toBe('0');
        state = runCommand(state, advancePhaseCommand('0'));
        expect(state.sys.phase).toBe('initiativeQuickcast');
        expect(state.core.phaseActorId).toBe('1');
        state = runCommand(state, advancePhaseCommand('1'));
        expect(state.sys.phase).toBe('creatureAction');
        expect(state.core.phaseActorId).toBe('0');

        state = runCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: {
                objectId: PLAYER_ZERO_WOLF_OBJECT_ID,
                toZoneId: 'a2',
            },
        });
        expect(state.core.objects[PLAYER_ZERO_WOLF_OBJECT_ID]).toMatchObject({
            zoneId: 'a2',
            actionReady: false,
        });
    });

    it('keeps the wall tutorial setup and wall cast legal through the formal wall edge UI contract', () => {
        const setupStep = MageWarsWallAndLineOfSightTutorial.steps.find((step) => step.id === 'setup-wall-position');
        let state = runTutorialAiActions(setupState(), setupStep?.aiActions);
        state = { ...state, sys: { ...state.sys, phase: 'deployment' } };

        expect(state.sys.phase).toBe('deployment');
        expect(state.core.phaseActorId).toBe('0');
        expect(state.core.players['0'].preparedSpellCardIds).toEqual([THORNS_WALL_CARD_ID]);
        expect(state.core.players['0'].mana).toBe(20);

        const castWallStep = MageWarsWallAndLineOfSightTutorial.steps.find((step) => step.id === 'cast-thorns-wall');
        expect(castWallStep).toMatchObject({
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [
                `mw-prepared-card-${THORNS_WALL_CARD_ID}`,
                `mw-wall-edge-${WALL_EDGE_A3_B3}`,
            ],
        });
        expect(castWallStep?.advanceOnEvents).toEqual([{ type: MAGE_WARS_EVENTS.WALL_SUMMONED }]);

        state = runCommand(state, castSpellCommand('0', {
            spellCardId: THORNS_WALL_CARD_ID,
            manaCost: 5,
            targetWallEdgeId: WALL_EDGE_A3_B3,
        }));

        expect(state.core.walls[WALL_EDGE_A3_B3]).toMatchObject({
            edgeId: WALL_EDGE_A3_B3,
            sourceSpellCardId: THORNS_WALL_CARD_ID,
            blocksLineOfSight: true,
            passageDamage: { amount: 3 },
        });
        expect(state.core.players['0'].discardSpellCardIds).toContain(THORNS_WALL_CARD_ID);
    });

    it('keeps the guard continuation command legal', () => {
        const setupStep = MageWarsGuardTutorial.steps.find((step) => step.id === 'setup-guard-board');
        let state = runTutorialAiActions(setupState(), setupStep?.aiActions);
        state = { ...state, sys: { ...state.sys, phase: 'creatureAction' } };
        expect(state.sys.phase).toBe('creatureAction');
        expect(state.core.phaseActorId).toBe('0');
        expect(state.core.players['0']).toMatchObject({
            mageId: 'priestess_apprentice',
            mana: 20,
            actionReady: true,
        });
        expect(Object.keys(state.core.objects)).toEqual(expect.arrayContaining([
            MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID,
            MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID,
            MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID,
            MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID,
        ]));

        state = runCommand(state, {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: { objectId: MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID },
        });
        expect(state.core.objects[MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID]).toMatchObject({
            guarding: true,
            actionReady: false,
        });

        const commandCoverage = new Set(MageWarsGuardTutorial.steps.flatMap((step) => step.allowedCommands ?? []));
        expect([...commandCoverage]).toEqual([MAGE_WARS_COMMANDS.GUARD]);
    });

    it('keeps the healing continuation command and life-readout step legal', () => {
        const setupStep = MageWarsHealingTutorial.steps.find((step) => step.id === 'setup-healing-board');
        let state = runTutorialAiActions(setupState(), setupStep?.aiActions);
        state = { ...state, sys: { ...state.sys, phase: 'creatureAction' } };

        expect(state.sys.phase).toBe('creatureAction');
        expect(state.core.phaseActorId).toBe('0');
        expect(state.core.players['0']).toMatchObject({
            mageId: 'priestess_apprentice',
            mana: 20,
            actionReady: true,
        });
        expect(Object.keys(state.core.objects)).toEqual(expect.arrayContaining([
            MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID,
            MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID,
        ]));

        const bobcatDamageBefore = state.core.objects[MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID].damage;
        state = runCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                manaCost: 0,
                targetObjectId: MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID,
            },
        });
        expect(state.core.objects[MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID].actionReady).toBe(false);
        expect(state.core.objects[MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID].damage).toBeLessThan(bobcatDamageBefore);
        expect(state.core.players['0'].actionReady).toBe(true);

        expect(MageWarsHealingTutorial.steps.map((step) => step.id)).toEqual([
            'setup-healing-board',
            'healing-rule',
            'heal-wounded-bobcat',
            'healing-result-and-life-readout',
            'life-toggle',
        ]);
        const commandCoverage = new Set(MageWarsHealingTutorial.steps.flatMap((step) => step.allowedCommands ?? []));
        expect([...commandCoverage]).toEqual([MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY]);
    });

    it('keeps the restore and burn continuation command legal', () => {
        const setupStep = MageWarsRestoreAndBurnTutorial.steps.find((step) => step.id === 'setup-restore-board');
        let state = runTutorialAiActions(setupState(), setupStep?.aiActions);
        state = { ...state, sys: { ...state.sys, phase: 'creatureAction' } };
        state = {
            ...state,
            core: {
                ...state.core,
                objects: {
                    ...state.core.objects,
                    [MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID]: {
                        ...state.core.objects[MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID],
                        statusTokens: { [STATUS_TOKEN_IDS.BURN]: 1 },
                    },
                },
            },
        };

        expect(state.sys.phase).toBe('creatureAction');
        expect(state.core.phaseActorId).toBe('0');
        expect(state.core.players['0']).toMatchObject({
            mageId: 'priestess_apprentice',
            mana: 20,
            actionReady: true,
        });
        expect(state.core.objects[MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID].statusTokens[STATUS_TOKEN_IDS.BURN])
            .toBe(1);

        state = runCommand(state, {
            type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
            playerId: '0',
            payload: {
                abilityId: MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD,
                manaCost: 2,
                targetObjectId: MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID,
                statusTokenIds: [STATUS_TOKEN_IDS.BURN],
            },
        });
        expect(state.core.objects[MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID].statusTokens[STATUS_TOKEN_IDS.BURN] ?? 0)
            .toBe(0);
        expect(state.core.players['0']).toMatchObject({
            mana: 18,
            actionReady: false,
        });

        expect(MageWarsRestoreAndBurnTutorial.steps.map((step) => step.id)).toEqual([
            'setup-restore-board',
            'burn-rule',
            'restore-burning-cleric',
            'restore-result',
        ]);
        const commandCoverage = new Set(MageWarsRestoreAndBurnTutorial.steps.flatMap((step) => step.allowedCommands ?? []));
        expect([...commandCoverage]).toEqual([MAGE_WARS_COMMANDS.USE_MAGE_ABILITY]);
    });

    it('keeps Board.tsx tutorial anchors available for the manifest targets', () => {
        const boardSource = fs.readFileSync(path.join(process.cwd(), 'src', 'games', 'mage-wars', 'Board.tsx'), 'utf8');
        for (const anchor of [
            'mw-board',
            'mw-stage',
            'mw-self-hud',
            'mw-opponent-hud',
            'mw-opponent-prepared',
            'mw-discard',
            'mw-spellbook',
            'mw-plan-spells',
            'mw-prepared',
            'mw-turn-end',
            'mw-arena',
            'mw-zone-',
            'mw-field-object-',
            'mw-arena-object-',
            'mw-spellbook-category-',
            'mw-spellbook-next-page',
            'mw-spellbook-card-',
            'mw-prepared-card-',
            'mw-wall-edge-',
            'mw-wall-card-',
            'mw-selected-unit-guard',
            'mw-life-toggle',
            'mw-ability-action-dock',
            'mw-ability-healing-light',
            'mw-ability-restore',
            'mw-mage-entity-',
            'data-tutorial-object-id',
        ]) {
            expect(boardSource).toContain(anchor);
        }
        const highlightTargets = allTutorialManifests()
            .flatMap((manifest) => manifest.steps.map((step) => step.highlightTarget))
            .filter((target): target is string => Boolean(target));
        expect(highlightTargets).toEqual(expect.arrayContaining([
            `mw-wall-card-${THORNS_WALL_CARD_ID}`,
            `mw-arena-object-${MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID}`,
            `mw-arena-object-${MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID}`,
            'mw-life-toggle',
            'mw-mage-entity-0',
        ]));
    });
});
