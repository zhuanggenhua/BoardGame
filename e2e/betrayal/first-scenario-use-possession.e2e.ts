import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createMaskMoveReadyRuntimeCore,
    createMedicalKitUseReadyRuntimeCore,
    createSkeletonKeyMoveReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-物品使用完整链路';
const USE_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-使用前牌桌可操作.jpg`;
const ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-急救包本体已选中.jpg`;
const TARGET_AVAILABLE_SCREENSHOT = `${EVIDENCE_DIR}/03-同房间队友目标可选.jpg`;
const TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/04-同房间队友目标已选中.jpg`;
const USE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/05-急救包结算结果可见.jpg`;
const USE_RETURNED_SCREENSHOT = `${EVIDENCE_DIR}/06-物品使用后回牌桌状态清空.jpg`;

const MASK_EVIDENCE_DIR = 'evidence/山屋惊魂-面具移动完整链路';
const MASK_READY_SCREENSHOT = `${MASK_EVIDENCE_DIR}/01-面具使用前牌桌可操作.jpg`;
const MASK_SELECTED_SCREENSHOT = `${MASK_EVIDENCE_DIR}/02-面具本体已选中.jpg`;
const MASK_TARGET_TOKEN_SCREENSHOT = `${MASK_EVIDENCE_DIR}/03-同房间队友目标已激活.jpg`;
const MASK_TARGET_ROOM_SCREENSHOT = `${MASK_EVIDENCE_DIR}/04-选择相邻房间并确认前.jpg`;
const MASK_SETTLED_SCREENSHOT = `${MASK_EVIDENCE_DIR}/05-面具移动结算结果可见.jpg`;
const MASK_RETURNED_SCREENSHOT = `${MASK_EVIDENCE_DIR}/06-面具使用后回牌桌状态清空.jpg`;

const SKELETON_KEY_EVIDENCE_DIR = 'evidence/山屋惊魂-骨制钥匙穿墙移动完整链路';
const SKELETON_KEY_READY_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/01-骨制钥匙移动前牌桌可操作.jpg`;
const SKELETON_KEY_CARD_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/02-骨制钥匙本体规则可见.jpg`;
const SKELETON_KEY_TARGETS_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/03-打开移动模式看到穿墙目标.jpg`;
const SKELETON_KEY_TARGET_HOVER_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/04-点击穿墙目标前.jpg`;
const SKELETON_KEY_SETTLED_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/05-骨制钥匙移动结算结果可见.jpg`;
const SKELETON_KEY_RETURNED_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/06-骨制钥匙移动后回牌桌状态清空.jpg`;

async function waitForMedicalKitAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-medical-kit-front-atlas"]');
        return {
            asset: image?.getAttribute('data-asset-src') ?? '',
            loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        };
    }), {
        message: '急救包必须使用正式物品牌面 atlas，不能退回纯文字物品',
        timeout: 15000,
    }).toEqual({
        asset: expect.stringContaining('item-front-atlas'),
        loaded: true,
    });
}

async function readUseChainState(page: Page) {
    return page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };
        const useButton = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-use"]');
        const selectedName = document.querySelector('[data-testid="betrayal-selected-inventory-card-name"]')?.textContent?.trim() ?? '';
        const feedback = document.querySelector('[data-testid="betrayal-room-latest-feedback"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const useStatus = document.querySelector('[data-testid="betrayal-use-status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const targetSelector = document.querySelector('[data-testid="betrayal-inventory-target-player-selector"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const targetOutline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        const targetOutlineStyle = targetOutline ? window.getComputedStyle(targetOutline) : null;
        return {
            medicalKit: rectOf('betrayal-inventory-medical-kit'),
            useButton: rectOf('betrayal-action-use'),
            useButtonDisabled: Boolean(useButton?.disabled),
            selectedName,
            feedback,
            useStatus,
            targetSelector,
            targetOutlineBorderColor: targetOutlineStyle?.borderTopColor ?? '',
            targetOutlineShape: targetOutline?.getAttribute('data-highlight-shape') ?? '',
            targetDirect: document.querySelector('[data-testid="betrayal-room-occupant-hallway-1"]')?.getAttribute('data-direct-target') ?? '',
        };
    });
}

