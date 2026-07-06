import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_TEST_IDS = [
    'data-testid="qidahen-board"',
    'data-testid="qidahen-desktop-stage"',
    'data-testid="qidahen-map-layer"',
    'data-tutorial-id="qidahen-map-layer"',
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
    'data-tutorial-id="qidahen-action-wheel"',
    'data-testid="qidahen-action-wheel-asset"',
    'data-testid={`qidahen-year-card-slot-${card.id}`}',
    'data-testid="qidahen-chronology-zone"',
    'data-testid="qidahen-korea-zone"',
    '<svg',
    'data-testid="qidahen-wheel-sector"',
    'data-testid="qidahen-wheel-move-layer"',
    'data-testid={`qidahen-wheel-move-target-${choice.id}`}',
    'data-testid="qidahen-wheel-tip"',
    'testId="qidahen-wheel-next-step-banner"',
    "'qidahen-wheel-next-step-title'",
    "'qidahen-wheel-next-step-hint'",
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
    'data-testid="qidahen-post-battle-dice-summary"',
    'data-testid={`qidahen-post-battle-choice-${choice.id}`}',
    'data-testid="qidahen-wheel-dispatch-selection"',
    'data-testid="qidahen-actions-zone"',
    'data-tutorial-id="qidahen-actions-zone"',
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
    'data-tutorial-id="qidahen-turn-banner"',
    'testId="qidahen-top-action-banner"',
    'data-testid="qidahen-actions-blocked-by-scenario"',
    'data-testid="qidahen-bottom-dock"',
    'data-testid="qidahen-draw-anchor"',
    'data-testid="qidahen-hand-zone"',
    'data-tutorial-id="qidahen-hand-zone"',
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
    'data-testid={`qidahen-wheel-move-${choice.id}`}',
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
    'dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId: choiceId })',
    'WheelMoveChoiceButton',
    'QIDAHEN_MAP_REGION_SHAPES =',
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
const typesSource = readFileSync(resolve(__dirname, '..', 'domain', 'types.ts'), 'utf-8');

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
        expect(boardSource).toContain('选择剧本介绍卡后确认投票');
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

    it('轮盘成为唯一下一步时，横幅只做提示，真正交互继续由轮盘本体热区承接', () => {
        expect(boardSource).toContain('showTopWheelPrompt');
        expect(boardSource).toContain("const showTopWheelPrompt = primaryStageMode === 'wheel'");
        expect(boardSource).toContain('tutorialInfoStepActive');
        expect(boardSource).toContain('!tutorialInfoStepActive');
        expect(boardSource).toContain('!actionPaymentPreviewVisible');
        expect(boardSource).toContain('khanEdictSelection == null');
        expect(boardSource).toContain('emphasized={wheelStageAvailable}');
        expect(boardSource).not.toContain("emphasized={!setupStagePending && primaryStageMode === 'wheel'");
        expect(boardSource).toContain('轮盘落点行动');
        expect(boardSource).toContain("t('board.actions.wheelNextStepBadge'");
        expect(boardSource).toContain("t('board.actions.wheelNextStepHint'");
        expect(boardSource).toContain("defaultValue: '选择轮盘格'");
        expect(boardSource).toContain('data-testid={`qidahen-wheel-move-target-${choice.id}`}');
        expect(boardSource).toContain('data-tutorial-id={`qidahen-wheel-move-${choice.id}`}');
        expect(boardSource).toContain('directExecuteOnClick={!isTouchLikeWheelInteraction}');
        expect(boardSource).toContain("const mediaQuery = safeMatchMedia('(hover: none), (pointer: coarse), (any-pointer: coarse)');");
        expect(boardSource).toContain('return subscribeMediaQueryChange(mediaQuery, update);');
        expect(boardSource).toContain('if (directExecuteOnClick) {');
        expect(boardSource).toContain('canActivateMove={(moveId, selected) => {');
        expect(boardSource).toContain('return isTouchLikeWheelInteraction');
        expect(boardSource).toContain('? (selected');
        expect(boardSource).toContain('isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) && isTutorialTargetAllowed(moveId)');
        expect(boardSource).toContain('isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE) && isTutorialTargetAllowed(moveId))');
        expect(boardSource).toContain(': isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) && isTutorialTargetAllowed(moveId);');
        expect(boardSource).not.toContain('qidahen-wheel-next-step-choice-${choice.id}');
        expect(boardSource).not.toContain('onSelectChoice={executeWheelMove}');
        expect(boardSource).not.toContain('发亮的绿色格就是下一步');
        expect(boardSource).not.toContain('点左上发亮的绿色格');
    });

    it('教程高亮锚点会真实挂到棋盘主区域，而不是只留 tutorial manifest', () => {
        expect(boardSource).toContain('data-tutorial-id="qidahen-map-layer"');
        expect(boardSource).toContain('data-tutorial-id="qidahen-action-wheel"');
        expect(boardSource).toContain('data-tutorial-id="qidahen-actions-zone"');
        expect(boardSource).toContain('data-tutorial-id="qidahen-hand-zone"');
        expect(boardSource).toContain('data-tutorial-id="qidahen-turn-banner"');
        expect(boardSource).toContain('data-tutorial-id={getQidahenHandCardTutorialTargetId(card)}');
    });

    it('已识别手牌会把教程和正式动作入口挂到单牌本体，而不是只能退回右侧按钮', () => {
        expect(boardSource).toContain("const getQidahenHandCardTutorialTargetId = (card: QidahenHandCard): string => (");
        expect(boardSource).toContain("card.cardDefId ?? card.id");
        expect(boardSource).toContain("import {");
        expect(boardSource).toContain("getQidahenDirectActionIdForHandCard,");
        expect(boardSource).toContain("getQidahenHandCardBadgeKind,");
        expect(boardSource).toContain("const getQidahenDirectHandActionIdsForFaction = (");
        expect(boardSource).toContain(".map((card) => getQidahenDirectActionIdForHandCard(card))");
        expect(boardSource).toContain("if (directHandActionIds.has(selectedAction.id)) {");
        expect(boardSource).toContain("return '打出手牌';");
        expect(boardSource).toContain("const visibleActionChoices = core.actionChoices.filter((action) => !directHandActionIds.has(action.id));");
        expect(boardSource).toContain('{visibleActionChoices.map((action) => (');
        expect(boardSource).toContain('onPreviewActionFromHandCard: (card: QidahenHandCard) => void;');
        expect(boardSource).toContain('const selectableForDirectHandAction = !actionPaymentPreviewVisible');
        expect(boardSource).toContain('getQidahenDirectActionIdForHandCard(card) != null');
        expect(boardSource).toContain('? () => onPreviewActionFromHandCard(card)');
        expect(boardSource).toContain('const previewActionFromHandCard = React.useCallback((card: QidahenHandCard) => {');
        expect(boardSource).toContain('previewAction(actionId, getQidahenHandCardTutorialTargetId(card), card.id);');
        expect(boardSource).not.toContain("const getQidahenDirectActionIdForHandCard = (card: QidahenHandCard): string | null => {");
    });

    it('Board 会接教程桥、终局遮罩和游戏音频，而不是继续缺少新游戏共用壳层能力', () => {
        expect(boardSource).toContain("import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';");
        expect(boardSource).toContain("import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';");
        expect(boardSource).toContain("import { useEndgame } from '../../hooks/game/useEndgame';");
        expect(boardSource).toContain("import { useGameAudio } from '../../lib/audio/useGameAudio';");
        expect(boardSource).toContain('useTutorialBridge(G.sys.tutorial');
        expect(boardSource).toContain('const { overlayProps: endgameProps } = useEndgame({');
        expect(boardSource).toContain('useGameAudio({');
        expect(boardSource).toContain('<EndgameOverlay {...endgameProps} />');
    });

    it('一级行动入口会收口为顶部横幅与直达动作按钮，不再保留右侧说明式步骤卡', () => {
        expect(boardSource).toContain('const buildQidahenPrimaryActionEntryText = (');
        expect(boardSource).toContain("return selectedAction ? selectedAction.label : '手牌行动';");
        expect(boardSource).toContain("return '选择手牌行动';");
        expect(boardSource).toContain("return '选择行动目标';");
        expect(boardSource).toContain(": '选择轮盘格';");
        expect(boardSource).toContain('showTopFactionPrompt');
        expect(boardSource).toContain("const showTopFactionPrompt = primaryStageMode === 'faction'");
        expect(boardSource).toContain("&& khanEdictSelection == null");
        expect(boardSource).toContain("&& recruitSelection == null");
        expect(boardSource).toContain("&& maShiTradeSelection == null");
        expect(boardSource).toContain("&& diplomacySelection == null");
        expect(boardSource).toContain("&& driveTigerConsentSelection == null");
        expect(boardSource).toContain("&& internalDispatchSelection == null");
        expect(boardSource).toContain("&& wheelDispatchSelection == null");
        expect(boardSource).toContain("&& pendingTargetAction == null");
        expect(boardSource).toContain("&& postBattleSelection == null");
        expect(boardSource).toContain('qidahen-top-action-banner');
        expect(boardSource).toContain('!tutorialInfoStepActive');
        expect(boardSource).toContain('!actionPaymentPreviewVisible');
        expect(boardSource).toContain('const isQidahenGaoDiTargetSelectionActive = (');
        expect(boardSource).toContain('const mapRegionSelectionDecisionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)');
        expect(boardSource).toContain('if (!mapRegionSelectionDecisionActive) {');
        expect(boardSource).toContain("t('board.actions.primaryActionSelectPrompt', { defaultValue: '手牌行动' })");
        expect(boardSource).toContain("t('board.actions.primaryStageTagFaction', { defaultValue: '行动' })");
        expect(boardSource).toContain('hint={selectedPrimaryAction ? primaryActionEntryText : undefined}');
        expect(boardSource).toContain("defaultValue: '{{year}} · 轮盘 {{wheelStatus}} · 手牌行动 {{factionStatus}}'");
        expect(boardSource).toContain("defaultValue: '选择建军方式'");
        expect(boardSource).toContain("defaultValue: '选择建军数量'");
        expect(boardSource).toContain("defaultValue: '选择执行效果'");
        expect(boardSource).toContain('targetRegionName: recruitSelection.displayAnchorRegionName');
        expect(boardSource).toContain('targetRegionName: maShiTradeSelection.displayAnchorRegionName');
        expect(boardSource).toContain('sourceRegionName: khanEdictSelection.displayAnchorRegionName');
        expect(boardSource).toContain('sourceRegionName: diplomacySelection.displayAnchorRegionName');
        expect(boardSource).not.toContain('targetRegionName: recruitSelection.targetRegionName');
        expect(boardSource).not.toContain('targetRegionName: maShiTradeSelection.targetRegionName');
        expect(boardSource).not.toContain('sourceRegionName: khanEdictSelection.sourceRegionName');
        expect(boardSource).not.toContain('sourceRegionName: diplomacySelection.sourceRegionName');
        expect(boardSource).toContain("defaultValue: '处理外交与雇佣'");
        expect(boardSource).toContain("defaultValue: '在地图上点击外交目标；下方地区按钮仅作备用 · {{targetHint}}'");
        expect(boardSource).toContain("defaultValue: '进攻目标'");
        expect(boardSource).toContain("if (wheelDispatchSelection) {");
        expect(boardSource).toContain("action: 'wheel-dispatch' as const");
        expect(boardSource).not.toContain("defaultValue: '先选建军方式；需要时再改目标地区（当前聚焦 {{targetRegionName}}）'");
        expect(boardSource).not.toContain("defaultValue: '先选建军数量；需要时再改目标地区（当前聚焦 {{targetRegionName}}）'");
        expect(boardSource).not.toContain("defaultValue: '先选执行效果；需要时再改来源地区（当前聚焦 {{sourceRegionName}}）'");
        expect(boardSource).not.toContain("defaultValue: '从 {{sourceRegionName}} 出发 · 雇佣落在 {{hireRegionName}}'");
        expect(boardSource).not.toContain("defaultValue: '从 {{sourceRegionName}} 出发 · 可攻 {{count}} 处'");
        expect(boardSource).not.toContain("defaultValue: '选择进攻目标 · 可攻 {{count}} 处'");
        expect(boardSource).not.toContain("defaultValue: '正在查看 {{targetRegionName}} · {{targetHint}}'");
        expect(boardSource).not.toContain("defaultValue: '进攻 {{targetRegionName}} · 守方 {{defenderLabel}}'");
        expect(boardSource).toContain('onClick={() => onExecuteAction(action.id)}');
        expect(boardSource).not.toContain('qidahen-primary-action-next-step');
        expect(boardSource).not.toContain("t('board.actions.primaryActionLabel', { defaultValue: '这一步做什么' })");
        expect(boardSource).not.toContain("return '先从右侧选一项行动';");
        expect(boardSource).not.toContain('点亮起的绿色区域继续');
        expect(boardSource).not.toContain('地图可点');
        expect(boardSource).not.toContain('当前主入口');
        expect(boardSource).not.toContain('所有绿色底部都可点击');
        expect(boardSource).not.toContain("t('board.actions.state.current', { defaultValue: '当前' })");
        expect(boardSource).not.toContain("defaultValue: '可选' })");
        expect(boardSource).not.toContain('先选中下方一级势力行动');
        expect(boardSource).not.toContain('const PrimaryStageButton: React.FC<');
        expect(boardSource).not.toContain('data-testid="qidahen-primary-stage-choices"');
        expect(boardSource).not.toContain('primaryStageHint === primaryStageHeadline ? primaryStageHeadline :');
        expect(boardSource).not.toContain('const visuallySelected = selected && engaged;');
        expect(boardSource).not.toContain("badgeLabel: '已锁定'");
        expect(boardSource).toContain('focused={core.selectedActionId === action.id}');
        expect(boardSource).toContain('const engagedActionId = core.confirmedActionId;');
        expect(boardSource).toContain("hint: gaoDiTargetSelectionActive ? '选择目标' : '弃 1 张手牌'");
        expect(boardSource).toContain("badgeLabel: gaoDiTargetSelectionActive ? '选择目标' : '弃牌'");
        expect(boardSource).toContain("title: '点一个进攻目标'");
        expect(boardSource).toContain('hint: `${wheelDispatchSelection.displayAnchorRegionName} 出发`');
        expect(boardSource).toContain("badgeLabel: '选择地区'");
        expect(boardSource).toContain("? '调度目标'");
        expect(boardSource).not.toContain("? '点一个调度目标'");
        expect(boardSource).not.toContain("title: '点一个调度目标'");
        expect(boardSource).toContain("candidateSummary: gaoDiTargetSelectionActive");
        expect(boardSource).toContain(": '等待弃牌'");
        expect(boardSource).toContain('mapSelectionGuide.candidates.length > 0');
        expect(boardSource).toContain("title: gaoDiTargetSelectionActive");
        expect(boardSource).toContain("candidates: gaoDiTargetSelectionActive ? core.gaoDiDispatchSelection.candidates.map");
        expect(boardSource).not.toContain("action: core.gaoDiDispatchSelection?.selectedCardId ? 'gao-di' as const : 'select-region' as const");
    });

    it('地区目标主路径必须复用正式区域高亮，不得用标牌替代', () => {
        expect(boardSource).toContain('const buildRegularTroopPlacementCandidates = React.useCallback');
        expect(boardSource).toContain('.filter((region) => !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId))');
        expect(boardSource).toContain("action: 'select-region' as const");
        expect(boardSource).toContain("title: '赐印招安'");
        expect(boardSource).toContain("action: 'grant-pardon' as const");
        expect(boardSource).toContain('board.actions.grantPardon.mapFirstHint');
        expect(boardSource).toContain('board.actions.grantPardon.fallbackListLabel');
        expect(boardSource).toContain('主路径：点击地图上的目标地区完成招安；列表只作备用');
        expect(boardSource).toContain("candidate.action === 'grant-pardon'");
        expect(boardSource).toContain('const choice = grantPardonMapChoices.find((item) => item.targetRegionId === regionId);');
        expect(boardSource).toContain('resolveGrantPardonChoice(choice.id);');
        expect(boardSource).toContain('const grantPardonHasMapTargets = Boolean(grantPardonSelection?.choices.length);');
        expect(boardSource).toContain('grantPardonHasMapTargets ? null : (');
        expect(boardSource).toContain('grantPardonSelection?.choices.filter((choice) => isTutorialTargetAllowed(choice.id)) ?? []');
        expect(boardSource).toContain('for (const choice of grantPardonMapChoices)');
        expect(boardSource).toContain("if (tutorialStepId !== 'choose-grant-pardon-target') {");
        expect(boardSource).toContain("applyTone(choice.sourceRegionId, 'source');");
        expect(boardSource).toContain("applyTone(choice.targetRegionId, 'dispatch');");
        expect(boardSource).toContain('const mapSelectionGuideUsesRegionHighlight = grantPardonSelection != null');
        expect(boardSource).toContain("|| tutorialStepId === 'choose-grant-pardon-target';");
        expect(boardSource).toContain('const mapSelectionGuideDrawsRoute = mapSelectionGuide != null && !mapSelectionGuideUsesRegionHighlight;');
        expect(boardSource).toContain('{mapSelectionGuideDrawsRoute ? (');
        expect(boardSource).toContain("topLevelMapSelectionGuide && tutorialStep?.id === 'choose-grant-pardon-target'");
        expect(boardSource).toContain('data-tutorial-id={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}');
        expect(boardSource).toContain("topLevelMapSelectionGuide && tutorialStep?.id !== 'choose-grant-pardon-target'");
        expect(boardSource).toContain('const buildQidahenFocusedMapViewport = (');
        expect(boardSource).toContain('const autoFocusMapCandidate = topLevelMapSelectionGuide?.candidates.length === 1');
        expect(boardSource).not.toContain("const isGrantPardonTarget = candidate.action === 'grant-pardon';");
        expect(boardSource).not.toContain('data-testid={`qidahen-map-guide-target-label-${candidate.targetRegionId}`}');
        expect(boardSource).toContain('sr-only');
        expect(boardSource).not.toContain('0 0 0 5px rgba(255,236,190,0.92)');
        expect(boardSource).not.toContain("boxShadow: '0 0 0 3px rgba(255,236,190,0.68)'");
        expect(boardSource).toContain("title: '征召地区'");
        expect(boardSource).toContain('candidates: buildRegularTroopPlacementCandidates(recruitFactionId)');
        expect(boardSource).toContain("title: '马市建军地区'");
        expect(boardSource).toContain("candidates: buildRegularTroopPlacementCandidates('ming')");
        expect(boardSource).toContain("title: '大汗令箭地区'");
        expect(boardSource).toContain('candidates: buildRegularTroopPlacementCandidates(khanFactionId)');
        expect(boardSource).toContain("title: '外交目标'");
        expect(boardSource).toContain('data-testid={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}');
        expect(boardSource).toContain('data-action={candidate.action}');
        expect(boardSource).toContain('onClick={() => activateTopLevelGuideTarget(candidate)}');
        expect(boardSource).not.toContain('data-testid={`qidahen-wheel-dispatch-target-${candidate.targetRuntimeRegionId}`}');
        expect(boardSource).toContain('selectRegion(candidate.targetRegionId);');
        expect(boardSource).toContain('<div className="sr-only">');
        expect(boardSource).toContain('data-testid={`qidahen-diplomacy-target-${regionId}`}');
        expect(boardSource).toContain('data-testid={`qidahen-recruit-choice-${choice.id}`}');
        expect(boardSource).toContain('data-testid={`qidahen-ma-shi-trade-choice-${choice.troopCount}`}');
        expect(boardSource).toContain('data-testid={`qidahen-khan-edict-choice-${choice.id}`}');
        expect(boardSource).toContain('data-testid={`qidahen-diplomacy-choice-${choice.id}`}');
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

    it('战后处理必须展示本次掷骰本体，而不是只剩文字摘要', () => {
        expect(boardSource).toContain('const formatQidahenBattleRollPhaseLabel = (phase: QidahenBattleRollPhase): string => {');
        expect(boardSource).toContain('const formatQidahenBattleRollFace = (roll: QidahenBattleRoll): string => (');
        expect(boardSource).toContain('const QidahenBattleRollDiceSummary: React.FC<');
        expect(boardSource).toContain('data-testid="qidahen-post-battle-dice-summary"');
        expect(boardSource).toContain('{postBattleSelection.battleRolls ? (');
        expect(boardSource).toContain('<QidahenBattleRollDiceSummary battleRolls={postBattleSelection.battleRolls} />');
        expect(boardSource).toContain("defaultValue: '{{summary}} · 幸存 {{survivingTroops}}'");
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
        expect(boardSource).toContain('const buildQidahenGuideDisplayPoints = (');
        expect(boardSource).toContain('const buildQidahenGuideArrowHeadPath = (');
        expect(boardSource).toContain('data-guide-target-x={targetPoint.x}');
        expect(boardSource).toContain('data-guide-target-y={targetPoint.y}');
        expect(boardSource).toContain('data-testid={`qidahen-map-guide-arrow-head-${candidate.targetRegionId}`}');
        expect(boardSource).not.toContain('markerMid={');
        expect(boardSource).not.toContain('markerEnd={');
        expect(boardSource).not.toContain('<marker id="qidahen-map-guide-arrow"');
        expect(boardSource).toContain('inferPendingTargetPathRegionIds(pendingTargetAction)');
        expect(boardSource).not.toContain("t('board.map.selectionGuideSource'");
        expect(boardSource).not.toContain('{index + 1}');
    });

    it('待结算投入兵力必须由地图部队本体承接，默认全选并允许点击切换数量', () => {
        expect(typesSource).toContain('regionId?: string;');
        expect(typesSource).toContain('troopIndex?: number;');
        expect(mapTokenSource).toContain('regionId: region.id,');
        expect(mapTokenSource).toContain('troopIndex: index + 1,');
        expect(boardSource).toContain('data-pending-committed-selectable={pendingCommittedSelectable ?');
        expect(boardSource).toContain('data-pending-committed-selected={pendingCommittedSelectable ? String(pendingCommittedSelected) : undefined}');
        expect(boardSource).toContain('onSelectPendingCommittedTroops?.(token.troopIndex!)');
        expect(boardSource).toContain('token.regionId === pendingTargetAction.sourceRegionId');
        expect(boardSource).toContain('pendingCommittedSelected={pendingCommittedSelectable && (token.troopIndex ?? 0) <= pendingCommittedSelectedCount}');
        expect(boardSource).toContain("defaultValue: '实际出兵：点击地图上的源地区兵牌切换数量'");
        expect(boardSource).toContain('<span className="sr-only">');
        expect(boardSource).toContain('data-testid={`qidahen-pending-committed-${committedTroops}`}');
        expect(boardSource).not.toContain('className="inline-flex h-[28px] min-w-[34px] items-center justify-center border-[2px] px-2 text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"');
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
        expect(boardSource).toContain('!suppressPassiveActionContext');
        expect(boardSource).toContain('(!tutorialInfoStepActive || tutorialHighlightsSeasonSummary)');
        expect(boardSource).toContain('core.lastSeasonSummary ? (');
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
        expect(boardSource).toContain('if (compactRegionTip && core.explicitRegionId) {');
        expect(boardSource).toContain('const selectedRegion = core.explicitRegionId');
        expect(boardSource).toContain('data-map-selected={core.explicitRegionId ?? \'\'}');
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
        expect(boardSource).toContain("maxWidth: 'calc(100vw - 320px)'");
        expect(boardSource).toContain('data-testid="qidahen-hand-row"');
        expect(boardSource).toContain('className="mx-auto flex min-w-max items-end justify-center px-2" data-testid="qidahen-hand-row"');
        expect(boardSource).toContain('data-testid={`qidahen-hand-card-magnify-${card.id}`}');
        expect(boardSource).toContain('onMagnifyCard?.({');
        expect(boardSource).toContain('hover:-translate-y-[18px]');
        expect(boardSource).toContain('marginLeft: stackIndex === 0 ? 0 : overlapPx');
    });

    it('纪年卡与手牌都要接入局内放大查看，而不是只能靠缩略图硬读', () => {
        expect(boardSource).toContain("overlayTestId=\"qidahen-card-magnify-overlay\"");
        expect(boardSource).toContain('<QidahenCardMagnifyOverlay target={magnifyTarget} locale={locale} onClose={() => setMagnifyTarget(null)} />');
        expect(boardSource).toContain('onMagnify={setMagnifyTarget}');
        expect(boardSource).toContain('closeLabel="关闭查看"');
    });

    it('手牌放大按钮应在 HandZone 内获取翻译函数，避免运行时报 t 未定义', () => {
        const handZoneStart = boardSource.indexOf('const HandZone: React.FC<{');
        const handZoneEnd = boardSource.indexOf('const QidahenInMatchSetupOverlay', handZoneStart);
        const handZoneSource = boardSource.slice(handZoneStart, handZoneEnd);

        expect(handZoneStart).toBeGreaterThanOrEqual(0);
        expect(handZoneEnd).toBeGreaterThan(handZoneStart);
        expect(handZoneSource).toContain("const { t } = useTranslation('game-qidahen');");
        expect(handZoneSource).toContain("t('board.magnifyCardAria'");
        expect(handZoneSource).toContain("t('board.magnifyButton'");
    });

    it('正式手牌 badge 会复用领域层最小身份，而不是只硬编码事件/军备/战术/银两', () => {
        expect(boardSource).toContain('const cardKindBadgeKind = getQidahenHandCardBadgeKind(card);');
        expect(boardSource).toContain("character: '人物'");
        expect(boardSource).toContain("scenario: '剧本'");
        expect(boardSource).toContain("chronology: '纪年'");
        expect(boardSource).toContain("'card-back': '牌背'");
        expect(boardSource).not.toContain("}[card.cardKind]");
    });

    it('棋盘壳层与地图区域遮罩要保留正式底色和常驻势力浅色归属，不再露白底', () => {
        expect(boardSource).toContain("const QIDAHEN_STAGE_BG = '#c8a970';");
        expect(boardSource).toContain('background: QIDAHEN_STAGE_BG,');
        expect(boardSource).toContain('applyTone(region.id, region.controller);');
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

    it('地图部队必须按暗棋规则隐藏对手正面贴纸，只有己方或战斗公开区域可见正面', () => {
        expect(boardSource).toContain('const shouldRevealQidahenMapArmyToken = (');
        expect(boardSource).toContain("if (viewerFactionId != null && token.faction === viewerFactionId) {");
        expect(boardSource).toContain('return token.regionId != null && revealedBattleRegionIds.has(token.regionId);');
        expect(boardSource).toContain('const buildRevealedBattleRegionIds = (');
        expect(boardSource).toContain('pendingTargetAction?.targetRuntimeRegionId,');
        expect(boardSource).toContain('postBattleSelection?.targetRuntimeRegionId,');
        expect(boardSource).toContain('const showTokenImage = Boolean(token.imageSrc) && (!isArmyToken || revealFront);');
        expect(boardSource).toContain('data-qidahen-army-face="hidden-back"');
        expect(boardSource).toContain('aria-label="部队背面"');
        expect(boardSource).toContain("armyBackMarker: 'qidahen/markers/blank-rectangular-marker'");
        expect(boardSource).toContain('src={ASSETS.armyBackMarker}');
        expect(boardSource).toContain('revealFront={shouldRevealQidahenMapArmyToken(token, currentFactionId, revealedBattleRegionIds)}');
        expect(boardSource).not.toContain('HIDDEN_ARMY_BACK_BY_FACTION');
        expect(boardSource).not.toContain("src={ASSETS.mingCard}");
        expect(boardSource).not.toContain("src={ASSETS.mongolCard}");
        expect(boardSource).not.toContain("src={ASSETS.jinCard}");
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
