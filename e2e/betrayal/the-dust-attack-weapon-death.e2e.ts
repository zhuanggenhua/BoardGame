import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustAttackWeaponDeathRuntimeCore,
    type DustAttackWeaponE2ECardId,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';
import type { BetrayalCore, BetrayalTraitKey } from '../../src/games/betrayal/game';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-attack-weapon-death';
const ATTACKER_ID = '0';
const DEFENDER_ID = '1';
const ALREADY_DEAD_ID = '2';
const SHARED_ROOM_ID = 'hallway';

const attackerUrl = (suffix: string) =>
    `/play/betrayal?players=3&playerID=${ATTACKER_ID}&seat0=human&seat1=human&seat2=human&seed=the-dust-attack-weapon-${suffix}`;

const defenderUrl = (suffix: string) =>
    `/play/betrayal?players=3&playerID=${DEFENDER_ID}&seat0=human&seat1=human&seat2=human&seed=the-dust-attack-weapon-${suffix}-defender`;

type AttackWeaponCase = {
    cardId: DustAttackWeaponE2ECardId;
    cardName: string;
    damageKind: 'physical' | 'mental';
    damageLabel: string;
    allocationTrait: BetrayalTraitKey;
    allowedTraitLabels: string[];
    randomQueue: number[];
    screenshotPrefix: string;
};

const weaponCases: AttackWeaponCase[] = [
    {
        cardId: 'hunting-knife',
        cardName: '砍刀',
        damageKind: 'physical',
        damageLabel: '物理',
        allocationTrait: 'might',
        allowedTraitLabels: ['力量', '速度'],
        randomQueue: [0.99, 0.99, 0.01],
        screenshotPrefix: '01-砍刀',
    },
    {
        cardId: 'dagger',
        cardName: '匕首',
        damageKind: 'physical',
        damageLabel: '物理',
        allocationTrait: 'might',
        allowedTraitLabels: ['力量', '速度'],
        randomQueue: [0.99, 0.99, 0.99, 0.99, 0.01],
        screenshotPrefix: '02-匕首',
    },
    {
        cardId: 'ring',
        cardName: '指环',
        damageKind: 'mental',
        damageLabel: '精神',
        allocationTrait: 'sanity',
        allowedTraitLabels: ['知识', '神志'],
        randomQueue: [0.99, 0.99, 0.01],
        screenshotPrefix: '03-指环',
    },
];

type DustAttackWeaponDeathState = {
    phase?: string;
    currentPlayer?: string;
    currentRoomId?: string | null;
    otherRooms?: Record<string, string | null>;
    currentInventoryNames?: string[];
    defenderInventoryNames?: string[];
    usedCardIdsThisTurn?: string[];
    pendingDamageAllocation?: {
        playerId?: string;
        sourceTitle?: string;
        damageKind?: string;
        amount?: number;
        allowedTraits?: string[];
        allowSkull?: boolean;
    } | null;
    recentRoll?: {
        kind?: string;
        sourceTitle?: string;
        latestLabel?: string;
        attack?: {
            weaponCardId?: string;
            weaponName?: string;
            previousDamageToDefender?: number;
        };
    } | null;
    deadPlayerIds?: string[];
    feverishPlayerIds?: string[];
    feverishRoomId?: string | null;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    latestLog?: string;
};

const readDustAttackWeaponDeathState = async (
    page: Page,
): Promise<DustAttackWeaponDeathState> =>
    page.evaluate(({ feverishId, defenderId }) => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: BetrayalCore;
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const defender = [core?.currentExplorer, ...(core?.otherExplorers ?? [])]
            .find((explorer) => explorer?.playerId === defenderId);
        const feverish = core?.monsters?.find((monster) => monster.id === feverishId);
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            currentRoomId: core?.currentExplorer?.roomId ?? null,
            otherRooms: Object.fromEntries(
                (core?.otherExplorers ?? []).map((explorer) => [
                    explorer.playerId,
                    explorer.roomId ?? null,
                ]),
            ),
            currentInventoryNames: core?.currentExplorer?.inventory?.map((card) => card.name) ?? [],
            defenderInventoryNames: defender?.inventory?.map((card) => card.name) ?? [],
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            recentRoll: core?.recentRoll
                ? {
                    kind: core.recentRoll.kind,
                    sourceTitle: core.recentRoll.sourceTitle,
                    latestLabel: core.recentRoll.latestLabel,
                    attack: core.recentRoll.attack
                        ? {
                            weaponCardId: core.recentRoll.attack.weaponCardId,
                            weaponName: core.recentRoll.attack.weaponName,
                            previousDamageToDefender: core.recentRoll.attack.previousDamageToDefender,
                        }
                        : undefined,
                }
                : null,
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            feverishRoomId: feverish?.roomId ?? null,
            endgameResult: core?.endgameResult ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? '',
        };
    }, { feverishId: `feverish-${DEFENDER_ID}`, defenderId: DEFENDER_ID });

