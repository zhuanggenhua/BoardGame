import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import type { BetrayalCore, BetrayalTraitKey, BetrayalUseEffectSeed } from '../../src/games/betrayal/game';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
import {
    createRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-事件牌页面承接E2E';

type EventChoiceCase = {
    title: string;
    screenshotSlug: string;
    buildCore: () => BetrayalCore;
    actions: string[];
    expectedTexts: string[];
    expectedVisibleTestIds?: string[];
};

function eventByName(name: string) {
    const event = BETRAYAL_DISCOVERY_POOLS.events.find((candidate) => candidate.name === name);
    if (!event) {
        throw new Error(`未找到山屋事件：${name}`);
    }
    return event;
}

function branchEffect(eventName: string, min: number): BetrayalUseEffectSeed {
    const event = eventByName(eventName);
    const branch = event.roll?.branches.find((candidate) => candidate.min === min);
    if (!branch) {
        throw new Error(`未找到山屋事件分支：${eventName} min=${min}`);
    }
    return branch.effect;
}

function allPassEffect(eventName: string): BetrayalUseEffectSeed {
    const event = eventByName(eventName);
    if (event.effect?.mode !== 'allTraitChecks') {
        throw new Error(`山屋事件不是四属性检定：${eventName}`);
    }
    return event.effect.allPassEffect;
}

function createPendingChoiceCore(
    sourceTitle: string,
    effect: BetrayalUseEffectSeed,
    options: {
        id: string;
        acceptLabel?: string;
        declineLabel?: string;
        roomId?: string;
        traits?: Partial<Record<BetrayalTraitKey, number>>;
        possessionItems?: { id: string; name: string; kind: 'item' }[];
    },
) {
    const core = createRuntimeCore();
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: options.roomId ?? core.currentExplorer.roomId,
        traits: {
            ...core.currentExplorer.traits,
            ...options.traits,
        },
        inventory: [],
    };
    core.activeRoomId = core.currentExplorer.roomId;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];
    if (options.possessionItems) {
        core.possessionOrderByKind.item = [...options.possessionItems];
    }
    core.pendingEventChoice = {
        id: options.id,
        playerId: '0',
        sourceTitle,
        acceptLabel: options.acceptLabel,
        declineLabel: options.declineLabel,
        effect,
    };
    return core;
}

function eventEffect(eventName: string): BetrayalUseEffectSeed {
    const effect = eventByName(eventName).effect;
    if (!effect) {
        throw new Error(`山屋事件没有直接效果：${eventName}`);
    }
    return effect;
}

