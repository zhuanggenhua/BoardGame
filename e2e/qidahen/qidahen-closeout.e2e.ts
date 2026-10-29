import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    setChineseLocale,
} from '../helpers/common';

const CLOSEOUT_DIR = 'test-results/evidence-screenshots/_shared/qidahen-新游戏收口';
const TUTORIAL_ROOT_DIR = 'test-results/evidence-screenshots/_shared/qidahen-教程完成';
const TUTORIAL_RUN_ID = process.env.QIDAHEN_TUTORIAL_SCREENSHOT_RUN_ID
    ?? new Date().toISOString().replace(/[:.]/g, '-');
const TUTORIAL_DIR = `${TUTORIAL_ROOT_DIR}/${TUTORIAL_RUN_ID}`;
const MOBILE_TUTORIAL_DIR = `${TUTORIAL_ROOT_DIR}/${TUTORIAL_RUN_ID}-mobile`;
const BASIC_FARM_REGION = `${TUTORIAL_DIR}/00-辽北军屯地区选择.png`;
const BASIC_WHEEL_CHOICE = `${TUTORIAL_DIR}/01-轮盘前进两格与军屯落点.png`;
const BASIC_OPPONENT = `${TUTORIAL_DIR}/02-指定后金抽牌.png`;
const BASIC_FARM_RESULT = `${TUTORIAL_DIR}/03-辽北军屯结果.png`;
const BASIC_HAND_HOVER = `${TUTORIAL_DIR}/03a-手牌悬停完整抬起.png`;
const BASIC_HAND_MAGNIFY = `${TUTORIAL_DIR}/03b-共享放大镜检视手牌.png`;
const BASIC_TARGET = `${TUTORIAL_DIR}/04-叶赫部真实地图目标.png`;
const BASIC_PAYMENT = `${TUTORIAL_DIR}/05-银两支付与鸳鸯阵手牌.png`;
const BASIC_TACTIC = `${TUTORIAL_DIR}/05a-鸳鸯阵选中与确认出牌.png`;
const BASIC_BATTLE = `${TUTORIAL_DIR}/06-野战选择实际出兵部队.png`;
const BASIC_BATTLE_BEFORE = `${TUTORIAL_DIR}/05b-出兵选择前与真实兵牌引导.png`;
const BASIC_BATTLE_RESULT = `${TUTORIAL_DIR}/07-战后幸存部队与占领选择.png`;
const BASIC_OCCUPIED = `${TUTORIAL_DIR}/08-叶赫部占领结果.png`;
const BASIC_CONTINUE = `${TUTORIAL_DIR}/09-教程退出后同局继续.png`;
const WHEEL_COST_STEP_01 = `${TUTORIAL_DIR}/13-轮盘第1步-先看走3会让两家对手摸牌.png`;
const WHEEL_COST_STEP_02 = `${TUTORIAL_DIR}/14-轮盘第2步-看蒙古后金手牌同时增加.png`;
const WHEEL_COST_STEP_02A = `${TUTORIAL_DIR}/14a-进攻调度规则-弃一张手牌.png`;
const WHEEL_COST_PAYMENT_SELECTED = `${TUTORIAL_DIR}/14b-进攻调度支付-手牌已选待确认.png`;
const WHEEL_COST_STEP_03 = `${TUTORIAL_DIR}/15-进攻调度支付完成-地图部队选择可继续.png`;
const WHEEL_RECLAIM_STEP_01 = `${TUTORIAL_DIR}/15a-开垦第1步-点击高亮开垦.png`;
const WHEEL_RECLAIM_STEP_02 = `${TUTORIAL_DIR}/15b-开垦第2步-看己方控制区人口增加.png`;
const WHEEL_RECLAIM_OVERVIEW = `${TUTORIAL_DIR}/15a-00-开垦专题起点-轮盘标记与决策入口.png`;
const WHEEL_MILITARY_FARM_STEP_01 = `${TUTORIAL_DIR}/15c-军屯第1步-点击高亮军屯.png`;
const WHEEL_MILITARY_FARM_STEP_02 = `${TUTORIAL_DIR}/15d-军屯第2步-看补牌并建立正规军.png`;
const WHEEL_MILITARY_FARM_OVERVIEW = `${TUTORIAL_DIR}/15c-00-军屯专题起点-轮盘标记与决策入口.png`;
const WHEEL_RECRUIT_TRAIN_STEP_01 = `${TUTORIAL_DIR}/15e-征兵训练第1步-点击高亮征兵训练.png`;
const WHEEL_RECRUIT_TRAIN_RULE = `${TUTORIAL_DIR}/15e0-费用与次数规则译文.png`;
const WHEEL_RECRUIT_TRAIN_ACTION_RULE = `${TUTORIAL_DIR}/15e1-征兵与训练行动规则译文.png`;
const WHEEL_RECRUIT_TRAIN_ARTILLERY_RULE = `${TUTORIAL_DIR}/15e2-炮兵等级限制规则译文.png`;
const WHEEL_RECRUIT_TRAIN_PAYMENT = `${TUTORIAL_DIR}/15e3-轮盘落点等待支付.png`;
const WHEEL_RECRUIT_TRAIN_TRAINING_TARGET = `${TUTORIAL_DIR}/15f-选择炮兵训练.png`;
const WHEEL_RECRUIT_TRAIN_TRAINING_RESULT = `${TUTORIAL_DIR}/15g-炮兵训练结算结果.png`;
const WHEEL_RECRUIT_TRAIN_HOMELAND_RULE = `${TUTORIAL_DIR}/15h-本土征兵限制规则译文.png`;
const WHEEL_RECRUIT_TRAIN_RECRUIT_TARGET = `${TUTORIAL_DIR}/15i-征兵候选本土区域.png`;
const WHEEL_RECRUIT_TRAIN_RECRUIT_RESULT = `${TUTORIAL_DIR}/15j-征兵结算结果.png`;
const WHEEL_RECRUIT_TRAIN_EXTRA_RULE = `${TUTORIAL_DIR}/15k-额外训练规则译文.png`;
const WHEEL_RECRUIT_TRAIN_EXTRA_PAYMENT = `${TUTORIAL_DIR}/15l-额外训练弃牌.png`;
const WHEEL_RECRUIT_TRAIN_FINAL = `${TUTORIAL_DIR}/15m-征兵训练汇总与继续对局.png`;
const ARMAMENT_STEP_00 = `${TUTORIAL_DIR}/16-军备第0步-四个势力行动总览.png`;
const ARMAMENT_STEP_01 = `${TUTORIAL_DIR}/16-军备第1步-先点升级军备.png`;
const ARMAMENT_STEP_02 = `${TUTORIAL_DIR}/17-军备第2步-点击底部手牌支付2张.png`;
const ARMAMENT_STEP_03 = `${TUTORIAL_DIR}/18-军备第3步-看火炮技术升到2级.png`;
const EVENT_STEP_01 = `${TUTORIAL_DIR}/19-事件第1步-先点大汗令箭.png`;
const EVENT_STEP_00 = `${TUTORIAL_DIR}/18a-事件第0步-蒙古三个势力行动总览.png`;
const EVENT_STEP_02 = `${TUTORIAL_DIR}/20-事件第2步-点击底部手牌支付1张.png`;
const EVENT_STEP_03 = `${TUTORIAL_DIR}/21-事件第3步-选择征兵训练效果.png`;
const EVENT_STEP_04 = `${TUTORIAL_DIR}/22-大汗令箭征兵训练行动规则译文.png`;
const EVENT_STEP_05 = `${TUTORIAL_DIR}/23-大汗令箭选择征兵与本土限制规则译文.png`;
const EVENT_STEP_06 = `${TUTORIAL_DIR}/24-大汗令箭本土目标与征兵结果.png`;
const EVENT_STEP_07 = `${TUTORIAL_DIR}/25-大汗令箭结算摘要.png`;
const FIELD_BATTLE_STEP_01 = `${TUTORIAL_DIR}/23-进攻第1步-点击突袭作战入口.png`;
const FIELD_BATTLE_STEP_00 = `${TUTORIAL_DIR}/22a-进攻第0步-大明四个势力行动总览.png`;
const FIELD_BATTLE_STEP_02 = `${TUTORIAL_DIR}/24-进攻第2步-弃1张手牌支付突袭.png`;
const FIELD_BATTLE_STEP_03 = `${TUTORIAL_DIR}/25-进攻第3步-支付后进入察哈尔野战.png`;
const FIELD_BATTLE_STEP_03A = `${TUTORIAL_DIR}/25a-进攻第3a步-战术牌时机高亮骑兵冲锋.png`;
const FIELD_BATTLE_STEP_03B = `${TUTORIAL_DIR}/25b-进攻第3b步-战术牌选中后显示打出确认.png`;
const FIELD_BATTLE_STEP_04 = `${TUTORIAL_DIR}/26-进攻第4步-打出战术牌后决定承伤顺序.png`;
const FIELD_BATTLE_STEP_04A = `${TUTORIAL_DIR}/26a-进攻第4a步-看断后后的战后处理.png`;
const FIELD_BATTLE_STEP_05 = `${TUTORIAL_DIR}/27-进攻第5步-看战败标记与战后选择.png`;
const FIELD_BATTLE_STEP_06 = `${TUTORIAL_DIR}/27a-进攻第6步-看占领结果摘要.png`;
const ROUT_STEP_01 = `${TUTORIAL_DIR}/28-撤退第1步-先看断后和溃退入口.png`;
const ROUT_STEP_02 = `${TUTORIAL_DIR}/29-撤退第2步-看溃退后的残部清空与战败标记.png`;
const ROUT_OVERVIEW = `${TUTORIAL_DIR}/27-00-撤退专题起点-野战败方待选撤退方式.png`;
const SIEGE_STEP_01 = `${TUTORIAL_DIR}/30-攻城第1步-真实守城宣告入口.png`;
const SIEGE_STEP_01A = `${TUTORIAL_DIR}/30a-攻城第1a步-右侧断后结算城战.png`;
const SIEGE_STEP_02 = `${TUTORIAL_DIR}/31-攻城第2步-选择围城该区.png`;
const SIEGE_OCCUPY_STEP_00 = `${TUTORIAL_DIR}/31a-00-占领对照专题起点-守城决策.png`;
const SIEGE_OCCUPY_STEP_01 = `${TUTORIAL_DIR}/31a-01-攻下城市后-选择占领或围城.png`;
const SIEGE_STEP_03 = `${TUTORIAL_DIR}/31b-围城结算后-山海关仍由守方控制.png`;
const SIEGE_OCCUPY_STEP_02 = `${TUTORIAL_DIR}/31a-02-同章选择占领目标.png`;
const SIEGE_OCCUPY_STEP_03 = `${TUTORIAL_DIR}/31a-03-同章占领结算结果.png`;
const SIEGE_WITHDRAW_STEP_01 = `${TUTORIAL_DIR}/31c-01-攻城战后处理-选择前.png`;
const SIEGE_WITHDRAW_STEP_02 = `${TUTORIAL_DIR}/31c-02-攻城战后处理-撤回确认前.png`;
const SIEGE_WITHDRAW_STEP_03 = `${TUTORIAL_DIR}/31c-03-攻城战后处理-撤回结果.png`;
const DIPLOMACY_STEP_01 = `${TUTORIAL_DIR}/32-外交第1步-点击高亮外交雇佣.png`;
const DIPLOMACY_STEP_02 = `${TUTORIAL_DIR}/33-外交第2步-先放置友好标记.png`;
const DIPLOMACY_STEP_02A = `${TUTORIAL_DIR}/33a-外交第2a步-翻为附庸.png`;
const DIPLOMACY_STEP_02B = `${TUTORIAL_DIR}/33b-外交第2b步-移除他方控制标记.png`;
const DIPLOMACY_STEP_03 = `${TUTORIAL_DIR}/34-外交第3步-结束并结算雇佣军.png`;
const DIPLOMACY_STEP_04 = `${TUTORIAL_DIR}/35-外交第4步-看完外交与雇佣的合并收益.png`;
const SEASON_STEP_01 = `${TUTORIAL_DIR}/36-跨年第1步-推进到年中并查看税赋与人物.png`;
const SEASON_STEP_02 = `${TUTORIAL_DIR}/37-跨年第2步-先看新年朝鲜朝贡.png`;
const SEASON_STEP_03 = `${TUTORIAL_DIR}/38-跨年第3步-进入新年防线维护.png`;
const SEASON_STEP_04 = `${TUTORIAL_DIR}/39-跨年第4步-看纪年卡与争分结果.png`;
const SEASON_STEP_05 = `${TUTORIAL_DIR}/40-跨年第5步-看新顺位与人物刷新.png`;
const SEASON_STEP_06 = `${TUTORIAL_DIR}/41-跨年第6步-看到新年结算与新年份.png`;
const KOREA_STEP_01 = `${TUTORIAL_DIR}/42-朝鲜第1步-先看朝鲜朝贡后的牌库与弃牌堆.png`;
const KOREA_STEP_02 = `${TUTORIAL_DIR}/43-朝鲜第2步-看汉城威望已进入玩家条.png`;
const KOREA_STEP_03 = `${TUTORIAL_DIR}/44-朝鲜第3步-看海路与船锚区域关系.png`;
const KOREA_STEP_04 = `${TUTORIAL_DIR}/45-朝鲜第4步-点击新年维护进入耗损结算.png`;
const KOREA_STEP_05 = `${TUTORIAL_DIR}/46-朝鲜第5步-看朝鲜耗损与山海关结果.png`;
const MOBILE_WHEEL_OPPONENT = `${MOBILE_TUTORIAL_DIR}/移动-00-轮盘军屯与指定对手.png`;
const MOBILE_MAP_TARGET = `${MOBILE_TUTORIAL_DIR}/移动-01-叶赫部地图目标避开支付托盘.png`;
const MOBILE_RAID_PAYMENT = `${MOBILE_TUTORIAL_DIR}/移动-02-突袭支付与手牌.png`;
const MOBILE_HAND_INSPECT = `${MOBILE_TUTORIAL_DIR}/移动-03-长按银两检视卡面.png`;
const MOBILE_PAYMENT_SELECTED = `${MOBILE_TUTORIAL_DIR}/移动-04-检视返回后轻点银两选择支付.png`;
const ENDGAME_SCREENSHOT = `${CLOSEOUT_DIR}/02-终局遮罩-注入胜利后显示.png`;

type BehaviorSnapshot = {
    visible: Record<string, unknown>;
    authoritative: Record<string, unknown>;
};

type BehaviorInput = {
    type: string;
    target: string;
    key?: string;
    before: BehaviorSnapshot;
    after: BehaviorSnapshot;
};

type HarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
    __BG_HIDE_DEBUG_PANEL__?: boolean;
    __QIDAHEN_BEHAVIOR_INPUTS__?: BehaviorInput[];
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => { core: unknown; sys: Record<string, unknown> };
            set?: (state: { core: unknown; sys: Record<string, unknown> }) => Promise<void> | void;
            isRegistered?: () => boolean;
        };
    };
};

const QIDAHEN_TUTORIAL_CATALOG_URL = '/play/qidahen/tutorial';
const QIDAHEN_BASIC_TUTORIAL_URL = '/play/qidahen/tutorial/basic-opening';

