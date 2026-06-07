import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';

const WIZARD_ACADEMY_QUERY = {
    p0: 'wizards,aliens',
    p1: 'robots,dinosaurs',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 20260529,
};

type InteractionOption = {
    value?: {
        defId?: string;
        returnIt?: boolean;
    };
};

type WizardAcademyState = {
    core: {
        bases: Array<{ defId?: string }>;
        baseDeck: string[];
        players: Record<string, { hand: Array<{ uid: string }> }>;
    };
    sys: {
        interaction?: {
            current?: unknown;
        };
    };
};

async function openWizardAcademyScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('smashup', WIZARD_ACADEMY_QUERY, 45000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['wizards', 'aliens'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['robots', 'dinosaurs'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_wizard_academy',
                minions: [
                    { uid: 'scout1', defId: 'alien_scout', owner: '0', controller: '0', baseIndex: 0, basePower: 3 },
                    { uid: 'strong1', defId: 'wizard_archmage', owner: '0', controller: '0', baseIndex: 0, basePower: 13 },
                    { uid: 'enemy1', defId: 'pirate_king', owner: '1', controller: '1', baseIndex: 0, basePower: 5 },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_great_library',
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_cave_of_shinies',
                minions: [],
                ongoingActions: [],
            },
        ],
        extra: {
            core: {
                baseDeck: ['base_tortuga', 'base_central_brain', 'base_the_factory', 'base_the_homeworld'],
                titans: [],
                enabledExpansions: [],
                nextUid: 5000,
            },
        },
    });
}

test.describe('SmashUp 巫师学院 afterScoring 交互证据链', () => {
    test('应先选替换基地，再给剩余基地排序，并在收口后真正替换基地且继续后续链', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await openWizardAcademyScene(game);
        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await game.waitForInteraction('base_wizard_academy', 15000);

        const firstOptions = await game.getInteractionOptions();
        expect(firstOptions.map((option: InteractionOption) => option.value?.defId)).toEqual(
            expect.arrayContaining(['base_tortuga', 'base_central_brain', 'base_the_factory']),
        );
        await game.screenshot('wizard-academy-01-choose-replacement', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.defId === 'base_the_factory',
            '巫师学院替换基地选择工厂436-1337',
        );

        await game.waitForInteraction('base_wizard_academy', 10000);
        const reorderOptions = await game.getInteractionOptions();
        expect(reorderOptions.map((option: InteractionOption) => option.value?.defId)).toEqual(
            expect.arrayContaining(['base_tortuga', 'base_central_brain']),
        );
        expect(reorderOptions.some((option: InteractionOption) => option.value?.defId === 'base_the_factory')).toBe(false);
        await game.screenshot('wizard-academy-02-order-remaining', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.defId === 'base_central_brain',
            '巫师学院剩余基地排序把中央大脑放到最上面',
        );

        await game.waitForInteraction('alien_scout_return', 10000);
        await game.screenshot('wizard-academy-03-scout-continuation', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.returnIt === true,
            '侦察兵返回手牌',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as WizardAcademyState;
            return {
                base0: state.core.bases[0]?.defId ?? null,
                top2: state.core.baseDeck.slice(0, 2),
                scoutReturned: state.core.players['0'].hand.some((card) => card.uid === 'scout1'),
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }).toEqual({
            base0: 'base_the_factory',
            top2: ['base_central_brain', 'base_tortuga'],
            scoutReturned: true,
            interactionOpen: false,
        });

        await page.locator('[data-base-index="0"]').scrollIntoViewIfNeeded();
        await game.screenshot('wizard-academy-04-final-replaced-base', testInfo);
    });
});
