import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    dispatchDiceThroneCommand,
    waitForDiceThroneHarness,
} from '../helpers/dicethrone';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STATUS_IDS, TOKEN_IDS, VAMPIRE_LORD_DICE_FACE_IDS } from '../../src/games/dicethrone/domain/ids';
import { buildHeroAbilitiesForFace, initHeroState } from '../../src/games/dicethrone/domain/characters';
import { getPendingAttackExpectedDamage } from '../../src/games/dicethrone/domain/utils';

const VAMPIRE_LORD_HERO_ID = 'vampire_lord';
const DEFENDER_HERO_ID = 'barbarian';
const VAMPIRE_LORD_QUERY = { playerID: '0', disableLocalAiAutomation: true };
const FIXED_E2E_RANDOM = {
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (min: number, _max: number) => min,
    shuffle: <T>(array: T[]) => array,
};

const VAMPIRE_LORD_DICE_FACE_BY_VALUE: Record<number, string> = {
    1: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
    2: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
    3: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
    4: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
    5: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
    6: VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
};

const buildVampireLordDice = (values: readonly number[]) => values.map((value, index) => {
    const symbol = VAMPIRE_LORD_DICE_FACE_BY_VALUE[value];
    return {
        id: index,
        value,
        symbol,
        symbols: [symbol],
        isKept: false,
        ownerId: '0',
        definitionId: 'vampire_lord-dice',
    };
});

const getLastEventTypes = (state: any): string[] => (
    (state?.sys?.eventStream?.entries ?? [])
        .slice(-12)
        .map((entry: any) => entry?.event?.type)
        .filter(Boolean)
);

const buildVampireLordBloodPossessed2Player = () => {
    const player = initHeroState('0', VAMPIRE_LORD_HERO_ID, FIXED_E2E_RANDOM);
    const abilityLevels = {
        ...player.abilityLevels,
        'blood-possessed': 2,
    };

    return {
        ...player,
        hand: [],
        deck: [],
        discard: [],
        resources: {
            ...player.resources,
            [RESOURCE_IDS.CP]: 2,
            [RESOURCE_IDS.HP]: 50,
        },
        tokens: {
            ...player.tokens,
            [TOKEN_IDS.BLOOD_POWER]: 0,
            [TOKEN_IDS.MESMERIZE]: 0,
        },
        statusEffects: {
            ...player.statusEffects,
            [STATUS_IDS.BLEED]: 0,
        },
        abilities: buildHeroAbilitiesForFace(VAMPIRE_LORD_HERO_ID, player.playerBoardFace, abilityLevels),
        abilityLevels,
        upgradeCardByAbilityId: {
            ...player.upgradeCardByAbilityId,
            'blood-possessed': {
                cardId: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction',
                cpCost: 2,
            },
        },
    };
};

const buildBarbarianDefensePlayer = () => {
    const player = initHeroState('1', DEFENDER_HERO_ID, FIXED_E2E_RANDOM);

    return {
        ...player,
        hand: [],
        deck: [],
        discard: [],
        resources: {
            ...player.resources,
            [RESOURCE_IDS.CP]: 2,
            [RESOURCE_IDS.HP]: 50,
        },
        tokens: {
            ...player.tokens,
            [TOKEN_IDS.SNEAK]: 0,
        },
        statusEffects: {
            ...player.statusEffects,
            [STATUS_IDS.BLEED]: 0,
        },
    };
};

const clickResolvedAbilitySlot = async (
    page: Page,
    slotId: string,
    expectedBaseAbilityId: string,
    expectedAbilityId: string,
): Promise<void> => {
    const slot = page.locator(`[data-testid="player-board-surface"] [data-ability-slot="${slotId}"]`).first();
    await expect(slot).toHaveAttribute('data-base-ability-id', expectedBaseAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-resolved-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-available-ability-id', expectedAbilityId, { timeout: 10000 });
    await expect(slot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
    await slot.click({ force: true });
};

const chooseBloodPossessed2VariantIfPrompted = async (page: Page): Promise<void> => {
    const variantModal = page.locator('#modal-root');
    const variantButton = variantModal.getByRole('button', { name: /魔血附身 II（小顺子）/ }).first();
    if (!await variantButton.isVisible({ timeout: 1500 }).catch(() => false)) return;

    await variantButton.click();
};

const dismissAttackShowcaseIfVisible = async (page: Page): Promise<void> => {
    const continueButton = page.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i }).first();
    if (!await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) return;

    await continueButton.click();
    await expect(continueButton).toBeHidden({ timeout: 5000 }).catch(() => undefined);
};

