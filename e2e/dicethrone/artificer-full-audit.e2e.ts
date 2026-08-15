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
import { expectRightTrayBonusDiceConfirmation, settleCurrentBonusDice } from './bonus-dice-flow';

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

const setHarnessRandomQueue = async (page: Page, values: number[]): Promise<void> => {
    await page.evaluate((queue) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                random?: {
                    setQueue?: (values: number[]) => void;
                };
            };
        }).__BG_TEST_HARNESS__;

        if (!harness?.random?.setQueue) {
            throw new Error('TestHarness random queue 不可用');
        }

        harness.random.setQueue(queue);
    }, values);
};

const getSimpleChoiceOptionByCustomId = async (game: GameTestContext, customId: string): Promise<JsonRecord> => {
    const state = await game.getState() as JsonRecord;
    const interaction = state?.sys?.interaction?.current;
    const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
        ? interaction.data.options
        : [];
    const option = options.find((candidate: JsonRecord) => candidate?.value?.customId === customId);
    if (!option) {
        throw new Error(`未找到 simple-choice 选项 ${customId}`);
    }
    return option;
};

const cssAttributeValue = (value: string): string => (
    value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
);

const clickSimpleChoiceByCustomId = async (
    page: Page,
    game: GameTestContext,
    customId: string,
): Promise<void> => {
    const option = await getSimpleChoiceOptionByCustomId(game, customId);
    const optionId = typeof option.id === 'string' ? option.id : undefined;
    const modalRoot = page.locator('#modal-root');

    if (optionId) {
        const buttonByOptionId = modalRoot.locator(`button[data-option-id="${cssAttributeValue(optionId)}"]`).first();
        if (await buttonByOptionId.isVisible({ timeout: 1000 }).catch(() => false)) {
            await buttonByOptionId.click();
            return;
        }
    }

    const buttonByCustomId = modalRoot.locator(`button[data-choice-custom-id="${cssAttributeValue(customId)}"]`).first();
    if (await buttonByCustomId.isVisible({ timeout: 1000 }).catch(() => false)) {
        await buttonByCustomId.click();
        return;
    }

    await expect(modalRoot.getByRole('heading', { name: '技能结算选择' })).toBeVisible({ timeout: 5000 });

    if (customId === 'artificer-wrench-strike-roll') {
        const rollButton = modalRoot.getByRole('button', { name: '投 1 骰' });
        await expect(rollButton).toBeVisible({ timeout: 5000 });
        await rollButton.click();
        return;
    }

    const synthOffsetByCustomId: Record<string, number> = {
        'artificer-wrench-strike-spend-wrench': 0,
        'artificer-wrench-strike-spend-gear': 1,
        'artificer-wrench-strike-spend-electricity': 2,
    };
    const synthIndex = synthOffsetByCustomId[customId];
    if (synthIndex === undefined) {
        throw new Error(`未适配的 simple-choice 点击目标 ${customId}`);
    }

    const synthLabel = modalRoot.getByText('合成器', { exact: true }).nth(synthIndex);
    await expect(synthLabel).toBeVisible({ timeout: 5000 });

    try {
        await synthLabel.click();
        return;
    } catch {
        const clickableAncestor = synthLabel.locator('xpath=ancestor::*[contains(@class,"cursor-pointer")]').first();
        await expect(clickableAncestor).toBeVisible({ timeout: 5000 });
        await clickableAncestor.click();
    }
};

const clickSimpleChoiceByIndex = async (
    page: Page,
    game: GameTestContext,
    optionIndex: number,
): Promise<void> => {
    const state = await game.getState() as JsonRecord;
    const interaction = state?.sys?.interaction?.current;
    const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
        ? interaction.data.options
        : [];
    if (optionIndex < 0 || optionIndex >= options.length) {
        throw new Error(`simple-choice 选项索引越界: ${optionIndex}`);
    }

    const modalRoot = page.locator('#modal-root');
    const visibleButtons = modalRoot.locator('button:visible');
    const modalButton = visibleButtons.nth(optionIndex);
    await expect(modalButton).toBeVisible({ timeout: 5000 });
    await modalButton.click();
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

const isPreDamageBotChoiceSettled = (state: JsonRecord): boolean => {
    const pendingAttack = state?.core?.pendingAttack;
    return pendingAttack?.preDefenseResolved === true
        && pendingAttack?.settlementStage === 'preDamage';
};

const dismissAttackShowcaseIfVisible = async (page: Page): Promise<void> => {
    const foregroundModal = page.locator('#modal-root [role="dialog"]');
    const hasForegroundModal = await foregroundModal.first().isVisible({ timeout: 1000 }).catch(() => false);
    if (hasForegroundModal) return;

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

const clickResolvedAbilitySlot = async (
    page: Page,
    slotId: string,
    expectedAbilityId: string,
): Promise<void> => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });

    const clickPoint = await page.evaluate((targetSlotId: string) => {
        const element = document.querySelector(
            `[data-testid="player-board-surface"] [data-ability-slot="${targetSlotId}"]`,
        ) as HTMLElement | null;
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const xFractions = [0.18, 0.5, 0.82];
        const yFractions = [0.12, 0.28, 0.5, 0.72, 0.88];

        for (const yFraction of yFractions) {
            for (const xFraction of xFractions) {
                const x = rect.left + rect.width * xFraction;
                const y = rect.top + rect.height * yFraction;
                const topElement = document.elementFromPoint(x, y);
                const hitSlot = topElement?.closest?.('[data-ability-slot]');
                if (hitSlot === element) {
                    return { x, y };
                }
            }
        }

        return null;
    }, slotId);

    if (clickPoint) {
        await page.mouse.click(clickPoint.x, clickPoint.y);
        return;
    }

    await slot.click({ force: true });
};