async function assertMedicalKitUseReady(page: Page) {
    const metrics = await readUseChainState(page);
    expect(metrics.medicalKit, '使用前必须看得到急救包本体').not.toBeNull();
    expect(metrics.medicalKit!.width, '急救包必须保持真实牌面宽度，不能退成小文字选项').toBeGreaterThanOrEqual(58);
    expect(metrics.useButton, '使用按钮必须存在于真实动作区').not.toBeNull();
    expect(metrics.useButton!.width, '使用按钮必须保持可点击尺寸').toBeGreaterThanOrEqual(80);
    expect(metrics.selectedName, '使用前不能已有选中物品').toBe('');
    expect(metrics.useButtonDisabled, '未选物品和目标前，使用按钮应禁用').toBe(true);
}

async function assertMedicalKitSelectedNeedsTarget(page: Page) {
    const metrics = await readUseChainState(page);
    expect(metrics.selectedName, '点击急救包本体后必须选中急救包').toContain('急救包');
    expect(metrics.targetSelector, '急救包选中后必须显示治疗目标选择提示').toContain('急救包');
    expect(metrics.targetSelector, '急救包选中后必须列出同房间队友').toContain('AI 2 号位');
    expect(metrics.targetDirect, '治疗目标主路径必须点击地图上的队友 token 本体').toBe('true');
    expect(metrics.targetOutlineShape, '治疗目标高亮必须贴合玩家 token').toBe('pentagon');
    expect(metrics.useButtonDisabled, '未选择治疗目标前不能直接使用').toBe(true);
}

async function assertMedicalKitTargetSelected(page: Page) {
    const metrics = await readUseChainState(page);
    expect(metrics.selectedName, '选择目标后仍必须保留急救包为待使用对象').toContain('急救包');
    expect(metrics.targetOutlineBorderColor, '选中同房间队友后目标高亮应变为已选状态').toBe('rgb(209, 176, 95)');
    expect(metrics.useButtonDisabled, '选中急救包和治疗目标后，使用按钮必须可点击').toBe(false);
}

async function assertMedicalKitSettled(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentExplorer?: { inventory?: Array<{ id: string; name: string }> };
                            otherExplorers?: Array<{
                                playerId: string;
                                traits?: Record<string, number>;
                            }>;
                            usedCardIdsThisTurn?: string[];
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        const teammate = state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1');
        return {
            currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            teammateTraits: teammate?.traits ?? {},
            usedCards: state?.core?.usedCardIdsThisTurn ?? [],
            latestLog: state?.core?.activityLog?.[0]?.text ?? '',
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    }), {
        message: '急救包使用后必须消耗物品、治疗队友并写入活动日志',
        timeout: 10000,
    }).toMatchObject({
        currentInventory: expect.not.arrayContaining(['急救包']),
        teammateTraits: {
            might: expect.any(Number),
            speed: expect.any(Number),
            knowledge: expect.any(Number),
            sanity: expect.any(Number),
        },
        usedCards: expect.arrayContaining(['medical-kit']),
        latestLog: expect.stringMatching(/埋葬急救包|治疗丽贝卡·艾伦博士/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/埋葬急救包|治疗丽贝卡·艾伦博士/);
    await expect(page.getByTestId('betrayal-inventory-medical-kit'), '急救包使用后必须从当前持有区消失').toHaveCount(0);
}

async function assertMedicalKitSelectionCleared(page: Page) {
    await expect(page.getByTestId('betrayal-selected-inventory-card-name'), '物品使用结算后不能残留已选物品').toHaveCount(0);
    await expect(page.getByTestId('betrayal-inventory-target-player-selector'), '物品使用结算后目标选择提示必须清空').toHaveCount(0);
    const targetState = await page.evaluate(() => {
        const outline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        const outlineStyle = outline ? window.getComputedStyle(outline) : null;
        return {
            outlineBorderColor: outlineStyle?.borderTopColor ?? '',
        };
    });
    expect(targetState.outlineBorderColor, '物品使用结算后队友不能继续保持治疗已选金色实线；同房间交易候选高亮可以继续存在').not.toBe('rgb(209, 176, 95)');
    await expect(page.getByTestId('betrayal-board'), '物品使用后必须回到可操作牌桌').toBeVisible();
    await expect(page.getByTestId('betrayal-action-use'), '物品使用后仍保留使用动作入口，但因无可用物品禁用').toBeDisabled();
}

async function waitForMaskAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-mask-front-atlas"]');
        return {
            asset: image?.getAttribute('data-asset-src') ?? '',
            loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        };
    }), {
        message: '面具必须使用正式预兆牌面 atlas，不能退回纯文字牌',
        timeout: 15000,
    }).toEqual({
        asset: expect.stringContaining('omen-front-atlas'),
        loaded: true,
    });
}

