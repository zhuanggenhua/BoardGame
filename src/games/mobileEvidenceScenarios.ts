import type {
    MobileEvidenceScenarioContext,
    MobileEvidenceScenarioHandlers,
} from '../shared/mobileEvidenceCapture';

type SmashUpMobileEvidenceInjector = typeof import('./smashup/mobileEvidence').injectSmashUpFourPlayerMobileEvidenceScene;
type SummonerWarsMobileEvidenceInjector = typeof import('./summonerwars/mobileEvidence').injectSummonerWarsMobileEvidenceScene;
type SummonerWarsMobileEvidenceStateFactory = typeof import('./summonerwars/mobileEvidence').withSummonerWarsMobileEvidenceActionLog;

let smashUpMobileEvidenceInjectorLoader: Promise<SmashUpMobileEvidenceInjector> | null = null;
let summonerWarsMobileEvidenceInjectorLoader: Promise<SummonerWarsMobileEvidenceInjector> | null = null;
let summonerWarsMobileEvidenceStateFactoryLoader: Promise<SummonerWarsMobileEvidenceStateFactory> | null = null;

async function loadSmashUpMobileEvidenceInjector() {
    if (!smashUpMobileEvidenceInjectorLoader) {
        smashUpMobileEvidenceInjectorLoader = import('./smashup/mobileEvidence')
            .then((module) => module.injectSmashUpFourPlayerMobileEvidenceScene)
            .catch((error) => {
                smashUpMobileEvidenceInjectorLoader = null;
                throw error;
            });
    }

    return smashUpMobileEvidenceInjectorLoader;
}

async function loadSummonerWarsMobileEvidenceInjector() {
    if (!summonerWarsMobileEvidenceInjectorLoader) {
        summonerWarsMobileEvidenceInjectorLoader = import('./summonerwars/mobileEvidence')
            .then((module) => module.injectSummonerWarsMobileEvidenceScene)
            .catch((error) => {
                summonerWarsMobileEvidenceInjectorLoader = null;
                throw error;
            });
    }

    return summonerWarsMobileEvidenceInjectorLoader;
}

async function loadSummonerWarsMobileEvidenceStateFactory() {
    if (!summonerWarsMobileEvidenceStateFactoryLoader) {
        summonerWarsMobileEvidenceStateFactoryLoader = import('./summonerwars/mobileEvidence')
            .then((module) => module.withSummonerWarsMobileEvidenceActionLog)
            .catch((error) => {
                summonerWarsMobileEvidenceStateFactoryLoader = null;
                throw error;
            });
    }

    return summonerWarsMobileEvidenceStateFactoryLoader;
}

async function seedSummonerWarsActionLog(context: MobileEvidenceScenarioContext) {
    await context.waitForCondition(
        'Summoner Wars TestHarness 就绪',
        () => Boolean(window.__BG_TEST_HARNESS__?.state?.isRegistered?.()),
        15000,
    );

    const harness = window.__BG_TEST_HARNESS__;
    if (!harness) {
        throw new Error('TestHarness 未挂载');
    }

    const withActionLog = await loadSummonerWarsMobileEvidenceStateFactory();
    const currentState = harness.state.get();
    if (!currentState) {
        throw new Error('Summoner Wars 当前状态未就绪');
    }

    harness.state.set(withActionLog(currentState, Date.now()));
}

async function runSmashUpTutorialScenario(context: MobileEvidenceScenarioContext) {
    await context.waitForCondition(
        'Smash Up 教学浮层出现',
        () => Boolean(context.getVisibleElement('[data-testid="tutorial-overlay-card"]')),
        40000,
    );
}

async function runBetrayalTutorialPhoneLandscapeScenario(context: MobileEvidenceScenarioContext) {
    await context.waitForCondition(
        '山屋惊魂教程棋盘出现',
        () => Boolean(context.getVisibleElement('[data-testid="betrayal-board"]')),
        40000,
    );

    if (context.getVisibleElement('[data-testid="mobile-orientation-game-gate"]')) {
        throw new Error('山屋惊魂移动端仍停在旋转提示，未进入横屏游戏画面');
    }

    if (context.getVisibleElement('[data-tutorial-step="setup-runtime"]')) {
        if (!context.clickElement('[data-testid="tutorial-next-button"]', true)) {
            throw new Error('山屋惊魂教程初始步骤存在，但未找到继续按钮');
        }
    }

    await context.waitForCondition(
        '山屋惊魂教程进入书本使用步骤',
        () => Boolean(context.getVisibleElement('[data-tutorial-step="use-book"]')),
        10000,
    );
    await context.waitForCondition(
        '山屋惊魂书本持有物可见',
        () => Boolean(context.getVisibleElement('[data-testid="betrayal-inventory-omen-book"]')),
        10000,
    );
    await context.waitForCondition(
        '山屋惊魂房间棋盘可见',
        () => Boolean(context.getVisibleElement('[data-testid="betrayal-room-grid"]')),
        10000,
    );
    await context.sleep(500);
}

