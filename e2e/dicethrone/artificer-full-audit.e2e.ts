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
import '../../src/games/dicethrone/domain';

type JsonRecord = Record<string, any>;

const ARTIFICER = 'artificer';
const MONK = 'monk';

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
                postDamageFollowUpResolved: state?.core?.pendingAttack?.postDamageFollowUpResolved ?? false,
                settlementStage: state?.core?.pendingAttack?.settlementStage ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            shockBot: 0,
            defenderHp: 47,
            postDamageFollowUpResolved: true,
            settlementStage: 'readyToResolve',
            interactionKind: null,
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
                postDamageFollowUpResolved: state?.core?.pendingAttack?.postDamageFollowUpResolved ?? false,
                settlementStage: state?.core?.pendingAttack?.settlementStage ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                bonusDieFaces: (state?.sys?.eventStream?.entries ?? [])
                    .map((entry: JsonRecord) => entry?.event)
                    .filter((event: JsonRecord) => event?.type === 'BONUS_DIE_ROLLED')
                    .map((event: JsonRecord) => event?.payload?.face),
            };
        }, { timeout: 10000 }).toMatchObject({
            synth: 0,
            healBot: 0,
            artificerHp: 41,
            postDamageFollowUpResolved: true,
            settlementStage: 'readyToResolve',
            interactionKind: null,
            bonusDieFaces: ['wrench'],
        });

        await game.screenshot('artificer-post-damage-heal-bot-after-choice', testInfo);
    });
});