async function readMaskChainState(page: Page) {
    return page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };
        const useButton = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-use"]');
        const selectedName = document.querySelector('[data-testid="betrayal-selected-inventory-card-name"]')?.textContent?.trim() ?? '';
        const maskSelector = document.querySelector('[data-testid="betrayal-mask-target-selector"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const activeTarget = document.querySelector('[data-testid="betrayal-mask-active-target-1"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const firstRoomHighlight = document.querySelector<HTMLElement>('[data-testid^="betrayal-room-mask-target-card-highlight-"]');
        const firstTargetRoomId = firstRoomHighlight?.dataset.testid?.replace('betrayal-room-mask-target-card-highlight-', '') ?? '';
        const targetOutline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        const targetToken = document.querySelector('[data-testid="betrayal-room-occupant-hallway-1"]');
        return {
            mask: rectOf('betrayal-inventory-mask'),
            useButton: rectOf('betrayal-action-use'),
            useButtonDisabled: Boolean(useButton?.disabled),
            selectedName,
            maskSelector,
            activeTarget,
            targetTokenDirect: targetToken?.getAttribute('data-direct-target') ?? '',
            targetTokenShape: targetToken?.getAttribute('data-highlight-shape') ?? '',
            targetOutlineVisible: Boolean(targetOutline),
            firstTargetRoomId,
        };
    });
}

async function assertMaskUseReady(page: Page) {
    const metrics = await readMaskChainState(page);
    expect(metrics.mask, '使用前必须看得到面具本体').not.toBeNull();
    expect(metrics.mask!.width, '面具必须保持真实牌面宽度，不能退成小文字选项').toBeGreaterThanOrEqual(58);
    expect(metrics.useButton, '使用按钮必须存在于真实动作区').not.toBeNull();
    expect(metrics.useButtonDisabled, '未选面具和目标房间前，使用按钮应禁用').toBe(true);
    expect(metrics.selectedName, '使用前不能已有选中物品').toBe('');
}

async function assertMaskSelectedNeedsTarget(page: Page) {
    const metrics = await readMaskChainState(page);
    expect(metrics.selectedName, '点击面具本体后必须选中面具').toContain('面具');
    expect(metrics.maskSelector, '面具选中后必须显示面具目标选择器').toContain('面具');
    expect(metrics.maskSelector, '面具选中后必须列出同房间队友').toContain('AI 2 号位');
    expect(metrics.targetTokenDirect, '面具目标主路径必须点击地图上的队友 token 本体').toBe('true');
    expect(metrics.targetTokenShape, '面具目标高亮必须贴合玩家 token').toBe('pentagon');
    expect(metrics.targetOutlineVisible, '同房间队友 token 必须有可移动目标高亮').toBe(true);
    expect(metrics.firstTargetRoomId, '面具必须提供至少一个相邻房间目标').not.toBe('');
    expect(metrics.useButtonDisabled, '未选择目标房间前不能直接使用面具').toBe(true);
}

