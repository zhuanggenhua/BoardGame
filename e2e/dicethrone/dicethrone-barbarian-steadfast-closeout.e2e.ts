import { test, expect } from '../framework';
import { STATUS_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { STEADFAST_2 } from '../../src/games/dicethrone/heroes/barbarian/abilities';
import '../../src/games/dicethrone/domain';

const OPEN_TIMEOUT_MS = 45000;

async function dispatchHarnessCommand(
    page: any,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        await window.__BG_TEST_HARNESS__?.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
}

async function setupBarbarianSteadfast2Scene(page: any, game: any): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: '0' }, OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { HP: 50, CP: 3 },
            tokens: {},
        },
        player1: {
            resources: { HP: 50, CP: 3 },
            tokens: {},
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'barbarian', '1': 'moon_elf' },
            hostStarted: true,
            activePlayerId: '0',
            currentPlayer: '0',
            currentPlayerIndex: 0,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 4, isKept: false, isLocked: false, playerId: '0' },
                { id: 1, value: 4, isKept: false, isLocked: false, playerId: '0' },
                { id: 2, value: 4, isKept: false, isLocked: false, playerId: '0' },
                { id: 3, value: 1, isKept: false, isLocked: false, playerId: '0' },
                { id: 4, value: 6, isKept: false, isLocked: false, playerId: '0' },
            ],
            pendingAttack: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: undefined,
            activatingAbilityId: undefined,
        },
    });

    await page.evaluate(({ upgradedAbility, poisonId, hpKey, cpKey }) => {
        const harness = window.__BG_TEST_HARNESS__;
        const current = harness?.state?.get?.();
        if (!current || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        const players = { ...(current.core?.players ?? {}) };
        const barbarian = { ...(players['0'] ?? {}) };
        players['0'] = {
            ...barbarian,
            abilities: Array.isArray(barbarian.abilities)
                ? barbarian.abilities.map((ability: any) => (ability?.id === 'steadfast' ? upgradedAbility : ability))
                : barbarian.abilities,
            abilityLevels: {
                ...(barbarian.abilityLevels ?? {}),
                steadfast: 2,
            },
            upgradeCardByAbilityId: {
                ...(barbarian.upgradeCardByAbilityId ?? {}),
                steadfast: { cardId: 'upgrade-steadfast-2', cpCost: 2 },
            },
            resources: {
                ...(barbarian.resources ?? {}),
                [hpKey]: 50,
                [cpKey]: 3,
            },
            statusEffects: {
                ...(barbarian.statusEffects ?? {}),
                [poisonId]: 1,
            },
        };

        return harness.state.set({
            ...current,
            core: {
                ...current.core,
                players,
                activePlayerId: '0',
                currentPlayer: '0',
                currentPlayerIndex: 0,
            },
            sys: {
                ...(current.sys ?? {}),
                phase: 'offensiveRoll',
                interaction: {
                    ...((current.sys?.interaction ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
                responseWindow: {
                    ...((current.sys?.responseWindow ?? {}) as Record<string, unknown>),
                    current: undefined,
                },
            },
        });
    }, {
        upgradedAbility: STEADFAST_2,
        poisonId: STATUS_IDS.POISON,
        hpKey: RESOURCE_IDS.HP,
        cpKey: RESOURCE_IDS.CP,
    });

    await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'barbarian', { timeout: 10000 });
}

async function selectSteadfast2ThreeHearts(page: any): Promise<void> {
    await dispatchHarnessCommand(page, 'CONFIRM_ROLL', '0');
    await expect.poll(async () => {
        const state = await page.evaluate(() => window.__BG_TEST_HARNESS__?.state?.get?.());
        return {
            phase: state?.sys?.phase ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            resolvedAbilityIds: state?.core?.availableAbilityIds ?? state?.core?.availableAbilities ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'offensiveRoll',
        rollConfirmed: true,
    });

    await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: 'steadfast-2-3' });
}

async function clickResolveAttack(page: any): Promise<void> {
    const resolveAttackButton = page.getByRole('button', { name: /结算攻击|Resolve Attack/i }).first();
    if (
        await resolveAttackButton.isVisible({ timeout: 2000 }).catch(() => false)
        && await resolveAttackButton.isEnabled({ timeout: 1000 }).catch(() => false)
    ) {
        await resolveAttackButton.click();
        return;
    }

    await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');
}

test.describe('DiceThrone 野蛮人坚韧 II 真实页面收口', () => {
    test('坚韧 II 清状态后不会卡在进攻阶段，结算攻击可继续进入 main2', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await setupBarbarianSteadfast2Scene(page, game);
        await game.screenshot('坚韧II清状态前-野蛮人带中毒', testInfo);

        await selectSteadfast2ThreeHearts(page);
        await clickResolveAttack(page);

        await page.waitForFunction(() => {
            const state = window.__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.interaction?.current?.data?.type === 'selectStatus'
                && state?.core?.players?.['0']?.statusEffects?.poison === 1
                && state?.core?.players?.['0']?.resources?.hp === 55;
        }, { timeout: 10000, polling: 200 });

        await expect(page.getByTestId('dt-status-effect-0-poison')).toBeVisible({ timeout: 10000 });
        await game.screenshot('坚韧II清状态交互-中毒可选', testInfo);

        await page.getByTestId('dt-status-effect-0-poison').click();
        await expect(page.getByRole('button', { name: /确认|Confirm/i }).last()).toBeEnabled({ timeout: 5000 });
        await page.getByRole('button', { name: /确认|Confirm/i }).last().click();

        await page.waitForFunction(() => {
            const state = window.__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && state?.core?.players?.['0']?.statusEffects?.poison === 0
                && state?.core?.players?.['0']?.resources?.hp === 55
                && state?.sys?.phase === 'main2'
                && !state?.core?.pendingAttack
                && !state?.core?.pendingDamage;
        }, { timeout: 10000, polling: 200 });

        await expect(page.getByRole('button', { name: /结算攻击|Resolve Attack/i })).toHaveCount(0);
        await game.screenshot('坚韧II收口完成-main2无结算攻击残留', testInfo);
    });
});
