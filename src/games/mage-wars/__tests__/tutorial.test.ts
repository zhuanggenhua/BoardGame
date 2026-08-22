import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { MageWarsTutorial } from '../tutorial';
import { MageWarsDomain, MAGE_WARS_COMMANDS, MAGE_WARS_EVENTS } from '../domain';
import type { MageWarsCommand, MageWarsCore } from '../domain/types';

const playerIds = ['0', '1'];
const JUNGLE_WOLF_CARD_ID = 2819;
const ROUSE_THE_BEAST_CARD_ID = 3403;
const ASYRAN_CLERIC_CARD_ID = 2811;
const PILLAR_OF_LIGHT_CARD_ID = 1706;
const PLAYER_ZERO_WOLF_OBJECT_ID = 'mwobj-0-2819-1';
const PLAYER_ONE_CLERIC_OBJECT_ID = 'mwobj-1-2811-1';

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

function setupState(): MatchState<MageWarsCore> {
    return {
        core: MageWarsDomain.setup(playerIds, fixedRandom),
        sys: createInitialSystemState(playerIds, engineConfig.systems, 'local:mage-wars-tutorial-test'),
    };
}

function runCommand(
    state: MatchState<MageWarsCore>,
    command: MageWarsCommand | Command<typeof FLOW_COMMANDS.ADVANCE_PHASE, Record<string, never>>,
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
            'stage',
            'advance-channel',
            'channel-result',
            'advance-upkeep',
            'advance-planning',
            'plan-wolf',
            'prepared-and-hidden',
            'deploy-wolf',
            'rouse-wolf',
            'pass-your-deployment',
            'opponent-deploy',
            'opponent-attack-spell',
            'discard-reading',
            'skip-to-creature-action',
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
            `mw-spellbook-card-${JUNGLE_WOLF_CARD_ID}`,
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

        expect(MageWarsTutorial.steps.map((step) => step.highlightTarget).filter(Boolean)).toEqual(expect.arrayContaining([
            'mw-board',
            'mw-self-hud',
            'mw-stage',
            'mw-turn-end',
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
            for (const step of MageWarsTutorial.steps) {
                expect(resolveLocaleKey(locale, step.content), `${step.content} is missing`).toEqual(expect.any(String));
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
            'result panel',
            'queue',
            'for demonstration',
            'runtime',
        ];
        const tutorialText = locales.flatMap((locale) => flattenStrings(locale.tutorial)).join('\n').toLowerCase();
        for (const term of forbiddenTerms) {
            expect(tutorialText).not.toContain(term.toLowerCase());
        }
    });

    it('keeps the tutorial command chain legal through rousing and moving Jungle Wolf', () => {
        let state = setupState();

        state = runCommand(state, advancePhaseCommand('1'));
        state = runCommand(state, advancePhaseCommand('0'));
        expect(state.sys.phase).toBe('channel');
        expect(state.core.players['0'].mana).toBe(20);

        state = runCommand(state, advancePhaseCommand('1'));
        state = runCommand(state, advancePhaseCommand('0'));
        expect(state.sys.phase).toBe('upkeep');

        state = runCommand(state, advancePhaseCommand('1'));
        state = runCommand(state, advancePhaseCommand('0'));
        expect(state.sys.phase).toBe('planning');

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
        state = runCommand(state, advancePhaseCommand('0'));
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

    it('keeps Board.tsx tutorial anchors available for the manifest targets', () => {
        const boardSource = fs.readFileSync(path.join(process.cwd(), 'src', 'games', 'mage-wars', 'Board.tsx'), 'utf8');
        for (const anchor of [
            'mw-board',
            'mw-stage',
            'mw-self-hud',
            'mw-opponent-prepared',
            'mw-discard',
            'mw-spellbook',
            'mw-plan-spells',
            'mw-prepared',
            'mw-turn-end',
            'mw-arena',
            'mw-zone-',
            'mw-field-object-',
            'mw-spellbook-card-',
            'mw-prepared-card-',
        ]) {
            expect(boardSource).toContain(anchor);
        }
    });
});