async function selectFirstMaskTargetRoom(page: Page): Promise<string> {
    const targetRoomId = await page.evaluate(() => {
        const highlight = document.querySelector<HTMLElement>('[data-testid^="betrayal-room-mask-target-card-highlight-"]');
        return highlight?.dataset.testid?.replace('betrayal-room-mask-target-card-highlight-', '') ?? '';
    });
    expect(targetRoomId, '面具必须提供真实相邻房间高亮').not.toBe('');
    await page.getByTestId(`betrayal-room-${targetRoomId}`).click();
    return targetRoomId;
}

async function assertMaskTargetRoomSelected(page: Page, targetRoomId: string) {
    const metrics = await readMaskChainState(page);
    expect(metrics.selectedName, '选择目标房间后仍必须保留面具为待使用对象').toContain('面具');
    expect(metrics.activeTarget, '目标房间选好后，面具目标行不能继续显示待选择').not.toContain('待');
    await expect(page.getByTestId(`betrayal-room-mask-target-card-highlight-${targetRoomId}`), '相邻房间必须保持已选高亮').toBeVisible();
    await expect(page.getByTestId('betrayal-action-use'), '选中面具、队友和目标房间后，使用按钮必须可点击').toBeEnabled();
}

async function assertMaskSettled(page: Page, targetRoomId: string) {
    await expect.poll(async () => page.evaluate((roomId) => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentExplorer?: { inventory?: Array<{ id: string; name: string }>; roomId?: string };
                            otherExplorers?: Array<{ playerId: string; roomId?: string; inventory?: Array<{ id: string; name: string }> }>;
                            usedCardIdsThisTurn?: string[];
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        const teammate = state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1');
        return {
            currentRoomId: state?.core?.currentExplorer?.roomId ?? '',
            currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            teammateRoomId: teammate?.roomId ?? '',
            usedCards: state?.core?.usedCardIdsThisTurn ?? [],
            latestLog: state?.core?.activityLog?.[0]?.text ?? '',
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            expectedRoomId: roomId,
        };
    }, targetRoomId), {
        message: '面具使用后必须把同房间队友移动到相邻房间，并记录面具已使用',
        timeout: 10000,
    }).toMatchObject({
        currentRoomId: 'hallway',
        currentInventory: expect.arrayContaining(['面具']),
        teammateRoomId: targetRoomId,
        usedCards: expect.arrayContaining(['mask']),
        latestLog: expect.stringMatching(/使用面具|同板块其他角色/),
        rejected: null,
        expectedRoomId: targetRoomId,
    });
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/使用面具|同板块其他角色/);
    await expect(page.getByTestId(`betrayal-room-occupant-${targetRoomId}-1`), '面具结算后队友 token 必须出现在目标房间').toBeVisible();
}

async function assertMaskSelectionCleared(page: Page, targetRoomId: string) {
    await expect(page.getByTestId('betrayal-selected-inventory-card-name'), '面具使用结算后不能残留已选面具').toHaveCount(0);
    await expect(page.getByTestId('betrayal-mask-target-selector'), '面具使用结算后目标选择器必须清空').toHaveCount(0);
    await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-1'), '面具使用结算后原房间队友目标高亮必须清空').toHaveCount(0);
    await expect(page.getByTestId(`betrayal-room-mask-target-card-highlight-${targetRoomId}`), '面具使用结算后目标房间高亮必须清空').toHaveCount(0);
    await expect(page.getByTestId('betrayal-board'), '面具使用后必须回到可操作牌桌').toBeVisible();
}

async function waitForSkeletonKeyAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-lockpick-tool-front-atlas"]');
        return {
            asset: image?.getAttribute('data-asset-src') ?? '',
            loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        };
    }), {
        message: '骨制钥匙必须使用正式物品牌面 atlas，不能退回纯文字物品',
        timeout: 15000,
    }).toEqual({
        asset: expect.stringContaining('item-front-atlas'),
        loaded: true,
    });
}