const setupArtificerBeforeDamageResponseScene = async (
    game: GameTestContext,
    cardId: string,
    synth = 0,
    options?: {
        healBot?: boolean;
        damage?: number;
        hp?: number;
        randomQueue?: number[];
    },
): Promise<void> => {
    await game.openTestGame('dicethrone', { playerID: '0' });
    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: options?.randomQueue,
        player0: {
            hand: [cardId],
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: options?.hp ?? 50 },
            tokens: {
                [TOKEN_IDS.SYNTH]: synth,
                [TOKEN_IDS.NANOBOT]: 0,
                [TOKEN_IDS.SHOCK_BOT]: 0,
                [TOKEN_IDS.HEAL_BOT]: options?.healBot ? 1 : 0,
            },
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 50 },
        },
        currentPlayer: '1',
        phase: 'defensiveRoll',
        sys: {
            interaction: options?.healBot ? {
                current: {
                    id: 'dt-token-response-artificer-before-damage',
                    kind: 'dt:token-response',
                    playerId: '0',
                    data: {
                        pendingDamageId: 'artificer-before-damage',
                    },
                },
                queue: [],
            } : {
                current: undefined,
                queue: [],
            },
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
                originalDamage: options?.damage ?? 5,
                currentDamage: options?.damage ?? 5,
                sourceAbilityId: 'fist-technique',
                damageScope: 'attack',
                responseType: 'beforeDamageReceived',
                responderId: '0',
                isFullyEvaded: false,
            },
        },
    });

    if (options?.healBot) {
        await game.page.evaluate((healBotId) => {
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
                            tokenStackLimits: {
                                ...(artificer.tokenStackLimits ?? {}),
                                [healBotId]: 1,
                            },
                            artificerBotState: {
                                ...(artificer.artificerBotState ?? {}),
                                [healBotId]: {
                                    built: true,
                                    upgraded: false,
                                    activationsUsedThisTurn: 0,
                                },
                            },
                        },
                    },
                },
            });
        }, TOKEN_IDS.HEAL_BOT);
    }

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

const setupArtificerPreDamageBotChoiceScene = async (
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
                damageResolved: false,
                resolvedDamage: 0,
                settlementStage: 'preDamage',
            },
        },
    });

    await game.waitForPhase('offensiveRoll', 10000);
    await game.page.evaluate(({ tokenId, shockBotId, healBotId }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => any;
                    set?: (state: any) => void | Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;
        const current = harness?.state?.get?.();
        if (!harness?.state?.set || !current?.core?.players?.['0']) {
            throw new Error('TestHarness state.set 不可用，无法补工匠机器人状态');
        }

        const player0 = current.core.players['0'];
        const nextState = {
            ...current,
            core: {
                ...current.core,
                players: {
                    ...current.core.players,
                    '0': {
                        ...player0,
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [shockBotId]: tokenId === shockBotId ? 1 : (player0.tokenStackLimits?.[shockBotId] ?? 0),
                            [healBotId]: tokenId === healBotId ? 1 : (player0.tokenStackLimits?.[healBotId] ?? 0),
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            ...(tokenId === shockBotId ? {
                                [shockBotId]: {
                                    built: true,
                                    upgraded: false,
                                    activationsUsedThisTurn: 0,
                                },
                            } : {}),
                            ...(tokenId === healBotId ? {
                                [healBotId]: {
                                    built: true,
                                    upgraded: false,
                                    activationsUsedThisTurn: 0,
                                },
                            } : {}),
                        },
                    },
                },
            },
        };

        return harness.state.set(nextState);
    }, {
        tokenId: options.tokenId,
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        healBotId: TOKEN_IDS.HEAL_BOT,
    });
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

const randomValueForDieFace = (value: number): number => {
    const normalized = Math.max(1, Math.min(6, Math.floor(value)));
    return ((normalized - 1) / 6) + 0.001;
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

const prepareArtificerWrenchStrikeUpgradeBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ synthId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 9,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 1,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                    },
                },
                dice: [
                    toDie(1, 'wrench', 0),
                    toDie(1, 'wrench', 1),
                    toDie(1, 'wrench', 2),
                    toDie(6, 'gear', 3),
                    toDie(2, 'wrench', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, { synthId: TOKEN_IDS.SYNTH });
};

const prepareArtificerSchematicsUpgradeBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ synthId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];
        const deckCards = Array.isArray(player0.deck) ? player0.deck.slice(0, 2) : [];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        deck: deckCards,
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: 4,
                            hp: 38,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 0,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                    },
                },
                dice: [
                    toDie(4, 'gear', 0),
                    toDie(5, 'gear', 1),
                    toDie(6, 'gear', 2),
                    toDie(6, 'electricity', 3),
                    toDie(1, 'wrench', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, { synthId: TOKEN_IDS.SYNTH });
};

const prepareArtificerEurekaUpgradeBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(() => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 8,
                            hp: player0.resources?.hp ?? 50,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                    },
                },
                dice: [
                    toDie(1, 'wrench', 0),
                    toDie(2, 'wrench', 1),
                    toDie(4, 'gear', 2),
                    toDie(5, 'gear', 3),
                    toDie(6, 'electricity', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    });
};

const prepareArtificerEurekaMainBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(() => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 10,
                            hp: player0.resources?.hp ?? 50,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                    },
                },
                dice: [
                    toDie(1, 'wrench', 0),
                    toDie(2, 'wrench', 1),
                    toDie(4, 'gear', 2),
                    toDie(5, 'gear', 3),
                    toDie(4, 'gear', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    });
};

const prepareArtificerActivateBotsUpgradeBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 8,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 0,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(1, 'wrench', 0),
                    toDie(2, 'wrench', 1),
                    toDie(3, 'wrench', 2),
                    toDie(6, 'electricity', 3),
                    toDie(4, 'gear', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const prepareArtificerActivateBotsMainBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 10,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 0,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(1, 'wrench', 0),
                    toDie(2, 'wrench', 1),
                    toDie(3, 'wrench', 2),
                    toDie(4, 'gear', 3),
                    toDie(5, 'gear', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const prepareArtificerOverclockUpgradeBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ nanobombId, synthId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 8,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 0,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(6, 'electricity', 0),
                    toDie(6, 'electricity', 1),
                    toDie(6, 'electricity', 2),
                    toDie(3, 'wrench', 3),
                    toDie(4, 'gear', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        nanobombId: STATUS_IDS.NANOBOMB,
        synthId: TOKEN_IDS.SYNTH,
    });
};