const readHarnessCore = async (page: Page): Promise<BetrayalCore> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: { get?: () => { core?: BetrayalCore } };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        if (!core) {
            throw new Error('betrayal test harness core reader unavailable');
        }
        return core;
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const waitForPendingWeaponDamage = async (
    page: Page,
    weaponCase: AttackWeaponCase,
): Promise<DustAttackWeaponDeathState> => {
    let latestState: DustAttackWeaponDeathState = {};
    await expect.poll(async () => {
        latestState = await readDustAttackWeaponDeathState(page);
        return {
            pendingDamageAllocation: latestState.pendingDamageAllocation,
            usedCardIdsThisTurn: latestState.usedCardIdsThisTurn,
            recentWeaponName: latestState.recentRoll?.attack?.weaponName,
            latestLog: latestState.latestLog,
        };
    }).toMatchObject({
        pendingDamageAllocation: {
            playerId: DEFENDER_ID,
            sourceTitle: '攻击',
            damageKind: weaponCase.damageKind,
            allowedTraits: weaponCase.damageKind === 'physical'
                ? ['might', 'speed']
                : ['knowledge', 'sanity'],
            allowSkull: true,
        },
        usedCardIdsThisTurn: expect.arrayContaining(['haunt-attack', weaponCase.cardId]),
        recentWeaponName: weaponCase.cardName,
        latestLog: expect.stringContaining(`使用${weaponCase.cardName}`),
    });
    return latestState;
};