async function readSkeletonKeyMoveState(page: Page) {
    return page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            activeRoomId?: string;
                            currentExplorer?: { roomId?: string; inventory?: Array<{ id: string; name: string }> };
                            movesRemaining?: number;
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const moveButton = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-move"]');
        const targetButton = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-room-upper-west"]');
        const targetHighlight = document.querySelector<HTMLElement>('[data-testid="betrayal-room-move-card-highlight-upper-west"]');
        const feedback = document.querySelector('[data-testid="betrayal-room-latest-feedback"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        return {
            lockpick: rectOf('betrayal-inventory-lockpick-tool'),
            moveButton: rectOf('betrayal-action-move'),
            moveButtonDisabled: Boolean(moveButton?.disabled),
            moveButtonText: moveButton?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            targetButton: rectOf('betrayal-room-upper-west'),
            targetButtonDisabled: Boolean(targetButton?.disabled),
            targetHighlight: rectOf('betrayal-room-move-card-highlight-upper-west'),
            targetHighlightTitle: targetHighlight?.getAttribute('title') ?? '',
            feedback,
            currentRoomId: state?.core?.currentExplorer?.roomId ?? '',
            activeRoomId: state?.core?.activeRoomId ?? '',
            inventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            movesRemaining: state?.core?.movesRemaining ?? null,
            latestLog: state?.core?.activityLog?.[0]?.text ?? '',
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });
}

async function assertSkeletonKeyMoveReady(page: Page) {
    const metrics = await readSkeletonKeyMoveState(page);
    expect(metrics.lockpick, '移动前必须看得到骨制钥匙本体').not.toBeNull();
    expect(metrics.lockpick!.width, '骨制钥匙必须保持真实牌面宽度，不能退成小文字选项').toBeGreaterThanOrEqual(58);
    expect(metrics.moveButton, '移动按钮必须存在于真实动作区').not.toBeNull();
    expect(metrics.moveButtonDisabled, '骨制钥匙移动前移动按钮必须可用').toBe(false);
    expect(metrics.moveButtonText, '移动前应处于默认牌桌态').toContain('移动');
    expect(metrics.moveButtonText, '移动前不能已经处于取消移动态').not.toContain('取消');
    expect(metrics.currentRoomId, '骨制钥匙链路必须从上层平台起跑').toBe('upper-landing');
    expect(metrics.inventory, '骨制钥匙必须在当前探索者持有区').toContain('骨制钥匙');
    expect(metrics.targetHighlightTitle, '同层相邻但未连门目标必须标成骨制钥匙穿墙移动').toContain('骨制钥匙');
}

async function assertSkeletonKeyTargetMode(page: Page) {
    const metrics = await readSkeletonKeyMoveState(page);
    expect(metrics.moveButtonText, '打开移动模式后动作按钮必须变成取消移动').toContain('取消移动');
    expect(metrics.targetButton, '穿墙目标房间必须在地图上可见').not.toBeNull();
    expect(metrics.targetButtonDisabled, '进入移动模式后穿墙目标房间必须可点击').toBe(false);
}

