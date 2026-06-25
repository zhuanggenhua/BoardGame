/**
 * DiceThrone 工匠全面审计补证。
 *
 * 范围：P0 真实入口链路。手牌和选择都经过当前页面 UI，断言回到运行态状态收口。
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { initHeroState } from '../../src/games/dicethrone/domain/characters';
import '../../src/games/dicethrone/domain';

type JsonRecord = Record<string, any>;

const ARTIFICER = 'artificer';
const MONK = 'monk';

const DICE_THRONE_PREPARE_RANDOM = {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (_faces: number) => 1,
    range: (min: number, _max: number) => min,
};

type BadgeSpriteSnapshot = {
    backgroundImage: string;
    backgroundSize: string;
    imageSrc: string;
    width: number;
    height: number;
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> => {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch?: (command: {
                        type: string;
                        playerId: string;
                        payload: Record<string, unknown>;
                        timestamp: number;
                    }) => void | Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;

        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command dispatcher not ready');
        }

        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
            timestamp: Date.now(),
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
};

const getSimpleChoiceOptionIndexByCustomId = async (game: GameTestContext, customId: string): Promise<number> => {
    const state = await game.getState() as JsonRecord;
    const interaction = state?.sys?.interaction?.current;
    const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
        ? interaction.data.options
        : [];
    const index = options.findIndex((option: JsonRecord) => option?.value?.customId === customId);
    if (index < 0) {
        throw new Error(`未找到 simple-choice 选项 ${customId}`);
    }
    return index;
};

const clickSimpleChoiceByCustomId = async (
    page: Page,
    game: GameTestContext,
    customId: string,
): Promise<void> => {
    const optionIndex = await getSimpleChoiceOptionIndexByCustomId(game, customId);
    const visibleButtons = page.locator('#modal-root button:visible');
    await expect(visibleButtons.nth(optionIndex)).toBeVisible({ timeout: 5000 });
    await visibleButtons.nth(optionIndex).click();
};

const readIconBadgeSnapshots = async (page: Page, rootSelector: string): Promise<BadgeSpriteSnapshot[]> =>
    page.evaluate((selector) => {
        const root = document.querySelector(selector);
        if (!root) return [];

        return Array.from(root.querySelectorAll('.rounded-full'))
            .map((badge) => {
                const badgeElement = badge as HTMLElement;
                if (!badgeElement.className.includes('overflow-hidden')) {
                    return null;
                }

                const image = badgeElement.querySelector('img') as HTMLImageElement | null;
                const spriteSpan = Array.from(badgeElement.querySelectorAll('span')).find((node) => {
                    const style = window.getComputedStyle(node);
                    return Boolean(style.backgroundImage && style.backgroundImage !== 'none');
                }) as HTMLElement | undefined;
                const iconStyle = spriteSpan ? window.getComputedStyle(spriteSpan) : (image ? window.getComputedStyle(image) : null);
                const rect = badgeElement.getBoundingClientRect();

                return {
                    backgroundImage: iconStyle?.backgroundImage ?? '',
                    backgroundSize: iconStyle?.backgroundSize ?? '',
                    imageSrc: image ? image.currentSrc || image.src || '' : '',
                    width: rect.width,
                    height: rect.height,
                };
            })
            .filter((entry): entry is BadgeSpriteSnapshot => Boolean(entry));
    }, rootSelector);

const waitForIconBadges = async (
    page: Page,
    rootSelector: string,
    minimumCount: number,
): Promise<BadgeSpriteSnapshot[]> => {
    await page.waitForFunction(({ selector, count }) => {
        const root = document.querySelector(selector);
        if (!root) return false;

        const entries = Array.from(root.querySelectorAll('.rounded-full')).filter((badge) => {
            const badgeElement = badge as HTMLElement;
            return badgeElement.className.includes('overflow-hidden');
        });
        return entries.length >= count;
    }, { selector: rootSelector, count: minimumCount }, { timeout: 15000, polling: 200 });

    return readIconBadgeSnapshots(page, rootSelector);
};

const isPostDamageFollowUpSettled = (state: JsonRecord): boolean => {
    const pendingAttack = state?.core?.pendingAttack;
    if (!pendingAttack) {
        return state?.sys?.interaction?.current == null && state?.sys?.phase === 'main2';
    }

    return pendingAttack.postDamageFollowUpResolved === true
        && pendingAttack.settlementStage === 'readyToResolve';
};

const dismissAttackShowcaseIfVisible = async (page: Page): Promise<void> => {
    const dismissButton = page.getByRole('button', { name: /开始防御|继续/ }).last();
    const isVisible = await dismissButton.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isVisible) return;
    await dismissButton.click();
    await expect(dismissButton).toBeHidden({ timeout: 5000 });
};

const dragHandCardToPlay = async (page: Page, cardId: string): Promise<void> => {
    const card = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toHaveAttribute('data-can-drag', 'true', { timeout: 5000 });

    const cardBox = await page.evaluate((nextCardId) => {
        const node = document.querySelector(`[data-testid="hand-area"] [data-card-id="${nextCardId}"]`) as HTMLElement | null;
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, cardId);
    if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const setupArtificerBeforeDamageResponseScene = async (
    game: GameTestContext,
    cardId: string,
    synth = 0,
): Promise<void> => {
    await game.openTestGame('dicethrone', { playerID: '0' });
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: [cardId],
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 50 },
            tokens: {
                [TOKEN_IDS.SYNTH]: synth,
                [TOKEN_IDS.NANOBOT]: 0,
                [TOKEN_IDS.SHOCK_BOT]: 0,
                [TOKEN_IDS.HEAL_BOT]: 0,
            },
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 50 },
        },
        currentPlayer: '1',
        phase: 'defensiveRoll',
        sys: {
            responseWindow: {
                current: {
                    id: 'artificer-before-damage-response-window',
                    windowType: 'afterAttackResolved',
                    sourceId: 'fist-technique',
                    responderQueue: ['0'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        },
        extra: {
            selectedCharacters: { '0': ARTIFICER, '1': MONK },
            hostStarted: true,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'fist-technique',
                isDefendable: true,
            },
            pendingDamage: {
                id: 'artificer-before-damage',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 5,
                currentDamage: 5,
                sourceAbilityId: 'fist-technique',
                damageScope: 'attack',
                responseType: 'beforeDamageReceived',
                responderId: '0',
                isFullyEvaded: false,
            },
        },
    });

    await game.waitForPhase('defensiveRoll', 10000);
    await expect.poll(async () => {
        const state = await game.getState() as JsonRecord;
        return {
            cardInHand: state?.core?.players?.['0']?.hand?.some((card: JsonRecord) => card.id === cardId) ?? false,
            responseWindowType: state?.sys?.responseWindow?.current?.windowType ?? null,
            responderId: state?.sys?.responseWindow?.current?.responderQueue?.[0] ?? null,
            pendingDamageResponder: state?.core?.pendingDamage?.responderId ?? null,
        };
    }, { timeout: 10000 }).toEqual({
        cardInHand: true,
        responseWindowType: 'afterAttackResolved',
        responderId: '0',
        pendingDamageResponder: '0',
    });
};

const setupArtificerPostDamageBotChoiceScene = async (
    game: GameTestContext,
    options: {
        tokenId: typeof TOKEN_IDS.SHOCK_BOT | typeof TOKEN_IDS.HEAL_BOT;
        randomQueue?: number[];
    },
): Promise<void> => {
    await game.openTestGame('dicethrone', { playerID: '0' });
    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: options.randomQueue,
        player0: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 40 },
            tokens: {
                [TOKEN_IDS.SYNTH]: 2,
                [TOKEN_IDS.NANOBOT]: 0,
                [TOKEN_IDS.SHOCK_BOT]: options.tokenId === TOKEN_IDS.SHOCK_BOT ? 1 : 0,
                [TOKEN_IDS.HEAL_BOT]: options.tokenId === TOKEN_IDS.HEAL_BOT ? 1 : 0,
            },
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': ARTIFICER, '1': MONK },
            hostStarted: true,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'shock-bot',
                isDefendable: true,
                damageResolved: true,
                resolvedDamage: 9,
                settlementStage: 'postDamagePending',
            },
        },
    });

    await game.waitForPhase('offensiveRoll', 10000);
    await dispatchHarnessCommand(game.page, 'ADVANCE_PHASE', '0');

    await expect.poll(async () => {
        const state = await game.getState() as JsonRecord;
        const interaction = state?.sys?.interaction?.current;
        const optionsList = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
            ? interaction.data.options
            : [];
        return {
            kind: interaction?.kind ?? null,
            sourceId: interaction?.data?.sourceId ?? null,
            customIds: optionsList.map((option: JsonRecord) => option?.value?.customId),
            labels: optionsList.map((option: JsonRecord) => option?.label),
        };
    }, { timeout: 10000 }).toMatchObject({
        kind: 'simple-choice',
        sourceId: 'shock-bot',
        customIds: ['artificer-activate-bot-resolve'],
    });
};

const setupArtificerMainHandScene = async (
    game: GameTestContext,
    cardIds: string[],
    options: {
        randomQueue?: number[];
        synth?: number;
        cp?: number;
    } = {},
): Promise<void> => {
    await game.openTestGame('dicethrone', { playerID: '0' });
    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: options.randomQueue,
        player0: {
            hand: cardIds,
            resources: { [RESOURCE_IDS.CP]: options.cp ?? 10, [RESOURCE_IDS.HP]: 50 },
            tokens: {
                [TOKEN_IDS.SYNTH]: options.synth ?? 0,
                [TOKEN_IDS.NANOBOT]: 0,
                [TOKEN_IDS.SHOCK_BOT]: 0,
                [TOKEN_IDS.HEAL_BOT]: 0,
            },
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 50 },
        },
        currentPlayer: '0',
        phase: 'main1',
        extra: {
            selectedCharacters: { '0': ARTIFICER, '1': MONK },
            hostStarted: true,
        },
    });

    await game.waitForPhase('main1', 10000);
    await expect.poll(async () => {
        const state = await game.getState() as JsonRecord;
        const artificer = state?.core?.players?.['0'];
        return {
            phase: state?.sys?.phase ?? null,
            characterId: artificer?.characterId ?? null,
            selectedCharacter: state?.core?.selectedCharacters?.['0'] ?? null,
            handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'main1',
        characterId: ARTIFICER,
        selectedCharacter: ARTIFICER,
        handIds: cardIds,
    });
};

const createFourPlayerAuditHero = (
    playerId: '2' | '3',
    characterId: 'treant' | 'samurai',
): JsonRecord => {
    const player = initHeroState(playerId, characterId, DICE_THRONE_PREPARE_RANDOM);
    return {
        ...player,
        hand: [],
        deck: [],
        discard: [],
        statusEffects: {},
        resources: {
            ...player.resources,
            [RESOURCE_IDS.CP]: 10,
            [RESOURCE_IDS.HP]: 50,
        },
    };
};

const setupArtificerFourPlayerTeamMainHandScene = async (
    game: GameTestContext,
    cardIds: string[],
): Promise<void> => {
    await setupArtificerMainHandScene(game, cardIds);

    const player2 = createFourPlayerAuditHero('2', 'treant');
    const player3 = createFourPlayerAuditHero('3', 'samurai');

    await game.page.evaluate(({ nextPlayer2, nextPlayer3 }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => JsonRecord;
                    set?: (state: JsonRecord) => void | Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        const core = state.core as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        return harness.state.set({
            ...state,
            core: {
                ...core,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        resources: {
                            ...(player0.resources ?? {}),
                            hp: 50,
                            cp: player0.resources?.cp ?? 10,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            hp: 50,
                            cp: player1.resources?.cp ?? 10,
                        },
                    },
                    '2': nextPlayer2,
                    '3': nextPlayer3,
                },
                selectedCharacters: {
                    ...(core.selectedCharacters ?? {}),
                    '0': 'artificer',
                    '1': 'monk',
                    '2': 'treant',
                    '3': 'samurai',
                },
                readyPlayers: {
                    ...(core.readyPlayers ?? {}),
                    '0': true,
                    '1': true,
                    '2': true,
                    '3': true,
                },
                seatingOrder: ['0', '1', '2', '3'],
                teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
                teamHealth: { A: 50, B: 50 },
                seatControllers: {
                    ...(core.seatControllers ?? {}),
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                    '2': { type: 'local-ai' },
                    '3': { type: 'local-ai' },
                },
            },
        });
    }, { nextPlayer2: player2, nextPlayer3: player3 });

    await expect.poll(async () => {
        const state = await game.getState() as JsonRecord;
        return {
            playerIds: Object.keys(state?.core?.players ?? {}).sort(),
            seatingOrder: state?.core?.seatingOrder ?? [],
            teamIdByPlayerId: state?.core?.teamIdByPlayerId ?? {},
            handIds: state?.core?.players?.['0']?.hand?.map((card: JsonRecord) => card.id) ?? [],
        };
    }, { timeout: 10000 }).toMatchObject({
        playerIds: ['0', '1', '2', '3'],
        seatingOrder: ['0', '1', '2', '3'],
        teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
        handIds: cardIds,
    });
};

const injectVisibleArtificerStatusIcons = async (game: GameTestContext): Promise<void> => {
    await game.page.evaluate(({ synthId, nanobotId, shockBotId, healBotId, nanobombId }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => JsonRecord;
                    set?: (state: JsonRecord) => void | Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        const core = state.core as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const artificer = players['0'];

        return harness.state.set({
            ...state,
            core: {
                ...core,
                players: {
                    ...players,
                    '0': {
                        ...artificer,
                        tokens: {
                            ...(artificer.tokens ?? {}),
                            [synthId]: 3,
                            [nanobotId]: 1,
                            [shockBotId]: 1,
                            [healBotId]: 1,
                        },
                        statusEffects: {
                            ...(artificer.statusEffects ?? {}),
                            [nanobombId]: 2,
                        },
                    },
                },
            },
        });
    }, {
        synthId: TOKEN_IDS.SYNTH,
        nanobotId: TOKEN_IDS.NANOBOT,
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        healBotId: TOKEN_IDS.HEAL_BOT,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

test.describe('DiceThrone 工匠 P0 全面审计真实入口', () => {
    test('机械的反击应在真实受伤前响应窗口从手牌打出并施加纳米爆弹', async ({ page, game }, testInfo) => {
        await setupArtificerBeforeDamageResponseScene(game, 'card-artificer-mechanical-strike');
        await game.screenshot('artificer-mechanical-strike-before-play', testInfo);

        await dismissAttackShowcaseIfVisible(page);
        await dragHandCardToPlay(page, 'card-artificer-mechanical-strike');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const attacker = state?.core?.players?.['1'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: artificer?.discard?.map((card: JsonRecord) => card.id) ?? [],
                damageShield: artificer?.damageShields?.find((shield: JsonRecord) => shield.sourceId === 'card-artificer-mechanical-strike'),
                attackerNanobomb: attacker?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: ['card-artificer-mechanical-strike'],
            damageShield: {
                sourceId: 'card-artificer-mechanical-strike',
                value: 2,
                preventStatus: false,
            },
            attackerNanobomb: 1,
        });

        await game.screenshot('artificer-mechanical-strike-after-play', testInfo);
    });

    test('电弧盾应在真实受伤前响应窗口从手牌打出并选择花费合成器防止 3 点伤害', async ({ page, game }, testInfo) => {
        await setupArtificerBeforeDamageResponseScene(game, 'upgrade-artificer-shock-bot-2', 1);
        await game.screenshot('artificer-arc-shield-before-play', testInfo);

        await dismissAttackShowcaseIfVisible(page);
        await dragHandCardToPlay(page, 'upgrade-artificer-shock-bot-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return options.map((option: JsonRecord) => option?.value?.customId);
        }, { timeout: 10000 }).toEqual([
            'artificer-arc-shield-prevent-2',
            'artificer-arc-shield-prevent-3',
        ]);

        await game.screenshot('artificer-arc-shield-choice-open', testInfo);
        await clickSimpleChoiceByCustomId(page, game, 'artificer-arc-shield-prevent-3');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: artificer?.discard?.map((card: JsonRecord) => card.id) ?? [],
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                currentDamage: state?.core?.pendingDamage?.currentDamage ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: ['upgrade-artificer-shock-bot-2'],
            synth: 0,
            currentDamage: 2,
            interactionKind: null,
        });

        await game.screenshot('artificer-arc-shield-after-choice', testInfo);
    });

    test('攻击后机器人选择链应可真实选择电能机器人并收口攻击后续', async ({ page, game }, testInfo) => {
        await setupArtificerPostDamageBotChoiceScene(game, { tokenId: TOKEN_IDS.SHOCK_BOT });
        await game.screenshot('artificer-post-damage-shock-bot-choice-open', testInfo);

        await clickSimpleChoiceByCustomId(page, game, 'artificer-activate-bot-resolve');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                shockBot: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                attackSettled: isPostDamageFollowUpSettled(state),
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            shockBot: 0,
            defenderHp: 47,
            interactionKind: null,
            attackSettled: true,
        });

        await game.screenshot('artificer-post-damage-shock-bot-after-choice', testInfo);
    });

    test('攻击后机器人选择链应可真实选择治疗机器人并收口攻击后续', async ({ page, game }, testInfo) => {
        await setupArtificerPostDamageBotChoiceScene(game, {
            tokenId: TOKEN_IDS.HEAL_BOT,
            randomQueue: [1],
        });
        await game.screenshot('artificer-post-damage-heal-bot-choice-open', testInfo);

        await clickSimpleChoiceByCustomId(page, game, 'artificer-activate-bot-resolve');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                healBot: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.HEAL_BOT] ?? null,
                artificerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                attackSettled: isPostDamageFollowUpSettled(state),
                bonusDieFaces: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.face),
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            healBot: 0,
            artificerHp: 41,
            interactionKind: null,
            attackSettled: true,
            bonusDieFaces: ['wrench'],
        });

        await game.screenshot('artificer-post-damage-heal-bot-after-choice', testInfo);
    });

    test('超高电压应可从真实手牌打出并获得 2 合成器', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['card-artificer-voltage']);
        await game.screenshot('artificer-voltage-before-play', testInfo);

        await dragHandCardToPlay(page, 'card-artificer-voltage');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: artificer?.discard?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: ['card-artificer-voltage'],
            cp: 9,
            synth: 2,
        });

        await game.screenshot('artificer-voltage-after-play', testInfo);
    });

    test('合成大师应可从真实手牌打出并按电能奖励骰获得 5 合成器', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['card-artificer-masterpiece'], { randomQueue: [0.99] });
        await game.screenshot('artificer-masterpiece-before-play', testInfo);

        await dragHandCardToPlay(page, 'card-artificer-masterpiece');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                activePlayerId: state?.core?.activePlayerId ?? null,
                characterId: artificer?.characterId ?? null,
                selectedCharacter: state?.core?.selectedCharacters?.['0'] ?? null,
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: artificer?.discard?.map((card: JsonRecord) => card.id) ?? [],
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                bonusDieValues: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.value),
                bonusDieFaces: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.face),
                bonusDieEffectKeys: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.effectKey),
                drawnCards: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'CARD_DRAWN')
                    .length,
            };
        }, { timeout: 10000 }).toMatchObject({
            activePlayerId: '0',
            characterId: ARTIFICER,
            selectedCharacter: ARTIFICER,
            handIds: [],
            discardIds: ['card-artificer-masterpiece'],
            synth: 5,
            bonusDieValues: [6],
            bonusDieFaces: ['electricity'],
            bonusDieEffectKeys: ['bonusDie.effect.artificerMasterpieceElectricity'],
            drawnCards: 0,
        });

        await game.screenshot('artificer-masterpiece-after-play', testInfo);
    });

    test('纳米袭击应在 4 人组队局真实手牌打出且只允许选择敌方玩家', async ({ page, game }, testInfo) => {
        await setupArtificerFourPlayerTeamMainHandScene(game, ['card-artificer-nano-attack']);
        await game.screenshot('artificer-nano-attack-four-player-before-play', testInfo);

        await dragHandCardToPlay(page, 'card-artificer-nano-attack');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const interaction = state?.sys?.interaction?.current;
            const data = interaction?.data ?? {};
            return {
                interactionType: data?.type ?? null,
                sourceCardId: data?.sourceCardId ?? null,
                targetPlayerIds: data?.targetPlayerIds ?? [],
                selected: data?.selected ?? [],
            };
        }, { timeout: 10000 }).toMatchObject({
            interactionType: 'selectPlayer',
            sourceCardId: 'card-artificer-nano-attack',
            targetPlayerIds: ['1', '3'],
            selected: [],
        });

        await expect(page.getByTestId('dt-player-target-1')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('dt-player-target-3')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('dt-player-target-0')).toHaveCount(0);
        await expect(page.getByTestId('dt-player-target-2')).toHaveCount(0);
        await game.screenshot('artificer-nano-attack-four-player-enemy-targets', testInfo);

        await page.getByTestId('dt-player-target-3').click();
        await page.locator('#modal-root').getByRole('button', { name: /^确认$/ }).click();

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                handIds: state?.core?.players?.['0']?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: state?.core?.players?.['0']?.discard?.map((card: JsonRecord) => card.id) ?? [],
                player1Nanobomb: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
                player2Nanobomb: state?.core?.players?.['2']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
                player3Nanobomb: state?.core?.players?.['3']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: ['card-artificer-nano-attack'],
            player1Nanobomb: 0,
            player2Nanobomb: 0,
            player3Nanobomb: 1,
            interactionKind: null,
        });

        await game.screenshot('artificer-nano-attack-four-player-after-target', testInfo);
    });

    test('扳手攻击 II 应可从真实手牌打出并替换玩家板能力', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-wrench-strike-2']);
        await game.screenshot('artificer-wrench-strike-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-wrench-strike-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['wrench-strike'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['wrench-strike']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 9,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-wrench-strike-2',
        });

        await game.screenshot('artificer-wrench-strike-2-after-play', testInfo);
    });

    test('工匠合成器、纳米爆弹和三类机器人状态图标应命中状态图集 sprite', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await injectVisibleArtificerStatusIcons(game);

        const statusRoot = '[data-tutorial-id="status-tokens"]';
        const badges = await waitForIconBadges(page, statusRoot, 5);

        expect(badges.length).toBeGreaterThanOrEqual(5);
        for (const badge of badges) {
            expect(Boolean(badge.imageSrc) || badge.backgroundImage !== 'none').toBe(true);
            if (!badge.imageSrc) {
                expect(badge.backgroundSize).not.toBe('');
            }
            expect(badge.width).toBeGreaterThan(8);
            expect(badge.height).toBeGreaterThan(8);
        }

        await game.screenshot('artificer-status-icons-atlas-sprites', testInfo);
    });
});