const prepareArtificerOverclock2MainHealBotBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ shockBotId, healBotId, synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 8,
                            hp: 40,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 0,
                            [shockBotId]: 1,
                            [healBotId]: 1,
                        },
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [shockBotId]: 1,
                            [healBotId]: 1,
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            [shockBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                            [healBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(6, 'electricity', 0),
                    toDie(6, 'electricity', 1),
                    toDie(6, 'electricity', 2),
                    toDie(6, 'electricity', 3),
                    toDie(1, 'wrench', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        healBotId: TOKEN_IDS.HEAL_BOT,
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const prepareArtificerOverclockMainBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ shockBotId, synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 10,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 2,
                            [shockBotId]: 1,
                        },
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [shockBotId]: 1,
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            [shockBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(6, 'electricity', 0),
                    toDie(6, 'electricity', 1),
                    toDie(6, 'electricity', 2),
                    toDie(6, 'electricity', 3),
                    toDie(1, 'wrench', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const prepareArtificerShockBotMainBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ shockBotId, synthId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 10,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 2,
                            [shockBotId]: 1,
                        },
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [shockBotId]: 1,
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            [shockBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                    },
                },
                dice: [
                    toDie(2, 'wrench', 0),
                    toDie(3, 'wrench', 1),
                    toDie(4, 'gear', 2),
                    toDie(5, 'gear', 3),
                    toDie(6, 'electricity', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        synthId: TOKEN_IDS.SYNTH,
    });
};

const prepareArtificerMaximumPowerBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ nanobotId, shockBotId, synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 10,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 2,
                            [nanobotId]: 1,
                            [shockBotId]: 1,
                        },
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [nanobotId]: 1,
                            [shockBotId]: 1,
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            [nanobotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                            [shockBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(6, 'electricity', 0),
                    toDie(6, 'electricity', 1),
                    toDie(6, 'electricity', 2),
                    toDie(6, 'electricity', 3),
                    toDie(6, 'electricity', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        nanobotId: TOKEN_IDS.NANOBOT,
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const prepareArtificerShockBotUpgradeBoardScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ nanobotId, shockBotId, healBotId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        hand: [],
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 8,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [nanobotId]: 1,
                            [shockBotId]: 1,
                            [healBotId]: 0,
                        },
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [nanobotId]: 2,
                            [shockBotId]: 1,
                            [healBotId]: 0,
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            [nanobotId]: {
                                built: true,
                                upgraded: true,
                                activationsUsedThisTurn: 0,
                            },
                            [shockBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                            [healBotId]: {
                                built: false,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                    },
                },
                dice: [
                    toDie(2, 'wrench', 0),
                    toDie(3, 'wrench', 1),
                    toDie(4, 'gear', 2),
                    toDie(5, 'gear', 3),
                    toDie(6, 'electricity', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'offensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        nanobotId: TOKEN_IDS.NANOBOT,
        shockBotId: TOKEN_IDS.SHOCK_BOT,
        healBotId: TOKEN_IDS.HEAL_BOT,
    });
};

const prepareArtificerTinker2DefenseScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 1,
                rollConfirmed: true,
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'fist-technique',
                    defenseAbilityId: 'tinker',
                    isDefendable: true,
                    damageResolved: false,
                    resolvedDamage: 0,
                    settlementStage: 'preDamage',
                },
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 7,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 3,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(1, 'wrench', 0),
                    toDie(2, 'wrench', 1),
                    toDie(4, 'gear', 2),
                    toDie(5, 'gear', 3),
                    toDie(6, 'electricity', 4),
                ],
            },
            sys: {
                ...sys,
                phase: 'defensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const prepareArtificerTinkerDefenseScene = async (page: Page): Promise<void> => {
    await page.evaluate(({ synthId, nanobombId }) => {
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
        const sys = state.sys as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const player0 = players['0'];
        const player1 = players['1'];

        const toDie = (value: number, symbol: string, id: number) => ({
            id,
            value,
            symbol,
            symbols: [symbol],
            isKept: false,
            isLocked: false,
            playerId: '0',
        });

        return harness.state.set({
            ...state,
            core: {
                ...core,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
                rollCount: 1,
                rollLimit: 1,
                rollConfirmed: true,
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'fist-technique',
                    defenseAbilityId: 'tinker',
                    isDefendable: true,
                    damageResolved: false,
                    resolvedDamage: 0,
                    settlementStage: 'preDamage',
                },
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
                activatingAbilityId: undefined,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        resources: {
                            ...(player0.resources ?? {}),
                            cp: player0.resources?.cp ?? 10,
                            hp: player0.resources?.hp ?? 50,
                        },
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [synthId]: 0,
                        },
                    },
                    '1': {
                        ...player1,
                        resources: {
                            ...(player1.resources ?? {}),
                            cp: player1.resources?.cp ?? 10,
                            hp: 50,
                        },
                        statusEffects: {
                            ...(player1.statusEffects ?? {}),
                            [nanobombId]: 0,
                        },
                    },
                },
                dice: [
                    toDie(6, 'electricity', 0),
                    toDie(1, 'wrench', 1),
                    toDie(4, 'gear', 2),
                    toDie(2, 'wrench', 3),
                ],
            },
            sys: {
                ...sys,
                phase: 'defensiveRoll',
                interaction: {
                    ...((sys.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((sys.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        synthId: TOKEN_IDS.SYNTH,
        nanobombId: STATUS_IDS.NANOBOMB,
    });
};

const seedArtificerBuiltShockBot = async (page: Page): Promise<void> => {
    await page.evaluate(({ shockBotId }) => {
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

        return harness.state.set({
            ...state,
            core: {
                ...core,
                players: {
                    ...players,
                    '0': {
                        ...player0,
                        tokens: {
                            ...(player0.tokens ?? {}),
                            [shockBotId]: 1,
                        },
                        tokenStackLimits: {
                            ...(player0.tokenStackLimits ?? {}),
                            [shockBotId]: 1,
                        },
                        artificerBotState: {
                            ...(player0.artificerBotState ?? {}),
                            [shockBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                },
            },
        });
    }, {
        shockBotId: TOKEN_IDS.SHOCK_BOT,
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

    test('治疗机器人应在真实受伤前响应窗口可见并可点击使用', async ({ page, game }, testInfo) => {
        await setupArtificerBeforeDamageResponseScene(game, 'card-artificer-mechanical-strike', 2, {
            healBot: true,
            damage: 6,
            hp: 40,
            randomQueue: [1],
        });
        await dismissAttackShowcaseIfVisible(page);

        const tokenResponse = page.getByTestId('dicethrone-response-window-hint');
        const healBotToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.HEAL_BOT}`);
        await expect(tokenResponse).toBeVisible({ timeout: 10000 });
        await expect(healBotToken).toBeVisible({ timeout: 10000 });
        await expect(healBotToken).toHaveAttribute('data-token-clickable', 'true');
        await game.screenshot('artificer-heal-bot-before-damage-window-open', testInfo);

        await healBotToken.click();

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const entries = (state?.sys?.eventStream?.entries ?? []) as JsonRecord[];
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                healBot: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.HEAL_BOT] ?? null,
                healBotUsed: state?.core?.players?.['0']?.artificerBotState?.[TOKEN_IDS.HEAL_BOT]?.activationsUsedThisTurn ?? null,
                bonusDieFaces: entries
                    .map((entry) => entry?.event)
                    .filter((event) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event) => event?.payload?.face),
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            healBot: 1,
            healBotUsed: 1,
            bonusDieFaces: ['wrench'],
        });

        await game.screenshot('artificer-heal-bot-before-damage-used', testInfo);
    });

    test('稍作调整 II 打出后应可在真实防御阶段进入 5 骰防御并结算反击、合成器与纳米爆弹', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-tinker-2'], { synth: 3 });
        await game.screenshot('artificer-tinker-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-tinker-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: artificer?.discard?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['tinker'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['tinker']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: [],
            cp: 7,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-tinker-2',
        });

        await prepareArtificerTinker2DefenseScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-tinker-2-defense-ready', testInfo);

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['tinker']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            interactionKind: null,
            synth: 5,
            opponentHp: 49,
            opponentNanobomb: 1,
            pendingAttack: null,
            pendingDamage: null,
            upgradeCardId: 'upgrade-artificer-tinker-2',
        });

        await game.screenshot('artificer-tinker-2-after-defense', testInfo);
    });

    test('基础稍作调整应可在真实防御阶段进入 4 骰防御并获得 1 合成器、施加 1 纳米爆弹', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await prepareArtificerTinkerDefenseScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-tinker-base-defense-ready', testInfo);

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            interactionKind: null,
            synth: 1,
            opponentHp: 50,
            opponentNanobomb: 1,
            pendingAttack: null,
            pendingDamage: null,
        });

        await game.screenshot('artificer-tinker-base-after-defense', testInfo);
    });

    test('伤害前机器人选择链应可免费选择电能机器人并把加伤并入当前攻击', async ({ page, game }, testInfo) => {
        await setupArtificerPreDamageBotChoiceScene(game, { tokenId: TOKEN_IDS.SHOCK_BOT });
        await game.screenshot('artificer-pre-damage-shock-bot-choice-open', testInfo);

        await clickSimpleChoiceByCustomId(page, game, 'artificer-activate-bot-resolve');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                shockBot: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                shockBotUsed: state?.core?.players?.['0']?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.activationsUsedThisTurn ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                preDefenseSettled: isPreDamageBotChoiceSettled(state),
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 2,
            shockBot: 1,
            shockBotUsed: 1,
            defenderHp: 50,
            bonusDamage: 3,
            interactionKind: null,
            preDefenseSettled: true,
        });

        await game.screenshot('artificer-pre-damage-shock-bot-after-choice', testInfo);
    });

    test('伤害前机器人选择链应可免费选择治疗机器人并继续当前攻击', async ({ page, game }, testInfo) => {
        await setupArtificerPreDamageBotChoiceScene(game, {
            tokenId: TOKEN_IDS.HEAL_BOT,
            randomQueue: [1],
        });
        await game.screenshot('artificer-pre-damage-heal-bot-choice-open', testInfo);

        await clickSimpleChoiceByCustomId(page, game, 'artificer-activate-bot-resolve');
        await settleCurrentBonusDice(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'artificer-heal-bot-use',
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                healBot: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.HEAL_BOT] ?? null,
                healBotUsed: state?.core?.players?.['0']?.artificerBotState?.[TOKEN_IDS.HEAL_BOT]?.activationsUsedThisTurn ?? null,
                artificerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                preDefenseSettled: isPreDamageBotChoiceSettled(state),
                bonusDieFaces: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.face),
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 2,
            healBot: 1,
            healBotUsed: 1,
            artificerHp: 41,
            interactionKind: null,
            preDefenseSettled: true,
            bonusDieFaces: ['wrench'],
        });

        await game.screenshot('artificer-pre-damage-heal-bot-after-choice', testInfo);
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

    test('收集配件 II 应可从真实手牌打出并替换玩家板上的收集配件', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-collect-parts-2']);
        await game.screenshot('artificer-collect-parts-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-collect-parts-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['collect-parts'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['collect-parts']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 8,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-collect-parts-2',
        });

        await game.screenshot('artificer-collect-parts-2-after-play', testInfo);
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
                pendingBonusDice: state?.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
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
            synth: 0,
            pendingBonusDice: 'card-artificer-masterpiece',
            bonusDieValues: [6],
            bonusDieFaces: ['electricity'],
            bonusDieEffectKeys: ['bonusDie.effect.artificerMasterpieceElectricity'],
            drawnCards: 0,
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'card-artificer-masterpiece',
        });
        await game.screenshot('artificer-masterpiece-bonus-die-before-confirm', testInfo);
        await settleCurrentBonusDice(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'card-artificer-masterpiece',
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                pendingBonusDice: state?.core?.pendingBonusDiceSettlement ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ synth: 5, pendingBonusDice: null });

        await game.screenshot('artificer-masterpiece-after-play', testInfo);
    });

    test('万能电流应在 4 人组队局真实手牌打出并按电能分支只允许选择敌方玩家', async ({ page, game }, testInfo) => {
        await setupArtificerFourPlayerTeamMainHandScene(game, ['card-artificer-overdrive']);
        await game.page.evaluate(() => {
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
                            resources: {
                                ...(artificer.resources ?? {}),
                                hp: 38,
                                cp: artificer.resources?.cp ?? 10,
                            },
                        },
                    },
                },
            });
        });
        await setHarnessRandomQueue(game.page, [randomValueForDieFace(6)]);
        await game.screenshot('artificer-overdrive-before-play', testInfo);

        await dragHandCardToPlay(page, 'card-artificer-overdrive');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const interaction = state?.sys?.interaction?.current;
            const data = interaction?.data ?? {};
            return {
                interactionType: data?.type ?? null,
                sourceCardId: data?.sourceCardId ?? null,
                targetPlayerIds: data?.targetPlayerIds ?? [],
            };
        }, { timeout: 10000 }).toMatchObject({
            interactionType: 'selectPlayer',
            sourceCardId: 'card-artificer-overdrive',
            targetPlayerIds: ['1', '3'],
        });

        await expect(page.getByTestId('dt-player-target-1')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('dt-player-target-3')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('dt-player-target-0')).toHaveCount(0);
        await expect(page.getByTestId('dt-player-target-2')).toHaveCount(0);
        await game.screenshot('artificer-overdrive-enemy-targets', testInfo);

        await page.getByTestId('dt-player-target-3').click();
        await page.locator('#modal-root').getByRole('button', { name: /^确认$/ }).click();

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                pendingBonusDice: state?.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
                player3Nanobomb: state?.core?.players?.['3']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingBonusDice: 'card-artificer-overdrive',
            player3Nanobomb: 0,
        });
        await expectRightTrayBonusDiceConfirmation(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'card-artificer-overdrive',
        });
        await game.screenshot('artificer-overdrive-bonus-die-before-confirm', testInfo);
        await settleCurrentBonusDice(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'card-artificer-overdrive',
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                handIds: state?.core?.players?.['0']?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: state?.core?.players?.['0']?.discard?.map((card: JsonRecord) => card.id) ?? [],
                artificerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                player1Nanobomb: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
                player2Nanobomb: state?.core?.players?.['2']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
                player3Nanobomb: state?.core?.players?.['3']?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? 0,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                bonusDieFaces: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.face),
                bonusDieEffectKeys: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.effectKey),
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: ['card-artificer-overdrive'],
            artificerHp: 38,
            player1Nanobomb: 0,
            player2Nanobomb: 0,
            player3Nanobomb: 1,
            interactionKind: null,
            bonusDieFaces: ['electricity'],
            bonusDieEffectKeys: ['bonusDie.effect.artificerOverdriveElectricity'],
        });

        await game.screenshot('artificer-overdrive-after-target', testInfo);
    });

    test('这玩意儿真棒应可从真实手牌打出并按骰值一半向上取整获得 3 合成器', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['card-artificer-perfectly-calibrated'], {
            randomQueue: [randomValueForDieFace(5)],
        });
        await game.screenshot('artificer-perfectly-calibrated-before-play', testInfo);

        await dragHandCardToPlay(page, 'card-artificer-perfectly-calibrated');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                discardIds: artificer?.discard?.map((card: JsonRecord) => card.id) ?? [],
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                pendingBonusDice: state?.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
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
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            discardIds: ['card-artificer-perfectly-calibrated'],
            synth: 0,
            pendingBonusDice: 'card-artificer-perfectly-calibrated',
            bonusDieValues: [5],
            bonusDieFaces: ['gear'],
            bonusDieEffectKeys: ['bonusDie.effect.artificerPerfectlyCalibrated'],
        });

        await expectRightTrayBonusDiceConfirmation(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'card-artificer-perfectly-calibrated',
        });
        await game.screenshot('artificer-perfectly-calibrated-bonus-die-before-confirm', testInfo);
        await settleCurrentBonusDice(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'card-artificer-perfectly-calibrated',
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            return {
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                pendingBonusDice: state?.core?.pendingBonusDiceSettlement ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({ synth: 3, pendingBonusDice: null });

        await game.screenshot('artificer-perfectly-calibrated-after-play', testInfo);
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

    test('扳手攻击 II 打出后应可从真实玩家板触发升级后的扳手攻击并走电能分支收口', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-wrench-strike-2']);
        await dragHandCardToPlay(page, 'upgrade-artificer-wrench-strike-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['wrench-strike'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['wrench-strike']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            cp: 9,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-wrench-strike-2',
        });

        await prepareArtificerWrenchStrikeUpgradeBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-wrench-strike-2-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'fist', 'wrench-strike-2-4');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                sourceId: interaction?.data?.sourceId ?? null,
                customIds: options.map((option: JsonRecord) => option?.value?.customId),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            sourceId: 'wrench-strike-2-4',
            customIds: [
                'artificer-wrench-strike-roll',
                'artificer-wrench-strike-spend-wrench',
                'artificer-wrench-strike-spend-gear',
                'artificer-wrench-strike-spend-electricity',
            ],
        });

        await game.screenshot('artificer-wrench-strike-2-branch-open', testInfo);
        await clickSimpleChoiceByCustomId(page, game, 'artificer-wrench-strike-spend-electricity');
        await settleCurrentBonusDice(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'wrench-strike-2-4',
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const pendingAttack = state?.core?.pendingAttack;
            const phase = state?.sys?.phase ?? null;
            const interactionKind = state?.sys?.interaction?.current?.kind ?? null;
            const synth = artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null;

            if (
                phase === 'defensiveRoll'
                && interactionKind == null
                && pendingAttack?.sourceAbilityId === 'wrench-strike-2-4'
            ) {
                return {
                    state: 'defensive-roll-observed',
                    synth,
                    pendingAttackDamage: pendingAttack?.damage ?? null,
                    pendingAttackBonusDamage: pendingAttack?.bonusDamage ?? null,
                };
            }

            if (phase === 'main2' && interactionKind == null && !pendingAttack) {
                return {
                    state: 'main2-resolved',
                    synth,
                    opponentHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                };
            }

            return {
                state: 'waiting',
                phase,
                interactionKind,
                synth,
                pendingAttackSourceId: pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 1,
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const pendingAttack = state?.core?.pendingAttack;
            const phase = state?.sys?.phase ?? null;
            const interactionKind = state?.sys?.interaction?.current?.kind ?? null;

            if (
                phase === 'defensiveRoll'
                && interactionKind == null
                && pendingAttack?.sourceAbilityId === 'wrench-strike-2-4'
                && pendingAttack?.damage === 5
                && pendingAttack?.bonusDamage === 0
            ) {
                return 'defensive-roll-observed';
            }

            if (phase === 'main2' && interactionKind == null && !pendingAttack) {
                return 'main2-resolved';
            }

            return 'waiting';
        }, {
            timeout: 10000,
            message: '等待升级版扳手攻击 II 的电能分支在真实页面进入 defensiveRoll，或被对手自动防御后快速收口到 main2',
        }).toMatch(/defensive-roll-observed|main2-resolved/);

        await game.screenshot('artificer-wrench-strike-2-after-electricity-branch', testInfo);
    });

    test('电路图 II 打出后应可从真实玩家板触发升级后的电路图并同时获得 2 CP、抽 2、治疗 2、获得 4 合成器', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-schematics-2']);
        await game.screenshot('artificer-schematics-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-schematics-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['schematics'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['schematics']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 9,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-schematics-2',
        });

        await prepareArtificerSchematicsUpgradeBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-schematics-2-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'chi', 'schematics');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                hp: artificer?.resources?.[RESOURCE_IDS.HP] ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                handCount: artificer?.hand?.length ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['schematics']?.cardId ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            interactionKind: null,
            cp: 6,
            hp: 40,
            synth: 4,
            handCount: 2,
            upgradeCardId: 'upgrade-artificer-schematics-2',
            pendingAttack: null,
        });

        await game.screenshot('artificer-schematics-2-after-trigger', testInfo);
    });

    test('基础灵感突现应可从真实玩家板触发并获得 3 合成器、造成 7 伤害', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await prepareArtificerEurekaMainBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-eureka-base-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'lotus', 'eureka');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const pendingAttack = state?.core?.pendingAttack;
            const phase = state?.sys?.phase ?? null;
            const interactionKind = state?.sys?.interaction?.current?.kind ?? null;

            if (phase === 'defensiveRoll' && interactionKind == null && pendingAttack?.sourceAbilityId === 'eureka') {
                return {
                    state: 'defensive-roll-observed',
                    synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                    opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                    sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                };
            }

            if (phase === 'main2' && interactionKind == null && !pendingAttack) {
                return {
                    state: 'main2-resolved',
                    synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                    opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                    sourceAbilityId: null,
                };
            }

            return {
                state: 'waiting',
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 3,
        });

        await game.screenshot('artificer-eureka-base-after-trigger', testInfo);
    });

    test('灵感突现 II 打出后应可从真实玩家板触发从头构建并制造高级电能机器人', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-eureka-2']);
        await game.screenshot('artificer-eureka-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-eureka-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['eureka'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['eureka']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 8,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-eureka-2',
        });

        await prepareArtificerEurekaUpgradeBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-eureka-2-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'lotus', 'eureka-2-build-from-scratch');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                kind: interaction?.kind ?? null,
                sourceId: interaction?.data?.sourceId ?? null,
                optionValues: options.map((option: JsonRecord) => option?.value?.value ?? option?.value),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            kind: 'simple-choice',
            sourceId: 'eureka-2-build-from-scratch',
            optionValues: [1, 2, 3],
        });

        await clickSimpleChoiceByIndex(page, game, 1);

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const shockBotState = artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                tokenCount: artificer?.tokens?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                tokenLimit: artificer?.tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                built: shockBotState?.built ?? null,
                upgraded: shockBotState?.upgraded ?? null,
                activationsUsedThisTurn: shockBotState?.activationsUsedThisTurn ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            interactionKind: null,
            tokenCount: 1,
            tokenLimit: 2,
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
            pendingAttack: null,
        });

        await game.screenshot('artificer-eureka-2-after-build-from-scratch', testInfo);
    });

    test('基础唤醒机械应可从真实玩家板触发并获得 1 合成器、施加 1 纳米爆弹、造成 7 伤害', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await prepareArtificerActivateBotsMainBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-activate-bots-base-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'combo', 'activate-bots');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const pendingAttack = state?.core?.pendingAttack;
            const phase = state?.sys?.phase ?? null;
            const interactionKind = state?.sys?.interaction?.current?.kind ?? null;

            if (phase === 'defensiveRoll' && interactionKind == null && pendingAttack?.sourceAbilityId === 'activate-bots') {
                return {
                    state: 'defensive-roll-observed',
                    synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                    opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                    sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                };
            }

            if (phase === 'main2' && interactionKind == null && !pendingAttack) {
                return {
                    state: 'main2-resolved',
                    synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                    opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                    sourceAbilityId: null,
                };
            }

            return {
                state: 'waiting',
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 1,
            opponentNanobomb: 1,
        });

        await game.screenshot('artificer-activate-bots-base-after-trigger', testInfo);
    });

    test('唤醒机械 II 打出后应可从真实玩家板触发精密制造并获得 5 合成器', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-activate-bots-2']);
        await game.screenshot('artificer-activate-bots-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-activate-bots-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['activate-bots'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['activate-bots']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 8,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-activate-bots-2',
        });

        await prepareArtificerActivateBotsUpgradeBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-activate-bots-2-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'combo', 'activate-bots-2-main');

        const abilityChoiceModal = page.locator('#modal-root');
        await expect(abilityChoiceModal.getByRole('heading', { name: '选择发动变体' })).toBeVisible({ timeout: 5000 });
        await expect(abilityChoiceModal.getByRole('button', { name: /唤醒机械 II（3个扳手 \+ 1个电流）/ })).toBeVisible({ timeout: 5000 });
        await game.screenshot('artificer-activate-bots-2-ability-choice', testInfo);
        await abilityChoiceModal.getByRole('button', { name: /唤醒机械 II（3个扳手 \+ 1个电流）/ }).click();
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['activate-bots']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            interactionKind: null,
            synth: 5,
            cp: 8,
            opponentNanobomb: 0,
            pendingAttack: null,
            upgradeCardId: 'upgrade-artificer-activate-bots-2',
        });

        await game.screenshot('artificer-activate-bots-2-after-precision-fabrication', testInfo);
    });

    test('超频运行 II 打出后应可从真实玩家板触发能量提升并对对手施加 3 纳米爆弹', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-overclock-2']);
        await game.screenshot('artificer-overclock-2-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-overclock-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['overclock'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['overclock']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 8,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-overclock-2',
        });

        await prepareArtificerOverclockUpgradeBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-overclock-2-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'lightning', 'overclock-2-energy-boost');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['overclock']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            interactionKind: null,
            cp: 8,
            synth: 0,
            opponentNanobomb: 3,
            pendingAttack: null,
            upgradeCardId: 'upgrade-artificer-overclock-2',
        });

        await game.screenshot('artificer-overclock-2-after-energy-boost', testInfo);
    });

    test('超频运行 II 主分支选择治疗机器人后应普通确认右侧奖励骰盘并继续激活另一个机器人', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-overclock-2'], { randomQueue: [4] });
        await game.screenshot('artificer-overclock-2-main-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-overclock-2');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['overclock'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['overclock']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 8,
            abilityLevel: 2,
            upgradeCardId: 'upgrade-artificer-overclock-2',
        });

        await prepareArtificerOverclock2MainHealBotBoardScene(page);
        await setHarnessRandomQueue(page, [4]);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-overclock-2-main-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'lightning', 'overclock-2-main');

        const abilityChoiceModal = page.locator('#modal-root');
        await expect(abilityChoiceModal.getByRole('heading', { name: '选择发动变体' })).toBeVisible({ timeout: 5000 });
        await expect(abilityChoiceModal.getByRole('button', { name: /超频运行 II（4个电流）/ })).toBeVisible({ timeout: 5000 });
        await game.screenshot('artificer-overclock-2-main-ability-choice', testInfo);
        await abilityChoiceModal.getByRole('button', { name: /超频运行 II（4个电流）/ }).click();

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const pendingAttack = state?.core?.pendingAttack;
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                sourceAbilityId: interaction?.data?.sourceId ?? null,
                pendingAttackSourceId: pendingAttack?.sourceAbilityId ?? null,
                playerHp: artificer?.resources?.[RESOURCE_IDS.HP] ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                optionLabels: options.map((option: JsonRecord) => option?.labelKey ?? option?.label),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            interactionKind: 'simple-choice',
            sourceAbilityId: 'overclock-2-main',
            pendingAttackSourceId: 'overclock-2-main',
            playerHp: 40,
            synth: 0,
            opponentNanobomb: 1,
            optionLabels: [
                'choices.artificerBotActivation.activateShockBotFree',
                'choices.artificerBotActivation.activateHealBotFree',
                'choices.artificerBotActivation.skip',
            ],
        });

        await game.screenshot('artificer-overclock-2-main-first-choice', testInfo);
        await clickSimpleChoiceByIndex(page, game, 1);

        await settleCurrentBonusDice(page, () => game.getState() as Promise<JsonRecord>, {
            sourceAbilityId: 'artificer-heal-bot-use',
        });

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                sourceAbilityId: interaction?.data?.sourceId ?? null,
                playerHp: artificer?.resources?.[RESOURCE_IDS.HP] ?? null,
                healBotUsed: artificer?.artificerBotState?.[TOKEN_IDS.HEAL_BOT]?.activationsUsedThisTurn ?? null,
                shockBotUsed: artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.activationsUsedThisTurn ?? null,
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                optionLabels: options.map((option: JsonRecord) => option?.labelKey ?? option?.label),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            interactionKind: 'simple-choice',
            sourceAbilityId: 'overclock-2-main',
            playerHp: 41,
            healBotUsed: 1,
            shockBotUsed: 0,
            pendingBonusDiceSettlement: null,
            optionLabels: [
                'choices.artificerBotActivation.activateShockBotFree',
                'choices.artificerBotActivation.skip',
            ],
        });

        await game.screenshot('artificer-overclock-2-main-second-choice-after-heal-bot', testInfo);
        await clickSimpleChoiceByIndex(page, game, 0);

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : null;
            return {
                healBotUsed: artificer?.artificerBotState?.[TOKEN_IDS.HEAL_BOT]?.activationsUsedThisTurn ?? null,
                shockBotUsed: artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.activationsUsedThisTurn ?? null,
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                optionLabels: options?.map((option: JsonRecord) => option?.labelKey ?? option?.label) ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            healBotUsed: 1,
            shockBotUsed: 1,
            pendingBonusDiceSettlement: null,
            optionLabels: null,
        });

        await game.screenshot('artificer-overclock-2-main-after-two-bots', testInfo);
    });

    test('基础超频运行应可从真实玩家板触发并在伤害前请求免费激活机器人', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await prepareArtificerOverclockMainBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-overclock-base-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'lightning', 'overclock');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const monk = state?.core?.players?.['1'];
            const pendingAttack = state?.core?.pendingAttack;
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                sourceAbilityId: interaction?.data?.sourceId ?? null,
                pendingAttackSourceId: pendingAttack?.sourceAbilityId ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                synth: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                optionLabels: options.map((option: JsonRecord) => option?.labelKey ?? option?.label),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            interactionKind: 'simple-choice',
            sourceAbilityId: 'overclock',
            pendingAttackSourceId: 'overclock',
            opponentNanobomb: 1,
            synth: 2,
            optionLabels: [
                'choices.artificerBotActivation.activateShockBotFree',
                'choices.artificerBotActivation.skip',
            ],
        });

        await game.screenshot('artificer-overclock-base-choice-open', testInfo);
    });

    test('电能脉冲 III 打出后应可从真实玩家板触发机械大军并按机器人种类追加伤害', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, ['upgrade-artificer-shock-bot-3']);
        await game.screenshot('artificer-shock-bot-3-before-play', testInfo);

        await dragHandCardToPlay(page, 'upgrade-artificer-shock-bot-3');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            return {
                handIds: artificer?.hand?.map((card: JsonRecord) => card.id) ?? [],
                cp: artificer?.resources?.[RESOURCE_IDS.CP] ?? null,
                abilityLevel: artificer?.abilityLevels?.['shock-bot'] ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['shock-bot']?.cardId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            handIds: [],
            cp: 8,
            abilityLevel: 3,
            upgradeCardId: 'upgrade-artificer-shock-bot-3',
        });

        await prepareArtificerShockBotUpgradeBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-shock-bot-3-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'calm', 'shock-bot-3-main');

        const abilityChoiceModal = page.locator('#modal-root');
        await expect(abilityChoiceModal.getByRole('heading', { name: '选择发动变体' })).toBeVisible({ timeout: 5000 });
        await expect(abilityChoiceModal.getByRole('button', { name: /电能脉冲 III（1个扳手 \+ 2个齿轮 \+ 1个电流）/ })).toBeVisible({ timeout: 5000 });
        await game.screenshot('artificer-shock-bot-3-ability-choice', testInfo);
        await abilityChoiceModal.getByRole('button', { name: /电能脉冲 III（1个扳手 \+ 2个齿轮 \+ 1个电流）/ }).click();
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const pendingAttack = state?.core?.pendingAttack;
            const phase = state?.sys?.phase ?? null;
            const interactionKind = state?.sys?.interaction?.current?.kind ?? null;

            if (
                phase === 'defensiveRoll'
                && interactionKind == null
                && pendingAttack?.sourceAbilityId === 'shock-bot-3-mechanical-army'
            ) {
                return {
                    state: 'defensive-roll-observed',
                    phase,
                    interactionKind,
                    pendingAttackSourceId: pendingAttack?.sourceAbilityId ?? null,
                    defenseAbilityId: pendingAttack?.defenseAbilityId ?? null,
                    bonusDamage: pendingAttack?.bonusDamage ?? null,
                    opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                    nanobotBuilt: artificer?.artificerBotState?.[TOKEN_IDS.NANOBOT]?.built ?? null,
                    shockBotBuilt: artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.built ?? null,
                    upgradeCardId: artificer?.upgradeCardByAbilityId?.['shock-bot']?.cardId ?? null,
                };
            }

            if (phase === 'main2' && interactionKind == null && !pendingAttack) {
                return {
                    state: 'main2-resolved',
                    phase,
                    interactionKind,
                    defenseAbilityId: null,
                    bonusDamage: null,
                    opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                    lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                    nanobotBuilt: artificer?.artificerBotState?.[TOKEN_IDS.NANOBOT]?.built ?? null,
                    shockBotBuilt: artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.built ?? null,
                    upgradeCardId: artificer?.upgradeCardByAbilityId?.['shock-bot']?.cardId ?? null,
                };
            }

            return {
                state: 'waiting',
                phase,
                interactionKind,
                pendingAttackSourceId: pendingAttack?.sourceAbilityId ?? null,
                defenseAbilityId: pendingAttack?.defenseAbilityId ?? null,
                bonusDamage: pendingAttack?.bonusDamage ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                lastResolvedAttackDamage: state?.core?.lastResolvedAttackDamage ?? null,
                nanobotBuilt: artificer?.artificerBotState?.[TOKEN_IDS.NANOBOT]?.built ?? null,
                shockBotBuilt: artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT]?.built ?? null,
                upgradeCardId: artificer?.upgradeCardByAbilityId?.['shock-bot']?.cardId ?? null,
            };
        }, {
            timeout: 10000,
            message: '等待机械大军在真实页面进入 defensiveRoll，或被对手自动防御后快速收口到 main2',
        }).toMatchObject({
            defenseAbilityId: 'meditation',
            bonusDamage: 0,
            nanobotBuilt: true,
            shockBotBuilt: true,
            upgradeCardId: 'upgrade-artificer-shock-bot-3',
        });

        await game.screenshot('artificer-shock-bot-3-after-mechanical-army', testInfo);
    });

    test('基础电能脉冲应可从真实玩家板触发并在伤害前请求免费激活 1 个机器人', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await prepareArtificerShockBotMainBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-shock-bot-base-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'calm', 'shock-bot');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const pendingAttack = state?.core?.pendingAttack;
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                sourceAbilityId: interaction?.data?.sourceId ?? null,
                pendingAttackSourceId: pendingAttack?.sourceAbilityId ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                optionLabels: options.map((option: JsonRecord) => option?.labelKey ?? option?.label),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            interactionKind: 'simple-choice',
            sourceAbilityId: 'shock-bot',
            pendingAttackSourceId: 'shock-bot',
            opponentNanobomb: 1,
            synth: 2,
            optionLabels: [
                'choices.artificerBotActivation.activateShockBotFree',
                'choices.artificerBotActivation.skip',
            ],
        });

        await game.screenshot('artificer-shock-bot-base-choice-open', testInfo);
    });

    test('真本能量应可从真实玩家板触发并连续请求两个不同机器人的激活选择', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, []);
        await prepareArtificerMaximumPowerBoardScene(page);
        await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', ARTIFICER, { timeout: 10000 });
        await game.screenshot('artificer-maximum-power-board-ready', testInfo);

        await clickResolvedAbilitySlot(page, 'ultimate', 'maximum-power');
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                sourceAbilityId: interaction?.data?.sourceId ?? null,
                pendingAttackSourceId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                opponentNanobomb: monk?.statusEffects?.[STATUS_IDS.NANOBOMB] ?? null,
                optionLabels: options.map((option: JsonRecord) => option?.labelKey ?? option?.label),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            interactionKind: 'simple-choice',
            sourceAbilityId: 'maximum-power',
            pendingAttackSourceId: 'maximum-power',
            synth: 4,
            opponentHp: 50,
            opponentNanobomb: 1,
            optionLabels: [
                'choices.artificerBotActivation.activateNanobotFree',
                'choices.artificerBotActivation.activateShockBotFree',
                'choices.artificerBotActivation.skip',
            ],
        });

        await game.screenshot('artificer-maximum-power-first-choice', testInfo);
        await clickSimpleChoiceByIndex(page, game, 1);

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const monk = state?.core?.players?.['1'];
            const interaction = state?.sys?.interaction?.current;
            const options = interaction?.kind === 'simple-choice' && Array.isArray(interaction?.data?.options)
                ? interaction.data.options
                : [];
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                sourceAbilityId: interaction?.data?.sourceId ?? null,
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                opponentHp: monk?.resources?.[RESOURCE_IDS.HP] ?? null,
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                optionLabels: options.map((option: JsonRecord) => option?.labelKey ?? option?.label),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            interactionKind: 'simple-choice',
            sourceAbilityId: 'maximum-power',
            synth: 4,
            opponentHp: 50,
            bonusDamage: 3,
            optionLabels: [
                'choices.artificerBotActivation.activateNanobotFree',
                'choices.artificerBotActivation.skip',
            ],
        });

        await game.screenshot('artificer-maximum-power-second-choice', testInfo);
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

    test('工坊应可在真实主阶段通过按钮制造基础电能机器人', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, [], { synth: 2 });
        const buildShockBotButton = page.getByTestId('passive-action-artificer-workshop-4');
        await expect(buildShockBotButton).toBeVisible({ timeout: 10000 });
        await expect(buildShockBotButton).toContainText(/制造电能|Shock Bot/i);
        await game.screenshot('artificer-workshop-build-shock-bot-before-click', testInfo);

        await buildShockBotButton.click();

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const shockBotState = artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT];
            return {
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                shockBot: artificer?.tokens?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                tokenLimit: artificer?.tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                built: shockBotState?.built ?? null,
                upgraded: shockBotState?.upgraded ?? null,
                used: shockBotState?.activationsUsedThisTurn ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            shockBot: 1,
            tokenLimit: 1,
            built: true,
            upgraded: false,
            used: 0,
        });

        await game.screenshot('artificer-workshop-build-shock-bot-after-click', testInfo);
    });

    test('工坊应可在真实主阶段通过按钮把基础电能机器人升级为高级机器人', async ({ page, game }, testInfo) => {
        await setupArtificerMainHandScene(game, [], { synth: 3 });
        await seedArtificerBuiltShockBot(page);
        const upgradeShockBotButton = page.getByTestId('passive-action-artificer-workshop-7');
        await expect(upgradeShockBotButton).toBeVisible({ timeout: 10000 });
        await expect(upgradeShockBotButton).toContainText(/升级|电能机器人|Shock Bot/i);
        await game.screenshot('artificer-workshop-upgrade-shock-bot-before-click', testInfo);

        await upgradeShockBotButton.click();

        await expect.poll(async () => {
            const state = await game.getState() as JsonRecord;
            const artificer = state?.core?.players?.['0'];
            const shockBotState = artificer?.artificerBotState?.[TOKEN_IDS.SHOCK_BOT];
            return {
                synth: artificer?.tokens?.[TOKEN_IDS.SYNTH] ?? null,
                shockBot: artificer?.tokens?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                tokenLimit: artificer?.tokenStackLimits?.[TOKEN_IDS.SHOCK_BOT] ?? null,
                built: shockBotState?.built ?? null,
                upgraded: shockBotState?.upgraded ?? null,
                used: shockBotState?.activationsUsedThisTurn ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            shockBot: 1,
            tokenLimit: 2,
            built: true,
            upgraded: true,
            used: 0,
        });

        await game.screenshot('artificer-workshop-upgrade-shock-bot-after-click', testInfo);
    });
});