async function assertSkeletonKeySettled(page: Page) {
    await expect.poll(async () => readSkeletonKeyMoveState(page), {
        message: '骨制钥匙点击穿墙目标后必须移动到目标房间，并记录穿墙日志',
        timeout: 10000,
    }).toMatchObject({
        currentRoomId: 'upper-west',
        activeRoomId: 'upper-west',
        inventory: expect.arrayContaining(['骨制钥匙']),
        movesRemaining: 1,
        latestLog: expect.stringMatching(/使用骨制钥匙穿过墙壁|图书馆/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/使用骨制钥匙穿过墙壁|图书馆/);
}

async function assertSkeletonKeySelectionCleared(page: Page) {
    await expect(page.getByTestId('betrayal-room-move-card-highlight-upper-west'), '骨制钥匙结算后目标房间不能继续保持移动目标高亮').toHaveCount(0);
    await expect(page.getByTestId('betrayal-action-move'), '骨制钥匙移动后必须回到默认牌桌移动入口').toContainText('移动');
    await expect(page.getByTestId('betrayal-action-move'), '骨制钥匙移动后不应停在取消移动态').not.toContainText('取消');
    await expect(page.getByTestId('betrayal-board'), '骨制钥匙移动后必须回到可操作牌桌').toBeVisible();
}

test.describe('山屋惊魂首剧本物品使用交互', () => {
    test('真实页面选择急救包、选队友目标并完成治疗收口', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-use-possession');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createMedicalKitUseReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForMedicalKitAtlas(page);
        await assertMedicalKitUseReady(page);
        await saveScreenshot(page, USE_READY_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-medical-kit').click();
        await assertMedicalKitSelectedNeedsTarget(page);
        await saveScreenshot(page, ITEM_SELECTED_SCREENSHOT);
        await saveScreenshot(page, TARGET_AVAILABLE_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await assertMedicalKitTargetSelected(page);
        await saveScreenshot(page, TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await assertMedicalKitSettled(page);
        await saveScreenshot(page, USE_SETTLED_SCREENSHOT);
        await assertMedicalKitSelectionCleared(page);
        await saveScreenshot(page, USE_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-use-possession', diagnostics }]);
    });

    test('面具真实链路选择同房间队友、相邻房间并完成移动收口', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mask-move-possession');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createMaskMoveReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForMaskAtlas(page);
        await assertMaskUseReady(page);
        await saveScreenshot(page, MASK_READY_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-mask').click();
        await assertMaskSelectedNeedsTarget(page);
        await saveScreenshot(page, MASK_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await assertMaskSelectedNeedsTarget(page);
        await saveScreenshot(page, MASK_TARGET_TOKEN_SCREENSHOT);

        const targetRoomId = await selectFirstMaskTargetRoom(page);
        await assertMaskTargetRoomSelected(page, targetRoomId);
        await saveScreenshot(page, MASK_TARGET_ROOM_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await assertMaskSettled(page, targetRoomId);
        await saveScreenshot(page, MASK_SETTLED_SCREENSHOT);
        await assertMaskSelectionCleared(page, targetRoomId);
        await saveScreenshot(page, MASK_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-mask-move-possession', diagnostics }]);
    });

    test('骨制钥匙真实链路打开移动模式、选择穿墙目标并完成移动收口', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-skeleton-key-move');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createSkeletonKeyMoveReadyRuntimeCore());
        await setHarnessRandomQueue(page, [3]);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForSkeletonKeyAtlas(page);
        await assertSkeletonKeyMoveReady(page);
        await saveScreenshot(page, SKELETON_KEY_READY_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-lockpick-tool').hover();
        await assertSkeletonKeyMoveReady(page);
        await saveScreenshot(page, SKELETON_KEY_CARD_SCREENSHOT);

        await page.getByTestId('betrayal-action-move').click();
        await assertSkeletonKeyTargetMode(page);
        await saveScreenshot(page, SKELETON_KEY_TARGETS_SCREENSHOT);

        await page.getByTestId('betrayal-room-upper-west').hover();
        await assertSkeletonKeyTargetMode(page);
        await saveScreenshot(page, SKELETON_KEY_TARGET_HOVER_SCREENSHOT);

        await page.getByTestId('betrayal-room-upper-west').click();
        await assertSkeletonKeySettled(page);
        await saveScreenshot(page, SKELETON_KEY_SETTLED_SCREENSHOT);
        await assertSkeletonKeySelectionCleared(page);
        await saveScreenshot(page, SKELETON_KEY_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-skeleton-key-move', diagnostics }]);
    });
});