const readMapRegionInputPoint = async (page: Page, regionId: string) => {
    const point = await page.evaluate(async (id) => {
        const modulePath = '/src/games/qidahen/ui/mapGraph.ts';
        const graph = await import(modulePath);
        return graph.getQidahenRuntimeRegionAnchorTargetPoint(id) as { x: number; y: number } | null;
    }, regionId);
    expect(point).not.toBeNull();
    const content = page.getByTestId('qidahen-map-content');
    let previousGeometry = '';
    await expect.poll(async () => {
        const geometry = JSON.stringify(await content.boundingBox());
        const stable = geometry !== 'null' && geometry === previousGeometry;
        previousGeometry = geometry;
        return stable;
    }, { intervals: [50, 100, 100] }).toBe(true);
    const rect = await content.boundingBox();
    expect(rect).not.toBeNull();
    const size = await content.evaluate((element) => ({ width: element.offsetWidth, height: element.offsetHeight }));
    const input = {
        x: rect!.x + point!.x * rect!.width / size.width,
        y: rect!.y + point!.y * rect!.height / size.height,
    };
    const readExposure = () => page.evaluate(() => {
        const region = document.querySelector('[data-region-focus-shape="runtime-region-mask"]')?.getBoundingClientRect();
        const name = document.querySelector('[data-testid="qidahen-map-region-focus-name"]')?.getBoundingClientRect();
        if (!region || !name || name.width <= 0 || name.height <= 0) return { inViewport: false, coveredBy: ['missing-region-name'] };
        const selectors = ['[data-testid="qidahen-player-float"]', '[data-testid="qidahen-hand-zone"]',
            '[data-testid="qidahen-hand-interaction-tray"] > div', '[data-testid="qidahen-actions-zone"]',
            '[data-testid="tutorial-overlay-card"]'];
        const targets = [region, name];
        return {
            inViewport: targets.every(target => target.left >= 0 && target.top >= 0 && target.right <= innerWidth && target.bottom <= innerHeight),
            coveredBy: selectors.filter(selector => Array.from(document.querySelectorAll(selector)).some(element => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && box.height > 0 && targets.some(target => box.left < target.right && box.right > target.left
                    && box.top < target.bottom && box.bottom > target.top);
            })),
        };
    });
    try {
        await expect.poll(readExposure, { timeout: 5000, message: `${regionId}整片地区及名称必须可见，不能只露中心点` })
            .toEqual({ inViewport: true, coveredBy: [] });
    } catch (error) {
        console.info('REGION_EXPOSURE_FAILURE', JSON.stringify(await page.evaluate(() => {
            const selectors = ['[data-region-focus-shape]', '[data-testid="qidahen-map-region-focus-name"]',
                '[data-testid="qidahen-map-layer"]', '[data-testid="qidahen-player-float"]', '[data-testid="qidahen-hand-zone"]',
                '[data-testid="qidahen-hand-interaction-tray"] > div', '[data-testid="qidahen-actions-zone"]',
                '[data-testid="qidahen-action-wheel"]', '[data-testid="qidahen-map-viewport-controls"]',
                '[data-ui-role="qidahen-hand-magnify-viewport"]', '[data-testid="qidahen-draw-anchor"]',
                '[data-testid="qidahen-discard-anchor"]', '[data-testid="qidahen-chronology-zone"]', '[data-testid="qidahen-korea-zone"]'];
            return Object.fromEntries(selectors.map(selector => [selector, Array.from(document.querySelectorAll(selector)).map(element => element.getBoundingClientRect().toJSON())]));
        })));
        throw error;
    }
    expect(await page.evaluate(value => document.elementFromPoint(value.x, value.y)?.tagName, input)).toBe('CANVAS');
    return input;
};

type BehaviorTrace = {
    gameId: 'qidahen';
    evidenceCategory: 'tutorial';
    chainId: string;
    sourceRun: string;
    sourceRevision: string;
    status: 'RUNNING' | 'PASS' | 'FAIL';
    outcome: string;
    steps: Array<Record<string, unknown>>;
    uiStates: Array<Record<string, unknown>>;
    skippedDuplicateScreenshots: Array<{ path: string; sha256: string }>;
};

type BehaviorTraceRecorder = {
    trace: BehaviorTrace;
    tracePath: string;
    lastSnapshot: BehaviorSnapshot;
    lastAction: string;
};

const behaviorTraceRecorders = new WeakMap<Page, BehaviorTraceRecorder>();
const behaviorTraceScreenshotHashes = new Set<string>();
const QIDAHEN_TUTORIAL_SOURCE_FILES = [
    'src/games/qidahen/ui/QidahenBattlePreparation.tsx',
    'src/components/common/overlays/CardInspectButton.tsx',
    'e2e/qidahen/map-selection-geometry.e2e.ts',
    'src/games/qidahen/ui/QidahenHoverTip.tsx',
    'src/games/qidahen/domain/interactionSelectionAccessors.ts',
    'src/games/qidahen/domain/victoryResolution.ts',
    'src/games/qidahen/domain/regionEthnicity.ts',
    'src/games/qidahen/domain/scenarioRuntimeRegionPresets.ts',
    'src/games/qidahen/domain/mapTokens.ts',
    'src/games/qidahen/tutorial.ts',
    'src/games/qidahen/tutorialSetup.ts',
    'src/games/qidahen/Board.tsx',
    'src/games/qidahen/QidahenBoardShell.tsx',
    'src/games/qidahen/ui/hudLayout.ts',
    'src/games/qidahen/ui/QidahenMapPopulationLayer.tsx',
    'src/games/qidahen/ui/populationLayout.ts',
    'src/games/qidahen/domain/ordinaryHandCardIdentities.ts',
    'src/games/qidahen/domain/selectionBuilders.ts',
    'src/games/qidahen/domain/pendingBattleCommittedTroops.ts',
    'src/games/qidahen/domain/types.ts',
    'src/games/qidahen/domain/battleMorale.ts',
    'src/games/qidahen/domain/battleRollMath.ts',
    'src/games/qidahen/domain/attackRules.ts',
    'src/games/qidahen/domain/battleForceOutcomes.ts',
    'src/games/qidahen/domain/battleForceCommitments.ts',
    'src/games/qidahen/domain/pendingBattleCombatSupport.ts',
    'src/games/qidahen/domain/pendingTargetResolution.ts',
    'src/games/qidahen/domain/postBattleDecisionResolution.ts',
    'src/games/qidahen/domain/pendingBattleFlow.ts',
    'src/games/qidahen/domain/battleState.ts',
    'src/games/qidahen/domain/pendingTargetActionBuilder.ts',
    'src/games/qidahen/domain/previewActionReducer.ts',
    'src/games/qidahen/domain/selectedActionFollowUp.ts',
    'src/games/qidahen/domain/pendingTargetChoiceOptions.ts',
    'src/games/qidahen/domain/pendingTargetChoicePayload.ts',
    'src/games/qidahen/domain/battleInteractionBuilders.ts',
    'src/games/qidahen/domain/interactionSystem.ts',
    'src/games/qidahen/domain/commands.ts',
    'src/games/qidahen/domain/resolvedCommandEventBuilders.ts',
    'src/games/qidahen/domain/resolvedEventReducers.ts',
    'src/games/qidahen/domain/commandEventBuilders.ts',
    'src/games/qidahen/domain/pendingBattleStateTransition.ts',
    'src/games/qidahen/domain/troopCompat.ts',
    'src/games/qidahen/ui/mapGraph.ts',
    'src/games/qidahen/ui/runtimeRegionOwnership.ts',
    'src/games/qidahen/ui/mapRegionFocus.ts',
    'src/games/qidahen/ui/QidahenTutorialRegionLabel.tsx',
    'src/games/qidahen/ui/handInteractionView.ts',
    'src/components/game/framework/ZoomPanViewport.tsx',
    'src/engine/mapRenderer/PixiMapSceneHost.tsx',
    'src/games/qidahen/ui/regionMaskOverlay.ts',
    'src/games/qidahen/ui/mapSelectionCandidates.ts',
    'src/games/qidahen/ui/mapRegionHitTesting.ts',
    'src/games/qidahen/data/runtime-region-graph.json',
    'src/games/qidahen/data/region-mask.png',
    'src/games/qidahen/data/region-mask-regions.json',
    'src/games/qidahen/data/runtime-region-mask-regions.json',
    'src/games/qidahen/data/region-graph.json',
    'src/games/qidahen/data/region-authoritative-guides.json',
    'src/contexts/TutorialContext.tsx',
    'src/engine/pipeline.ts',
    'src/engine/types.ts',
    'src/engine/systems/TutorialSystem.ts',
    'src/engine/transport/localDispatchCommand.ts',
    'src/games/qidahen/domain/actionWindowDispatch.ts',
    'src/games/qidahen/domain/regionSelectionPreferences.ts',
    'src/games/qidahen/domain/wheelImmediateEffect.ts',
    'src/games/qidahen/domain/wheelRules.ts',
    'src/components/game/framework/widgets/GameHUD.tsx',
    'src/lib/feedback/feedbackScreenshot.ts',
    'src/components/tutorial/TutorialOverlay.tsx',
    'src/games/qidahen/qidahen-board.css',
    'src/games/qidahen/ui/QidahenHandInteractionTray.tsx',
    'public/locales/zh-CN/game-qidahen.json',
    'public/locales/en/game-qidahen.json',
    'e2e/qidahen/qidahen-closeout.e2e.ts',
    'src/games/qidahen/domain/characterActionWindow.ts',
    'src/games/qidahen/domain/regionConfig.ts',
    'src/games/qidahen/domain/regionRuleSemantics.ts',
    'src/games/qidahen/domain/wheelRecruitTrain.ts',
];

const getQidahenTutorialSourceRevision = () => {
    const digest = createHash('sha256');
    for (const file of QIDAHEN_TUTORIAL_SOURCE_FILES) {
        digest.update(file);
        digest.update(readFileSync(resolve(file)));
    }
    return `sha256:${digest.digest('hex')}`;
};

const behaviorChainIdForTitle = (title: string): string | null => {
    if (title.includes('唯一入门入口')) return 'basic-opening-entry';
    if (title.includes('正式入门连续对局')) return 'basic-opening-natural-raid';
    if (title.includes('移动横屏真实教程')) return 'basic-opening-mobile-hand-inspect';
    return null;
};

const behaviorTraceRoot = () => resolve('evidence/qidahen/behavior-traces', TUTORIAL_RUN_ID);

const writeBehaviorTrace = (recorder: BehaviorTraceRecorder) => {
    writeFileSync(recorder.tracePath, `${JSON.stringify(recorder.trace, null, 2)}\n`, 'utf8');
};

const readBehaviorSnapshot = async (page: Page): Promise<BehaviorSnapshot> => page.evaluate(() => {
    const testWindow = window as HarnessWindow;
    const state = testWindow.__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core && typeof state.core === 'object'
        ? state.core as Record<string, unknown>
        : {};
    const factions = core.factions && typeof core.factions === 'object'
        ? core.factions as Record<string, { handCount?: number }>
        : {};
    const tutorialStepId = document.querySelector<HTMLElement>('[data-tutorial-step]')?.dataset.tutorialStep ?? null;
    const tutorialCard = document.querySelector<HTMLElement>('[data-testid="tutorial-overlay-card"]');
    const board = document.querySelector<HTMLElement>('[data-testid="qidahen-board"]');
    const boardRect = board?.getBoundingClientRect();
    const viewport = window.innerWidth <= 900 ? 'mobile' : 'desktop';
    const sysTutorial = state?.sys?.tutorial as { step?: { id?: string; hiddenAutomation?: unknown } } | undefined;

    return {
        visible: {
            boardVisible: Boolean(boardRect && boardRect.width > 0 && boardRect.height > 0),
            path: `${window.location.pathname}${window.location.search}`,
            tutorialStepId,
            tutorialText: tutorialCard?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 400) ?? '',
            viewport,
        },
        authoritative: {
            harnessRegistered: Boolean(state),
            tutorialStepId: sysTutorial?.step?.id ?? null,
            tutorialHiddenAutomation: Boolean(sysTutorial?.step?.hiddenAutomation),
            turnPhase: core.turnPhase ?? null,
            currentPlayer: core.currentPlayer ?? null,
            selectedActionId: core.selectedActionId ?? null,
            actionWheelPosition: core.actionWheelPosition ?? null,
            factionActionUsed: core.factionActionUsed ?? null,
            mingHandCount: factions.ming?.handCount ?? null,
        },
    };
});