const cases: EventChoiceCase[] = [
    {
        title: '上古旧宅',
        screenshotSlug: '上古旧宅-属性目标通用伤害',
        buildCore: () => createPendingChoiceCore('上古旧宅', eventEffect('上古旧宅'), {
            id: 'e2e-old-mansion-choice',
            roomId: 'hallway',
            traits: { speed: 4, might: 4, knowledge: 4, sanity: 4 },
        }),
        actions: [
            'betrayal-event-choice-trait-might',
            'betrayal-event-choice-room-hallway',
            'betrayal-event-choice-damage-might',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['力量检定', '放置到门厅', '通用伤害 1（力量）'],
    },
    {
        title: '肉质苔癣',
        screenshotSlug: '肉质苔癣-跳过可选效果',
        buildCore: () => createPendingChoiceCore('肉质苔癣', eventEffect('肉质苔癣'), {
            id: 'e2e-flesh-moss-choice',
            acceptLabel: '大口吸入芳香',
            declineLabel: '不吸入芳香',
        }),
        actions: ['betrayal-event-choice-decline'],
        expectedTexts: ['无事发生'],
    },
    {
        title: '大宅饿了',
        screenshotSlug: '大宅饿了-选择属性跳过作祟',
        buildCore: () => createPendingChoiceCore('大宅饿了', eventEffect('大宅饿了'), {
            id: 'e2e-hungry-house-choice',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
        }),
        actions: [
            'betrayal-event-choice-trait-knowledge',
            'betrayal-event-choice-decline',
        ],
        expectedTexts: ['知识 +1'],
    },
    {
        title: '蜘蛛！',
        screenshotSlug: '蜘蛛-属性相邻房间',
        buildCore: () => createPendingChoiceCore('蜘蛛！', branchEffect('蜘蛛！', 4), {
            id: 'e2e-spider-adjacent-choice',
            roomId: 'hallway',
            traits: { sanity: 5, speed: 4 },
        }),
        actions: [
            'betrayal-event-choice-trait-speed',
            'betrayal-event-choice-room-grand-staircase',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['速度 +1', '放置到大阶梯'],
    },
    {
        title: '吊死鬼',
        screenshotSlug: '吊死鬼-奖励属性',
        buildCore: () => createPendingChoiceCore('吊死鬼', allPassEffect('吊死鬼'), {
            id: 'e2e-hanging-tree-trait-choice',
        }),
        actions: [
            'betrayal-event-choice-trait-knowledge',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['知识 +1'],
    },
    {
        title: '一条秘密通道',
        screenshotSlug: '一条秘密通道-第二目标板块',
        buildCore: () => createPendingChoiceCore('一条秘密通道', branchEffect('一条秘密通道', 5), {
            id: 'e2e-secret-passage-room-choice',
            roomId: 'ground-north',
            traits: { knowledge: 4 },
        }),
        actions: [
            'betrayal-event-choice-room-hallway',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['在当前板块放置秘密通道标志物', '在门厅放置秘密通道标志物', '知识 +1'],
    },
    {
        title: '脑状食品',
        screenshotSlug: '脑状食品-奖励属性',
        buildCore: () => createPendingChoiceCore('脑状食品', branchEffect('脑状食品', 5), {
            id: 'e2e-brain-food-reward-choice',
        }),
        actions: [
            'betrayal-event-choice-trait-speed',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['速度 +1'],
    },
    {
        title: '脑状食品',
        screenshotSlug: '脑状食品-通用伤害属性',
        buildCore: () => createPendingChoiceCore('脑状食品', branchEffect('脑状食品', 0), {
            id: 'e2e-brain-food-damage-choice',
        }),
        actions: [
            'betrayal-event-choice-damage-might',
            'betrayal-event-choice-damage-knowledge',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['通用伤害 2（力量、知识）'],
    },
    {
        title: '夜幕众星',
        screenshotSlug: '夜幕众星-选择检定属性',
        buildCore: () => createPendingChoiceCore('夜幕众星', eventEffect('夜幕众星'), {
            id: 'e2e-night-stars-trait-choice',
            traits: { knowledge: 4 },
        }),
        actions: [
            'betrayal-event-choice-trait-knowledge',
            'betrayal-event-choice-confirm',
        ],
        expectedTexts: ['知识检定', '治疗知识'],
    },
    {
        title: '一抹鲜红',
        screenshotSlug: '一抹鲜红-跳过作祟伤害',
        buildCore: () => createPendingChoiceCore('一抹鲜红', eventEffect('一抹鲜红'), {
            id: 'e2e-crimson-splash-choice',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
        }),
        actions: ['betrayal-event-choice-decline'],
        expectedTexts: ['物理伤害'],
    },
    {
        title: '一瓶微尘',
        screenshotSlug: '一瓶微尘-跳过作祟双属性',
        buildCore: () => createPendingChoiceCore('一瓶微尘', eventEffect('一瓶微尘'), {
            id: 'e2e-dusty-vial-choice',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
        }),
        actions: ['betrayal-event-choice-decline'],
        expectedTexts: ['力量 -1', '神志 +1'],
    },
    {
        title: '说“茄子”！',
        screenshotSlug: '说茄子-跳过作祟抽物品',
        buildCore: () => createPendingChoiceCore('说“茄子”！', eventEffect('说“茄子”！'), {
            id: 'e2e-say-cheese-choice',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
            possessionItems: [{ id: 'camera', name: '魔法相机', kind: 'item' }],
        }),
        actions: ['betrayal-event-choice-decline'],
        expectedTexts: ['抽取一张物品卡'],
        expectedVisibleTestIds: ['betrayal-inventory-row-item'],
    },
];

test.describe('山屋惊魂事件牌真实页面选择承接', () => {
    test.beforeEach(async ({ page, context }) => {
        await initBetrayalContext(context);
        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
    });

    for (const eventCase of cases) {
        test(`${eventCase.title} 能在真实浏览器页面完成事件选择：${eventCase.screenshotSlug}`, async ({ page }) => {
            test.setTimeout(120000);
            const diagnostics = attachPageDiagnostics(page, `betrayal-event-choice-${eventCase.screenshotSlug}`);
            const screenshotBase = `${EVIDENCE_DIR}/${eventCase.screenshotSlug}`;

            await injectCore(page, eventCase.buildCore());
            await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
            await expect(page.getByTestId('betrayal-event-choice-panel')).toContainText(eventCase.title);
            await saveScreenshot(page, `${screenshotBase}-选择前.jpg`);

            for (const testId of eventCase.actions) {
                await page.getByTestId(testId).click();
            }

            await expect(page.getByTestId('betrayal-event-choice-panel')).toBeHidden({ timeout: 30000 });
            const discoveryDetail = page.getByTestId('betrayal-discovery-detail');
            for (const expectedText of eventCase.expectedTexts) {
                await expect(discoveryDetail).toContainText(expectedText);
            }
            for (const testId of eventCase.expectedVisibleTestIds ?? []) {
                await expect(page.getByTestId(testId)).toBeVisible();
            }
            if (eventCase.title === '说“茄子”！') {
                await expect(page.getByTestId('betrayal-inventory-row-item')).toContainText('魔法相机');
            }
            await saveScreenshot(page, `${screenshotBase}-结算后.jpg`);
            assertNoFatalFrontendErrors([{ label: `betrayal-event-choice-${eventCase.screenshotSlug}`, diagnostics }]);
        });
    }
});
