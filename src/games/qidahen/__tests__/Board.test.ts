import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_TEST_IDS = [
    'data-testid="qidahen-board"',
    'data-testid="qidahen-desktop-stage"',
    'data-testid="qidahen-map-layer"',
    'data-testid="qidahen-map-hitmap-canvas"',
    'data-testid="qidahen-map-overlay"',
    'data-testid="qidahen-map-region-mask-overlay"',
    'data-testid="qidahen-map-region-movement-preview"',
    'data-testid="qidahen-shared-printed-runtime-switcher"',
    'data-testid={`qidahen-shared-printed-runtime-option-${region.id}`}',
    'data-testid="qidahen-runtime-region-graph"',
    'data-testid={`qidahen-runtime-region-edge-${edge.id}`}',
    "import qidahenRegionMaskUrl from './data/region-mask.png?url'",
    'QIDAHEN_REGION_GRAPH_EDGES',
    'getQidahenDirectedPassage',
    'getQidahenRuntimeRegionIdsForPrintedRegionId',
    'QIDAHEN_REGION_ID_BY_MASK_COLOR',
    'qidahenRegionColorKey',
    'buildQidahenRuntimeRegionIdByPixel',
    'renderRegionOwnershipOverlay',
    "mainMap: 'qidahen/board/qidahen-main-map'",
    'data-testid="qidahen-player-float"',
    'data-testid={`qidahen-armaments-${faction.id}`}',
    'data-testid="qidahen-action-wheel"',
    'data-testid="qidahen-action-wheel-asset"',
    'data-testid={`qidahen-year-card-slot-${card.id}`}',
    'data-testid="qidahen-chronology-zone"',
    'data-testid="qidahen-korea-zone"',
    '<svg',
    'data-testid="qidahen-wheel-sector"',
    'data-testid="qidahen-wheel-move-layer"',
    'data-testid={`qidahen-wheel-move-target-${choice.id}`}',
    'data-testid="qidahen-wheel-tip"',
    'data-testid="qidahen-wheel-next-step-banner"',
    'data-testid="qidahen-wheel-next-step-title"',
    'data-testid="qidahen-wheel-next-step-hint"',
    'data-testid="qidahen-wheel-next-step-choices"',
    'data-testid={`qidahen-wheel-next-step-choice-${choice.id}`}',
    '开垦',
    '军屯',
    '征兵',
    '训练',
    '外交',
    '雇佣',
    '进攻',
    '调度',
    '新年 >>>',
    '年中',
    'data-testid="qidahen-raid-intent"',
    'data-testid="qidahen-post-battle-selection"',
    'data-testid={`qidahen-post-battle-choice-${choice.id}`}',
    'data-testid="qidahen-wheel-dispatch-selection"',
    'data-testid={`qidahen-wheel-dispatch-target-${candidate.targetRuntimeRegionId}`}',
    'data-testid="qidahen-actions-zone"',
    'data-testid="qidahen-action-slot"',
    'data-testid="qidahen-action-rail"',
    'data-testid={`qidahen-action-${action.id}`}',
    'data-testid="qidahen-hand-interaction-tray"',
    'data-testid="qidahen-action-payment-panel"',
    'data-testid="qidahen-action-payment-status"',
    'data-testid="qidahen-action-payment-hint"',
    'data-testid="qidahen-action-payment-confirm"',
    'data-testid="qidahen-action-payment-cancel"',
    'data-testid="qidahen-turn-banner"',
    'data-testid="qidahen-primary-action-next-step"',
    'data-testid={`qidahen-action-state-${action.id}`}',
    'data-testid="qidahen-actions-blocked-by-scenario"',
    'data-testid="qidahen-bottom-dock"',
    'data-testid="qidahen-draw-anchor"',
    'data-testid="qidahen-hand-zone"',
    'data-ui-role="qidahen-hand-dock"',
    'data-testid="qidahen-hand-row"',
    'onExecuteAction',
    'data-testid={`qidahen-hand-card-${card.id}`}',
    'data-testid="qidahen-discard-anchor"',
    'data-testid={getPendingTargetChoiceTestId(choice.id)}',
    'data-testid="qidahen-pending-casualty-priority"',
    'data-testid={`qidahen-${group.id}-casualty-priority`}',
    'data-testid={`qidahen-${group.id}-casualty-${option.id}`}',
    'data-testid="qidahen-upkeep-attrition-priority"',
    'data-testid={`qidahen-upkeep-attrition-${option.id}`}',
    'testId="qidahen-draw-pile"',
    'testId="qidahen-discard-pile"',
    'const currentFaction = core.factions[currentFactionId];',
    'count={currentFaction.drawPileCount}',
    'count={currentFaction.discardPileCount}',
    'EXECUTE_ACTION',
    'raid',
];