async function prepareSummonerWarsBoard(context: MobileEvidenceScenarioContext) {
    await context.waitForCondition(
        'Summoner Wars TestHarness 就绪',
        () => Boolean(window.__BG_TEST_HARNESS__?.state?.isRegistered?.()),
        15000,
    );

    const harness = window.__BG_TEST_HARNESS__;
    if (!harness) {
        throw new Error('TestHarness 未挂载');
    }

    const injectSummonerWarsMobileEvidenceScene = await loadSummonerWarsMobileEvidenceInjector();
    injectSummonerWarsMobileEvidenceScene(harness);

    await context.waitForCondition(
        '召唤师战争手牌区可见',
        () => Boolean(context.getVisibleElement('[data-testid="sw-hand-area"]')),
        20000,
    );
    await context.waitForCondition(
        '召唤师战争阶段条可见',
        () => Boolean(context.getVisibleElement('[data-testid="sw-phase-tracker"]')),
        10000,
    );
    await context.waitForCondition(
        '召唤师战争结束阶段按钮可见',
        () => Boolean(context.getVisibleElement('[data-testid="sw-end-phase"]')),
        10000,
    );
}

async function runSummonerWarsPhoneBoardScenario(context: MobileEvidenceScenarioContext) {
    await prepareSummonerWarsBoard(context);
}

async function selectSummonerWarsHandCard(context: MobileEvidenceScenarioContext) {
    context.clickElement('[data-testid="sw-hand-area"] [data-card-id]', true);
    await context.waitForCondition(
        '召唤师战争选中态放大入口可见',
        () => Boolean(context.getVisibleElement('[data-testid="sw-hand-area"] [data-selected="true"] [data-testid="sw-hand-card-magnify"]')),
        5000,
    );
}

async function runSummonerWarsHandMagnifyScenario(context: MobileEvidenceScenarioContext) {
    await prepareSummonerWarsBoard(context);
    await selectSummonerWarsHandCard(context);
    context.clickElement('[data-testid="sw-hand-area"] [data-selected="true"] [data-testid="sw-hand-card-magnify"]', true);
    await context.waitForCondition(
        '召唤师战争放大层出现',
        () => {
            const overlay = context.getVisibleElement('[data-testid="sw-magnify-overlay"]');
            if (!overlay) {
                return false;
            }
            const styles = window.getComputedStyle(overlay);
            return styles.pointerEvents === 'auto' && styles.opacity === '1';
        },
        5000,
    );
}

async function runSummonerWarsPhaseDetailScenario(context: MobileEvidenceScenarioContext) {
    await prepareSummonerWarsBoard(context);
    context.clickElement('[data-testid="sw-phase-item-build"]', true);
    await context.waitForCondition(
        '召唤师战争阶段详情面板出现',
        () => Boolean(context.getVisibleElement('[data-testid="sw-phase-detail-panel"]')),
        5000,
    );
}

async function runSummonerWarsActionLogScenario(context: MobileEvidenceScenarioContext) {
    await prepareSummonerWarsBoard(context);
    await seedSummonerWarsActionLog(context);
    await context.openFabPanel('action-log', 'settings');
    await context.waitForCondition(
        '召唤师战争操作日志行出现',
        () => context.getVisibleElements('[data-testid="hud-action-log-row"]').length >= 2,
        5000,
    );
}

async function runSummonerWarsTabletBoardScenario(context: MobileEvidenceScenarioContext) {
    await prepareSummonerWarsBoard(context);
}