const startBehaviorTrace = async (page: Page, title: string) => {
    if (process.env.QIDAHEN_CAPTURE_BEHAVIOR_TRACE !== '1') return;
    const chainId = behaviorChainIdForTitle(title);
    if (!chainId) return;
    const sourceRevision = process.env.QIDAHEN_TUTORIAL_SOURCE_REVISION ?? getQidahenTutorialSourceRevision();

    await page.addInitScript(() => {
        const testWindow = window as HarnessWindow;
        testWindow.__QIDAHEN_BEHAVIOR_INPUTS__ = [];
        let pointerBefore: BehaviorSnapshot | null = null;
        const describeTarget = (target: EventTarget | null) => {
            if (!(target instanceof Element)) return '页面';
            const control = target.closest('[data-testid], [data-tutorial-id], button, [role="button"]') ?? target;
            const text = control.textContent?.replace(/\s+/g, ' ').trim().slice(0, 50);
            const className = typeof control.className === 'string'
                ? control.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
                : '';
            return control.getAttribute('data-testid')
                || control.getAttribute('data-tutorial-id')
                || control.getAttribute('aria-label')
                || text
                || `${control.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
        };
        const readSnapshot = (): BehaviorSnapshot => {
            const state = testWindow.__BG_TEST_HARNESS__?.state?.get?.();
            const core = state?.core && typeof state.core === 'object' ? state.core as Record<string, unknown> : {};
            const factions = core.factions && typeof core.factions === 'object'
                ? core.factions as Record<string, { handCount?: number }>
                : {};
            const stepId = document.querySelector<HTMLElement>('[data-tutorial-step]')?.dataset.tutorialStep ?? null;
            const tutorialCard = document.querySelector<HTMLElement>('[data-testid="tutorial-overlay-card"]');
            const board = document.querySelector<HTMLElement>('[data-testid="qidahen-board"]');
            const boardRect = board?.getBoundingClientRect();
            const tutorial = state?.sys?.tutorial as { step?: { id?: string; hiddenAutomation?: unknown } } | undefined;

            return {
                visible: {
                    boardVisible: Boolean(boardRect && boardRect.width > 0 && boardRect.height > 0),
                    path: `${window.location.pathname}${window.location.search}`,
                    tutorialStepId: stepId,
                    tutorialText: tutorialCard?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 400) ?? '',
                    viewport: window.innerWidth <= 900 ? 'mobile' : 'desktop',
                },
                authoritative: {
                    harnessRegistered: Boolean(state),
                    tutorialStepId: tutorial?.step?.id ?? null,
                    tutorialHiddenAutomation: Boolean(tutorial?.step?.hiddenAutomation),
                    turnPhase: core.turnPhase ?? null,
                    currentPlayer: core.currentPlayer ?? null,
                    selectedActionId: core.selectedActionId ?? null,
                    actionWheelPosition: core.actionWheelPosition ?? null,
                    factionActionUsed: core.factionActionUsed ?? null,
                    mingHandCount: factions.ming?.handCount ?? null,
                },
            };
        };
        const recordAfterPaint = (type: string, target: EventTarget | null, before: BehaviorSnapshot, key?: string) => {
            const input = { type, target: describeTarget(target), ...(key ? { key } : {}), before };
            requestAnimationFrame(() => requestAnimationFrame(() => {
                testWindow.__QIDAHEN_BEHAVIOR_INPUTS__?.push({ ...input, after: readSnapshot() });
            }));
        };
        document.addEventListener('pointerdown', () => { pointerBefore = readSnapshot(); }, true);
        document.addEventListener('click', (event) => {
            const before = pointerBefore ?? readSnapshot();
            pointerBefore = null;
            recordAfterPaint('点击', event.target, before);
        }, false);
        document.addEventListener('pointerup', (event) => {
            if (event.pointerType !== 'touch') return;
            const before = pointerBefore ?? readSnapshot();
            pointerBefore = null;
            recordAfterPaint('触摸抬起', event.target, before);
        }, false);
        document.addEventListener('keydown', (event) => {
            if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
            recordAfterPaint('键盘操作', event.target, readSnapshot(), event.key);
        }, true);
    });

    const tracePath = resolve(behaviorTraceRoot(), `${chainId}.json`);
    mkdirSync(dirname(tracePath), { recursive: true });
    const recorder: BehaviorTraceRecorder = {
        tracePath,
        lastSnapshot: await readBehaviorSnapshot(page),
        lastAction: '',
        trace: {
            gameId: 'qidahen',
            evidenceCategory: 'tutorial',
            chainId,
            sourceRun: TUTORIAL_RUN_ID,
            sourceRevision,
            status: 'RUNNING',
            outcome: '教程行为链执行中。',
            steps: [],
            uiStates: [],
            skippedDuplicateScreenshots: [],
        },
    };
    behaviorTraceRecorders.set(page, recorder);
    writeBehaviorTrace(recorder);
};

const finishBehaviorTrace = (page: Page, passed: boolean) => {
    const recorder = behaviorTraceRecorders.get(page);
    if (!recorder) return;
    recorder.trace.status = passed ? 'PASS' : 'FAIL';
    recorder.trace.outcome = passed
        ? `真实教程操作通过，记录 ${recorder.trace.steps.length} 个行为检查点与 ${recorder.trace.uiStates.length} 个独特界面状态。`
        : '教程 E2E 未通过；本行为链不得用于最终 PASS。';
    writeBehaviorTrace(recorder);
};

const recordBehaviorOnlyCheckpoint = async (page: Page, action: string, expectedStep: string | null, expectedBoardVisible = true) => {
    const recorder = behaviorTraceRecorders.get(page);
    if (!recorder) return;
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    const inputEvents = await page.evaluate(() => {
        const host = window as HarnessWindow;
        const events = host.__QIDAHEN_BEHAVIOR_INPUTS__ ?? [];
        host.__QIDAHEN_BEHAVIOR_INPUTS__ = [];
        return events.map(({ type, target, key }) => ({ type, target, ...(key ? { key } : {}) }));
    });
    const after = await readBehaviorSnapshot(page);
    recorder.trace.steps.push({
        id: `${recorder.trace.chainId}-check-${String(recorder.trace.steps.length + 1).padStart(3, '0')}`,
        action, before: recorder.lastSnapshot, after, inputEvents,
        assertions: [
            { name: '当前教程步骤', actual: after.visible.tutorialStepId, expected: expectedStep },
            { name: '棋盘可见状态', actual: after.visible.boardVisible, expected: expectedBoardVisible },
        ],
    });
    recorder.lastSnapshot = after;
    writeBehaviorTrace(recorder);
};

const captureBehaviorCheckpoint = async (page: Page, targetPath: string) => {
    const recorder = behaviorTraceRecorders.get(page);
    if (!recorder) return;
    await page.evaluate(() => new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
    }));
    const events = await page.evaluate(() => {
        const testWindow = window as HarnessWindow;
        const inputs = testWindow.__QIDAHEN_BEHAVIOR_INPUTS__ ?? [];
        testWindow.__QIDAHEN_BEHAVIOR_INPUTS__ = [];
        return inputs;
    });
    const after = await readBehaviorSnapshot(page);
    const fileName = targetPath.split(/[\\/]/).at(-1)?.replace(/\.png$/i, '') ?? '教程状态';
    const assertionsFor = (snapshot: BehaviorSnapshot, prefix: string) => [
        { name: `${prefix}-qidahen-board-visible`, actual: snapshot.visible.boardVisible, expected: true },
        { name: `${prefix}-test-harness-state-available`, actual: snapshot.authoritative.harnessRegistered, expected: true },
        {
            name: `${prefix}-visible-tutorial-step-matches-authoritative-step`,
            actual: snapshot.visible.tutorialStepId,
            expected: snapshot.authoritative.tutorialHiddenAutomation ? null : snapshot.authoritative.tutorialStepId,
        },
    ];
    for (const event of events) {
        const id = `${recorder.trace.chainId}-input-${String(recorder.trace.steps.length + 1).padStart(3, '0')}`;
        const action = `${event.type}${event.key ? ` ${event.key}` : ''}：${event.target}`;
        recorder.trace.steps.push({
            id,
            action,
            before: event.before,
            after: event.after,
            assertions: [
                ...assertionsFor(event.after, id),
                { name: `${id}-real-input-target-recorded`, actual: event.target.length > 0, expected: true },
            ],
            inputEvents: [{ type: event.type, target: event.target, ...(event.key ? { key: event.key } : {}) }],
        });
        recorder.lastAction = action;
    }
    const beforeCapture = events.at(-1)?.after ?? recorder.lastSnapshot;
    const currentAction = events.length > 0
        ? `记录实际输入后的稳定界面：${fileName}`
        : recorder.lastAction
            ? `稳定界面截图：${fileName}`
            : `打开教程入口并确认棋盘与当前教程状态：${fileName}`;
    const stepId = `${recorder.trace.chainId}-capture-${String(recorder.trace.steps.length + 1).padStart(3, '0')}`;
    const stateId = `${recorder.trace.chainId}-ui-${String(recorder.trace.uiStates.length + 1).padStart(2, '0')}`;
    recorder.trace.steps.push({
        id: stepId,
        action: currentAction,
        before: beforeCapture,
        after,
        assertions: assertionsFor(after, stepId),
        inputEvents: [],
    });
    const screenshotHash = createHash('sha256').update(readFileSync(targetPath)).digest('hex');
    if (behaviorTraceScreenshotHashes.has(screenshotHash)) {
        recorder.trace.skippedDuplicateScreenshots.push({ path: targetPath, sha256: screenshotHash });
    } else {
        behaviorTraceScreenshotHashes.add(screenshotHash);
        const desktopOrMobile = after.visible.viewport === 'mobile' ? 'mobile' : 'desktop';
        const change = /支付|弃牌|长按|检视/.test(fileName)
            ? 'interaction-mode'
            : /高亮|目标|候选|区域|走法|地图/.test(fileName)
                ? 'target-highlight'
                : 'panel';
        recorder.trace.uiStates.push({
            id: stateId,
            stepId,
            change,
            viewport: desktopOrMobile,
            sha256: screenshotHash,
            path: targetPath,
            reason: `玩家完成当前输入后，教程界面呈现${fileName.replace(/[-_]/g, '，')}状态。`,
        });
    }
    recorder.lastSnapshot = after;
    if (events.length > 0) recorder.lastAction = currentAction;
    writeBehaviorTrace(recorder);
};

const saveScreenshot = async (page: Page, path: string) => {
    const targetPath = resolve(path);
    mkdirSync(dirname(targetPath), { recursive: true });
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: targetPath, fullPage: false, animations: 'disabled' });
    await captureBehaviorCheckpoint(page, targetPath);
    if (process.env.QIDAHEN_REGION_LAYOUT_DIAGNOSTIC === '1') {
        const layout = await page.evaluate(() => {
            const target = document.querySelector('[data-region-focus-shape="runtime-region-mask"]');
            if (!target) return null;
            const selectors = ['qidahen-map-layer', 'qidahen-player-float', 'qidahen-hand-row',
                'qidahen-hand-interaction-tray', 'qidahen-actions-zone', 'qidahen-action-wheel', 'qidahen-map-viewport-controls'];
            return { target: target.getBoundingClientRect().toJSON(), boxes: Object.fromEntries(selectors.map(id => (
                [id, document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().toJSON() ?? null]
            ))) };
        });
        if (layout) console.info('REGION_LAYOUT', JSON.stringify(layout));
    }
};

const expectTutorialOverlayFullyVisible = async (page: Page, stepId: string) => {
    const metrics = await page.locator('[data-testid="tutorial-overlay-card"]').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            width: rect.width,
        };
    });
    expect(metrics.width, `${stepId} tutorial card width`).toBeGreaterThan(80);
    expect(metrics.height, `${stepId} tutorial card height`).toBeGreaterThan(40);
    expect(metrics.left, `${stepId} tutorial card left edge`).toBeGreaterThanOrEqual(0);
    expect(metrics.top, `${stepId} tutorial card top edge`).toBeGreaterThanOrEqual(0);
    expect(metrics.right, `${stepId} tutorial card right edge`).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.bottom, `${stepId} tutorial card bottom edge`).toBeLessThanOrEqual(metrics.viewportHeight);
};

const readLocatorRect = async (locator: Locator) => (
    locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
        };
    })
);

const getRectOverlapArea = (
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
) => {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
};

const expectTutorialOverlayNotToCover = async (
    page: Page,
    target: Locator,
    label: string,
) => {
    let lastMeasurement: {
        overlay: Awaited<ReturnType<typeof readLocatorRect>>;
        target: Awaited<ReturnType<typeof readLocatorRect>>;
        overlap: number;
    } | null = null;
    try {
        await expect.poll(async () => {
            const [overlayRect, targetRect] = await Promise.all([
                readLocatorRect(page.locator('[data-testid="tutorial-overlay-card"]')),
                readLocatorRect(target),
            ]);
            const overlap = getRectOverlapArea(overlayRect, targetRect);
            lastMeasurement = { overlay: overlayRect, target: targetRect, overlap };
            return overlap;
        }, { message: label, timeout: 2500 }).toBeLessThanOrEqual(1);
    } catch (error) {
        const detail = lastMeasurement ? `; overlay/target geometry=${JSON.stringify(lastMeasurement)}` : '';
        throw new Error(`${label}${detail}; ${error instanceof Error ? error.message : String(error)}`);
    }
};

const readHandCardVisibleFraction = async (card: Locator) => card.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    let top = Math.max(0, bounds.top);
    let bottom = Math.min(innerHeight, bounds.bottom);
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(ancestor).overflowY)) {
            const clip = ancestor.getBoundingClientRect();
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
        }
    }
    return Math.max(0, bottom - top) / bounds.height;
});

const clickExposedHandCard = async (card: Locator) => {
    const bounds = await card.boundingBox();
    if (!bounds) throw new Error('手牌没有实际可见牌面');
    await card.click({ position: { x: bounds.width / 2, y: bounds.height / 4 } });
};

const expectMobileHandCardsFullyInsideViewport = async (page: Page) => {
    const cards = page.locator('button[data-testid^="qidahen-hand-card-hand-"]');
    const viewport = page.viewportSize();
    expect(viewport, '移动手牌检查需要固定视口').not.toBeNull();
    const count = await cards.count();
    expect(count, '移动教程当前手牌应有可见实体卡牌').toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
        const bounds = await cards.nth(index).boundingBox();
        expect(bounds, `移动手牌 ${index + 1} 有实际布局`).not.toBeNull();
        expect(bounds!.y, `移动手牌 ${index + 1} 未被视口上沿裁切`).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height, `移动手牌 ${index + 1} 与视口底边留有间距`)
            .toBeLessThanOrEqual(viewport!.height - 8);
    }
};

const expectWheelRecruitTrainTargetListFullyVisible = async (
    page: Page,
    stepId: string,
    choiceTestIdPrefix: string,
) => {
    const panel = page.getByTestId('qidahen-wheel-recruit-train-selection');
    const panelHeader = page.getByTestId('qidahen-wheel-recruit-train-header');
    const measurements = await panel.evaluate((element, testIdPrefix) => {
        const slot = element.parentElement;
        const choices = Array.from(element.querySelectorAll<HTMLElement>('button[data-testid]'))
            .filter((choice) => choice.dataset.testid?.startsWith(testIdPrefix));
        if (!slot || choices.length === 0) throw new Error('征兵训练目标面板或候选项不存在');
        const rect = (target: Element) => {
            const bounds = target.getBoundingClientRect();
            return { bottom: bounds.bottom, left: bounds.left, right: bounds.right, top: bounds.top };
        };
        const panelRect = element.getBoundingClientRect();
        const partialChoiceCount = choices.filter((choice) => {
            const bounds = choice.getBoundingClientRect();
            const intersectsPanel = bounds.bottom > panelRect.top && bounds.top < panelRect.bottom;
            const fullyWithinPanel = bounds.top >= panelRect.top && bounds.bottom <= panelRect.bottom;
            return intersectsPanel && !fullyWithinPanel;
        }).length;
        return {
            panel: rect(element),
            slot: rect(slot),
            choiceCount: choices.length,
            partialChoiceCount,
            choiceLabels: choices.map((choice) => (
                choice.querySelector<HTMLElement>(':scope > span > span:first-child')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
            )),
            scrollTop: element.scrollTop,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            viewportHeight: window.innerHeight,
        };
    }, choiceTestIdPrefix);
    const highlightRect = await readLocatorRect(page.getByTestId('tutorial-highlight-ring'));
    const panelHeaderRect = await readLocatorRect(panelHeader);
    const discardPileRect = await readLocatorRect(page.getByTestId('qidahen-discard-anchor'));
    const scrollHint = page.getByTestId('qidahen-wheel-recruit-train-scroll-hint');

    expect(measurements.panel.top, `${stepId} 候选面板顶部`).toBeGreaterThanOrEqual(0);
    expect(measurements.panel.bottom, `${stepId} 候选面板未被操作栏裁切`)
        .toBeLessThanOrEqual(measurements.slot.bottom + 1);
    expect(measurements.panel.bottom, `${stepId} 候选面板未超出视口`)
        .toBeLessThanOrEqual(measurements.viewportHeight);
    expect(panelHeaderRect.top, `${stepId} 列表标题未被上沿裁切`).toBeGreaterThanOrEqual(measurements.panel.top);
    expect(panelHeaderRect.bottom, `${stepId} 列表标题保持在面板内`).toBeLessThanOrEqual(measurements.panel.bottom);
    expect(getRectOverlapArea(measurements.panel, discardPileRect), `${stepId} 候选面板不遮挡右下弃牌堆`)
        .toBeLessThanOrEqual(1);
    expect(measurements.choiceCount, `${stepId} 实际训练候选`).toBeGreaterThan(0);
    expect(measurements.partialChoiceCount, `${stepId} 面板边缘的候选项完整可读`).toBe(0);
    expect(new Set(measurements.choiceLabels).size, `${stepId} 训练目标标签可区分`)
        .toBe(measurements.choiceLabels.length);
    expect(Math.abs(highlightRect.top - measurements.panel.top), `${stepId} 高亮框贴合面板顶部`)
        .toBeLessThanOrEqual(1);
    expect(Math.abs(highlightRect.bottom - measurements.panel.bottom), `${stepId} 高亮框贴合面板底部`)
        .toBeLessThanOrEqual(1);
    await expect(scrollHint, `${stepId} 需要滚动时显示操作提示`).toBeVisible();

    if (measurements.scrollHeight > measurements.clientHeight) {
        const lastChoice = page.locator(`[data-testid^="${choiceTestIdPrefix}"]`).last();
        await panel.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
        });
        await expect.poll(async () => {
            const [panelRect, lastChoiceRect] = await Promise.all([
                readLocatorRect(panel),
                readLocatorRect(lastChoice),
            ]);
            return lastChoiceRect.top >= panelRect.top && lastChoiceRect.bottom <= panelRect.bottom;
        }, { message: `${stepId} 可滚动到完整候选末项` }).toBe(true);
        await panel.evaluate((element, scrollTop) => {
            element.scrollTop = scrollTop;
        }, measurements.scrollTop);
    }

    const firstChoice = page.locator(`[data-testid^="${choiceTestIdPrefix}"]`).first();
    await expect(firstChoice, `${stepId} 首个候选在原滚动位置完整可见`).toBeVisible();
    const [panelRect, firstChoiceRect] = await Promise.all([
        readLocatorRect(panel),
        readLocatorRect(firstChoice),
    ]);
    expect(firstChoiceRect.top, `${stepId} 首个候选未被面板上沿裁切`).toBeGreaterThanOrEqual(panelRect.top);
    expect(firstChoiceRect.bottom, `${stepId} 首个候选未被面板下沿裁切`).toBeLessThanOrEqual(panelRect.bottom);
};

const expectElementsNotToOverlap = async (
    page: Page,
    first: Locator,
    second: Locator,
    label: string,
) => {
    const [firstRect, secondRect] = await Promise.all([
        readLocatorRect(first),
        readLocatorRect(second),
    ]);
    expect(getRectOverlapArea(firstRect, secondRect), label).toBeLessThanOrEqual(1);
};

const readQidahenCore = async (page: Page) => (
    page.evaluate(() => {
        const stateApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.state;
        const snapshot = stateApi?.get?.();
        if (!snapshot) {
            throw new Error('qidahen test harness state snapshot unavailable');
        }
        return snapshot.core as Record<string, unknown>;
    })
);

const selectPostBattleChoice = async (page: Page, choiceId: string) => {
    const mode = choiceId.startsWith('besiege')
        ? 'besiege'
        : choiceId.startsWith('withdraw')
            ? 'withdraw'
            : 'occupy';
    const modeButton = page.getByTestId(`qidahen-post-battle-mode-${mode}`);
    if (await modeButton.count() > 0) {
        await modeButton.click();
    }
    await page.getByTestId(`qidahen-post-battle-choice-${choiceId}`).click();
    await page.getByTestId('qidahen-post-battle-confirm').click();
};

const resolvePendingActionByCommand = async (
    page: Page,
    payload: Record<string, unknown>,
) => {
    await page.evaluate(async (nextPayload) => {
        const commandApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.command;
        if (!commandApi?.dispatch) {
            throw new Error('qidahen test harness command dispatcher unavailable');
        }
        await commandApi.dispatch({
            type: 'RESOLVE_PENDING_ACTION',
            playerId: '0',
            payload: nextPayload,
        });
    }, payload);
};

const clickWheelMoveUntilTutorialStep = async (
    page: Page,
    moveId: string,
    nextStepId: string,
) => {
    const moveTarget = page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`);
    const nextStep = page.locator(`[data-tutorial-step="${nextStepId}"]`);
    await expect(moveTarget).toBeVisible();
    await moveTarget.click();
    if (moveId === 'move-2-one-opponent') {
        const opponentTarget = page.getByTestId('qidahen-wheel-opponent-ming');
        await expect(opponentTarget).toBeVisible({ timeout: 10000 });
        await opponentTarget.click();
        await expect(nextStep).toBeVisible({ timeout: 10000 });
        return;
    }
    const advanced = await nextStep.waitFor({ state: 'visible', timeout: 2500 })
        .then(() => true)
        .catch(() => false);
    if (!advanced) {
        await moveTarget.click();
    }
    await expect(nextStep).toBeVisible({ timeout: 10000 });
};

const expectWheelPrimaryMove = async (page: Page, moveId: string) => {
    const primaryMove = page.locator('[data-testid^="qidahen-wheel-move-target-"][data-wheel-primary="true"]');
    await expect(primaryMove).toHaveCount(1);
    await expect(page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`)).toHaveAttribute('data-wheel-primary', 'true');
    await expect(page.locator('[data-testid^="qidahen-wheel-move-target-"][data-wheel-candidate-level="secondary"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="qidahen-wheel-sector"][data-wheel-primary="true"]')).toHaveCount(1);
};

const dispatchTouchLongPress = async (locator: Locator, durationMs = 700) => {
    const point = await locator.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        let left = Math.max(0, bounds.left), right = Math.min(innerWidth, bounds.right);
        let top = Math.max(0, bounds.top), bottom = Math.min(innerHeight, bounds.bottom);
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor), clip = ancestor.getBoundingClientRect();
            if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
            if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
        }
        if (right <= left || bottom <= top) throw new Error('长按目标没有实际可见触摸面');
        return { x: (left + right) / 2, y: (top + bottom) / 2 };
    });
    const session = await locator.page().context().newCDPSession(locator.page());
    try {
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }],
        });
        await locator.page().waitForTimeout(durationMs);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
        await session.detach();
    }
};

test.describe('七大恨新游戏收口', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }, testInfo) => {
        attachPageDiagnostics(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__BG_HIDE_DEBUG_PANEL__ = true;
        });
        if (!testInfo.title.includes('移动横屏真实教程')) {
            await startBehaviorTrace(page, testInfo.title);
        }
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== 'passed' && !page.isClosed()) {
            console.info('TUTORIAL_PAGE_DIAGNOSTICS', JSON.stringify({ errors: attachPageDiagnostics(page).errors,
                resources: await page.evaluate(() => performance.getEntriesByType('resource').slice(-20).map(entry => ({
                    path: new URL(entry.name).pathname, duration: Math.round(entry.duration),
                }))).catch(() => []),
            }));
        }
        finishBehaviorTrace(
            page,
            testInfo.status === 'passed' && testInfo.expectedStatus === 'passed',
        );
    });

    test.beforeAll(() => {
        mkdirSync(resolve(TUTORIAL_DIR), { recursive: true });
        mkdirSync(resolve(MOBILE_TUTORIAL_DIR), { recursive: true });
    });

    test('教程地区注释在宿主容器尺寸改变后仍贴合真实区域', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => { (window as HarnessWindow).__E2E_TEST_MODE__ = true; });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-tutorial-step="frontier"]')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('tutorial-next-button').click();
        const anchor = page.getByTestId('qidahen-map-region-focus-city-region-15');
        const label = page.locator('[data-testid="qidahen-map-region-focus-name"][data-region-id="city-region-15"]');
        await expect(label).toHaveText('辽北');
        const board = page.getByTestId('qidahen-board');
        const original = await board.evaluate(element => ({ width: element.style.width, height: element.style.height }));
        const before = await readLocatorRect(label);
        try {
            // 宿主侧栏改变容器大小不会派发window resize，注释仍须跟随同一地区。
            await board.evaluate(element => { element.style.width = 'calc(100% - 180px)'; element.style.height = 'calc(100% - 40px)'; });
            await expect.poll(async () => {
                const [area, name] = await Promise.all([readLocatorRect(anchor), readLocatorRect(label)]);
                return Math.abs(area.left - name.left) < 1 && Math.abs(area.top - name.bottom - 4) < 1
                    && (Math.abs(name.left - before.left) > 1 || Math.abs(name.top - before.top) > 1);
            }).toBe(true);
            await expect(label).toHaveCSS('font-size', '14px');
            expect(page.viewportSize()).toEqual({ width: 1920, height: 1080 });
        } finally {
            await board.evaluate((element, style) => { element.style.width = style.width; element.style.height = style.height; }, original);
        }
    });

    test('唯一入门入口、刷新继续、重开与退出清理', async ({ page }) => {
        test.setTimeout(120_000);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => { (window as HarnessWindow).__E2E_TEST_MODE__ = true; });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_TUTORIAL_CATALOG_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('tutorial-catalog-stage')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-step="frontier"]')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('先在辽北军屯');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('征召军队');
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="select-farm-region"]')).toBeVisible();
        const beforeRefresh = await readQidahenCore(page);
        await recordBehaviorOnlyCheckpoint(page, '正常进入唯一入门并推进到军屯地点选择', 'select-farm-region');
        await page.reload();
        await page.getByRole('button', { name: '从上次继续', exact: true }).click();
        await expect(page.locator('[data-tutorial-step="select-farm-region"]')).toBeVisible({ timeout: 30000 });
        expect((await readQidahenCore(page)).actionWheelPosition).toBe(beforeRefresh.actionWheelPosition);
        await recordBehaviorOnlyCheckpoint(page, '刷新后真实点击从上次继续，恢复同一军屯地点选择', 'select-farm-region');
        await page.reload();
        await page.getByRole('button', { name: '重头开始', exact: true }).click();
        await expect(page.locator('[data-tutorial-step="frontier"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(1);
        await recordBehaviorOnlyCheckpoint(page, '刷新后真实点击重头开始，恢复正式开局首屏', 'frontier');
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.getByTestId('qidahen-map-region-focus-name')).toHaveText('辽北');
        await page.getByTestId('fab-menu').locator('button[data-fab-id]').first().click();
        await page.getByRole('button', { name: '离开', exact: true }).click();
        await page.getByTestId('fab-panel-exit').getByRole('button', { name: /返回大厅/ }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-map-region-focus-name')).toHaveCount(0);
        await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => (
            (window as unknown as { __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: { active?: boolean } })
                .__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?.active ?? null
        ))).toBe(false);
        await recordBehaviorOnlyCheckpoint(page, '通过退出面板返回大厅，教程提示和高亮均清理', null, false);
    });

    test('正式入门连续对局：军屯辽北、突袭叶赫、打出鸳鸯阵并占领', async ({ page }) => {
        test.setTimeout(120_000);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => { (window as HarnessWindow).__E2E_TEST_MODE__ = true; });
        const diagnostics = attachPageDiagnostics(page);
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="frontier"]')).toBeVisible({ timeout: 15000 });
        const opening = await readQidahenCore(page);
        const openingLiaobei = (opening.regions as Array<{ id: string; troops: number; population: number }>).find((region) => region.id === 'city-region-15');
        expect([openingLiaobei?.troops, openingLiaobei?.population]).toEqual([3, 3]);
        await page.getByTestId('tutorial-next-button').click();

        await expect(page.locator('[data-tutorial-step="select-farm-region"]')).toBeVisible();
        const candidateIds = (await page.getByTestId('qidahen-map-region-mask-overlay')
            .getAttribute('data-qidahen-candidate-region-ids'))!.split('|');
        expect(candidateIds).toEqual(expect.arrayContaining(['city-region-15', 'city-region-15-liaodong', 'city-region-28']));
        expect(candidateIds).not.toContain('city-region-7');
        expect(candidateIds).not.toContain('xian-xing');
        const ordinaryCandidate = await page.getByTestId('qidahen-map-region-mask-overlay').evaluate((canvas: HTMLCanvasElement) => (
            [...canvas.getContext('2d')!.getImageData(880, 455, 1, 1).data]
        ));
        expect(ordinaryCandidate[3]).toBeGreaterThanOrEqual(30);
        const farmRegion = page.getByTestId('qidahen-map-region-focus-city-region-15');
        await expect(farmRegion).toHaveAttribute('data-region-focus-shape', 'runtime-region-mask');
        await expect(page.locator('[data-testid="qidahen-map-region-focus-name"][data-region-id="city-region-15"]')).toHaveText('辽北');
        const farmPoint = await readMapRegionInputPoint(page, 'city-region-15');
        await page.mouse.move(farmPoint.x, farmPoint.y);
        await expect(page.getByTestId('qidahen-map-region-tip')).toContainText('辽北');
        await expect(page.getByTestId('qidahen-map-region-tip')).not.toContainText('调度可达');
        await expect(page.getByTestId('qidahen-map-region-tip')).not.toContainText('特殊');
        await saveScreenshot(page, BASIC_FARM_REGION);
        await page.mouse.click(farmPoint.x, farmPoint.y);
        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('军屯');
        await expectWheelPrimaryMove(page, 'move-2-one-opponent');
        await saveScreenshot(page, BASIC_WHEEL_CHOICE);
        await page.getByTestId('qidahen-wheel-move-target-move-2-one-opponent').click();
        await expect(page.locator('[data-tutorial-step="wheel-opponent"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-wheel-opponent-jin')).toBeVisible();
        await expect(page.getByTestId('qidahen-wheel-opponent-picker')).toContainText('军屯建军地：辽北');
        await saveScreenshot(page, BASIC_OPPONENT);
        await page.getByTestId('qidahen-wheel-opponent-jin').click();

        await expect(page.locator('[data-tutorial-step="choose-raid"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-season-summary')).toHaveCount(0);
        const farmed = await readQidahenCore(page);
        const farmedLiaobei = (farmed.regions as Array<{ id: string; troops: number }>).find((region) => region.id === 'city-region-15');
        expect(farmedLiaobei?.troops).toBe(4);
        expect((farmed.factions as Record<string, { handCount: number }>).ming.handCount).toBe(5);
        expect((farmed.factions as Record<string, { handCount: number }>).jin.handCount).toBe(
            (opening.factions as Record<string, { handCount: number }>).jin.handCount + 2,
        );
        await saveScreenshot(page, BASIC_FARM_RESULT);
        const inspectCard = (farmed.handCards as Array<{ id: string; faction: string; cardKind: string }>).find(card => card.faction === 'ming' && card.cardKind === 'silver')!;
        const inspectCardElement = page.getByTestId('qidahen-hand-card-' + inspectCard.id);
        await expect.poll(() => readHandCardVisibleFraction(inspectCardElement)).toBeGreaterThan(0.4);
        await expect.poll(() => readHandCardVisibleFraction(inspectCardElement)).toBeLessThan(0.62);
        // 从实际露出的上半张移入；locator.hover 的自动滚动会把被裁切的整张牌滚入屏幕。
        const restingCardBounds = await inspectCardElement.boundingBox();
        expect(restingCardBounds).not.toBeNull();
        await page.mouse.move(restingCardBounds!.x + restingCardBounds!.width / 2, restingCardBounds!.y + restingCardBounds!.height / 4);
        await expect.poll(() => readHandCardVisibleFraction(inspectCardElement)).toBeGreaterThan(0.98);
        await saveScreenshot(page, BASIC_HAND_HOVER);
        await page.mouse.move(20, 20);
        await expect.poll(() => readHandCardVisibleFraction(inspectCardElement)).toBeLessThan(0.62);
        const inspectButton = page.getByTestId('qidahen-hand-card-magnify-' + inspectCard.id);
        await expect(inspectButton.locator('svg')).toHaveCount(1);
        await expect(inspectButton).toHaveText('');
        await inspectButton.click();
        await expect(page.getByTestId('qidahen-card-magnify-overlay')).toBeVisible();
        await saveScreenshot(page, BASIC_HAND_MAGNIFY);
        await page.getByTestId('qidahen-card-magnify-overlay').getByRole('button', { name: /关闭/ }).click();
        await expect(page.getByTestId('qidahen-card-magnify-overlay')).toBeHidden();
        expect((await readQidahenCore(page)).selectedPaymentCardIds).toEqual([]);


        await expect(page.locator('[data-tutorial-step="choose-raid"]')).toBeVisible();
        await page.getByTestId('qidahen-action-recruit').click();
        await expect(page.locator('[data-tutorial-step="choose-raid"]')).toBeVisible();
        await expect.poll(async () => (await readQidahenCore(page)).confirmedActionId).not.toBe('recruit');
        await page.getByTestId('qidahen-action-raid').click();
        await expect(page.locator('[data-tutorial-step="choose-target"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-action-payment-hint')).toContainText('选择目标地区');
        await expect(page.getByTestId('qidahen-action-payment-hint')).not.toContainText('建州');
        expect((await readQidahenCore(page)).explicitRegionId).toBeNull();
        const raidCandidateIds = (await page.getByTestId('qidahen-map-region-mask-overlay')
            .getAttribute('data-qidahen-candidate-region-ids'))!.split('|');
        expect(raidCandidateIds).toContain('city-region-7');
        expect(raidCandidateIds).not.toContain('city-region-15');
        const target = page.getByTestId('qidahen-map-region-focus-city-region-7');
        await expect(target).toBeVisible();
        await expect(target).toHaveAttribute('data-region-focus-shape', 'runtime-region-mask');
        await expect(page.locator('[data-testid="qidahen-map-region-focus-name"][data-region-id="city-region-7"]')).toHaveText('叶赫部');
        const targetPoint = await readMapRegionInputPoint(page, 'city-region-7');
        await saveScreenshot(page, BASIC_TARGET);
        await page.mouse.click(targetPoint.x, targetPoint.y);
        await expect(page.locator('[data-tutorial-step="pay-raid"]')).toBeVisible();
        const beforePayment = await readQidahenCore(page);
        const silver = (beforePayment.handCards as Array<{ id: string; cardKind: string; faction: string }>).find((card) => card.faction === 'ming' && card.cardKind === 'silver');
        expect(silver).toBeTruthy();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('保留鸳鸯阵');
        await saveScreenshot(page, BASIC_PAYMENT);
        const preservedTactic = (beforePayment.handCards as Array<{ id: string; cardDefId: string }>).find((card) => card.cardDefId === 'qidahen-atlas05-1644-yuanyang-zhen');
        expect(preservedTactic).toBeTruthy();
        await clickExposedHandCard(page.getByTestId('qidahen-hand-card-' + preservedTactic!.id));
        await expect.poll(async () => (await readQidahenCore(page)).selectedPaymentCardIds).toEqual([]);
        await expect(page.locator('[data-tutorial-step="pay-raid"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-hand-card-' + preservedTactic!.id)).toBeVisible();
        await clickExposedHandCard(page.getByTestId('qidahen-hand-card-' + silver!.id));
        await expect(page.locator('[data-tutorial-step="confirm-raid-payment"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-action-payment-hint')).toContainText('叶赫部');
        await page.getByTestId('qidahen-action-payment-confirm').click();

        await expect(page.locator('[data-tutorial-step="battle-open"]')).toBeVisible({ timeout: 10000 });
        const pending = await readQidahenCore(page);
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid', sourceRegionId: 'city-region-15', targetRegionId: 'city-region-7',
        });
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="play-tactic"]')).toBeVisible();
        const tactic = (pending.handCards as Array<{ id: string; cardDefId: string; faction: string }>).find((card) => card.faction === 'ming' && card.cardDefId === 'qidahen-atlas05-1644-yuanyang-zhen');
        expect(tactic).toBeTruthy();
        await clickExposedHandCard(page.getByTestId('qidahen-hand-card-' + tactic!.id));
        await expect(page.getByTestId('qidahen-confirm-tactic-card')).toBeVisible();
        await expect(page.getByTestId('qidahen-selected-tactic-card-label')).toContainText('鸳鸯阵');
        await expectTutorialOverlayNotToCover(page, page.getByTestId('qidahen-tactic-card-selection-panel'), '教程提示不得遮挡战术确认面板');
        await expectTutorialOverlayNotToCover(page, page.getByTestId('qidahen-hand-card-' + tactic!.id), '教程提示不得遮挡选中的鸳鸯阵');
        await saveScreenshot(page, BASIC_TACTIC);
        await page.getByTestId('qidahen-confirm-tactic-card').click();
        await expect(page.locator('[data-tutorial-step="resolve-battle"]')).toBeVisible({ timeout: 10000 });
        const fourthTroop = page.locator('[data-pending-committed-selectable="true"][data-pending-committed-index="4"]').first();
        await expect(fourthTroop).toBeVisible();
        await expect(page.getByTestId('qidahen-battle-committed-count')).toHaveText('尚未选择');
        await expect(page.getByTestId('qidahen-resolve-pending-action')).toBeDisabled();
        await expect(fourthTroop).toHaveAttribute('data-pending-committed-selected', 'false');
        await saveScreenshot(page, BASIC_BATTLE_BEFORE);
        await fourthTroop.click();
        await expect(fourthTroop).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(page.getByTestId('qidahen-battle-committed-count')).toHaveText('4 / 4');
        await expect(page.getByTestId('qidahen-committed-troop-check')).toHaveCount(4);
        await expect(page.getByTestId('qidahen-battle-preparation')).toContainText('步兵骰子等级+1');
        await expect(page.getByTestId('qidahen-resolve-pending-action')).toBeEnabled();
        await saveScreenshot(page, BASIC_BATTLE);
        await page.getByTestId('qidahen-resolve-pending-action').click();

        await expect(page.locator('[data-tutorial-step="battle-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-post-battle-selection')).toBeVisible();
        await expect(page.getByTestId('qidahen-desktop-stage')).toHaveJSProperty('scrollTop', 0);
        const actualRolls = (await readQidahenCore(page)).postBattleSelection as { battleRolls: { stages: Array<{ phase: string; attackerRolls: unknown[] }> } };
        expect(actualRolls.battleRolls.stages.find(stage => stage.phase === 'infantry')?.attackerRolls)
            .toEqual([expect.objectContaining({ troopKind: 'infantry', dieSides: 10, raw: 9 })]);
        console.info('BATTLE_RESULT_LAYOUT', JSON.stringify(await page.getByTestId('qidahen-post-battle-result-header').evaluate(element => {
            const nodes = []; for (let node: Element | null = element; node; node = node.parentElement) {
                const style = getComputedStyle(node); nodes.push({ id: node.getAttribute('data-testid') ?? node.tagName, rect: node.getBoundingClientRect().toJSON(), scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, overflowY: style.overflowY, transform: style.transform });
            } return nodes;
        })));
        await expect.poll(async () => {
            const [header, slot] = await Promise.all([readLocatorRect(page.getByTestId('qidahen-post-battle-result-header')), readLocatorRect(page.getByTestId('qidahen-action-slot'))]);
            return header.top >= Math.max(0, slot.top) && header.bottom <= slot.bottom;
        }, { message: '战后结果开头必须在滚动区域和视口内完整可见' }).toBe(true);
        await saveScreenshot(page, BASIC_BATTLE_RESULT);
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="occupy"]')).toBeVisible();
        await selectPostBattleChoice(page, 'withdraw:city-region-15');
        await expect(page.locator('[data-tutorial-step="occupy"]')).toBeVisible();
        await expect.poll(async () => (await readQidahenCore(page)).postBattleSelection != null).toBe(true);
        await selectPostBattleChoice(page, 'occupy');
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        const occupied = await readQidahenCore(page);
        const yehe = (occupied.regions as Array<{ id: string; controller: string; troops: number }>).find((region) => region.id === 'city-region-7');
        expect([yehe?.controller, yehe?.troops]).toEqual(['ming', 4]);
        expect(occupied.currentPlayer).toBe('1');
        await saveScreenshot(page, BASIC_OCCUPIED);
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
        const nextTurn = await readQidahenCore(page);
        expect(nextTurn.currentPlayer).toBe('1');
        await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
        const resumed = await readQidahenCore(page);
        expect(resumed.actionWheelPosition).not.toBe(nextTurn.actionWheelPosition);
        await saveScreenshot(page, BASIC_CONTINUE);
        assertNoFatalFrontendErrors([{ label: 'qidahen-natural-opening', diagnostics }]);
    });

    test('移动横屏真实教程支持长按手牌检视并返回突袭支付', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(90_000);
        const touchContext = await browser.newContext({
            viewport: { width: 844, height: 390 },
            deviceScaleFactor: 1,
            isMobile: true,
            hasTouch: true,
        });
        const touchPage = await touchContext.newPage();
        try {
            await startBehaviorTrace(touchPage, testInfo.title);
            await setChineseLocale(touchPage);
            await disableAudio(touchPage);
            await touchPage.addInitScript(() => {
                (window as HarnessWindow).__E2E_TEST_MODE__ = true;
                (window as HarnessWindow).__BG_HIDE_DEBUG_PANEL__ = true;
            });
            await touchPage.goto(new URL(QIDAHEN_BASIC_TUTORIAL_URL, baseURL).toString(), { waitUntil: 'domcontentloaded' });
            await expect(touchPage.locator('[data-tutorial-step="frontier"]')).toBeVisible({ timeout: 30000 });
            await touchPage.getByTestId('tutorial-next-button').tap();
            await expect(touchPage.locator('[data-tutorial-step="select-farm-region"]')).toBeVisible();
            await expect(touchPage.locator('[data-map-hit-testing-ready="true"]')).toBeVisible();
            const farmRegion = touchPage.getByTestId('qidahen-map-region-focus-city-region-15');
            await expect(touchPage.locator('[data-testid="qidahen-map-region-focus-name"][data-region-id="city-region-15"]')).toHaveText('辽北');
            let previousFarmGeometry = '';
            await expect.poll(async () => {
                const rect = await farmRegion.boundingBox();
                const geometry = JSON.stringify(rect);
                const stable = rect != null && geometry === previousFarmGeometry;
                previousFarmGeometry = geometry;
                return stable;
            }, { intervals: [50, 100, 100] }).toBe(true);
            const tapPoint = await readMapRegionInputPoint(touchPage, 'city-region-15');
            expect(await touchPage.evaluate((point) => (document.elementFromPoint(point.x, point.y) as HTMLElement)?.dataset.testid, tapPoint)).not.toBe('qidahen-hand-zone');
            await touchPage.touchscreen.tap(tapPoint.x, tapPoint.y);
            await expect(touchPage.locator('[data-tutorial-step="wheel-move"]')).toBeVisible();
            await touchPage.getByTestId('qidahen-wheel-move-target-move-2-one-opponent').tap();
            await expect(touchPage.getByTestId('qidahen-wheel-opponent-picker')).toBeVisible();
            const opponentButton = await touchPage.getByTestId('qidahen-wheel-opponent-jin').boundingBox();
            expect(opponentButton!.height).toBeGreaterThanOrEqual(44);
            expect(opponentButton!.width).toBeGreaterThanOrEqual(76);
            await saveScreenshot(touchPage, MOBILE_WHEEL_OPPONENT);
            await touchPage.getByTestId('qidahen-wheel-opponent-jin').tap();
            await expect(touchPage.getByTestId('qidahen-season-summary')).toHaveCount(0);
            await expect(touchPage.locator('[data-tutorial-step="choose-raid"]')).toBeVisible();
            await touchPage.getByTestId('qidahen-action-raid').tap();
            const target = touchPage.getByTestId('qidahen-map-region-focus-city-region-7');
            await expect(target).toBeVisible();
            await expect(touchPage.locator('[data-testid="qidahen-map-region-focus-name"][data-region-id="city-region-7"]')).toHaveText('叶赫部');
            const paymentPanel = touchPage.getByTestId('qidahen-action-payment-panel');
            const playerFloat = touchPage.getByTestId('qidahen-player-float');
            await expect.poll(async () => getRectOverlapArea(await readLocatorRect(paymentPanel), await readLocatorRect(playerFloat)), { message: '支付栏不得遮挡玩家栏' }).toBeLessThanOrEqual(1);
            await expectTutorialOverlayNotToCover(touchPage, paymentPanel, '目标教程提示不得遮挡支付栏');
            let previousTargetGeometry = '';
            await expect.poll(async () => {
                const rect = await target.boundingBox();
                const geometry = JSON.stringify(rect);
                const stable = rect != null && geometry === previousTargetGeometry;
                previousTargetGeometry = geometry;
                return stable;
            }, { intervals: [50, 100, 100] }).toBe(true);
            const targetPoint = await readMapRegionInputPoint(touchPage, 'city-region-7');
            await saveScreenshot(touchPage, MOBILE_MAP_TARGET);
            expect(await touchPage.evaluate((point) => document.elementFromPoint(point.x, point.y)?.tagName,
                targetPoint)).toBe('CANVAS');
            await touchPage.touchscreen.tap(targetPoint.x, targetPoint.y);
            await expect(touchPage.locator('[data-tutorial-step="pay-raid"]')).toBeVisible();
            await expectTutorialOverlayNotToCover(touchPage, paymentPanel, '支付教程提示不得遮挡支付栏');
            await expectTutorialOverlayNotToCover(touchPage, touchPage.getByTestId('fab-menu'), '支付教程提示不得遮挡聊天入口');
            const silver = ((await readQidahenCore(touchPage)).handCards as Array<{ id: string; cardKind: string; faction: string }>).find((card) => card.faction === 'ming' && card.cardKind === 'silver');
            expect(silver).toBeTruthy();
            const silverCard = touchPage.getByTestId('qidahen-hand-card-' + silver!.id);
            await expectTutorialOverlayNotToCover(touchPage, silverCard, '支付教程提示不得遮挡银两');
            await expect.poll(async () => {
                const [cardRect, dockRect] = await Promise.all([readLocatorRect(silverCard), readLocatorRect(touchPage.getByTestId('qidahen-hand-zone'))]);
                return cardRect.left >= dockRect.left && cardRect.right <= dockRect.right;
            }, { message: '银两的露出牌面应在手牌窗口内，可直接触摸' }).toBe(true);
            await expect.poll(() => readHandCardVisibleFraction(silverCard)).toBeGreaterThan(0.4);
            await expect.poll(() => readHandCardVisibleFraction(silverCard)).toBeLessThan(0.62);
            await saveScreenshot(touchPage, MOBILE_RAID_PAYMENT);
            const handDock = touchPage.getByTestId('qidahen-hand-zone');
            const handOverflow = await handDock.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
            if (handOverflow) {
                const initialScroll = await handDock.evaluate((element) => element.scrollLeft);
                expect(initialScroll).toBeGreaterThan(0);
                const touchSession = await touchContext.newCDPSession(touchPage);
                const swipeHand = async (from: number, to: number) => {
                    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: from, y: 310 }] });
                    for (let step = 1; step <= 8; step += 1) {
                        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: from + (to - from) * step / 8, y: 310 }] });
                    }
                    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                };
                await swipeHand(290, 440);
                await expect.poll(() => handDock.evaluate((element) => element.scrollLeft), { message: '触屏右滑应显示前面的手牌' }).toBeLessThan(initialScroll);
                await swipeHand(440, 290);
                await expect.poll(async () => {
                    const [cardRect, dockRect] = await Promise.all([readLocatorRect(silverCard), readLocatorRect(handDock)]);
                    return cardRect.left >= dockRect.left && cardRect.right <= dockRect.right;
                }, { message: '触屏左滑后银两应重新完整显示' }).toBe(true);
                await touchSession.detach();
            } else {
                const visibleCards = handDock.locator('button[data-testid^="qidahen-hand-card-"]');
                const dockRect = await readLocatorRect(handDock);
                for (const card of await visibleCards.all()) {
                    const cardRect = await readLocatorRect(card);
                    expect(cardRect.left >= dockRect.left && cardRect.right <= dockRect.right).toBe(true);
                }
            }
            await dispatchTouchLongPress(touchPage.getByTestId('qidahen-hand-card-' + silver!.id));
            await expect(touchPage.getByTestId('qidahen-card-magnify-overlay')).toBeVisible({ timeout: 10000 });
            await saveScreenshot(touchPage, MOBILE_HAND_INSPECT);
            await touchPage.getByTestId('qidahen-card-magnify-overlay-close').tap();
            await expect(touchPage.locator('[data-tutorial-step="pay-raid"]')).toBeVisible();
            await recordBehaviorOnlyCheckpoint(touchPage, '关闭卡面检视后回到原突袭支付，未消耗手牌', 'pay-raid');
            const silverTouchBounds = await silverCard.boundingBox();
            await silverCard.tap({ position: { x: silverTouchBounds!.width / 2, y: silverTouchBounds!.height / 4 } });
            await expect(touchPage.locator('[data-tutorial-step="confirm-raid-payment"]')).toBeVisible();
            expect((await readQidahenCore(touchPage)).selectedPaymentCardIds).toEqual([silver!.id]);
            const confirmButton = await touchPage.getByTestId('qidahen-action-payment-confirm').boundingBox();
            expect(confirmButton!.height).toBeGreaterThanOrEqual(44);
            expect(confirmButton!.width).toBeGreaterThanOrEqual(152);
            await saveScreenshot(touchPage, MOBILE_PAYMENT_SELECTED);
            finishBehaviorTrace(touchPage, true);
        } catch (error) {
            finishBehaviorTrace(touchPage, false);
            throw error;
        } finally {
            if (!touchPage.isClosed()) await touchContext.close();
        }
    });

    test('注入终局状态后会真实显示终局遮罩', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="endgame-overlay"]')).toHaveCount(0);
        await page.waitForFunction(() => (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);

        await page.evaluate(async () => {
            const stateApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.state;
            const snapshot = stateApi?.get?.();
            if (!snapshot || !stateApi?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.sys = {
                ...next.sys,
                phase: 'end',
                gameover: { winner: '0' },
            };
            await stateApi.set(next);
        });

        await expect(page.locator('[data-testid="endgame-overlay"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="endgame-overlay-content"]')).toContainText('胜利');
        await saveScreenshot(page, ENDGAME_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-closeout-endgame-overlay', diagnostics }]);
    });

    test('轮盘代价教程会展示调度费用并实际弃牌，完成后可进入常规对局创建入口', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-shared-cost', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入公共轮盘的 3 格分支');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-current-marker"]')).toHaveAttribute(
            'data-wheel-current-position',
            'wheel-military-farm',
        );
        await expect(page.locator('[data-testid="qidahen-wheel-sector"][data-wheel-candidate="true"]')).toHaveCount(3);
        await expectWheelPrimaryMove(page, 'move-3-all-opponents');
        await expect(page.locator('[data-wheel-sector-id="wheel-hire"]')).toHaveAttribute('data-wheel-candidate', 'true');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('6/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await saveScreenshot(page, WHEEL_COST_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();

        await expect(page.locator('[data-tutorial-step="draw-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-current-marker"]')).toHaveAttribute(
            'data-wheel-current-position',
            'wheel-hire',
        );
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('8/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('12/10');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌数各增加 2');
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="fab-menu"]'),
            '轮盘三格抽牌结果提示不得覆盖聊天悬浮菜单',
        );
        await expectElementsNotToOverlap(
            page,
            page.locator('[data-testid="fab-menu"]'),
            page.locator('[data-testid="tutorial-next-button"]'),
            '轮盘三格抽牌结果的聊天悬浮菜单不得遮挡下一步按钮',
        );
        await saveScreenshot(page, WHEEL_COST_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="dispatch-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('需弃 1 张');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进攻调度：弃 1 张手牌。');
        await saveScreenshot(page, WHEEL_COST_STEP_02A);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="pay-dispatch"]')).toBeVisible({ timeout: 10000 });
        const beforeDispatchPayment = await readQidahenCore(page) as {
            currentPlayer: string;
            factions: Record<string, { discardPileCount?: number; handCount: number; playerId: string }>;
            handCards: Array<{ faction: string; id: string; status: string }>;
        };
        const payingFactionId = Object.entries(beforeDispatchPayment.factions)
            .find(([, faction]) => faction.playerId === beforeDispatchPayment.currentPlayer)?.[0];
        expect(payingFactionId).toBeTruthy();
        const handCountBeforePayment = beforeDispatchPayment.factions[payingFactionId!].handCount;
        const discardCountBeforePayment = beforeDispatchPayment.factions[payingFactionId!].discardPileCount ?? 0;
        const dispatchPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(dispatchPaymentCard).toBeVisible();
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-wheel-dispatch-payment-panel'),
            '进攻调度支付提示不得遮挡支付面板',
        );
        await expectTutorialOverlayNotToCover(
            page,
            dispatchPaymentCard,
            '进攻调度支付提示不得遮挡可选手牌',
        );
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-wheel-dispatch-payment-confirm'),
            '进攻调度支付提示不得遮挡弃牌确认按钮',
        );
        await dispatchPaymentCard.click();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('已选 1 张');
        await expect(page.getByTestId('qidahen-wheel-dispatch-payment-confirm')).toBeEnabled();
        await saveScreenshot(page, WHEEL_COST_PAYMENT_SELECTED);
        await page.getByTestId('qidahen-wheel-dispatch-payment-confirm').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-panel"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-wheel-dispatch-selection')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图上的部队调度选择已可继续');
        const afterDispatchPayment = await readQidahenCore(page) as {
            actionWheelPosition: string;
            currentPlayer: string;
            factions: Record<string, { discardPileCount?: number; handCount: number; playerId: string }>;
            handCards: Array<{ faction: string; id: string; status: string }>;
            payment: { required: number };
            selectedPaymentCardIds: string[];
            turnPhase: string;
        };
        expect(afterDispatchPayment.currentPlayer).toBe(beforeDispatchPayment.currentPlayer);
        expect(afterDispatchPayment.factions[payingFactionId!].handCount).toBe(handCountBeforePayment - 1);
        expect(afterDispatchPayment.factions[payingFactionId!].discardPileCount).toBe(discardCountBeforePayment + 1);
        expect(afterDispatchPayment.payment.required).toBe(0);
        expect(afterDispatchPayment.selectedPaymentCardIds).toEqual([]);
        expect(afterDispatchPayment.turnPhase).toBe('dispatch-targeting');
        expect(afterDispatchPayment.actionWheelPosition).toBe('wheel-hire');
        await saveScreenshot(page, WHEEL_COST_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page).toHaveURL(/\/\?game=qidahen(?:&|$)/, { timeout: 10000 });
        const visibleGameDetailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').first();
        await expect(visibleGameDetailsModal).toBeVisible({ timeout: 10000 });
        await expect(visibleGameDetailsModal).toContainText('七大恨');
        const openCreateRoomButton = visibleGameDetailsModal.locator('[data-testid="game-details-open-create-room"]:visible').first();
        await expect(openCreateRoomButton).toBeVisible();
        await openCreateRoomButton.click();
        await expect(page.locator('[data-testid="create-room-modal"]:visible').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
    });

    test('轮盘开垦教程会真实展示人口增加的结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-reclaim', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入轮盘开垦结算');
        await saveScreenshot(page, WHEEL_RECLAIM_OVERVIEW);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“开垦”区域');
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('人口增加 1');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const reclaimCore = await readQidahenCore(page) as {
            regions: Array<{ id: string; population: number }>;
        };
        expect(reclaimCore.regions.find((region) => region.id === 'city-region-24')?.population).toBe(7);
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '开垦结果提示不得遮挡右侧行动选项',
        );
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('开垦已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('轮盘军屯教程会真实展示补牌并建立正规军', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-military-farm', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('军屯行动');
        await saveScreenshot(page, WHEEL_MILITARY_FARM_OVERVIEW);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“军屯”区域');
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, WHEEL_MILITARY_FARM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌已补充');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('出现 1 个等级 2 正规军');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const militaryFarmCore = await readQidahenCore(page) as {
            factions: {
                ming: { handCount: number };
            };
            regions: Array<{ id: string; troops: number }>;
        };
        expect(militaryFarmCore.factions.ming.handCount).toBe(5);
        expect(militaryFarmCore.regions.find((region) => region.id === 'city-region-24')?.troops).toBe(3);
        await saveScreenshot(page, WHEEL_MILITARY_FARM_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('军屯已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('轮盘征兵训练教程会让玩家支付、选择两种行动、加付训练并继续对局', async ({ page }) => {
        test.setTimeout(60_000);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-recruit-train', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('从军屯再前进 1 格，会进入征兵训练');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="rule-payment"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('弃一张手牌，最多可进行4 次的征兵或训练行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('额外的训练行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵的等级上限须由军备来提升');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText(/原文|原句/);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('当前点击');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“征兵训练”区域');
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_STEP_01);
        const beforeWheelLanding = await readQidahenCore(page) as {
            regions: Array<{ id: string; troops: number }>;
            factions: { ming: { handCount: number } };
        };
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="pay-initial"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-payment-panel')).toBeVisible();
        await expect(page.getByTestId('qidahen-season-summary')).toHaveCount(0);
        const afterWheelLanding = await readQidahenCore(page) as typeof beforeWheelLanding & {
            wheelRecruitTrainProgress: { phase: string; paymentPurpose: string };
        };
        expect(afterWheelLanding.wheelRecruitTrainProgress).toEqual({
            source: 'wheel',
            phase: 'payment',
            paymentPurpose: 'initial',
            actionsCompleted: 0,
            extraTrainingsCompleted: 0,
            trainingOnly: false,
            summaryLines: [],
        });
        expect(afterWheelLanding.factions.ming.handCount).toBe(beforeWheelLanding.factions.ming.handCount);
        expect(afterWheelLanding.regions.find((region) => region.id === 'city-region-24')?.troops)
            .toBe(beforeWheelLanding.regions.find((region) => region.id === 'city-region-24')?.troops);
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_PAYMENT);
        const initialPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(initialPaymentCard).toBeVisible();
        await initialPaymentCard.click();
        await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();

        await expect(page.locator('[data-tutorial-step="actions-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('-  征兵行动：直接建立 1 个等级 2 的正规军部队。');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('-  训练行动：将部队向上转 1 级，在一回合中每个部队只能各提升 1 级。');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵的等级上限须由军备来提升');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_ACTION_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-training"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Atrain').click();

        await expect(page.locator('[data-tutorial-step="artillery-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('(注意炮兵的等级上限须由军备来提升)');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本土(深色)');
        const artilleryTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train%3A"]')
            .filter({ hasText: '宣府' })
            .filter({ hasText: '炮兵' })
            .first();
        const expectArtilleryTargetFullyVisible = async () => {
            const fullyVisible = await artilleryTarget.evaluate((target) => {
                const panel = target.closest<HTMLElement>('[data-testid="qidahen-wheel-recruit-train-selection"]');
                if (!panel) return false;
                const targetRect = target.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                return targetRect.top >= panelRect.top
                    && targetRect.bottom <= panelRect.bottom
                    && targetRect.left >= panelRect.left
                    && targetRect.right <= panelRect.right;
            });
            expect(fullyVisible, '宣府炮兵训练选项应完整显示在征兵训练候选面板内').toBe(true);
        };
        await expect(artilleryTarget).toBeVisible();
        await expect(artilleryTarget).toContainText('炮兵 1级 → 2级');
        await expect(artilleryTarget).not.toContainText('{{targetLevel}}');
        await expectArtilleryTargetFullyVisible();
        await expectTutorialOverlayNotToCover(page, artilleryTarget, '炮兵训练教学提示不得覆盖当前目标');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_ARTILLERY_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-training-target"]')).toBeVisible({ timeout: 10000 });
        await expect(artilleryTarget).toBeVisible();
        await expectArtilleryTargetFullyVisible();
        await expectTutorialOverlayNotToCover(page, artilleryTarget, '炮兵训练操作提示不得覆盖当前目标');
        const artilleryBefore = await readQidahenCore(page) as {
            regions: Array<{ id: string; troops: number; specialTroops?: Array<{ troopKind: string; level: number }> }>;
        };
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_TRAINING_TARGET);
        await artilleryTarget.click();
        await expect(page.locator('[data-tutorial-step="training-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('炮兵从 1 级训练至 2 级');
        const artilleryAfter = await readQidahenCore(page) as typeof artilleryBefore;
        expect(artilleryAfter.regions.find((region) => region.id === 'city-region-24')?.troops)
            .toBe(artilleryBefore.regions.find((region) => region.id === 'city-region-24')?.troops);
        expect(artilleryAfter.regions.find((region) => region.id === 'city-region-24')?.specialTroops)
            .toEqual(expect.arrayContaining([expect.objectContaining({ troopKind: 'artillery', level: 2 })]));
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_TRAINING_RESULT);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
        await expect(page.locator('[data-tutorial-step="recruit-homeland-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('且必须在本土(深色)区域才能建立。');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵的等级上限');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_HOMELAND_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit-target"]')).toBeVisible({ timeout: 10000 });
        const recruitTargetTutorialText = page.locator('[data-testid="tutorial-overlay-card"]');
        await expect(recruitTargetTutorialText).toContainText('在候选区域中选择一个本土区域。');
        await expect(recruitTargetTutorialText).not.toContainText('正规军必须通过征兵行动建立');
        await expect(recruitTargetTutorialText).not.toContainText('选择高亮的区域');
        const recruitTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-recruit%3A"]').first();
        await expect(recruitTarget).toBeVisible();
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_RECRUIT_TARGET);
        const recruitBefore = await readQidahenCore(page) as {
            factions: { ming: { troops: number } };
            regions: Array<{ id: string; troops: number }>;
        };
        await recruitTarget.click();
        await expect(page.locator('[data-tutorial-step="recruit-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('建立 1 个等级 2 正规军部队');
        const recruitAfter = await readQidahenCore(page) as typeof recruitBefore;
        expect(recruitAfter.factions.ming.troops).toBe(recruitBefore.factions.ming.troops + 1);
        expect(recruitAfter.regions.filter((region) => (
            region.troops === (recruitBefore.regions.find((before) => before.id === region.id)?.troops ?? 0) + 1
        ))).toHaveLength(1);
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_RECRUIT_RESULT);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="extra-training-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('可透过弃手牌进行额外的训练行动，每张弃牌可额外进行 1 次训练。');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_EXTRA_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-extra-training"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-extra-training').click();
        await expect(page.locator('[data-tutorial-step="pay-extra"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-payment-panel')).toContainText('额外训练 · 弃牌');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_EXTRA_PAYMENT);
        const extraPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(extraPaymentCard).toBeVisible();
        await extraPaymentCard.click();
        await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();
        await expect(page.locator('[data-tutorial-step="choose-extra-training-target"]')).toBeVisible({ timeout: 10000 });
        const extraTrainingTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train%3A"]')
            .filter({ hasText: '宣府' })
            .filter({ hasText: '正规军' })
            .first();
        await expect(extraTrainingTarget).toBeVisible();
        await extraTrainingTarget.click();
        await expect(page.locator('[data-tutorial-step="extra-training-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-progress')).toContainText('已完成 2 / 4 次；额外训练 1 次');
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('训练至 3 级');

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-recruit-train-choice-finish"]')).toBeVisible();
        await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘征兵/训练');
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('建立 1 个等级 2 正规军部队');
        const recruitTrainCore = await readQidahenCore(page) as {
            wheelRecruitTrainProgress: unknown;
            wheelActionUsed: boolean;
            factionActionUsed: boolean;
            lastSeasonSummary: { lines: string[] } | null;
            regions: Array<{ id: string; troops: number; specialTroops?: Array<{ troopKind: string; level: number }> }>;
        };
        expect(recruitTrainCore.wheelRecruitTrainProgress).toBeNull();
        expect(recruitTrainCore.wheelActionUsed).toBe(true);
        expect(recruitTrainCore.factionActionUsed).toBe(false);
        expect(recruitTrainCore.lastSeasonSummary?.lines).toHaveLength(3);
        expect(recruitTrainCore.regions.find((region) => region.id === 'city-region-24')?.specialTroops)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ troopKind: 'artillery', level: 2 }),
                expect.objectContaining({ troopKind: 'infantry', level: 3 }),
            ]));
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_FINAL);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('征兵训练已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page.getByTestId('qidahen-actions-zone')).toBeVisible();
        await expect(page.getByTestId('qidahen-action-raid')).toBeEnabled();
    });

    test('升级军备教程会从真实手牌行动入口进入，并看到军备等级提升', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/armament-upgrade', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入大明手牌行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="action-overview"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('升级军备：打出军备牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('示例顺序');
        for (const actionId of ['raid', 'recruit', 'grant-pardon', 'drive-tiger']) {
            await expect(page.getByTestId(`qidahen-action-${actionId}`)).toBeVisible();
        }
        await saveScreenshot(page, ARMAMENT_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        const artilleryTechCard = page.locator('[data-tutorial-id="qidahen-atlas05-1626-artillery-tech"]').first();
        await expect(artilleryTechCard).toBeVisible();
        await saveScreenshot(page, ARMAMENT_STEP_01);
        await artilleryTechCard.click();

        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('弃 1 张手牌');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await saveScreenshot(page, ARMAMENT_STEP_02);

        const discardCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]:not([data-tutorial-id="qidahen-atlas05-1626-artillery-tech"])').first();
        await expect(discardCard).toBeVisible();
        await discardCard.click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).not.toContainText('军备详情');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('火炮技术从 1 级升到 2 级');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await saveScreenshot(page, ARMAMENT_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('升级军备完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('大汗令箭教程会真实选择征兵、本土目标、完成效果并继续对局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/event-action', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入蒙古手牌行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="action-overview"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('右侧列出蒙古的三个同层势力行动');
        for (const actionId of ['raid', 'ma-shi-trade', 'khan-edict']) {
            await expect(page.getByTestId(`qidahen-action-${actionId}`)).toBeVisible();
        }
        await saveScreenshot(page, EVENT_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-tutorial-id="qidahen-action-khan-edict"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-player-mongol')).toContainText('当前');
        await saveScreenshot(page, EVENT_STEP_01);
        await page.locator('[data-tutorial-id="qidahen-action-khan-edict"]').click();

        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('已选 0 / 1 张');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await saveScreenshot(page, EVENT_STEP_02);

        const handCards = page.locator('button[data-testid^="qidahen-hand-card-hand-"]');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        const firstCardBox = await handCards.nth(0).boundingBox();
        if (!firstCardBox) {
            throw new Error('first mongol hand card box missing');
        }
        await page.mouse.click(firstCardBox.x + 20, firstCardBox.y + firstCardBox.height / 2);
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="choose-effect"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]')).toContainText('征兵训练');
        const khanEdictMapTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-25"][data-action="select-region"]');
        await expect(khanEdictMapTarget).toBeVisible();
        await saveScreenshot(page, EVENT_STEP_03);
        await khanEdictMapTarget.click();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]').click();

        await expect(page.locator('[data-tutorial-step="recruit-train-actions-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('直接建立 1 个等级 2 的正规军部队');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('一回合中每个部队只能各提升 1 级');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await saveScreenshot(page, EVENT_STEP_04);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
        await expect(page.locator('[data-tutorial-step="recruit-homeland-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('且必须在本土(深色)区域才能建立。');
        await saveScreenshot(page, EVENT_STEP_05);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit-target"]')).toBeVisible({ timeout: 10000 });
        const recruitTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-recruit%3A"]').first();
        await expect(recruitTarget).toBeVisible();
        const beforeRecruit = await readQidahenCore(page) as {
            factions: { mongol: { troops: number } };
        };
        await recruitTarget.click();
        await expect(page.locator('[data-tutorial-step="recruit-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('建立 1 个等级 2 正规军部队');
        const afterRecruit = await readQidahenCore(page) as typeof beforeRecruit;
        expect(afterRecruit.factions.mongol.troops).toBe(beforeRecruit.factions.mongol.troops + 1);
        await saveScreenshot(page, EVENT_STEP_06);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish-recruit-train"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('大汗令箭 · 征兵训练');
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('建立 1 个等级 2 正规军部队');
        expect((await readQidahenCore(page)).wheelRecruitTrainProgress).toBeNull();
        await saveScreenshot(page, EVENT_STEP_07);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('大汗令箭的征兵训练效果已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page.getByTestId('qidahen-actions-zone')).toBeVisible();
        const continuedCore = await readQidahenCore(page) as {
            currentPlayer: string;
            turnPhase: string;
            factionActionUsed: boolean;
            wheelActionUsed: boolean;
            wheelRecruitTrainProgress: unknown;
            roundNumber: number;
            wheelMoveChoices: Array<{ id: string }>;
            factions: Record<string, { playerId: string }>;
        };
        const activeFaction = Object.entries(continuedCore.factions)
            .find(([, faction]) => faction.playerId === continuedCore.currentPlayer)?.[0];
        expect(activeFaction).toBeTruthy();
        expect(continuedCore.turnPhase).toBe('action-window');
        expect(continuedCore.factionActionUsed).toBe(true);
        expect(continuedCore.wheelActionUsed).toBe(false);
        expect(continuedCore.wheelRecruitTrainProgress).toBeNull();
        expect(continuedCore.wheelMoveChoices.some((choice) => choice.id === 'move-1-free')).toBe(true);
        const continueWheelAction = page.getByTestId('qidahen-wheel-move-target-move-1-free');
        await expect(continueWheelAction).toBeVisible();
        await expect(continueWheelAction).toHaveAttribute('aria-disabled', 'false');
        await continueWheelAction.click();
        const afterContinuedWheelAction = await readQidahenCore(page) as {
            currentPlayer: string;
            roundNumber: number;
            wheelActionUsed: boolean;
            wheelRecruitTrainProgress: unknown;
        };
        expect(
            afterContinuedWheelAction.wheelActionUsed
            || afterContinuedWheelAction.currentPlayer !== continuedCore.currentPlayer
            || afterContinuedWheelAction.roundNumber > continuedCore.roundNumber,
        ).toBe(true);
        expect(afterContinuedWheelAction.wheelRecruitTrainProgress).toBeNull();
    });

    test('进攻与野战教程会从真实突袭作战入口支付后进入战斗与战后处理', async ({ page }) => {
        test.setTimeout(60_000);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/attack-and-battle', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在进入大明手牌行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="action-overview"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('右侧列出大明的四个同层势力行动');
        for (const actionId of ['raid', 'recruit', 'grant-pardon', 'drive-tiger']) {
            await expect(page.getByTestId(`qidahen-action-${actionId}`)).toBeVisible();
        }
        await saveScreenshot(page, FIELD_BATTLE_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择「突袭作战」');
        await expect(page.locator('[data-tutorial-id="qidahen-action-raid"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(0);
        const initialAttackCore = await readQidahenCore(page) as {
            turnPhase: string;
            factionActionUsed: boolean;
            selectedActionId: string | null;
            pendingTargetAction: unknown | null;
        };
        expect(initialAttackCore.turnPhase).toBe('action-window');
        expect(initialAttackCore.factionActionUsed).toBe(false);
        expect(initialAttackCore.selectedActionId).toBe('raid');
        expect(initialAttackCore.pendingTargetAction).toBeNull();
        await saveScreenshot(page, FIELD_BATTLE_STEP_01);
        await page.locator('[data-tutorial-id="qidahen-action-raid"]').click();

        await expect(page.locator('[data-tutorial-step="pay-raid"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择 1 张手牌');
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('已选 0 / 1 张');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        const beforePaymentCore = await readQidahenCore(page) as {
            handCards: Array<{
                cardKind?: string;
                faction?: string;
                id: string;
                status?: string;
            }>;
        };
        const paymentCard = beforePaymentCore.handCards.find((card) => (
            card.faction === 'ming'
            && card.status !== 'disabled'
            && card.cardKind !== 'tactic'
        ));
        expect(paymentCard).toBeTruthy();
        await page.locator(`[data-testid="qidahen-hand-card-${paymentCard!.id}"]`).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('已选 1 / 1 张');
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-action-payment-panel'),
            '突袭支付教程提示不得覆盖支付面板',
        );
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-action-payment-confirm'),
            '突袭支付教程提示不得覆盖确认执行按钮',
        );
        await saveScreenshot(page, FIELD_BATTLE_STEP_02);
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="border-width"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('察哈尔');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进攻从克什克腾部进入察哈尔部');
        const afterPaymentCore = await readQidahenCore(page) as {
            pendingTargetAction?: {
                actionId?: string;
                committedTroops?: number;
                sourceRegionId?: string;
                targetRegionId?: string;
            } | null;
            turnPhase: string;
        };
        expect(afterPaymentCore.turnPhase).toBe('resolve-pending');
        expect(afterPaymentCore.pendingTargetAction?.actionId).toBe('raid');
        expect(afterPaymentCore.pendingTargetAction?.sourceRegionId).toBe('city-region-16');
        expect(afterPaymentCore.pendingTargetAction?.targetRegionId).toBe('city-region-14');
        expect(afterPaymentCore.pendingTargetAction?.committedTroops ?? 0).toBeGreaterThan(0);
        await saveScreenshot(page, FIELD_BATTLE_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="battle-open"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('双方公开部队');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="tactic-window"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击「骑兵冲锋」');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('再点击「打出战术牌」确认');
        const pendingGuideGeometry = await page.evaluate(() => {
            const selectedTokens = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-testid^="qidahen-map-token-"][data-pending-committed-selected="true"]',
            ));
            const targetTokens = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-qidahen-map-token-type="army"][data-qidahen-map-token-region="city-region-14"]',
            ));
            const routeLine = document.querySelector<SVGPathElement>(
                '[data-testid="qidahen-map-guide-line-city-region-14"]',
            );
            const matrix = routeLine?.getScreenCTM() ?? null;
            if (selectedTokens.length <= 0 || targetTokens.length <= 0 || !routeLine || !matrix) {
                return null;
            }
            const sourceCenter = selectedTokens.reduce(
                (center, token) => {
                    const rect = token.getBoundingClientRect();
                    return {
                        x: center.x + (rect.left + rect.width / 2) / selectedTokens.length,
                        y: center.y + (rect.top + rect.height / 2) / selectedTokens.length,
                    };
                },
                { x: 0, y: 0 },
            );
            const pathStartPoint = routeLine.getPointAtLength(0);
            const pathStart = new DOMPoint(pathStartPoint.x, pathStartPoint.y).matrixTransform(matrix);
            const pathEndPoint = routeLine.getPointAtLength(routeLine.getTotalLength());
            const pathEnd = new DOMPoint(pathEndPoint.x, pathEndPoint.y).matrixTransform(matrix);
            const targetTokenRects = targetTokens.map((token) => token.getBoundingClientRect());
            const nearestTargetTokenDistance = Math.min(...targetTokenRects.map((rect) => (
                Math.hypot(
                    pathEnd.x - (rect.left + rect.width / 2),
                    pathEnd.y - (rect.top + rect.height / 2),
                )
            )));
            const overlapsTargetToken = targetTokenRects.some((rect) => (
                pathEnd.x >= rect.left - 6
                && pathEnd.x <= rect.right + 6
                && pathEnd.y >= rect.top - 6
                && pathEnd.y <= rect.bottom + 6
            ));
            return {
                startToSelectedTroops: Math.hypot(
                    pathStart.x - sourceCenter.x,
                    pathStart.y - sourceCenter.y,
                ),
                nearestTargetTokenDistance,
                overlapsTargetToken,
            };
        });
        expect(pendingGuideGeometry).not.toBeNull();
        expect(pendingGuideGeometry!.startToSelectedTroops).toBeLessThan(40);
        expect(pendingGuideGeometry!.nearestTargetTokenDistance).toBeGreaterThan(28);
        expect(pendingGuideGeometry!.overlapsTargetToken).toBe(false);
        await saveScreenshot(page, FIELD_BATTLE_STEP_03A);
        const beforeTacticCore = await readQidahenCore(page) as {
            discardPileCount: number;
            handCards: Array<{ id: string; cardDefId?: string | null }>;
        };
        const tacticCard = beforeTacticCore.handCards.find((card) => card.cardDefId === 'qidahen-atlas05-1618-cavalry-charge');
        expect(tacticCard).toBeTruthy();
        const tacticCardButton = page.locator(`[data-testid="qidahen-hand-card-${tacticCard!.id}"]`);
        const tacticCardTopBeforeSelection = await tacticCardButton.evaluate((element) => element.getBoundingClientRect().top);
        await tacticCardButton.click();
        await expect(page.locator('[data-tutorial-step="tactic-window"]')).toBeVisible({ timeout: 10000 });
        await expect(tacticCardButton).toHaveAttribute('data-game-object-selected', 'true');
        await expect.poll(async () => {
            const selectedTop = await tacticCardButton.evaluate((element) => element.getBoundingClientRect().top);
            return Math.round(tacticCardTopBeforeSelection - selectedTop);
        }).toBeGreaterThanOrEqual(38);
        await expect(page.locator('[data-testid="qidahen-tactic-card-selection-panel"]')).toContainText('骑兵冲锋');
        await expect(page.locator('[data-testid="qidahen-confirm-tactic-card"]')).toContainText('打出战术牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveAttribute('data-tutorial-placement', 'left');
        await expectTutorialOverlayNotToCover(page, tacticCardButton, 'tactic tutorial overlay should not cover selected tactic card');
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-tactic-card-selection-panel"]'),
            'tactic tutorial overlay should not cover tactic confirmation strip',
        );
        await saveScreenshot(page, FIELD_BATTLE_STEP_03B);
        await tacticCardButton.click();
        await expect(tacticCardButton).not.toHaveAttribute('data-game-object-selected', 'true');
        await expect.poll(async () => {
            const unselectedTop = await tacticCardButton.evaluate((element) => element.getBoundingClientRect().top);
            return Math.abs(Math.round(unselectedTop - tacticCardTopBeforeSelection));
        }).toBeLessThanOrEqual(4);
        await expect(page.locator('[data-testid="qidahen-tactic-card-selection-panel"]')).toBeHidden();
        await tacticCardButton.click();
        await expect(tacticCardButton).toHaveAttribute('data-game-object-selected', 'true');
        await page.locator('[data-testid="qidahen-confirm-tactic-card"]').click();

        await expect(page.locator('[data-tutorial-step="battle-damage"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击「断后」结算野战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action"]')).toContainText('断后');
        const afterTacticCore = await readQidahenCore(page) as {
            discardPileCount: number;
            handCards: Array<{ id: string }>;
            lastSeasonSummary?: { title?: string; lines?: string[] } | null;
        };
        expect(afterTacticCore.handCards.some((card) => card.id === tacticCard?.id)).toBe(false);
        expect(afterTacticCore.discardPileCount).toBe(beforeTacticCore.discardPileCount + 1);
        expect(afterTacticCore.lastSeasonSummary?.title).toBe('战术牌');
        expect(afterTacticCore.lastSeasonSummary?.lines?.join(' ')).toContain('打出战术牌');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('攻方承伤');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('低级先损');
        await saveScreenshot(page, FIELD_BATTLE_STEP_04);
        await resolvePendingActionByCommand(page, {
            retreatLossMode: 'rear-guard',
            attackerCasualtyPriority: 'lowest-level',
            defenderCasualtyPriority: 'highest-level',
            committedTroops: 5,
        });

        await expect(page.locator('[data-tutorial-step="battle-result"]')).toBeVisible({ timeout: 10000 });
        const battleResultCore = await readQidahenCore(page) as {
            lastSeasonSummary?: { lines?: string[] } | null;
        };
        const battleResultSummary = battleResultCore.lastSeasonSummary?.lines?.join(' ') ?? '';
        expect(battleResultSummary).toContain('战斗掷骰（野战）');
        expect(battleResultSummary).toContain('骑兵');
        expect(battleResultSummary).toContain('步兵');
        expect(battleResultSummary).toContain('损伤');
        const battleMapResult = page.locator('[data-testid="qidahen-map-result-feedback"]');
        await expect(battleMapResult).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback-text"]'))
            .toContainText('察哈尔部队：1 → 0');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存');
        await saveScreenshot(page, FIELD_BATTLE_STEP_04A);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="retreat-and-defeat"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('战败方要在');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('败×1');
        await saveScreenshot(page, FIELD_BATTLE_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="post-battle-choice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在查看战后面板，选择战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await selectPostBattleChoice(page, 'occupy');
        await expect(page.locator('[data-tutorial-step="battle-finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('野战、撤退和战后处理已完成');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await saveScreenshot(page, FIELD_BATTLE_STEP_06);
    });

    test('战败撤退教程会真实展示断后与溃退入口，并结算一次溃退代价', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/retreat-and-rout', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入野战败方的撤退选择');
        await saveScreenshot(page, ROUT_OVERVIEW);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-rout"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '溃退提示不得遮挡断后与溃退两个选项',
        );
        await saveScreenshot(page, ROUT_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-rout"]').click();

        await expect(page.locator('[data-tutorial-step="rout-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图出发区不再保留这支部队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="fab-menu"]'),
            '撤退结果提示不得覆盖聊天悬浮菜单',
        );
        await expectElementsNotToOverlap(
            page,
            page.locator('[data-testid="fab-menu"]'),
            page.locator('[data-testid="tutorial-next-button"]'),
            '撤退结果的聊天悬浮菜单不得遮挡下一步按钮',
        );
        await saveScreenshot(page, ROUT_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('攻城教程会从真实守城宣告入口进入，再进入围城选择', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('守城宣告');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('守城避战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-defender-sortie"]')).toContainText('出城野战');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '守城提示不得遮挡守城与出城野战选择',
        );
        await saveScreenshot(page, SIEGE_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]').click();

        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('城战待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('本次出兵 4');
        const committedTroopTokens = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]');
        await expect(committedTroopTokens).toHaveCount(4);
        await expect(committedTroopTokens.nth(0)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(committedTroopTokens.nth(3)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击右侧战斗面板里的「断后」');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveCount(0);
        await saveScreenshot(page, SIEGE_STEP_01A);
        await page.locator('[data-testid="qidahen-resolve-pending-action"]').click();

        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback-text"]')).toContainText('山海关部队：2 → 0');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('已被突破');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存 1');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城保留后金控制和城内守军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领改由大明控制并清除守军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回会放弃占领');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '战后处理提示不得遮挡围城、占领和撤回入口',
        );
        const besiegeModeButton = page.getByTestId('qidahen-post-battle-mode-besiege');
        await expect(besiegeModeButton).toContainText('围城');
        await expect(page.getByTestId('qidahen-post-battle-mode-occupy')).toBeVisible();
        await expect(page.getByTestId('qidahen-post-battle-mode-withdraw')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="qidahen-post-battle-choice-entry"]')).toHaveCount(1);
        await expectTutorialOverlayNotToCover(page, besiegeModeButton, 'siege tutorial overlay should not cover besiege mode entry');
        await besiegeModeButton.click();
        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选择一种处理方式');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-post-battle-choice-list'),
            '围城目标列表不得被教程提示遮挡',
        );
        await expect(page.locator('[data-tutorial-id="qidahen-post-battle-choice-entry"]')).toHaveCount(1);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-post-battle-choice-besiege"]'),
            'siege tutorial overlay should not cover besiege choice',
        );
        const besiegeChoiceListFits = await page.getByTestId('qidahen-post-battle-choice-list').evaluate((element) => (
            element.scrollHeight <= element.clientHeight
        ));
        expect(besiegeChoiceListFits, '围城选项列表应完整显示，无需滚动才能读完末项').toBe(true);
        const postBattlePanelFits = await page.getByTestId('qidahen-actions-zone').evaluate((zone) => {
            const slot = zone.querySelector<HTMLElement>('[data-testid="qidahen-action-slot"]');
            const list = zone.querySelector<HTMLElement>('[data-testid="qidahen-post-battle-choice-list"]');
            const confirm = zone.querySelector<HTMLElement>('[data-testid="qidahen-post-battle-confirm"]');
            if (!slot || !list || !confirm) return false;
            const slotRect = slot.getBoundingClientRect();
            const options = Array.from(list.querySelectorAll<HTMLElement>('button'));
            const allOptionsVisible = options.length > 0 && options.every((option) => {
                const rect = option.getBoundingClientRect();
                return rect.top >= slotRect.top && rect.bottom <= slotRect.bottom;
            });
            const confirmRect = confirm.getBoundingClientRect();
            const confirmVisible = confirmRect.top >= slotRect.top && confirmRect.bottom <= slotRect.bottom;
            const zoneRect = zone.getBoundingClientRect();
            return allOptionsVisible && confirmVisible && zoneRect.bottom <= window.innerHeight;
        });
        expect(postBattlePanelFits, '围城选项和确认按钮应完整位于右侧面板可视范围内').toBe(true);
        const beforeBesiegeCore = await readQidahenCore(page);
        const beforeBesiegeRegions = beforeBesiegeCore.regions as Array<{
            id: string;
            controller?: string;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const beforeBesiegeShanhaiguan = beforeBesiegeRegions.find((region) => region.id === 'city-region-25');
        expect(beforeBesiegeShanhaiguan?.controller).toBe('jin');
        expect(beforeBesiegeShanhaiguan?.cityState).not.toBeNull();
        expect(beforeBesiegeShanhaiguan?.cityState?.population).toBeGreaterThan(0);
        await saveScreenshot(page, SIEGE_STEP_02);
        await selectPostBattleChoice(page, 'besiege');
        await expect(page.locator('[data-tutorial-step="besiege-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城完成：山海关仍由后金控制');
        await saveScreenshot(page, SIEGE_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveCount(0);
        const afterBesiegeCore = await readQidahenCore(page);
        const afterBesiegeRegions = afterBesiegeCore.regions as Array<{
            id: string;
            controller?: string;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const afterBesiegeShanhaiguan = afterBesiegeRegions.find((region) => region.id === 'city-region-25');
        expect(afterBesiegeShanhaiguan?.controller).toBe('jin');
        expect(afterBesiegeShanhaiguan?.cityState).not.toBeNull();
        expect(afterBesiegeShanhaiguan?.cityState?.population).toBeGreaterThan(0);
        expect(afterBesiegeShanhaiguan?.siegeState?.attackerFactionId).toBe('ming');
        expect(afterBesiegeShanhaiguan?.siegeState?.attackerTroops).toBeGreaterThan(0);
    });

    test('攻城教程同章占领对照会在攻下城市后真正改控制权', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('守城避战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]').click();

        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击右侧战斗面板里的「断后」');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action"]')).toContainText('断后');
        await page.locator('[data-testid="qidahen-resolve-pending-action"]').click();

        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('已被突破');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领改由大明控制并清除守军');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '战后选项不得被教程提示遮挡',
        );
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_01);
        const occupyModeButton = page.getByTestId('qidahen-post-battle-mode-occupy');
        await expect(occupyModeButton).toContainText('占领');
        await occupyModeButton.click();
        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回会放弃占领');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-post-battle-choice-list'),
            '占领候选列表不得被教程提示遮挡',
        );
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');
        await expect(page.getByTestId('qidahen-post-battle-scroll-hint')).toHaveText('滚动列表查看全部选项。');
        const occupyChoiceList = page.getByTestId('qidahen-post-battle-choice-list');
        const occupyChoiceContentFits = await occupyChoiceList.locator('button').evaluateAll((buttons) => (
            buttons.every((button) => getComputedStyle(button).flexShrink === '0' && button.scrollHeight <= button.clientHeight)
        ));
        expect(occupyChoiceContentFits, '占领选项说明卡不得被列表高度压缩截断').toBe(true);
        const occupyLastChoice = occupyChoiceList.locator('button').last();
        await occupyLastChoice.scrollIntoViewIfNeeded();
        const occupyLastChoiceFullyVisible = await occupyChoiceList.evaluate((list) => {
            const choice = list.querySelector<HTMLElement>('button:last-child');
            if (!choice) return false;
            const listRect = list.getBoundingClientRect();
            const choiceRect = choice.getBoundingClientRect();
            return choiceRect.top >= listRect.top && choiceRect.bottom <= listRect.bottom;
        });
        expect(occupyLastChoiceFullyVisible, '占领方式列表滚动到底部后，末项说明卡应完整可读').toBe(true);
        await occupyChoiceList.evaluate((list) => { list.scrollTop = 0; });
        await expect(page.getByTestId('qidahen-discard-anchor')).toHaveCount(0);
        const occupyConfirm = page.getByTestId('qidahen-post-battle-confirm');
        if (await occupyConfirm.count() > 0) {
            await expect(occupyConfirm).toBeVisible();
            await expectTutorialOverlayNotToCover(
                page,
                occupyConfirm,
                '占领确认按钮不得被教程卡遮挡',
            );
            const chatFabButton = page.locator('[data-testid="fab-menu"] button[aria-label="聊天"]');
            await expect(chatFabButton).toBeVisible();
            const [fabRect, confirmRect] = await Promise.all([
                readLocatorRect(chatFabButton),
                readLocatorRect(occupyConfirm),
            ]);
            expect(getRectOverlapArea(fabRect, confirmRect), '教程中的聊天悬浮按钮不得压住占领确认操作').toBeLessThanOrEqual(1);
        }
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_02);
        await selectPostBattleChoice(page, 'occupy');

        await expect(page.locator('[data-tutorial-step="occupy-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领完成：山海关改由大明控制');
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城、占领或撤回分别决定山海关控制权、城市状态和幸存部队去向');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        const afterOccupyCore = await readQidahenCore(page);
        const afterOccupyRegions = afterOccupyCore.regions as Array<{
            id: string;
            controller?: string;
            troops?: number;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const occupiedShanhaiguan = afterOccupyRegions.find((region) => region.id === 'city-region-25');
        expect(occupiedShanhaiguan?.controller).toBe('ming');
        expect(occupiedShanhaiguan?.troops).toBeGreaterThan(0);
        expect(occupiedShanhaiguan?.cityState).toBeNull();
        expect(occupiedShanhaiguan?.siegeState).toBeNull();
    });

    test('攻城教程允许撤回幸存部队并保留山海关原控制权', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-resolve-pending-action-defender-hold-city').click();
        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-resolve-pending-action').click();
        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回会放弃占领');
        await saveScreenshot(page, SIEGE_WITHDRAW_STEP_01);
        const withdrawModeButton = page.getByTestId('qidahen-post-battle-mode-withdraw');
        await expect(withdrawModeButton).toBeVisible();
        await expectTutorialOverlayNotToCover(page, withdrawModeButton, '战后处理提示不得遮挡撤回入口');
        await withdrawModeButton.click();

        const withdrawChoice = page.getByTestId('qidahen-post-battle-choice-withdraw:city-region-24');
        await expect(withdrawChoice).toContainText('退回');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-post-battle-choice-list'),
            '撤回目标列表不得被教程提示遮挡',
        );
        await withdrawChoice.click();
        await saveScreenshot(page, SIEGE_WITHDRAW_STEP_02);
        await page.getByTestId('qidahen-post-battle-confirm').click();

        await expect(page.locator('[data-tutorial-step="withdraw-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回完成：山海关仍由后金控制');
        await saveScreenshot(page, SIEGE_WITHDRAW_STEP_03);

        const afterWithdrawCore = await readQidahenCore(page);
        const afterWithdrawRegions = afterWithdrawCore.regions as Array<{
            id: string;
            controller?: string;
            troops?: number;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const withdrawnShanhaiguan = afterWithdrawRegions.find((region) => region.id === 'city-region-25');
        const withdrawDestination = afterWithdrawRegions.find((region) => region.id === 'city-region-24');
        expect(withdrawnShanhaiguan?.controller).toBe('jin');
        expect(withdrawnShanhaiguan?.cityState).not.toBeNull();
        expect(withdrawnShanhaiguan?.siegeState).toBeNull();
        expect(withdrawDestination?.controller).toBe('ming');
        expect(withdrawDestination?.troops).toBeGreaterThan(0);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
    });

    test('外交雇佣教程会从真实轮盘入口进入，并完成一次友好标记与雇佣结算', async ({ page }) => {
        const diagnostics = attachPageDiagnostics(page);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/diplomacy-and-hire', { waitUntil: 'domcontentloaded' });

        await page.waitForFunction(() => {
            return Boolean(
                document.querySelector('[data-testid="qidahen-board"]')
                || document.querySelector('[data-bg-friendly-screen="true"]'),
            );
        }, { timeout: 30000 });
        const friendlyErrorScreen = page.locator('[data-bg-friendly-screen="true"]');
        if (await friendlyErrorScreen.isVisible().catch(() => false)) {
            const errorScreenText = await friendlyErrorScreen.innerText().catch(() => '游戏加载失败');
            const diagnosticTail = diagnostics.errors.slice(-8).join('\n') || 'EMPTY';
            throw new Error([
                '外交雇佣教程在进入棋盘前命中前端错误屏。',
                `错误屏文案: ${errorScreenText}`,
                `最近页面错误:\n${diagnosticTail}`,
            ].join('\n'));
        }
        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await assertNoFatalFrontendErrors([{ label: 'qidahen-diplomacy-and-hire', diagnostics }]);
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入轮盘外交雇佣');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, DIPLOMACY_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="choose-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('外交目标');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('邻近 山海关');
        await expect(page.locator('[data-testid^="qidahen-diplomacy-target-"]')).toHaveCount(4);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="select-region"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交目标必须与己方控制区相邻');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="friendly-mark"]')).toBeVisible({ timeout: 10000 });
        const friendlyMarkTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="select-region"]');
        await expect(friendlyMarkTarget).toBeInViewport();
        await friendlyMarkTarget.click();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
        await saveScreenshot(page, DIPLOMACY_STEP_02);
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();

        await expect(page.locator('[data-tutorial-step="tribute-mark"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('翻为附庸');
        await expect(page.locator('[data-testid="qidahen-diplomacy-choice-flip-vassal"]')).toContainText('翻为附庸');
        await saveScreenshot(page, DIPLOMACY_STEP_02A);
        await page.locator('[data-testid="qidahen-diplomacy-choice-flip-vassal"]').click();

        await expect(page.locator('[data-tutorial-step="remove-mark"]')).toBeVisible({ timeout: 10000 });
        const removeMarkTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-22"][data-action="select-region"]');
        await expect(removeMarkTarget).toBeVisible();
        await expect(removeMarkTarget).toBeInViewport();
        await removeMarkTarget.click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('移除控制标记');
        await expect(page.locator('[data-testid="qidahen-diplomacy-choice-remove-marker"]')).toContainText('移除控制标记');
        await saveScreenshot(page, DIPLOMACY_STEP_02B);
        await page.locator('[data-testid="qidahen-diplomacy-choice-remove-marker"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        const diplomacyCore = await readQidahenCore(page) as {
            regions: Array<{
                id: string;
                controller?: string;
                diplomacyMarkerFaction?: string | null;
                diplomacyMarkerSide?: string | null;
                specialTroops?: Array<{
                    label?: string;
                    faction?: string;
                    count?: number;
                    level?: number;
                }>;
            }>;
            lastSeasonSummary?: { title?: string; lines?: string[] } | null;
        };
        const ningyuan = diplomacyCore.regions.find((region) => region.id === 'city-region-24');
        expect(ningyuan?.controller).toBe('ming');
        expect(ningyuan?.diplomacyMarkerFaction).toBe('ming');
        expect(ningyuan?.diplomacyMarkerSide).toBe('vassal');
        const dongjiang = diplomacyCore.regions.find((region) => region.id === 'city-region-22');
        expect(dongjiang?.diplomacyMarkerFaction).toBeNull();
        expect(dongjiang?.diplomacyMarkerSide).toBeNull();
        const hireRegion = diplomacyCore.regions.find((region) => region.id === 'city-region-25');
        expect(
            hireRegion?.specialTroops?.some((troop) => (
                troop.label?.includes('雇佣军')
                && troop.faction === 'ming'
                && troop.count === 2
                && troop.level === 2
            )),
        ).toBe(true);
        expect(diplomacyCore.lastSeasonSummary?.title).toBe('轮盘外交/雇佣');
        const diplomacySummaryText = diplomacyCore.lastSeasonSummary?.lines?.join(' ') ?? '';
        expect(diplomacySummaryText).toContain('建立 2 个等级 2 雇佣军');
        expect(diplomacySummaryText).toContain('宁远');
        expect(diplomacySummaryText).toContain('东江');
        expect(diplomacySummaryText).toContain('控制标记已移除');
        await saveScreenshot(page, DIPLOMACY_STEP_03);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交标记和雇佣部队已结算');
        await saveScreenshot(page, DIPLOMACY_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('年中新年教程会从年中摘要继续推进到新年维护，再看到跨年结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/year-and-characters', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入年中与新年结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-midyear"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('指定一个对手抽 2 张牌并向前走 2 格');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]')).toBeVisible();
        await expectWheelPrimaryMove(page, 'move-2-one-opponent');
        await clickWheelMoveUntilTutorialStep(page, 'move-2-one-opponent', 'midyear-tax');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('税赋');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        const midyearCore = await readQidahenCore(page);
        const midyearSummaryText = ((midyearCore.lastSeasonSummary as { lines?: string[] } | null)?.lines ?? []).join(' ');
        const midyearFactions = midyearCore.factions as Record<string, { defeatMarkers?: number; handCount?: number }>;
        expect(midyearSummaryText).toContain('土地税赋');
        expect(midyearSummaryText).toContain('战败标记');
        expect(midyearSummaryText).toContain('非朝鲜区域');
        expect(midyearFactions.ming.defeatMarkers).toBe(0);
        expect(midyearFactions.mongol.defeatMarkers).toBe(0);
        expect(midyearFactions.jin.defeatMarkers).toBe(0);
        await saveScreenshot(page, SEASON_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="midyear-characters"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('战败标记');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-new-year"]')).toBeVisible({ timeout: 10000 });
        await clickWheelMoveUntilTutorialStep(page, 'move-1-free', 'new-year-tribute');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('新年朝贡');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜牌库');
        await saveScreenshot(page, SEASON_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="new-year-maintenance"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        const beforeNewYearMaintenanceCore = await readQidahenCore(page);
        const beforeNewYearFactions = beforeNewYearMaintenanceCore.factions as Record<string, { handCount?: number; vp?: number }>;
        const beforeNewYearOrder = beforeNewYearMaintenanceCore.currentFactionOrder as string[];
        const beforeNewYearIndex = beforeNewYearMaintenanceCore.currentYearIndex as number;
        await saveScreenshot(page, SEASON_STEP_03);
        await page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]').click();
        await expect(page.locator('[data-tutorial-step="new-year-attrition"]')).toBeVisible({ timeout: 10000 });
        const afterNewYearMaintenanceCore = await readQidahenCore(page);
        const afterNewYearFactions = afterNewYearMaintenanceCore.factions as Record<string, { handCount?: number; vp?: number; characters?: Array<{ inPlay?: boolean }> }>;
        const afterNewYearSummary = afterNewYearMaintenanceCore.lastSeasonSummary as { title?: string; lines?: string[] } | null;
        const afterNewYearSummaryText = (afterNewYearSummary?.lines ?? []).join(' ');
        const afterNewYearOrder = afterNewYearMaintenanceCore.currentFactionOrder as string[];
        const afterNewYearCards = afterNewYearMaintenanceCore.yearCards as unknown[];
        expect(afterNewYearSummary?.title).toBe('新年结算');
        expect(afterNewYearSummaryText).toContain('维护');
        expect(afterNewYearSummaryText).toContain('兵力耗损');
        expect(afterNewYearSummaryText).toContain('获得本年纪年卡');
        expect(afterNewYearSummaryText).toContain('威望 +1');
        expect(afterNewYearSummaryText).toContain('非朝鲜区域');
        expect(afterNewYearMaintenanceCore.currentYearIndex).toBe(beforeNewYearIndex + 1);
        expect(afterNewYearMaintenanceCore.currentYear).toBe('天命五年 1620');
        expect(afterNewYearOrder).toEqual(expect.arrayContaining(['ming', 'mongol', 'jin']));
        expect(afterNewYearOrder).toHaveLength(beforeNewYearOrder.length);
        expect(afterNewYearCards.length).toBeGreaterThan(0);
        expect(afterNewYearFactions.ming.handCount).toBeLessThan(beforeNewYearFactions.ming.handCount ?? 0);
        expect(afterNewYearFactions.mongol.handCount).toBeLessThan(beforeNewYearFactions.mongol.handCount ?? 0);
        expect(afterNewYearFactions.mongol.vp).toBe((beforeNewYearFactions.mongol.vp ?? 0) + 1);
        expect(afterNewYearFactions.ming.characters?.some((character) => character.inPlay)).toBe(true);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="chronology-score"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-chronology-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('纪年卡结算');
        await saveScreenshot(page, SEASON_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="turn-order-refresh"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-chronology-zone')).toBeVisible();
        await expect(page.getByTestId('qidahen-year-card-slot-current-year')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-year-card-slot-current-year"] [data-card-atlas-frame]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"], [data-testid="qidahen-player-mongol"], [data-testid="qidahen-player-jin"]').filter({ hasText: '当前' })).toHaveCount(1);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('纪年结算完成');
        await saveScreenshot(page, SEASON_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-chronology-zone')).toBeVisible();
        await expect(page.getByTestId('qidahen-year-card-slot-current-year')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-year-card-slot-current-year"] [data-card-atlas-frame]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"], [data-testid="qidahen-player-mongol"], [data-testid="qidahen-player-jin"]').filter({ hasText: '当前' })).toHaveCount(1);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await saveScreenshot(page, SEASON_STEP_06);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('朝鲜与地图特例教程会从真实新年入口看到朝鲜朝贡，再通过维护结算看到朝鲜耗损与山海关结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/korea-and-special-map-rules', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入朝鲜、汉城、水路和山海关特例');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="korea-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝贡图标决定新年抽牌数');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜牌库');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜弃牌');
        await expect(page.locator('[data-testid="qidahen-korea-draw-pile"]')).toContainText('9');
        await expect(page.locator('[data-testid="qidahen-korea-discard-pile"]')).toContainText('3');
        const initialKoreaCore = await readQidahenCore(page);
        const initialKoreaRegions = initialKoreaCore.regions as { id: string; population?: number }[];
        const findInitialKoreaRegion = (regionId: string) => initialKoreaRegions.find((region) => region.id === regionId);
        expect(initialKoreaCore.koreaDeckCount).toBe(9);
        expect(initialKoreaCore.koreaDiscardCount).toBe(3);
        expect(findInitialKoreaRegion('xian-xing')?.population).toBe(0);
        expect(findInitialKoreaRegion('city-region-18')?.population).toBe(0);
        expect(findInitialKoreaRegion('city-region-29')?.population).toBe(0);
        await saveScreenshot(page, KOREA_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="hanseong-vp"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('汉城控制权对应 1 点威望');
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toContainText('汉城+1');
        await saveScreenshot(page, KOREA_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="water-limit"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('船锚水路一次最多移动 2 个部队');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('骑兵不能用水路避战');
        await saveScreenshot(page, KOREA_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="new-year-maintenance"]')).toBeVisible({ timeout: 10000 });
        const autoPayChoice = page.getByTestId('qidahen-fortification-maintenance-choice-auto-pay');
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await expect(autoPayChoice).toContainText('尽量维护防线');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击“尽量维护防线”，进入新年维护');
        await saveScreenshot(page, KOREA_STEP_04);
        await autoPayChoice.click();

        await expect(page.locator('[data-tutorial-step="korea-attrition"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝鲜部队耗损');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        const koreaAttritionCore = await readQidahenCore(page);
        const koreaAttritionSummaryText = ((koreaAttritionCore.lastSeasonSummary as { lines?: string[] } | null)?.lines ?? []).join(' ');
        expect(koreaAttritionSummaryText).toContain('朝鲜耗损');
        expect(koreaAttritionSummaryText).toContain('非朝鲜区域');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="shanhaiguan"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('完整时边界窄');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await saveScreenshot(page, KOREA_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝贡、汉城、水路和山海关特例');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });
});