test.describe('DiceThrone 吸血鬼领主魔血附身 II 追加效果复现', () => {
    test('魔血附身 II 点击追加效果选项后不应停在选择弹窗', async ({ page, game }, testInfo) => {
        const vampireLord = buildVampireLordBloodPossessed2Player();
        const barbarian = buildBarbarianDefensePlayer();

        await game.openTestGame('dicethrone', VAMPIRE_LORD_QUERY);
        await game.setupScene({
            gameId: 'dicethrone',
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': VAMPIRE_LORD_HERO_ID, '1': DEFENDER_HERO_ID },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 0,
                rollLimit: 3,
                rollDiceCount: 5,
                rollConfirmed: false,
                dice: buildVampireLordDice([1, 2, 3, 4, 6]),
                currentRollContext: undefined,
                pendingAttack: null,
                pendingDamage: undefined,
                pendingBonusDiceSettlement: undefined,
                passiveActionUsedThisTurn: {
                    '0': {},
                },
                players: {
                    '0': vampireLord,
                    '1': barbarian,
                },
            },
        });

        await waitForDiceThroneHarness(page);
        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]').first();

        await expect(page.getByTestId('player-board-surface'))
            .toHaveAttribute('data-character-id', VAMPIRE_LORD_HERO_ID, { timeout: 10000 });
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3, 4, 6]);
        });
        await rollButton.click();

        await expect(confirmButton).toBeEnabled({ timeout: 10000 });
        await confirmButton.click();

        await clickResolvedAbilitySlot(page, 'combo', 'blood-possessed', 'blood-possessed-2-main');
        await chooseBloodPossessed2VariantIfPrompted(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const pendingAttack = state?.core?.pendingAttack;
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: pendingAttack?.sourceAbilityId ?? null,
                defenderId: pendingAttack?.defenderId ?? null,
                isDefendable: pendingAttack?.isDefendable ?? null,
                expectedDamage: pendingAttack ? getPendingAttackExpectedDamage(state.core, pendingAttack, 0) : null,
                attackDiceValues: pendingAttack?.attackDiceValues ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            sourceAbilityId: 'blood-possessed-2-main',
            defenderId: '1',
            isDefendable: true,
            expectedDamage: 8,
            attackDiceValues: [1, 2, 3, 4, 6],
        });

        await game.screenshot('魔血附身II-技能槽触发后', testInfo);
        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await dismissAttackShowcaseIfVisible(page);

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 2, 3]);
        });
        await dispatchDiceThroneCommand(page, { type: 'ROLL_DICE', playerId: '1' });
        await dispatchDiceThroneCommand(page, { type: 'CONFIRM_ROLL', playerId: '1' });
        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '1' });

        const modalRoot = page.locator('#modal-root');
        const hasChoiceModal = await modalRoot
            .getByText('魔血附身 II：选择追加效果')
            .isVisible({ timeout: 10000 })
            .catch(() => false);
        const afterDefenseSnapshot = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__?.state.get();
            const interaction = state?.sys?.interaction?.current;
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                interactionId: interaction?.id ?? null,
                interactionSource: interaction?.data?.sourceId ?? null,
                interactionTitle: interaction?.data?.title ?? null,
                currentChoiceSourceAbilityId: state?.core?.currentChoiceSourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack
                    ? {
                        sourceAbilityId: state.core.pendingAttack.sourceAbilityId,
                        defenderId: state.core.pendingAttack.defenderId,
                        settlementStage: state.core.pendingAttack.settlementStage ?? null,
                        damageResolved: state.core.pendingAttack.damageResolved ?? null,
                        resolvedDamage: state.core.pendingAttack.resolvedDamage ?? null,
                        postDamageFollowUpResolved: state.core.pendingAttack.postDamageFollowUpResolved ?? null,
                    }
                    : null,
                attackerMesmerize: state?.core?.players?.['0']?.tokens?.mesmerize ?? null,
                defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                defenderBleed: state?.core?.players?.['1']?.statusEffects?.bleed ?? null,
                modalText: document.querySelector('#modal-root')?.textContent ?? null,
                eventTypes: (state?.sys?.eventStream?.entries ?? [])
                    .slice(-12)
                    .map((entry: any) => entry?.event?.type)
                    .filter(Boolean),
            };
        });
        if (!hasChoiceModal) {
            throw new Error(`未出现“魔血附身 II：选择追加效果”弹窗；afterDefense=${JSON.stringify(afterDefenseSnapshot)}`);
        }
        const choiceSnapshotBeforeClick = await page.evaluate(() => {
            const state = window.__BG_TEST_HARNESS__?.state.get();
            const interaction = state?.sys?.interaction?.current;
            return {
                phase: state?.sys?.phase ?? null,
                interactionKind: interaction?.kind ?? null,
                interactionSource: interaction?.data?.sourceId ?? null,
                currentChoiceSourceAbilityId: state?.core?.currentChoiceSourceAbilityId ?? null,
                pendingAttackStage: state?.core?.pendingAttack?.settlementStage ?? null,
                options: (interaction?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    label: option.label,
                    customId: option.value?.customId,
                    value: option.value?.value,
                })),
            };
        });
        expect(choiceSnapshotBeforeClick).toMatchObject({
            phase: 'defensiveRoll',
            interactionKind: 'simple-choice',
            interactionSource: 'blood-possessed-2-main',
            currentChoiceSourceAbilityId: 'blood-possessed-2-main',
            pendingAttackStage: 'postDamagePending',
            options: [
                expect.objectContaining({ customId: 'vampire-lord-blood-possessed-inflict-bleed', value: 1 }),
                expect.objectContaining({ customId: 'vampire-lord-blood-possessed-gain-mesmerize', value: 1 }),
            ],
        });
        await game.screenshot('魔血附身II-追加效果弹窗-点击前', testInfo);

        const inflictBleedButton = modalRoot
            .locator('button[data-choice-custom-id="vampire-lord-blood-possessed-inflict-bleed"]')
            .first();
        await expect(inflictBleedButton).toBeVisible({ timeout: 5000 });
        await inflictBleedButton.click();

        const afterChoice = async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasInteraction: Boolean(state?.sys?.interaction?.current),
                currentChoiceSourceAbilityId: state?.core?.currentChoiceSourceAbilityId ?? null,
                pendingAttack: state?.core?.pendingAttack
                    ? {
                        sourceAbilityId: state.core.pendingAttack.sourceAbilityId,
                        settlementStage: state.core.pendingAttack.settlementStage ?? null,
                    }
                    : null,
                defenderHp: state?.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? null,
                defenderBleed: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.BLEED] ?? null,
                attackerMesmerize: state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.MESMERIZE] ?? null,
                eventTypes: getLastEventTypes(state),
                modalText: await modalRoot.textContent().catch(() => null),
            };
        };
        await expect.poll(afterChoice, { timeout: 10000 }).toEqual({
            phase: 'main2',
            hasInteraction: false,
            currentChoiceSourceAbilityId: null,
            pendingAttack: null,
            defenderHp: 42,
            defenderBleed: 1,
            attackerMesmerize: 0,
            eventTypes: expect.arrayContaining(['CHOICE_RESOLVED', 'ATTACK_RESOLVED']),
            modalText: '',
        });
        await expect(modalRoot.getByText('魔血附身 II：选择追加效果'))
            .toHaveCount(0);
        await game.screenshot('魔血附身II-追加效果点击后收口', testInfo);
    });
});