const FORBIDDEN_LEGACY_TITLES = [
    '行动记录',
    '结束行动',
    '当前年度',
    '势力状态',
    '战斗',
    '待处理',
    '地图缩放',
    '行动记录',
];

const FORBIDDEN_HALF_FINISHED_CHAINS = [
    'leftTopPatch',
    'FrontendWheel',
    'HandFan',
    'rotateDeg',
    'style={{ transform: `rotate(',
    'marginLeft: index === 0 ? 0 : -62',
    'data-testid="qidahen-wheel-move-choices"',
    'qidahen-wheel-move-${choice.id}',
    'data-testid="qidahen-wheel-summary"',
    '?? core.postBattleSelection',
    '?? core.recruitSelection',
    '?? core.diplomacySelection',
    '?? core.wheelDispatchProgress',
    '?? core.internalDispatchSelection',
    '?? core.maShiTradeSelection',
    '?? core.khanEdictSelection',
    'core.internalDispatchSelection ? (',
    'core.internalDispatchSelection != null',
    'const maShiTradeSelection = core.maShiTradeSelection;',
    'const khanEdictSelection = core.khanEdictSelection;',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT',
    'dispatch(QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE',
    'dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId: choiceId })',
    'WheelMoveChoiceButton',
    'QIDAHEN_MAP_REGION_SHAPES',
    'mapPath(shape)',
    'data-testid="qidahen-wheel-step-controls"',
    'data-testid="qidahen-payment-panel"',
    'data-testid="qidahen-execute-action"',
    '>执行<',
    'data-testid="qidahen-payment-state"',
    'paymentPrompt',
    '{action.cost}',
    '可付',
    'ASSETS.actionWheel',
    "label: '乾'",
    "label: '兑'",
    "label: '离'",
    "label: '震'",
    "label: '巽'",
    "label: '坎'",
    "label: '艮'",
    "label: '坤'",
    '走 {choice.steps}',
    'core.yearCards.slice(0, 1).map',
    'testId="qidahen-chronology-deck"',
    'label="纪年牌堆"',
    'selectedPaymentCardIds: []',
    '<DeckStack src={ASSETS.mingCard} locale={locale} label="牌库" count={core.drawPileCount} testId="qidahen-draw-pile" className="mr-[6px]" />',
    '<DeckStack src={ASSETS.coverCard} locale={locale} label="弃牌" count={core.discardPileCount} tone="crimson" testId="qidahen-discard-pile" className="ml-[6px]" />',
    'absolute bottom-[14px] left-[112px]',
    'absolute bottom-[14px] right-[116px]',
    'bottom-[28px]',
    'bg-[radial-gradient',
    'qidahen/board/main-board',
];

const boardSource = readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');
const cardAtlasSource = readFileSync(resolve(__dirname, '..', 'ui', 'cardAtlas.ts'), 'utf-8');
const mapTokenSource = readFileSync(resolve(__dirname, '..', 'domain', 'mapTokens.ts'), 'utf-8');

