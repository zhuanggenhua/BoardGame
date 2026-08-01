import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { readCoreState } from '../helpers/smashup';
import {
    MUNCHKIN_MONSTER_DECK_DEF_IDS,
    MUNCHKIN_TREASURE_DECK_DEF_IDS,
} from '../../src/games/smashup/data/factions/munchkin';

type SmashUpSceneConfig = Parameters<GameTestContext['setupScene']>[0];

type RocketBootsCoreState = {
    bases: Array<{
        minions: Array<{
            uid: string;
            attachedActions?: Array<{ uid: string; defId: string; talentUsed?: boolean }>;
        }>;
    }>;
    triggerQueue?: unknown[];
};

type InteractionOption = {
    value?: {
        baseIndex?: number;
    };
};

const deckCards = (playerId: string, defId: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
        uid: `${playerId}-deck-${index}`,
        defId,
        type: 'minion',
        owner: playerId,
    }));

const minion = (uid: string, defId: string, owner: string, basePower: number) => ({
    uid,
    defId,
    owner,
    controller: owner,
    basePower,
    powerCounters: 0,
    powerModifier: 0,
    tempPowerModifier: 0,
    talentUsed: false,
    attachedActions: [],
});

const buildMunchkinMonsterTreasureScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'p0-hand-1', defId: 'munchkin_dwarves_loot_lover', type: 'minion', owner: '0' },
            { uid: 'p0-hand-2', defId: 'munchkin_dwarves_mine', type: 'action', owner: '0' },
            { uid: 'p0-hand-3', defId: 'munchkin_warriors_big_hero', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [
            { uid: 'p1-hand-1', defId: 'munchkin_orcs_sword_lord', type: 'minion', owner: '1' },
            { uid: 'p1-hand-2', defId: 'ninja_infiltrate', type: 'action', owner: '1' },
        ],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 5,
            nextUid: 500,
            deckQueryEnabled: false,
            enabledExpansions: ['titans', 'munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath', 'base_the_homeworld'],
            baseDiscard: [],
            titans: [
                {
                    uid: 'titan-on-base-0',
                    defId: 'dinosaurs_fort_titanosaurus',
                    faction: 'dinosaurs',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
                {
                    uid: 'titan-setaside-0',
                    defId: 'ninjas_invisible_ninja',
                    faction: 'ninjas',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('p0-base0-loot-lover', 'munchkin_dwarves_loot_lover', '0', 4),
                        minion('p0-base0-big-hero', 'munchkin_warriors_big_hero', '0', 5),
                        minion('p1-base0-sword-lord', 'munchkin_orcs_sword_lord', '1', 5),
                    ],
                    ongoingActions: [
                        { uid: 'ongoing-full-sail-0', defId: 'pirate_full_sail', ownerId: '0' },
                        { uid: 'ongoing-power-up-1', defId: 'robot_power_up', ownerId: '1' },
                    ],
                    monsters: [
                        { uid: 'monster-dragon-0', defId: 'munchkin_monster_treasure_dragon' },
                        { uid: 'monster-bigfoot-0', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'monster-ghoul-0', defId: 'munchkin_monster_ghoul', controllerId: '1' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        minion('p0-base1-gem', 'munchkin_dwarves_gem_grabber', '0', 2),
                        minion('p1-base1-dork-orc', 'munchkin_orcs_dork_orc', '1', 2),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinRocketBootsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 6,
            nextUid: 800,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        {
                            ...minion('rocket-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'rocket-boots-1',
                                    defId: 'munchkin_treasure_rocket_boots',
                                    ownerId: '0',
                                    talentUsed: false,
                                },
                            ],
                        },
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

test.describe('大杀四方 Munchkin 怪物与宝藏 UI', () => {
    test('怪物行和公共小牌堆不抢原版布局', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinMonsterTreasureScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-special-supply-row')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-monster-uid]')).toHaveCount(3);
        await expect(page.getByTestId('su-base-titan-titan-on-base-0')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-ongoing-uid="ongoing-full-sail-0"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="su-munchkin-monster-discard"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);

        const layoutEvidence = await page.evaluate(() => {
            const rectOf = (selector: string) => {
                const element = document.querySelector<HTMLElement>(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height,
                };
            };
            const monsterRow = rectOf('[data-testid="su-base-monster-row-0"]');
            const baseCard = rectOf('[data-base-index="0"]');
            const playerColumn = rectOf('[data-testid="su-base-player-column-0-0"]');
            const titanOnBase = rectOf('[data-testid="su-base-titan-titan-on-base-0"]');
            const ongoing = rectOf('[data-ongoing-uid="ongoing-full-sail-0"]');
            const supplyRow = rectOf('[data-testid="su-special-supply-row"]');
            const deckStack = rectOf('[data-testid="su-deck-stack"]');

            return {
                monsterBelowBase: !!monsterRow && !!baseCard && monsterRow.top >= baseCard.bottom - 8,
                monsterAbovePlayerColumn: !!monsterRow && !!playerColumn && monsterRow.bottom <= playerColumn.top + 12,
                titanAboveBase: !!titanOnBase && !!baseCard && titanOnBase.bottom <= baseCard.top + 90,
                ongoingAboveBase: !!ongoing && !!baseCard && ongoing.bottom <= baseCard.top + 90,
                supplyAttachedToDeck: !!supplyRow && !!deckStack && supplyRow.bottom <= deckStack.top + 60,
            };
        });

        expect(layoutEvidence, '怪物行应位于基地卡下方、玩家随从列上方；泰坦/持续行动仍在基地上方；公共小牌堆挂在抽牌堆旁').toEqual({
            monsterBelowBase: true,
            monsterAbovePlayerColumn: true,
            titanAboveBase: true,
            ongoingAboveBase: true,
            supplyAttachedToDeck: true,
        });

        await page.waitForTimeout(800);
        await game.screenshot('01-当前实现-怪物行和公共牌堆', testInfo);

        const treasureDragon = page.locator('[data-monster-uid="monster-dragon-0"][data-defeatable-monster="true"]');
        await expect(treasureDragon).toBeVisible({ timeout: 15000 });
        const treasureDragonBox = await treasureDragon.boundingBox();
        expect(treasureDragonBox, '宝藏龙怪物卡应有可点击的露出切片').not.toBeNull();
        await page.mouse.click(
            treasureDragonBox!.x + Math.max(8, treasureDragonBox!.width * 0.16),
            treasureDragonBox!.y + treasureDragonBox!.height * 0.5,
        );

        await expect(page.locator('[data-monster-uid="monster-dragon-0"]')).toHaveCount(0);
        await expect(page.locator('[data-monster-uid]')).toHaveCount(2);
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 19');
        await expect(page.locator('[data-card-uid^="munchkin_treasure_"]')).toHaveCount(3);

        await page.waitForTimeout(800);
        await game.screenshot('02-点击怪物后宝藏进入手牌', testInfo);

        const core = await readCoreState(page) as {
            bases: Array<{ monsters?: Array<{ uid: string; defId: string }> }>;
            players: Record<string, { hand: Array<{ uid: string; defId: string; type: string }> }>;
            monsterDiscard?: string[];
            treasureDeck?: string[];
        };
        expect(core.bases[0].monsters?.map(monster => monster.uid)).toEqual(['monster-bigfoot-0', 'monster-ghoul-0']);
        expect(core.monsterDiscard).toContain('munchkin_monster_treasure_dragon');
        expect(core.players['0'].hand.filter(card => card.uid.startsWith('munchkin_treasure_')).map(card => card.defId)).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_halfling_hireling',
            'munchkin_treasure_tiger_steed',
        ]);
        expect(core.players['0'].hand.filter(card => card.uid.startsWith('munchkin_treasure_')).map(card => card.type)).toEqual([
            'minion',
            'minion',
            'minion',
        ]);
        expect(core.treasureDeck).toHaveLength(19);
    });

    test('火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinRocketBootsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="rocket-host"]').first();
        const rocketBoots = page.locator('[data-attached-action-uid="rocket-boots-1"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(rocketBoots).toBeVisible({ timeout: 15000 });
        await game.screenshot('03-火箭靴附着行动可点击', testInfo);

        await rocketBoots.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_rocket_boots_move', 10000);
        await game.screenshot('04-火箭靴选择目标基地', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '火箭靴目标基地',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const core = await readCoreState(page) as RocketBootsCoreState;
            const sourceUids = core.bases[0].minions.map(minion => minion.uid);
            const targetHost = core.bases[1].minions.find(minion => minion.uid === 'rocket-host');
            const rocket = targetHost?.attachedActions?.find(action => action.uid === 'rocket-boots-1');
            return {
                sourceUids,
                targetHasHost: Boolean(targetHost),
                targetHasRocketBoots: rocket?.defId === 'munchkin_treasure_rocket_boots',
                rocketTalentUsed: rocket?.talentUsed === true,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceUids: [],
            targetHasHost: true,
            targetHasRocketBoots: true,
            rocketTalentUsed: true,
            triggerQueueLength: 0,
        });

        await game.screenshot('05-火箭靴移动宿主后状态', testInfo);
    });
});