async function prepareSmashUpFourPlayerBoard(
    context: MobileEvidenceScenarioContext,
    options: { expandMinion?: boolean } = {},
) {
    const { expandMinion = true } = options;
    await context.waitForCondition(
        'Smash Up TestHarness 就绪',
        () => {
            const harness = window.__BG_TEST_HARNESS__;
            return Boolean(harness?.state?.isRegistered?.() && harness?.command?.isRegistered?.());
        },
        15000,
    );

    const harness = window.__BG_TEST_HARNESS__;
    if (!harness) {
        throw new Error('TestHarness 未挂载');
    }

    const injectSmashUpFourPlayerMobileEvidenceScene = await loadSmashUpMobileEvidenceInjector();
    injectSmashUpFourPlayerMobileEvidenceScene(harness);

    await context.waitForCondition(
        'Smash Up 移动端场景注入完成',
        () => {
            const state = window.__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.length ?? 0) === 2
                && state?.core?.bases?.[0]?.minions?.some((minion: { uid: string }) => minion.uid === 'p0-b0-armor-stego');
        },
        10000,
    );

    await context.waitForCondition(
        'Smash Up 目标随从可见',
        () => Boolean(context.getVisibleElement('[data-minion-uid="p0-b0-armor-stego"]')),
        15000,
    );

    if (!expandMinion) {
        return;
    }

    context.clickElement('[data-minion-uid="p0-b0-armor-stego"]', true);

    await context.waitForCondition(
        'Smash Up 单击后展开附属行动',
        () => {
            const minion = document.querySelector<HTMLElement>('[data-minion-uid="p0-b0-armor-stego"]');
            return minion?.dataset.expanded === 'true'
                && minion?.dataset.attachedActionsVisible === 'true'
                && minion?.dataset.activationArmed === 'true';
        },
        5000,
    );
}

async function runSmashUpFourPlayerAttachedActionsScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context);
}

async function runSmashUpMinionLongPressScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context);
    await context.longPressElement('[data-minion-uid="p0-b0-armor-stego"]', 'Smash Up 随从', 1);
    await context.waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 随从');
}

async function runSmashUpBaseLongPressScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context);
    await context.longPressElement('[data-base-index="1"]', 'Smash Up 基地', 2);
    await context.waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 基地');
}

async function runSmashUpBaseOngoingLongPressScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context);
    await context.longPressElement('[data-ongoing-uid="p0-b0-base-ongoing"]', 'Smash Up 基地持续行动', 3);
    await context.waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 基地持续行动');
}

async function runSmashUpAttachedActionLongPressScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context);
    await context.longPressElement('[data-attached-action-uid="p0-b0-armor-stego-upgrade"]', 'Smash Up 附属行动', 4);
    await context.waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 附属行动');
}

async function runSmashUpHandLongPressScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context);
    await context.longPressElement('[data-card-uid="p0-mobile-hand-terraform"]', 'Smash Up 手牌', 5);
    await context.waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 手牌');
}

async function runSmashUpTabletBoardScenario(context: MobileEvidenceScenarioContext) {
    await prepareSmashUpFourPlayerBoard(context, { expandMinion: false });
}

export const mobileEvidenceScenarioHandlers: MobileEvidenceScenarioHandlers = {
    'betrayal-tutorial-phone-landscape': runBetrayalTutorialPhoneLandscapeScenario,
    'betrayal-tutorial-mobile-landscape': runBetrayalTutorialPhoneLandscapeScenario,
    'smashup-tutorial-mobile-landscape': runSmashUpTutorialScenario,
    'summonerwars-tutorial-phone-landscape': runSummonerWarsPhoneBoardScenario,
    'summonerwars-mobile-10-phone-landscape-board': runSummonerWarsPhoneBoardScenario,
    'summonerwars-mobile-11-hand-magnify-open': runSummonerWarsHandMagnifyScenario,
    'summonerwars-mobile-12-phase-detail-open': runSummonerWarsPhaseDetailScenario,
    'summonerwars-mobile-13-action-log-open': runSummonerWarsActionLogScenario,
    'summonerwars-mobile-20-tablet-landscape-board': runSummonerWarsTabletBoardScenario,
    'smashup-4p-mobile-attached-actions': runSmashUpFourPlayerAttachedActionsScenario,
    'smashup-4p-mobile-05-attached-actions': runSmashUpFourPlayerAttachedActionsScenario,
    'smashup-4p-mobile-07-minion-long-press': runSmashUpMinionLongPressScenario,
    'smashup-4p-mobile-08-base-long-press': runSmashUpBaseLongPressScenario,
    'smashup-4p-mobile-09-base-ongoing-long-press': runSmashUpBaseOngoingLongPressScenario,
    'smashup-4p-mobile-10-attached-action-long-press': runSmashUpAttachedActionLongPressScenario,
    'smashup-4p-mobile-11-hand-long-press': runSmashUpHandLongPressScenario,
    'smashup-4p-mobile-12-tablet-landscape': runSmashUpTabletBoardScenario,
};