test.describe('山屋惊魂作祟3灰尘攻击武器致死完整链', () => {
    for (const weaponCase of weaponCases) {
        test(`${weaponCase.cardName}可从真实页面声明武器攻击并在分配后触发狂热病患终局`, async ({
            page,
            context,
        }) => {
            test.setTimeout(120000);
            const diagnostics = attachPageDiagnostics(
                page,
                `betrayal-the-dust-attack-weapon-death-${weaponCase.cardId}`,
            );

            await initBetrayalContext(context);
            await page.setViewportSize({ width: 1600, height: 900 });
            await warmBetrayalFrontend(context);
            await page.goto(attackerUrl(weaponCase.cardId), {
                waitUntil: 'domcontentloaded',
            });
            await waitForBetrayalPageReady(page);

            await injectCore(page, createDustAttackWeaponDeathRuntimeCore(weaponCase.cardId));
            await expect(page.getByTestId('betrayal-board')).toBeVisible({
                timeout: 30000,
            });
            await dismissHauntRevealCueIfVisible(page);
            await expect.poll(() => readDustAttackWeaponDeathState(page)).toMatchObject({
                phase: 'haunt',
                currentPlayer: ATTACKER_ID,
                currentRoomId: SHARED_ROOM_ID,
                otherRooms: {
                    [DEFENDER_ID]: SHARED_ROOM_ID,
                    [ALREADY_DEAD_ID]: 'entrance-hall',
                },
                currentInventoryNames: [weaponCase.cardName],
                defenderInventoryNames: ['地图'],
                pendingDamageAllocation: null,
                deadPlayerIds: [ALREADY_DEAD_ID],
                feverishPlayerIds: [],
                endgameResult: null,
            });

            await expect(page.getByTestId('betrayal-attack-weapon-selector')).toBeVisible();
            await expect(
                page.getByTestId(`betrayal-attack-weapon-${weaponCase.cardId}`),
            ).not.toBeDisabled();
            await page.getByTestId(`betrayal-attack-weapon-${weaponCase.cardId}`).click();

            const attackAction = page.getByTestId('betrayal-action-use');
            const defenderToken = page.getByTestId(
                `betrayal-room-occupant-${SHARED_ROOM_ID}-${DEFENDER_ID}`,
            );
            await expect(attackAction).toContainText('攻击灰尘');
            await attackAction.click();
            await expect(attackAction).toHaveAttribute(
                'data-haunt-primary-action-mode',
                'targeting',
            );
            await expect(defenderToken).toHaveAttribute('data-direct-target', 'true');
            await expect(
                page.getByTestId(
                    `betrayal-room-occupant-target-outline-${SHARED_ROOM_ID}-${DEFENDER_ID}`,
                ),
            ).toHaveAttribute('data-highlight-shape', 'pentagon');
            await saveScreenshot(
                page,
                `${EVIDENCE_DIR}/${weaponCase.screenshotPrefix}-选择武器并高亮目标.jpg`,
            );

            await setHarnessRandomQueue(page, weaponCase.randomQueue);
            await defenderToken.click();
            const pendingState = await waitForPendingWeaponDamage(page, weaponCase);
            const defenderAllocationCore = await readHarnessCore(page);

            await page.goto(defenderUrl(weaponCase.cardId), {
                waitUntil: 'domcontentloaded',
            });
            await waitForBetrayalPageReady(page);
            await injectCore(page, defenderAllocationCore);
            await dismissHauntRevealCueIfVisible(page);

            const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
            await expect(damagePanel).toBeVisible();
            await expect(damagePanel).toHaveAttribute('data-player-id', DEFENDER_ID);
            await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('攻击');
            await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText(
                `${pendingState.pendingDamageAllocation?.amount} 点${weaponCase.damageLabel}伤害`,
            );
            for (const traitLabel of weaponCase.allowedTraitLabels) {
                await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText(
                    traitLabel,
                );
            }
            await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
            await saveScreenshot(
                page,
                `${EVIDENCE_DIR}/${weaponCase.screenshotPrefix}-武器攻击后伤害分配.jpg`,
            );

            const allocationClicks = pendingState.pendingDamageAllocation?.amount ?? 0;
            const damageTrait = page.getByTestId(
                `betrayal-damage-allocation-trait-${weaponCase.allocationTrait}`,
            );
            for (let index = 0; index < allocationClicks; index += 1) {
                await damageTrait.click();
            }
            await expect(damageTrait).toHaveAttribute(
                'data-damage-selected-count',
                String(allocationClicks),
            );
            await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
            await page.getByTestId('betrayal-damage-allocation-confirm').click();

            const endgameScreen = page.getByTestId('betrayal-endgame-screen');
            await expect(endgameScreen).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('betrayal-endgame-ending-stage')).toBeVisible();
            await expect(page.getByTestId('betrayal-endgame-ending-narration')).toContainText(
                '结局朗读',
            );
            await expect(page.getByTestId('betrayal-endgame-ending-narration')).toContainText(
                '狂热病患冲出房屋',
            );
            await expect(page.getByTestId('betrayal-endgame-ending-source-status')).toContainText(
                '官方 If You Win 原文 / 正式翻译',
            );
            await page.getByTestId('betrayal-endgame-ending-continue').click();
            await expect(page.getByTestId('betrayal-endgame-result-report')).toBeVisible();
            await expect(endgameScreen).toContainText('灰尘');
            await expect(endgameScreen).toContainText('叛徒得逞');
            await expect.poll(() => readDustAttackWeaponDeathState(page)).toMatchObject({
                phase: 'endgame',
                pendingDamageAllocation: null,
                defenderInventoryNames: [],
                deadPlayerIds: expect.arrayContaining([DEFENDER_ID, ALREADY_DEAD_ID]),
                feverishPlayerIds: expect.arrayContaining([DEFENDER_ID]),
                feverishRoomId: SHARED_ROOM_ID,
                endgameResult: {
                    hauntId: 'the-dust',
                    outcome: 'traitor',
                    winners: [ATTACKER_ID],
                },
            });
            await saveScreenshot(
                page,
                `${EVIDENCE_DIR}/${weaponCase.screenshotPrefix}-确认分配后狂热病患终局.jpg`,
            );

            assertNoFatalFrontendErrors([
                {
                    label: `betrayal-the-dust-attack-weapon-death-${weaponCase.cardId}`,
                    diagnostics,
                },
            ]);
        });
    }
});