describe('Qidahen Board 结构门禁', () => {
    it('纪年卡预览继续绑定纪年图集而不是蒙古图集', () => {
        expect(cardAtlasSource).toContain("image: 'qidahen/cards/atlases/chronology-deck-atlas'");
    });

    it('三势力手牌预览继续绑定各自牌库图集，而不是退回牌背', () => {
        expect(cardAtlasSource).toMatch(/export const qidahenMingHandPreview = \(index: number\): CardPreviewRef => \(\{[\s\S]*?type: 'atlas',[\s\S]*?atlasId: QIDAHEN_MING_ATLAS_ID,[\s\S]*?index,/);
        expect(cardAtlasSource).toMatch(/export const qidahenMongolHandPreview = \(index: number\): CardPreviewRef => \(\{[\s\S]*?type: 'atlas',[\s\S]*?atlasId: QIDAHEN_MONGOL_ATLAS_ID,[\s\S]*?index,/);
        expect(cardAtlasSource).toMatch(/export const qidahenJinHandPreview = \(index: number\): CardPreviewRef => \(\{[\s\S]*?type: 'atlas',[\s\S]*?atlasId: QIDAHEN_JIN_ATLAS_ID,[\s\S]*?index,/);
    });

    it('Board 会把剧本待决项收口到局内 setup 页，而不是继续塞回建房页或主 HUD', () => {
        expect(boardSource).toContain('qidahen-scenario-vote-screen');
        expect(boardSource).toContain('qidahen-scenario-vote-title');
        expect(boardSource).toContain('qidahen-scenario-vote-confirm');
        expect(boardSource).toContain('qidahen-scenario-vote-clear');
        expect(boardSource).toContain('CAST_SCENARIO_VOTE');
        expect(boardSource).toContain('core.pendingScenarioCharacterChoices');
        expect(boardSource).toContain('core.pendingScenarioArmamentChoices');
        expect(boardSource).toContain('qidahen-inmatch-setup-overlay');
        expect(boardSource).toContain('qidahen-inmatch-setup-title');
        expect(boardSource).toContain('qidahen-inmatch-setup-scenario');
        expect(boardSource).toContain('qidahen-inmatch-setup-character-confirm-');
        expect(boardSource).toContain('qidahen-inmatch-setup-armament-confirm-');
        expect(boardSource).toContain('qidahen-actions-blocked-by-scenario');
        expect(boardSource).toContain('RESOLVE_SCENARIO_CHARACTER_CHOICE');
        expect(boardSource).toContain('RESOLVE_SCENARIO_ARMAMENT_CHOICE');
    });

    it('剧本待决项出现时，动作区只保留阻断提示，真正交互在单独 setup 覆层里完成', () => {
        expect(boardSource).toContain('局内剧本投票尚未完成');
        expect(boardSource).toContain('当前只可处理剧本介绍与投票');
        expect(boardSource).toContain('先选一张剧本介绍卡，再点确认投票');
        expect(boardSource).toContain('剧本待决项尚未确认');
        expect(boardSource).toContain('当前只可处理剧本选择');
        expect(boardSource).toContain('确认人物');
        expect(boardSource).toContain('确认军备');
        expect(boardSource).toContain('等待其他玩家完成其所属阵营的前置项');
    });

    it('正式联机手牌区只允许本地模式保留 currentFaction fallback，在线 seat 不再退回别人的当前手牌', () => {
        expect(boardSource).toContain('const currentFactionId = playerID == null ? (viewerFactionId ?? getCurrentFactionId(core)) : viewerFactionId;');
        expect(boardSource).not.toContain('const currentFactionId = viewerFactionId ?? getCurrentFactionId(core);');
    });

    it('轮盘成为唯一下一步时，会在动作区给出显式横幅和明文按钮，而不是只靠轮盘热区', () => {
        expect(boardSource).toContain('showWheelNextStepBanner');
        expect(boardSource).toContain('去点绿色扇区');
        expect(boardSource).toContain("t('board.actions.wheelNextStepBadge'");
        expect(boardSource).toContain("t('board.actions.wheelNextStepHint'");
        expect(boardSource).toContain("defaultValue: '绿色扇区就是可点入口'");
        expect(boardSource).toContain('点这里');
        expect(boardSource).toContain('onExecuteWheelMove(choice.id)');
    });

    it('一级行动面板会自动锁定当前主流程，并直接暴露二级行动而不是再加一级选择按钮', () => {
        expect(boardSource).toContain('const buildQidahenPrimaryActionEntryText = (');
        expect(boardSource).toContain("return selectedAction ? `本次行动：${selectedAction.label}` : '先选一项行动';");
        expect(boardSource).toContain("return '先从右侧选一项行动';");
        expect(boardSource).toContain("return '先点地图上的绿色目标';");
        expect(boardSource).toContain(": '去点一个绿色扇区';");
        expect(boardSource).toContain("t('board.actions.primaryActionLabel', { defaultValue: '现在做什么' })");
        expect(boardSource).toContain("t('board.actions.primaryStageTagFaction', { defaultValue: '行动' })");
        expect(boardSource).toContain("defaultValue: '{{year}} · 轮盘 {{wheelStatus}} · 弃牌行动 {{factionStatus}}'");
        expect(boardSource).toContain('qidahen-primary-action-next-step');
        expect(boardSource).toContain('qidahen-action-state-${action.id}');
        expect(boardSource).toContain("t('board.actions.state.current', { defaultValue: '当前' })");
        expect(boardSource).toContain("t('board.actions.state.available', { defaultValue: '可选' })");
        expect(boardSource).not.toContain('const PrimaryStageButton: React.FC<');
        expect(boardSource).not.toContain('data-testid="qidahen-primary-stage-choices"');
    });

    it('右侧动作按钮在 hover 或 focus 时必须显示可见功能提示，而不是只依赖原生 title', () => {
        expect(boardSource).toContain('title={action.detail}');
        expect(boardSource).toContain('data-testid={`qidahen-action-tooltip-${action.id}`}');
        expect(boardSource).toContain("role=\"tooltip\"");
        expect(boardSource).toContain('group-hover:block group-focus:block');
        expect(boardSource).toContain('right-[calc(100%+12px)] top-1/2');
        expect(boardSource).toContain("t('board.actions.tooltipHeader', { defaultValue: '功能说明' })");
        expect(boardSource).toContain("t('board.actions.tooltipCost', {");
        expect(boardSource).toContain('{action.label}');
        expect(boardSource).toContain('{action.detail}');
    });

    it('地图必须共享缩放拖动视口，并让高亮路线与顶层点击点一起跟随同一套投影', () => {
        expect(boardSource).toContain('type QidahenMapViewport = {');
        expect(boardSource).toContain('const clampQidahenMapViewport = (viewport: QidahenMapViewport): QidahenMapViewport => {');
        expect(boardSource).toContain('const projectQidahenMapPointToStage = (');
        expect(boardSource).toContain('data-testid="qidahen-map-viewport-controls"');
        expect(boardSource).toContain('data-testid="qidahen-map-content"');
        expect(boardSource).toContain('data-map-zoom={viewport.zoom}');
        expect(boardSource).toContain('data-map-pan-x={viewport.panX}');
        expect(boardSource).toContain('data-map-pan-y={viewport.panY}');
        expect(boardSource).toContain('data-testid="qidahen-map-zoom-in"');
        expect(boardSource).toContain('data-testid="qidahen-map-zoom-out"');
        expect(boardSource).toContain('data-testid="qidahen-map-zoom-reset"');
        expect(boardSource).toContain('onWheel={handleMapWheel}');
        expect(boardSource).toContain('onPointerDown={handlePointerDown}');
        expect(boardSource).toContain('onPointerUp={handlePointerUp}');
        expect(boardSource).toContain('viewport={mapViewport}');
        expect(boardSource).toContain('onViewportChange={setMapViewport}');
        expect(boardSource).toContain("markerMid={activeCandidate ? 'url(#qidahen-map-guide-arrow-active)' : 'url(#qidahen-map-guide-arrow)'}");
        expect(boardSource).toContain("markerEnd={activeCandidate ? 'url(#qidahen-map-guide-arrow-active)' : 'url(#qidahen-map-guide-arrow)'}");
    });

    it('地图文案不得再把 region id 直接漏给用户，可见区域名优先走中文规则名', () => {
        expect(boardSource).toContain("import { getActionRuleDisplayRegionName } from './domain/regionRuleSemantics';");
        expect(boardSource).toContain("import { getQidahenStatefulRegionDisplayName } from './domain/runtimeRegionRules';");
        expect(boardSource).toContain("regionName: targetRegion");
        expect(boardSource).toContain("? getActionRuleDisplayRegionName(targetRegion, targetRegion.name)");
        expect(boardSource).toContain(": getQidahenStatefulRegionDisplayName(regionId)");
        expect(boardSource).not.toContain('regionName: targetRegion?.name ?? regionId');
    });

    it('有弃牌成本的势力行动必须先进入显式选牌确认态，并把确认入口收口到手牌上方的独立交互条', () => {
        expect(boardSource).toContain('actionPaymentPreviewVisible');
        expect(boardSource).toContain('const HAND_INTERACTION_TRAY_WIDTH = 860;');
        expect(boardSource).toContain('const HAND_INTERACTION_TRAY_BOTTOM = BOTTOM_DOCK_HEIGHT + 10;');
        expect(boardSource).toContain('qidahen-hand-interaction-tray');
        expect(boardSource).toContain('data-ui-anchor="bottom-hand"');
        expect(boardSource).toContain('qidahen-action-payment-panel');
        expect(boardSource).toContain('qidahen-action-payment-confirm');
        expect(boardSource).toContain('qidahen-action-payment-cancel');
        expect(boardSource).toContain('点击底部手牌选择要弃掉的牌；再次点击已选手牌可取消该张');
        expect(boardSource).toContain('QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION');
        expect(boardSource).toContain('QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD');
        expect(boardSource).toContain('QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION');
        expect(boardSource).not.toContain('getAutoPaymentCardIds(state, command.payload.actionId)');
    });

    it('右侧交互区必须保留固定动作栏与独立交互槽位，瞬时面板不得再把动作按钮往下挤', () => {
        expect(boardSource).toContain('const ACTIONS_DOCK_WIDTH = 420;');
        expect(boardSource).toContain('const ACTIONS_DOCK_HEIGHT = 470;');
        expect(boardSource).toContain('const ACTIONS_DOCK_LEFT = STAGE_WIDTH - ACTIONS_DOCK_RIGHT - ACTIONS_DOCK_WIDTH;');
        expect(boardSource).toContain('data-testid="qidahen-action-slot"');
        expect(boardSource).toContain('className="mt-3 shrink-0"');
        expect(boardSource).toContain('className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="qidahen-action-slot"');
        expect(boardSource).toContain('left: ACTIONS_DOCK_LEFT,');
        expect(boardSource).toContain('width: ACTIONS_DOCK_WIDTH,');
        expect(boardSource).toContain('height: ACTIONS_DOCK_HEIGHT,');
    });

    it('主交互槽位激活时，被动状态块必须让位，不再跟主交互面板争抢右侧动作槽位', () => {
        expect(boardSource).toContain('const suppressPassiveActionContext = showWheelNextStepBanner');
        expect(boardSource).toContain('|| pendingTargetAction != null');
        expect(boardSource).toContain('|| postBattleSelection != null;');
        expect(boardSource).toContain("const showFortificationStrip = !suppressPassiveActionContext && core.turnPhase !== 'action-window';");
        expect(boardSource).toContain('{showFortificationStrip ? (');
        expect(boardSource).toContain('data-testid="qidahen-fortification-strip"');
        expect(boardSource).toContain('!suppressPassiveActionContext && core.lastSeasonSummary ? (');
        expect(boardSource).toContain('data-testid="qidahen-season-summary"');
    });

    it('地图区域提示必须避开右侧交互槽位，不能再盖到动作区上', () => {
        expect(boardSource).toContain('const MAP_REGION_TIP_WIDTH = 252;');
        expect(boardSource).toContain('const MAP_REGION_TIP_ACTION_GAP = 20;');
        expect(boardSource).toContain('ACTIONS_DOCK_LEFT - MAP_REGION_TIP_WIDTH - MAP_REGION_TIP_ACTION_GAP');
        expect(boardSource).toContain('width: MAP_REGION_TIP_WIDTH,');
    });

    it('主交互进行中时，地图区域 tip 必须收成简版，不再把接边摘要和同图块切换条摊成第二焦点', () => {
        expect(boardSource).toContain('compactRegionTip: boolean;');
        expect(boardSource).toContain('const compactMapRegionTip = setupStagePending');
        expect(boardSource).toContain('|| khanEdictSelection != null');
        expect(boardSource).toContain('|| diplomacySelection != null');
        expect(boardSource).toContain('compactRegionTip={compactMapRegionTip}');
        expect(boardSource).toContain("const displaySelectedRegion = compactRegionTip ? selectedRegion : undefined;");
        expect(boardSource).toContain("const focusedRegion = hoveredRegion ?? displaySelectedRegion;");
        expect(boardSource).toContain('if (compactRegionTip && core.selectedRegionId) {');
        expect(boardSource).toContain('{!compactRegionTip && activePassageSummary ? (');
        expect(boardSource).toContain('{!compactRegionTip && activeMovementPreview ? (');
        expect(boardSource).toContain('{!compactRegionTip && sharedPrintedRuntimeOptions.length > 1 ? (');
    });

    it('手牌区默认贴底紧凑展示，只有牌多时才允许轻度重叠并继续保留横向滚动', () => {
        expect(boardSource).toContain('const HAND_CARD_SELECTED_LIFT = 26;');
        expect(boardSource).toContain('const BOTTOM_DOCK_HEIGHT = CARD_DIMENSIONS.hand.height + HAND_CARD_SELECTED_LIFT + 4;');
        expect(boardSource).toContain('const getQidahenHandCardOverlapPx = (handCount: number): number => {');
        expect(boardSource).toContain('data-testid="qidahen-bottom-dock"');
        expect(boardSource).toContain('style={{ height: BOTTOM_DOCK_HEIGHT }}');
        expect(boardSource).toContain('className="absolute left-1/2 flex items-end justify-center overflow-x-auto overflow-y-visible"');
        expect(boardSource).toContain("height: BOTTOM_DOCK_HEIGHT,");
        expect(boardSource).toContain("maxWidth: 'calc(100vw - 300px)'");
        expect(boardSource).toContain('data-testid="qidahen-hand-row"');
        expect(boardSource).toContain('className="mx-auto flex min-w-max items-end justify-center px-2" data-testid="qidahen-hand-row"');
        expect(boardSource).toContain('hover:-translate-y-[18px]');
        expect(boardSource).toContain('marginLeft: stackIndex === 0 ? 0 : overlapPx');
    });

    it('地图 army token 会拆成可旋转的方块棋子，非部队图片 token 才保留数量徽标', () => {
        expect(boardSource).toContain("const isArmyToken = token.type === 'army';");
        expect(boardSource).toContain("const isPopulationToken = token.type === 'population';");
        expect(boardSource).toContain("rounded-[6px]");
        expect(boardSource).toContain("const tokenShapeClass = isArmyToken ? 'rounded-[6px]' : (token.type === 'control' || isPopulationToken) ? 'rounded-full' : '';");
        expect(boardSource).toContain("const showImageValueBadge = token.type === 'control' && typeof token.value === 'number';");
        expect(boardSource).toContain('className="absolute inset-0 grid place-items-center text-[12px] font-black leading-none"');
        expect(boardSource).toContain("rotate(${token.rotationDeg ?? 0}deg)");
        expect(mapTokenSource).toContain("type: 'population',");
        expect(mapTokenSource).toContain('value: region.population,');
        expect(mapTokenSource).toContain('size: 28,');
        expect(mapTokenSource).not.toContain('populationMarkerImageSrc');
    });

    it('pending-target 按钮 test id 继续由共享选择渲染统一生成', () => {
        expect(boardSource).toContain('const getPendingTargetChoiceTestId = (choiceId: string): string => {');
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action';");
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action-rout';");
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action-cavalry-plunder';");
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action-cavalry-plunder-defender';");
        expect(boardSource).toContain("return `qidahen-resolve-pending-action-${choiceId}`;");
    });

    for (const testId of REQUIRED_TEST_IDS) {
        it(`保留关键结构标识 ${testId}`, () => {
            expect(boardSource).toContain(testId);
        });
    }

    for (const title of FORBIDDEN_LEGACY_TITLES) {
        it(`移除旧占位面板标题：${title}`, () => {
            expect(boardSource).not.toContain(title);
        });
    }

    for (const legacyChain of FORBIDDEN_HALF_FINISHED_CHAINS) {
        it(`禁止半成品运行链路回流：${legacyChain}`, () => {
            expect(boardSource).not.toContain(legacyChain);
        });
    }
});
