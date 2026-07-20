import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_TEST_IDS = [
    'data-testid="qidahen-board"',
    'data-testid="qidahen-desktop-stage"',
    'containerTestId="qidahen-map-layer"',
    "'data-tutorial-id': 'qidahen-map-layer'",
    'width: STAGE_WIDTH,',
    'height: STAGE_HEIGHT,',
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
    'data-testid="qidahen-tactic-card-selection-panel"',
    'data-testid="qidahen-confirm-tactic-card"',
    'data-tutorial-id="qidahen-confirm-tactic-card"',
    'data-testid="qidahen-cancel-tactic-card"',
    'data-testid="qidahen-hand-row"',
    'onExecuteAction',
    'data-testid={`qidahen-hand-card-${card.id}`}',
    'data-testid="qidahen-discard-anchor"',
    'data-testid={getPendingTargetChoiceTestId(choice.id)}',
    'data-tutorial-id={getPendingTargetChoiceTestId(choice.id)}',
    'data-testid="qidahen-pending-casualty-priority"',
    'data-testid={`qidahen-${group.id}-casualty-priority`}',
    'data-testid={`qidahen-${group.id}-casualty-${option.id}`}',
    'data-tutorial-id={`qidahen-${group.id}-casualty-${option.id}`}',
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
const boardShellSource = readFileSync(resolve(__dirname, '..', 'QidahenBoardShell.tsx'), 'utf-8');
const combinedBoardSource = `${boardSource}\n${boardShellSource}`;
const cardAtlasSource = readFileSync(resolve(__dirname, '..', 'ui', 'cardAtlas.ts'), 'utf-8');
const mapTokenSource = readFileSync(resolve(__dirname, '..', 'domain', 'mapTokens.ts'), 'utf-8');
const typesSource = readFileSync(resolve(__dirname, '..', 'domain', 'types.ts'), 'utf-8');

const getRegisteredAtlasBlock = (atlasId: string): string => {
    const start = cardAtlasSource.indexOf(`registerCardAtlasSource(${atlasId},`);
    expect(start).toBeGreaterThanOrEqual(0);
    const nextStart = cardAtlasSource.indexOf('registerCardAtlasSource(', start + 1);
    return nextStart === -1 ? cardAtlasSource.slice(start) : cardAtlasSource.slice(start, nextStart);
};

describe('Qidahen Board 结构门禁', () => {
    it('纪年卡预览应从蒙古图集中的纪年卡格子取图，禁止回到普通手牌图集', () => {
        const chronologyAtlasBlock = getRegisteredAtlasBlock('QIDAHEN_CHRONOLOGY_ATLAS_ID');

        expect(chronologyAtlasBlock).toContain("image: 'qidahen/cards/atlases/mongol-faction-deck-atlas'");
        expect(chronologyAtlasBlock).toContain('[1434, 1912, 2390, 2868, 3346, 3824, 4302]');
        expect(chronologyAtlasBlock).toContain('[663, 1326, 1989, 2652, 3315, 3978]');
        expect(chronologyAtlasBlock).toContain('478,');
        expect(chronologyAtlasBlock).toContain('663,');
        expect(chronologyAtlasBlock).not.toContain("image: 'qidahen/cards/atlases/chronology-deck-atlas'");
        expect(chronologyAtlasBlock).not.toContain("image: 'qidahen/cards/atlases/ordinary-hand-atlas05'");
    });

    it('三势力手牌预览继续绑定各自牌库图集，而不是退回牌背', () => {
        expect(cardAtlasSource).toMatch(/export const qidahenMingHandPreview = \(index: number\): CardPreviewRef => \(\{[\s\S]*?type: 'atlas',[\s\S]*?atlasId: QIDAHEN_MING_ATLAS_ID,[\s\S]*?index,/);
        expect(cardAtlasSource).toMatch(/export const qidahenMongolHandPreview = \(index: number\): CardPreviewRef => \(\{[\s\S]*?type: 'atlas',[\s\S]*?atlasId: QIDAHEN_MONGOL_ATLAS_ID,[\s\S]*?index,/);
        expect(cardAtlasSource).toMatch(/export const qidahenJinHandPreview = \(index: number\): CardPreviewRef => \(\{[\s\S]*?type: 'atlas',[\s\S]*?atlasId: QIDAHEN_JIN_ATLAS_ID,[\s\S]*?index,/);
    });

    it('Board 会把剧本待决项收口到局内 setup 页，而不是继续塞回建房页或主 HUD', () => {
        expect(boardSource).toContain('qidahen-scenario-vote-screen');
        expect(boardSource).toContain('qidahen-scenario-vote-title');
        expect(boardSource).toContain('qidahen-scenario-host-selected');
        expect(boardSource).toContain('data-qidahen-inline-choice="character"');
        expect(boardSource).toContain('data-qidahen-inline-choice="armament"');
        expect(boardSource).toContain('data-ui-family="qidahen-book-setup"');
        expect(boardSource).toContain('UI_SURFACE.bookPaper');
        expect(boardSource).toContain('UI_SURFACE.bookPage');
        expect(boardSource).toContain('qidahen-scenario-vote-book-page-intro');
        expect(boardSource).toContain('qidahen-scenario-vote-card-rail');
        expect(boardSource).toContain('qidahen-scenario-vote-feature-card');
        expect(boardSource).toContain('data-ui-page="qidahen-scenario-vote-book-page-focus"');
        expect(boardSource).toContain('data-ui-page="qidahen-scenario-vote-book-page-status"');
        expect(boardSource).toContain('CAST_SCENARIO_VOTE');
        expect(boardSource).toContain('core.pendingScenarioCharacterChoices');
        expect(boardSource).toContain('core.pendingScenarioArmamentChoices');
        expect(boardSource).toContain('qidahen-inmatch-setup-overlay');
        expect(boardSource).toContain('z-[140] flex items-center justify-center');
        expect(boardSource).toContain('qidahen-inmatch-setup-title');
        expect(boardSource).toContain('qidahen-inmatch-setup-scenario');
        expect(boardSource).toContain('qidahen-inmatch-setup-book-page-player');
        expect(boardSource).toContain('qidahen-inmatch-setup-book-page-status');
        expect(boardSource).toContain('applyInlineChoice');
        expect(boardSource).toContain('qidahen-scenario-vote-confirm');
        expect(boardSource).toContain('qidahen-faction-selection-confirm');
        expect(boardSource).toContain('qidahen-inmatch-setup-character-confirm-${group.id}');
        expect(boardSource).toContain('qidahen-inmatch-setup-armament-confirm-${group.id}');
        expect(boardSource).toContain('disabled={completed || selectedIds.length !== group.count}');
        expect(boardSource).toContain("t('board.setup.characterButtonConfirmed', { defaultValue: '人物已确认' })");
        expect(boardSource).toContain("t('board.setup.confirmCharacter', { defaultValue: '确认人物' })");
        expect(boardSource).toContain("t('board.setup.armamentButtonConfirmed', { defaultValue: '军备已确认' })");
        expect(boardSource).toContain("t('board.setup.confirmArmament', { defaultValue: '确认军备' })");
        expect(boardSource).toContain('getQidahenScenarioCardPreview(option.scenarioId)');
        expect(boardSource).toContain('getQidahenSetupCharacterPreview(group.factionId, characterId)');
        expect(boardSource).toContain('getQidahenSetupArmamentPreview(armamentId)');
        expect(boardSource).toContain('<SelectableGameObject');
        expect(boardSource).toContain('qidahen-actions-blocked-by-scenario');
        expect(boardSource).toContain('RESOLVE_SCENARIO_CHARACTER_CHOICE');
        expect(boardSource).toContain('RESOLVE_SCENARIO_ARMAMENT_CHOICE');
    });

    it('剧本待决项出现时，动作区只保留阻断提示，真正交互在单独 setup 覆层里完成', () => {
        expect(boardSource).toContain('局内剧本选择尚未完成');
        expect(boardSource).toContain('当前只可处理剧本介绍与房主选择');
        expect(boardSource).toContain('选择一张剧本卡');
        expect(boardSource).toContain('剧本待决项尚未确认');
        expect(boardSource).toContain('当前只可处理剧本选择');
        expect(boardSource).toContain('等待其他玩家完成其所属阵营的前置项');
    });

    it('手牌选中态必须绑定完整卡牌外层，禁止回到左右色块叠层', () => {
        const handCardSource = boardSource.slice(
            boardSource.indexOf('const HandCard: React.FC<'),
            boardSource.indexOf('const HandZone: React.FC<'),
        );

        expect(boardSource).toContain('rounded-[9px]');
        expect(boardSource).toContain('data-qidahen-hand-card-selected');
        expect(boardSource).toContain('selected={selected}');
        expect(boardSource).toContain('available={Boolean(onClick)}');
        expect(boardSource).not.toContain('before:inset-[-7px]');
        expect(handCardSource).not.toContain("boxShadow: 'none'");
        expect(boardSource).not.toContain('qidahen-hand-selection-frame-layer');
        expect(boardSource).not.toContain('qidahen-hand-selection-frame-layer absolute inset-y-0');
    });

    it('正式联机手牌区只允许本地模式保留 currentFaction fallback，在线 seat 不再退回别人的当前手牌', () => {
        expect(boardSource).toContain('const currentFactionId = handLimitDiscardSelection?.factionId');
        expect(boardSource).toContain('?? (playerID == null ? (viewerFactionId ?? getCurrentFactionId(core)) : viewerFactionId);');
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
        expect(boardSource).toContain('directExecuteOnClick');
        expect(boardSource).not.toContain("const mediaQuery = safeMatchMedia('(hover: none), (pointer: coarse), (any-pointer: coarse)');");
        expect(boardSource).not.toContain('return subscribeMediaQueryChange(mediaQuery, update);');
        expect(boardSource).toContain('if (directExecuteOnClick) {');
        expect(boardSource).toContain('canActivateMove={(moveId) => (');
        expect(boardSource).toContain('isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) && isTutorialTargetAllowed(moveId)');
        expect(boardSource).not.toContain('return isTouchLikeWheelInteraction');
        expect(boardSource).not.toContain('isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE) && isTutorialTargetAllowed(moveId))');
        expect(boardSource).not.toContain('qidahen-wheel-next-step-choice-${choice.id}');
        expect(boardSource).not.toContain('onSelectChoice={executeWheelMove}');
        expect(boardSource).not.toContain('发亮的绿色格就是下一步');
        expect(boardSource).not.toContain('点左上发亮的绿色格');
    });

    it('轮盘必须显示共享行动标记，并且只高亮当前阶段真正可点击的落点', () => {
        expect(boardSource).toContain("wheelMarker: 'qidahen/markers/chronology-year-marker'");
        expect(boardSource).toContain('const renderQidahenWheelVerticalText = (');
        expect(boardSource).toContain('<tspan key={`${text}-${index}-${char}`}');
        expect(boardSource).not.toContain('writingMode:');
        expect(boardSource).not.toContain('textOrientation:');
        expect(boardSource).toContain('const activatableMoveChoices = moveChoices.filter');
        expect(boardSource).toContain('activatableMoveChoices.map((choice) => (selectedIndex + choice.steps) % WHEEL_SECTORS.length)');
        expect(boardSource).toContain('className="pointer-events-none group absolute left-[136px] top-[-16px] z-30 h-[438px] w-[438px]"');
        expect(boardSource).toContain('className={`pointer-events-auto outline-none transition-[fill,stroke]');
        expect(boardSource).toContain('data-testid="qidahen-wheel-current-marker"');
        expect(boardSource).toContain('data-wheel-current-position={selectedId}');
        expect(boardSource).toContain('const currentMarkerPoint = polarToPoint(WHEEL_CENTER, WHEEL_OUTER_RADIUS - 18, selectedAngle);');
        expect(boardSource).toContain('h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full');
        expect(boardSource).toContain('className="h-full w-full scale-[1.08] object-cover"');
    });

    it('教程高亮锚点会真实挂到棋盘主区域，而不是只留 tutorial manifest', () => {
        expect(boardSource).toContain("'data-tutorial-id': 'qidahen-map-layer'");
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

    it('战术牌手牌可点击性会复用命令资格合同，并同时支持合法攻方与守方入口', () => {
        expect(boardSource).toContain('isQidahenTacticCardPlayableForPendingBattle,');
        expect(boardSource).toContain("import { isQidahenFeignedRetreatCardPlayable } from './domain/feignedRetreatSelection';");
        expect(boardSource).toContain("pendingTargetAction: QidahenCore['pendingTargetAction'];");
        expect(boardSource).toContain('pendingTargetAction={pendingTargetAction}');
        expect(boardSource).toContain('const [selectedTacticCardId, setSelectedTacticCardId] = React.useState<string | null>(null);');
        expect(boardSource).toContain('const selectedTacticCard = currentHandCards.find((card) => card.id === selectedTacticCardId) ?? null;');
        expect(boardSource).toContain('|| selectedTacticCardId === card.id');
        expect(boardSource).toContain('data-testid="qidahen-tactic-card-selection-panel"');
        expect(boardSource).toContain('data-testid="qidahen-confirm-tactic-card"');
        expect(boardSource).toContain('data-tutorial-id="qidahen-confirm-tactic-card"');
        expect(boardSource).toContain('onClick={() => onPlayTacticCard(selectedTacticCard.id)}');
        expect(boardSource).toContain('data-testid="qidahen-cancel-tactic-card"');
        expect(boardSource).toContain('onClick={() => setSelectedTacticCardId(null)}');
        expect(boardSource).toContain('const card = core.handCards.find((candidate) => candidate.id === cardId);');
        expect(boardSource).toContain('const tutorialTargetId = card ? getQidahenHandCardTutorialTargetId(card) : cardId;');
        expect(boardSource).toContain('|| (!isTutorialTargetAllowed(cardId) && !isTutorialTargetAllowed(tutorialTargetId))');
        expect(boardSource).toContain("pendingTargetAction?.attackerFactionId === card.faction");
        expect(boardSource).toContain("pendingTargetAction?.defenderFactionId === card.faction");
        expect(boardSource).toContain("? 'attacker'");
        expect(boardSource).toContain("? 'defender'");
        expect(boardSource).toContain('isQidahenFeignedRetreatCardPlayable(core, card)');
        expect(boardSource).toContain('|| isQidahenTacticCardPlayableForPendingBattle(');
        expect(boardSource).toContain('? () => setSelectedTacticCardId((current) => (current === card.id ? null : card.id))');
        expect(boardSource).not.toContain('? () => onPlayTacticCard(card.id)');
        expect(boardSource).not.toContain('const pendingTargetAction = core.pendingTargetAction;');
        expect(boardSource).not.toContain('&& core.pendingTargetAction.attackerFactionId === card.faction');
    });

    it('各个击破复用防守方手牌直点与地图区域直选，不新增按钮列表或替代高亮', () => {
        expect(boardSource).toContain('getQidahenDefeatInDetailSelectableSourceRegionIds,');
        expect(boardSource).toContain('isQidahenDefeatInDetailOrderSelectionActive,');
        expect(boardSource).toContain('isQidahenDefeatInDetailPlayable,');
        expect(boardSource).toContain('onPlayBattleResponseEventCard: (cardId: string) => void;');
        expect(boardSource).toContain('const selectableForBattleResponseEvent = !actionPaymentPreviewVisible');
        expect(boardSource).toContain('&& isQidahenDefeatInDetailPlayable(core, card, pendingTargetAction);');
        expect(boardSource).toContain('? () => onPlayBattleResponseEventCard(card.id)');
        expect(boardSource).toContain('dispatch(QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD, { cardId });');
        expect(boardSource).toContain('const defeatInDetailOrderSelectionActive = isQidahenDefeatInDetailOrderSelectionActive(');
        expect(boardSource).toContain('|| defeatInDetailOrderSelectionActive');
        expect(boardSource).toContain('|| (pendingTargetAction != null && !defeatInDetailOrderSelectionActive)');
        expect(boardSource).toContain("title: '决定战斗顺序'");
        expect(boardSource).toContain("action: 'select-region' as const");
        expect(boardSource).toContain("applyTone(sourceRegionId, 'dispatch');");
        expect(boardSource).toContain('|| defeatInDetailSelectableSourceRegionIds.length > 0');
        expect(boardSource).toContain("hint: '选择先结算的进攻方向'");
        expect(boardSource).not.toContain('qidahen-defeat-in-detail-choice-button');
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
        expect(boardSource).toContain("const actionPaymentMapRegionSelectionActive = actionPaymentPreviewVisible");
        expect(boardSource).toContain("&& core.confirmedActionId === 'raid';");
        expect(boardSource).toContain('const gaoDiMapRegionSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);');
        expect(boardSource).toContain('const directMapRegionSelectionActive = actionPaymentMapRegionSelectionActive || gaoDiMapRegionSelectionActive;');
        expect(boardSource).toContain('const mapRegionSelectionDecisionActive = gaoDiMapRegionSelectionActive');
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
        expect(boardSource).toContain("title: '选择参与部队'");
        expect(boardSource).toContain("hint: '先点源地区兵牌确认本次出兵'");
        expect(boardSource).toContain("badgeLabel: '选择部队'");
        expect(boardSource).toContain('if (wheelDispatchSelection && (pendingCommittedTroops == null || pendingCommittedTroops <= 0))');
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
        expect(boardSource).not.toContain('const wheelDispatchCandidateRegionIds = new Set(');
        expect(boardSource).not.toContain("candidate.targetRuntimeRegionId === wheelDispatchActiveTargetRegionId ? 'activeDispatch' : 'dispatch'");
        expect(boardSource).not.toContain("applyTone(\\n                    candidate.targetRuntimeRegionId,");
        expect(boardSource).toContain('const mapSelectionGuideUsesRegionHighlight = grantPardonSelection != null');
        expect(boardSource).toContain("|| tutorialStepId === 'choose-grant-pardon-target';");
        expect(boardSource).toContain('const mapSelectionGuideDrawsRoute = mapSelectionGuide != null && !mapSelectionGuideUsesRegionHighlight;');
        expect(boardSource).toContain('{mapSelectionGuideDrawsRoute ? (');
        expect(boardSource).toContain("topLevelMapSelectionGuide && tutorialStep?.id === 'choose-grant-pardon-target'");
        expect(boardSource).toContain('data-tutorial-id={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}');
        expect(boardSource).toContain("topLevelMapSelectionGuide && tutorialStep?.id !== 'choose-grant-pardon-target'");
        expect(boardSource).toContain('const buildQidahenFocusedMapViewport = (');
        expect(boardSource).toContain('const buildQidahenFocusedMapViewportForPoints = (');
        expect(boardSource).toContain('const autoFocusMapTargetRegionIdsKey = topLevelMapSelectionGuide?.candidates');
        expect(boardSource).toContain('const autoFocusMapTargetRegionIds = autoFocusMapTargetRegionIdsKey');
        expect(boardSource).toContain('const activeTargetPoint = getTopLevelGuideRegionMapPoint(activeTargetRegionId);');
        expect(boardSource).toContain('const focusRegionIds = [');
        expect(boardSource).toContain('? buildQidahenFocusedMapViewport(activeTargetPoint, 1.82)');
        expect(boardSource).toContain(': buildQidahenFocusedMapViewportForPoints(points);');
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
        expect(boardSource).toContain('getQidahenRecruitSelectionForCore as getCoreQidahenRecruitSelectionForCore');
        expect(boardSource).toContain('getQidahenMaShiTradeSelectionForCore as getCoreQidahenMaShiTradeSelectionForCore');
        expect(boardSource).toContain('const recruitSelectionFromCore = getCoreQidahenRecruitSelectionForCore(core);');
        expect(boardSource).toContain('const recruitSelection = core.explicitRegionId && recruitSelectionFromCore');
        expect(boardSource).toContain('const maShiTradeSelectionFromCore = getCoreQidahenMaShiTradeSelectionForCore(core);');
        expect(boardSource).toContain('const maShiTradeSelection = core.explicitRegionId && maShiTradeSelectionFromCore');
        expect(boardSource).toContain('const recruitRegionExplicitlySelected = recruitSelection != null');
        expect(boardSource).toContain('&& explicitSelectedRuntimeRegionId === recruitSelection.targetRegionId');
        expect(boardSource).toContain('const maShiTradeRegionExplicitlySelected = maShiTradeSelection != null');
        expect(boardSource).toContain('&& explicitSelectedRuntimeRegionId === maShiTradeSelection.targetRegionId');
        expect(boardSource).toContain('mergedValue: { qidahenRecruitSelection: recruitSelection }');
        expect(boardSource).toContain('mergedValue: { qidahenGrantPardonSelection: grantPardonSelection }');
        expect(boardSource).toContain('mergedValue: { qidahenInternalDispatchSelection: internalDispatchSelection }');
        expect(boardSource).toContain('mergedValue: { qidahenKhanEdictSelection: khanEdictSelection }');
        expect(boardSource).toContain('mergedValue: { qidahenDiplomacySelection: diplomacySelection }');
        expect(boardSource).toContain('mergedValue: { qidahenMaShiTradeSelection: maShiTradeSelection }');
        expect(boardSource).toContain('mergedValue: { qidahenDriveTigerConsentSelection: driveTigerConsentSelection }');
        expect(boardSource).toContain('qidahenWheelDispatchSelection: wheelDispatchSelection');
        expect(boardSource).toContain("...(pendingCommittedTroops != null ? { committedTroops: pendingCommittedTroops } : {})");
        expect(boardSource).toContain('data-testid="qidahen-recruit-map-first-hint"');
        expect(boardSource).toContain('data-testid="qidahen-ma-shi-trade-map-first-hint"');
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

    it('朝鲜牌库在桌面端使用右侧小型 rail，禁止回到右上角大卡悬浮', () => {
        const koreaZoneStart = boardSource.indexOf('const KoreaZone: React.FC<{');
        const koreaZoneEnd = boardSource.indexOf('const TopPromptBanner: React.FC<{', koreaZoneStart);
        const koreaZoneSource = boardSource.slice(koreaZoneStart, koreaZoneEnd);

        expect(koreaZoneStart).toBeGreaterThanOrEqual(0);
        expect(koreaZoneEnd).toBeGreaterThan(koreaZoneStart);
        expect(boardSource).toContain('const KoreaRailItem: React.FC<{');
        expect(boardSource).toContain('data-qidahen-korea-rail-item');
        expect(koreaZoneSource).toContain('data-ui-anchor="right-deck-slot"');
        expect(koreaZoneSource).toContain('data-qidahen-korea-zone-layout="desktop-rail"');
        expect(koreaZoneSource).toContain('<KoreaRailItem');
        expect(koreaZoneSource).toContain('testId="qidahen-korea-draw-pile"');
        expect(koreaZoneSource).toContain('testId="qidahen-korea-discard-pile"');
        expect(koreaZoneSource).not.toContain('<DeckStack');
        expect(koreaZoneSource).not.toContain('CARD_DIMENSIONS.koreaDeck');
        expect(koreaZoneSource).not.toContain('right-[80px] top-[92px]');
    });

    it('战后处理必须展示本次掷骰本体，而不是只剩文字摘要', () => {
        expect(boardSource).toContain('const formatQidahenBattleRollPhaseLabel = (phase: QidahenBattleRollPhase): string => {');
        expect(boardSource).toContain('const formatQidahenBattleRollFace = (roll: QidahenBattleRoll): string => (');
        expect(boardSource).toContain('const QidahenBattleRollDiceSummary: React.FC<');
        expect(boardSource).toContain('data-testid="qidahen-post-battle-dice-summary"');
        expect(boardSource).not.toContain('Dice3D');
        expect(boardSource).not.toContain('data-testid="dice-3d"');
        expect(boardSource).toContain('{postBattleSelection.battleRolls && postBattleMode == null ? (');
        expect(boardSource).toContain('<QidahenBattleRollDiceSummary battleRolls={postBattleSelection.battleRolls} />');
        expect(boardSource).toContain("defaultValue: '{{summary}} · 幸存 {{survivingTroops}}'");
    });

    it('地图必须共享缩放拖动视口，并让高亮路线与顶层点击点一起跟随同一套投影', () => {
        expect(boardSource).toContain('type QidahenMapViewport = {');
        expect(boardSource).toContain('const clampQidahenMapViewport = (viewport: QidahenMapViewport): QidahenMapViewport => {');
        expect(boardSource).toContain('const projectQidahenMapPointToStage = (');
        expect(boardSource).toContain('data-testid="qidahen-map-viewport-controls"');
        expect(boardSource).toContain('data-testid="qidahen-map-content"');
        expect(boardSource).toContain("'data-map-zoom': viewport.zoom,");
        expect(boardSource).toContain("'data-map-pan-x': viewport.panX,");
        expect(boardSource).toContain("'data-map-pan-y': viewport.panY,");
        expect(boardSource).toContain('data-testid="qidahen-map-zoom-in"');
        expect(boardSource).toContain('data-testid="qidahen-map-zoom-out"');
        expect(boardSource).toContain('data-testid="qidahen-map-zoom-reset"');
        expect(boardSource).toContain('wheelZoomFactor={1.14}');
        expect(boardSource).toContain('controlledViewport={controlledMapViewport}');
        expect(boardSource).toContain('onControlledViewportChange={handleControlledViewportChange}');
        expect(boardSource).toContain('onPointerUp={handlePointerUp}');
        expect(boardSource).toContain('viewport={mapViewport}');
        expect(boardSource).toContain('onViewportChange={setMapViewport}');
        expect(boardSource).toContain('const buildQidahenGuideDisplayPoints = (');
        expect(boardSource).toContain('const buildQidahenGuideArrowHeadPath = (');
        expect(boardSource).toContain('const getGuideArmyTokenPoint = (');
        expect(boardSource).toContain('const getWheelDispatchTargetPoint = (candidate: QidahenWheelDispatchSelection[\'candidates\'][number]) => (');
        expect(boardSource).toContain('getRegionPoint(candidate.targetRuntimeRegionId)');
        expect(boardSource).not.toContain('getGuideArmyTokenPoint(candidate.targetRuntimeRegionId, candidate.defenderFactionId)');
        expect(boardSource).toContain("candidate.targetRuntimeRegionId === 'city-region-22'");
        expect(boardSource).toContain('x: targetPoint.x');
        expect(boardSource).toContain('y: targetPoint.y');
        expect(boardSource).toContain('const buildQidahenGuideArrow = (');
        expect(boardSource).toContain('const arrowTip = { x: center.x + unitX * length, y: center.y + unitY * length };');
        expect(boardSource).toContain('const leftTail = {');
        expect(boardSource).toContain('const rightTail = {');
        expect(boardSource).toContain('`M ${arrowTip.x} ${arrowTip.y}`');
        expect(boardSource).toContain('`L ${leftTail.x} ${leftTail.y}`');
        expect(boardSource).toContain('`L ${rightTail.x} ${rightTail.y}`');
        expect(boardSource).toContain("'Z',");
        expect(boardSource).toContain('fill="none"');
        expect(boardSource).toContain('vectorEffect="non-scaling-stroke"');
        expect(boardSource).toContain('const curveLift = Math.min(108, Math.max(34, distance * 0.14));');
        expect(boardSource).toContain('return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;');
        expect(boardSource).toContain('data-guide-target-x={targetPoint.x}');
        expect(boardSource).toContain('data-guide-target-y={targetPoint.y}');
        expect(boardSource).toContain('data-testid="qidahen-map-guide-route-overlay"');
        expect(boardSource).toContain('data-testid="qidahen-map-selection-guide-routes"');
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
        expect(boardSource).toContain("pendingTargetAction?.sourceRegionId ?? wheelDispatchSelection?.sourceRegionId ?? null");
        expect(boardSource).toContain('token.regionId === pendingCommittedSourceRegionId');
        expect(boardSource).toContain('token.troopIndex <= activeCommittedMax');
        expect(boardSource).toContain('pendingCommittedSelected={pendingCommittedSelectable && (token.troopIndex ?? 0) <= pendingCommittedSelectedCount}');
        expect(boardSource).toContain('pendingCommittedTroops ?? pendingTargetAction?.committedTroops ?? 0');
        expect(boardSource).toContain("tokenSelectable ? 'none' : `0 2px 8px ${UI_STYLE.shadowSoft}`");
        expect(boardSource).not.toContain("0 0 0 4px rgba(77, 157, 78, 0.78), 0 5px 14px");
        expect(boardSource).not.toContain("0 0 0 2px rgba(39, 25, 13, 0.68), 0 2px 8px");
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
        expect(boardSource).toContain('const ACTIONS_DOCK_WIDTH = 350;');
        expect(boardSource).toContain('const ACTIONS_DOCK_HEIGHT = 470;');
        expect(boardSource).toContain('const ACTIONS_DOCK_LEFT = STAGE_WIDTH - ACTIONS_DOCK_RIGHT - ACTIONS_DOCK_WIDTH;');
        expect(boardShellSource).toContain("'--qidahen-mobile-edge-pull': `${metrics.mobileEdgePull}px`");
        expect(boardShellSource).toContain("'--qidahen-mobile-top-inset': `${metrics.mobileTopInset}px`");
        expect(boardSource).toContain('MOBILE_LANDSCAPE_TOP_SAFE_INSET');
        expect(boardSource).toContain('const MOBILE_LANDSCAPE_CHRONOLOGY_TOP = 670;');
        expect(boardShellSource).toContain('mobileChronologyTop: isMobileLandscape');
        expect(boardShellSource).toContain("'--qidahen-mobile-chronology-top': `${metrics.mobileChronologyTop}px`,");
        expect(boardSource).toContain("style={{ top: 'var(--qidahen-mobile-chronology-top, 542px)' }}");
        expect(boardSource).toContain('data-testid="qidahen-action-slot"');
        expect(boardSource).toContain('className="mt-3 shrink-0"');
        expect(boardSource).toContain('className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="qidahen-action-slot"');
        expect(boardSource).toContain('left: `calc(${ACTIONS_DOCK_LEFT}px + var(--qidahen-mobile-edge-pull, 0px))`,');
        expect(boardSource).toContain('width: suppressPassiveActionContext ? ACTIONS_DOCK_WIDTH + 12 : ACTIONS_DOCK_WIDTH,');
        expect(boardSource).toContain('height: ACTIONS_DOCK_HEIGHT,');
    });

    it('PC 右侧动作按钮必须保持桌面尺寸，禁止回到移动端式紧凑按钮', () => {
        const actionButtonStart = boardSource.indexOf('const ActionButton: React.FC<{');
        const actionButtonEnd = boardSource.indexOf('const ActionsZone: React.FC<{', actionButtonStart);
        const actionButtonSource = boardSource.slice(actionButtonStart, actionButtonEnd);

        expect(actionButtonStart).toBeGreaterThanOrEqual(0);
        expect(actionButtonEnd).toBeGreaterThan(actionButtonStart);
        expect(actionButtonSource).toContain('h-[48px] min-w-[132px]');
        expect(actionButtonSource).toContain('px-3.5 text-left text-[14px]');
        expect(actionButtonSource).not.toContain('h-[38px] min-w-[104px]');
    });

    it('主交互槽位激活时，被动状态块必须让位，不再跟主交互面板争抢右侧动作槽位', () => {
        expect(boardSource).toContain('const suppressPassiveActionContext = actionPaymentPreviewVisible');
        expect(boardSource).toContain('|| showWheelNextStepBanner');
        expect(boardSource).toContain('|| pendingTargetAction != null');
        expect(boardSource).toContain('|| postBattleSelection != null;');
        expect(boardSource).toContain("const showFortificationStrip = !suppressPassiveActionContext && core.turnPhase !== 'action-window';");
        expect(boardSource).toContain("const showActionRail = !pendingScenarioChoices && !suppressPassiveActionContext && primaryStageMode === 'faction';");
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
        expect(boardSource).toContain("const pendingCommittedSelectionActive = activeCommittedMax > 0");
        expect(boardSource).toContain("&& (pendingTargetAction != null || wheelDispatchSelection != null);");
        expect(boardSource).toContain("const displaySelectedRegion = compactRegionTip && !pendingCommittedSelectionActive ? selectedRegion : undefined;");
        expect(boardSource).toContain("const displayHoveredRegion = pendingCommittedSelectionActive ? undefined : hoveredRegion;");
        expect(boardSource).toContain("const focusedRegion = displayHoveredRegion ?? displaySelectedRegion;");
        expect(boardSource).toContain('if (compactRegionTip && core.explicitRegionId) {');
        expect(boardSource).toContain('const selectedRegion = core.explicitRegionId');
        expect(boardSource).toContain("'data-map-selected': core.explicitRegionId ?? '',");
        expect(boardSource).toContain('{!compactRegionTip && activePassageSummary ? (');
        expect(boardSource).toContain('{!compactRegionTip && activeMovementPreview ? (');
        expect(boardSource).toContain('{!compactRegionTip && sharedPrintedRuntimeOptions.length > 1 ? (');
    });

    it('手牌区默认贴底紧凑展示，只有牌多时才允许轻度重叠并继续保留横向滚动', () => {
        expect(boardSource).toMatch(/const HAND_CARD_SELECTED_LIFT = \d+;/);
        expect(boardSource).toContain('const BOTTOM_DOCK_HEIGHT = CARD_DIMENSIONS.hand.height + HAND_CARD_SELECTED_LIFT + 4;');
        expect(boardSource).toContain('const HAND_DOCK_WIDTH = 1310;');
        expect(boardSource).toContain('const MOBILE_LANDSCAPE_HAND_CARD_MIN_WIDTH = 92;');
        expect(boardSource).toContain('const MOBILE_LANDSCAPE_HAND_CARD_MAX_WIDTH = 118;');
        expect(boardSource).toContain('const getQidahenMobileLandscapeHandLayout = (dockWidth: number) => {');
        expect(boardSource).toContain('const getQidahenHandCardOverlapPx = (');
        expect(boardSource).toContain('const visibleCardCount = Math.min(handCount, MOBILE_LANDSCAPE_VISIBLE_HAND_LIMIT);');
        expect(boardSource).toContain('data-testid="qidahen-bottom-dock"');
        expect(boardSource).toContain('const MOBILE_LANDSCAPE_BOTTOM_DOCK_INSET = 0;');
        expect(boardShellSource).toContain('const sceneScale = Math.max(width / layout.width, height / layout.height);');
        expect(boardShellSource).toContain('const hudScale = isMobileLandscape ? 1 : Math.min(width / layout.width, height / layout.height);');
        expect(boardShellSource).toContain('width: metrics.isMobileLandscape ? metrics.viewportWidth : layout.width');
        expect(boardShellSource).toContain('height: metrics.isMobileLandscape ? metrics.viewportHeight : layout.height');
        expect(boardShellSource).toContain("data-qidahen-layout-mode={metrics.isMobileLandscape ? 'mobile-landscape' : 'desktop'}");
        expect(boardShellSource).toContain('mobileBottomInset: isMobileLandscape ? layout.mobileLandscapeBottomDockInset : layout.bottomDockInset');
        expect(boardShellSource).toContain("'--qidahen-mobile-bottom-inset': `${metrics.mobileBottomInset}px`,");
        expect(boardSource).toContain("const dockBottomInset = 'var(--qidahen-mobile-bottom-inset, 0px)';");
        expect(boardSource).toContain('bottom: dockBottomInset,');
        expect(boardSource).toContain('mapTargetSelectionActive?: boolean;');
        expect(boardSource).toContain("className={`${mapTargetSelectionActive ? 'pointer-events-none' : 'pointer-events-auto'} absolute left-1/2 flex items-end ${isMobileLandscapeViewport ? 'justify-start' : 'justify-center'} overflow-x-auto overflow-y-visible`}");
        expect(boardSource).toContain("data-map-target-selection-active={mapTargetSelectionActive ? 'true' : undefined}");
        expect(boardSource).toContain('const mapTargetSelectionActive = topLevelMapSelectionGuide != null && topLevelMapSelectionGuide.candidates.length > 0;');
        expect(boardSource).toContain('mapTargetSelectionActive={mapTargetSelectionActive}');
        expect(boardSource).toContain('height: bottomDockHeight,');
        expect(boardSource).toContain('const handDockMaxWidth: number | string = isMobileLandscapeViewport ? handDockWidth : \'calc(100vw - 320px)\';');
        expect(boardSource).toContain('width: handDockWidth,');
        expect(boardSource).toContain('maxWidth: handDockMaxWidth,');
        expect(boardSource).toContain('data-testid="qidahen-hand-row"');
        expect(boardSource).toContain('className="mx-auto flex min-w-max items-end justify-center px-2" data-testid="qidahen-hand-row"');
        expect(boardSource).toContain('data-testid={`qidahen-hand-card-magnify-${card.id}`}');
        expect(boardSource).toContain('onMagnifyCard?.({');
        expect(boardSource).toContain('hover:-translate-y-[18px]');
        expect(boardSource).toContain('data-qidahen-hand-card-selected');
        expect(boardSource).toContain('selected={selected}');
        expect(boardSource).not.toContain('before:inset-[-7px]');
        expect(boardSource).toContain('width={handCardWidth}');
        expect(boardSource).toContain('height={handCardHeight}');
        expect(boardSource).toContain('overlapPx={handCardOverlapPx}');
        expect(boardSource).toContain('marginLeft: stackIndex === 0 ? 0 : overlapPx');
    });

    it('纪年卡与手牌都要接入局内放大查看，而不是只能靠缩略图硬读', () => {
        expect(boardSource).toContain("overlayTestId=\"qidahen-card-magnify-overlay\"");
        expect(boardSource).toContain('data-testid="qidahen-card-magnify-content"');
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
        expect(boardSource).toContain('backgroundColor={QIDAHEN_STAGE_BG}');
        expect(boardShellSource).toContain('backgroundColor,');
        expect(boardShellSource).toContain("'--qidahen-scene-inverse-scale': String(1 / metrics.scene.scale)");
        expect(boardSource).toContain('applyTone(region.id, region.controller);');
    });

    it('地图 army token 会拆成可旋转的方块棋子，人口不生成额外地图 token', () => {
        expect(boardSource).toContain("const isArmyToken = token.type === 'army';");
        expect(boardSource).not.toContain("const isPopulationToken = token.type === 'population';");
        expect(boardSource).toContain("rounded-[6px]");
        expect(boardSource).toContain("const tokenShapeClass = isArmyToken ? 'rounded-[6px]' : token.type === 'control' ? 'rounded-full' : '';");
        expect(boardSource).toContain("const showImageValueBadge = token.type === 'control' && typeof token.value === 'number';");
        expect(boardSource).toContain("const showTokenImage = Boolean(token.imageSrc) && (!isArmyToken || revealFront);");
        expect(boardSource).not.toContain(') : isPopulationToken ? (');
        expect(boardSource).toContain("rotate(${token.rotationDeg ?? 0}deg)");
        expect(mapTokenSource).not.toContain("type: 'population',");
        expect(typesSource).not.toContain("type: 'army' | 'population' | 'control' | 'marker';");
        expect(typesSource).toContain("type: 'army' | 'control' | 'marker';");
        expect(mapTokenSource).not.toContain('populationMarkerImageSrc');
    });

    it('甲喇标记没有专属图片时必须直接显示专用汉字，不得借用其它素材', () => {
        expect(mapTokenSource).toContain('if (!marker.imageSrc && !marker.mapLabel) {');
        expect(mapTokenSource).toContain('value: marker.imageSrc ? undefined : marker.mapLabel,');
        expect(boardSource).toContain('{token.value}');
    });

    it('地图部队必须按暗棋规则隐藏对手正面贴纸，只有己方或战斗公开区域可见正面', () => {
        expect(boardSource).toContain('const shouldRevealQidahenMapArmyToken = (');
        expect(boardSource).toContain('const currentFactionId = perspectiveFactionId;');
        expect(boardSource).not.toContain('?? QIDAHEN_FACTION_ORDER.find((factionId) => core.factions[factionId].playerId === core.currentPlayer)');
        expect(boardSource).toContain("if (viewerFactionId != null && token.faction === viewerFactionId) {");
        expect(boardSource).toContain('return token.regionId != null && revealedBattleRegionIds.has(token.regionId);');
        expect(boardSource).toContain('const buildRevealedBattleRegionIds = (');
        expect(boardSource).toContain('pendingTargetAction?.targetRuntimeRegionId,');
        expect(boardSource).toContain('postBattleSelection?.targetRuntimeRegionId,');
        expect(boardSource).toContain('const showTokenImage = Boolean(token.imageSrc) && (!isArmyToken || revealFront);');
        expect(boardSource).toContain('data-qidahen-army-face="hidden-back"');
        expect(boardSource).toContain("aria-label={t('board.map.armyBackAlt', { defaultValue: '部队背面' })}");
        expect(boardSource).toContain("const armyHiddenBackColorByFaction: Record<QidahenFactionId | 'neutral', string> = {");
        expect(boardSource).toContain('background: armyHiddenBackColorByFaction[token.faction]');
        expect(boardSource).not.toContain('opacity: 0.46');
        expect(boardSource).not.toContain('grayscale(0.42)');
        expect(boardSource).not.toContain("armyBackMarker: 'qidahen/markers/blank-rectangular-marker'");
        expect(boardSource).not.toContain('src={ASSETS.armyBackMarker}');
        expect(boardSource).not.toContain('qidahen/markers/blank-rectangular-marker');
        expect(boardSource).not.toContain('qidahen/cards/backs/army');
        expect(boardSource).not.toContain('HIDDEN_ARMY_BACK_BY_FACTION');
        expect(boardSource).toContain('revealFront={shouldRevealQidahenMapArmyToken(token, currentFactionId, revealedBattleRegionIds)}');
        expect(boardSource).not.toContain("src={ASSETS.mingCard}");
        expect(boardSource).not.toContain("src={ASSETS.mongolCard}");
        expect(boardSource).not.toContain("src={ASSETS.jinCard}");
    });

    it('选择参与部队必须在军队本体上给绿色邀请态和已选确认态', () => {
        expect(boardSource).toContain('const pendingCommittedTone = pendingCommittedSelected');
        expect(boardSource).toContain("boxShadow: '0 0 0 1px rgba(29, 83, 36, 0.6), 0 0 5px rgba(91, 215, 101, 0.28)'");
        expect(boardSource).toContain("boxShadow: '0 0 0 1px rgba(29, 83, 36, 0.72), 0 0 7px rgba(112, 238, 124, 0.34)'");
        expect(boardSource).toContain('data-testid={`qidahen-pending-committed-highlight-${token.id}`}');
        expect(boardSource).toContain("className={`pointer-events-none absolute inset-[-2px] ${tokenShapeClass}`}");
        expect(boardSource).toContain("border: pendingCommittedSelected ? '1.5px solid #8cf694' : '1.5px solid #69d873'");
        expect(boardSource).toContain("background: pendingCommittedSelected ? 'rgba(101, 255, 128, 0.045)' : 'rgba(87, 240, 103, 0.028)'");
        expect(boardSource).toContain('const tokenSelectable = pendingCommittedSelectable || pincerAdvanceSelectable || instigateDefectionSelectable || wuzhenChaohaSelectable;');
        expect(boardSource).toContain('const resolvedSelectionTone = wuzhenChaohaTone ?? instigateDefectionTone ?? pincerAdvanceTone ?? pendingCommittedTone;');
        expect(boardSource).toContain('zIndex: tokenSelectable ? 64 : undefined');
        expect(boardSource).toContain('className="pointer-events-none absolute z-20 border-[3px] px-3 py-2 text-[13px] font-black leading-5"');
        expect(boardSource).toContain("const displaySelectedRegion = compactRegionTip && !pendingCommittedSelectionActive ? selectedRegion : undefined;");
        expect(boardSource).toContain("const displayHoveredRegion = pendingCommittedSelectionActive ? undefined : hoveredRegion;");
        expect(boardSource).toContain("className={`${tokenSelectable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}");
        expect(boardSource).toContain('data-pending-committed-selectable={pendingCommittedSelectable ?');
        expect(boardSource).toContain('data-pending-committed-selected={pendingCommittedSelectable ? String(pendingCommittedSelected) : undefined}');
        expect(boardSource).toContain("role={tokenSelectable ? 'button' : undefined}");
        expect(boardSource).toContain('aria-pressed={tokenSelectable && !instigateDefectionSelectable && !wuzhenChaohaSelectable ? (pincerAdvanceSelectable ? pincerAdvanceSelected : pendingCommittedSelected) : undefined}');
        expect(boardSource).toContain(': pendingCommittedSelectable && token.troopIndex');
        expect(boardSource).toContain('onSelectPendingCommittedTroops?.(token.troopIndex!)');
        expect(boardSource).not.toContain('opacity: 0.46');
        expect(boardSource).not.toContain('grayscale(0.42)');
    });

    it('策反必须复用敌方次级兵牌本体直选并显示绿色可选态', () => {
        expect(boardSource).toContain('const instigateDefectionTone = instigateDefectionSelectable');
        expect(boardSource).toContain("boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.9), 0 0 8px rgba(124, 244, 134, 0.5)'");
        expect(boardSource).toContain("data-instigate-defection-selectable={instigateDefectionSelectable ? 'true' : undefined}");
        expect(boardSource).toContain(': instigateDefectionSelectable');
        expect(boardSource).toContain('onResolveInstigateDefection?.(token.id)');
        expect(boardSource).toContain('} else if (instigateDefectionSelectable) {');
        expect(boardSource).toContain('点击绿色兵牌选择要策反的敌方次级部队。');
    });

    it('乌真超哈必须复用实际参战步兵牌直选，并在确认前允许选择销毁火炮技术数量', () => {
        expect(boardSource).toContain('const wuzhenChaohaTone = wuzhenChaohaSelectable');
        expect(boardSource).toContain("data-wuzhen-chaoha-selectable={wuzhenChaohaSelectable ? 'true' : undefined}");
        expect(boardSource).toContain('onClick={wuzhenChaohaSelectable');
        expect(boardSource).toContain('onResolveWuzhenChaoha?.(token.id)');
        expect(boardSource).toContain('data-testid="qidahen-wuzhen-chaoha-selection"');
        expect(boardSource).toContain('点击绿色步兵牌，指定其提前在炮兵阶段攻击。');
        expect(boardSource).toContain('data-testid={`qidahen-wuzhen-chaoha-artillery-tech-${count}`}');
        expect(boardSource).toContain('dispatch(QIDAHEN_COMMANDS.SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT, { count });');
        expect(boardSource).toContain('dispatch(QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA, { choiceId });');
        expect(boardSource).not.toContain('qidahen-wuzhen-chaoha-choice-button');
    });

    it('pending-target 按钮 test id 继续由共享选择渲染统一生成', () => {
        expect(boardSource).toContain('const getPendingTargetChoiceTestId = (choiceId: string): string => {');
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action';");
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action-rout';");
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action-cavalry-plunder';");
        expect(boardSource).toContain("return 'qidahen-resolve-pending-action-cavalry-plunder-defender';");
        expect(boardSource).toContain("return `qidahen-resolve-pending-action-${choiceId}`;");
        expect(boardSource).toContain('data-tutorial-id={getPendingTargetChoiceTestId(choice.id)}');
    });

    it('步骑联合待选择时必须只显示两个汉字选项并隐藏普通战斗结算入口', () => {
        const selectionBranchIndex = boardSource.indexOf('core.infantryCavalryCombinedSelection ? (');
        const fallbackBranchIndex = boardSource.indexOf(') : (', selectionBranchIndex);
        const pendingChoiceOptionsIndex = boardSource.indexOf(
            '{pendingTargetChoiceOptions.map((choice) => {',
            selectionBranchIndex,
        );

        expect(selectionBranchIndex).toBeGreaterThan(-1);
        expect(boardSource).toContain('data-testid="qidahen-infantry-cavalry-combined-withdraw"');
        expect(boardSource).toContain('data-testid="qidahen-infantry-cavalry-combined-joint-attack"');
        expect(boardSource).toContain('骑兵撤离');
        expect(boardSource).toContain('步骑联合攻击');
        expect(boardSource).toContain("dispatch(QIDAHEN_COMMANDS.RESOLVE_INFANTRY_CAVALRY_COMBINED, { mode });");
        expect(fallbackBranchIndex).toBeGreaterThan(selectionBranchIndex);
        expect(pendingChoiceOptionsIndex).toBeGreaterThan(fallbackBranchIndex);
    });

    it('地图进攻指引箭头必须停在目标边缘而不是扎进区域中心', () => {
        expect(boardSource).toContain(': pendingTargetAction?.targetRuntimeRegionId ?? null;');
        expect(boardSource).not.toContain(': mapSelectionGuide?.candidates[0]?.targetRegionId ?? null;');
        expect(boardSource).toContain('const activeGuideTargetCandidate = mapSelectionGuide?.candidates.find');
        expect(boardSource).toContain('tutorialGuideTargetRegionId && mapSelectionCandidateRegionIds.has(tutorialGuideTargetRegionId)');
        expect(boardSource).toContain('tutorialGuideTargetRegionId && wheelDispatchTargetRegionIds.has(tutorialGuideTargetRegionId)');
        expect(boardSource).toContain('const tutorialAllowedMapTargetRegionId = tutorialStep?.allowedTargets?.find');
        expect(boardSource).toContain(': tutorialAllowedMapTargetRegionId;');
        expect(boardSource).toContain('tutorialGuideTargetRegionId={tutorialMapFocusCandidateRegionId}');
        expect(boardSource).toContain('const mapSelectionBannerHint = activeGuideTargetCandidate');
        expect(boardSource).toContain('当前目标：${activeGuideTargetCandidate.targetRegionName}');
        expect(boardSource).toContain('{mapSelectionBannerHint}');
        expect(boardSource).toContain('const sourcePoint = getGuideArmyTokenPoint(');
        expect(boardSource).toContain('pendingCommittedTroops,');
        expect(boardSource).toContain('selectedTroopCount?: number | null,');
        expect(boardSource).toContain('const selectedTokens = selectedTroopCount == null');
        expect(boardSource).toContain("typeof token.troopIndex === 'number'");
        expect(boardSource).toContain('&& token.troopIndex <= selectedTroopCount');
        expect(boardSource).toContain('const targetTokens = selectedTokens.length > 0 ? selectedTokens : matchingTokens;');
        expect(boardSource).toContain('const targetPoint = getWheelDispatchTargetPoint(candidate);');
        expect(boardSource).not.toContain('const guideTargetTone = guideTargeted');
        expect(boardSource).toContain('const wheelDispatchTargetRegionIds = new Set(');
        expect(boardSource).toContain('const activeWheelDispatchTargetRegionId = hoveredRegionId && wheelDispatchTargetRegionIds.has(hoveredRegionId)');
        expect(boardSource).toContain("applyTone(activeWheelDispatchTargetRegionId, 'activeDispatch');");
        expect(boardSource).not.toContain("applyTone(activeWheelDispatchTargetRegionId, 'dispatch');");
        expect(boardSource).not.toContain('data-testid={`qidahen-map-guide-token-target-${token.id}`}');
        expect(boardSource).toContain('targetTokenIds: targetTokens.map((token) => token.id)');
        expect(boardSource).toContain('arrowTargetPoint,');
        expect(boardSource).toContain('targetFocusDisabled: true,');
        expect(boardSource).toContain('targetTokenBounds: targetTokenBounds ?? undefined');
        expect(boardSource).toContain('const arrowTargetPoint = getWheelDispatchArrowTargetPoint(candidate, sourcePoint, targetPoint);');
        expect(boardSource).toContain('const getGuideArrowTargetPoint = (');
        expect(boardSource).toContain('const entryPoint = resolveQidahenRuntimeRegionEntryPoint(');
        expect(boardSource).toContain('targetRuntimeRegionId,');
        expect(boardSource).toContain('sourcePoint,');
        expect(boardSource).toContain('targetPoint,');
        expect(boardSource).toContain('14,');
        expect(boardSource).toContain("targetRuntimeRegionId === 'city-region-22' && targetPoint");
        expect(boardSource).toContain('x: targetPoint.x - 36,');
        expect(boardSource).toContain('y: targetPoint.y - 58,');
        expect(boardSource).toContain("const arrowHeadAnchorRatio = candidate.targetRuntimeRegionId === 'city-region-22' ? 0.95 : undefined;");
        expect(boardSource).not.toContain("const guideTargetPoint = candidate.targetRuntimeRegionId === 'city-region-22'");
        expect(boardSource).toContain('targetPoint,');
        expect(boardSource).not.toContain('const targetPathEndPoint = targetTokenBounds');
        expect(boardSource).toContain('pathPoints: buildGuidePathPoints(');
        expect(boardSource).toContain('candidate.pathRegionIds,');
        expect(boardSource).toContain('arrowTargetPoint,');
        expect(boardSource).toContain('pendingCommittedTroops ?? pendingTargetAction.committedTroops,');
        expect(boardSource).toContain('const targetPoint = getRegionPoint(pendingTargetAction.targetRuntimeRegionId);');
        expect(boardSource).toContain('const arrowTargetPoint = getGuideArrowTargetPoint(');
        expect(boardSource).toContain('pendingTargetAction.targetRuntimeRegionId,');
        expect(boardSource).toContain('targetPoint: targetPoint ?? undefined,');
        expect(boardSource).toContain('arrowTargetPoint: arrowTargetPoint ?? undefined,');
        expect(boardSource).not.toContain('guideTargeted={guideTargetedTokenIds.has(token.id)}');
        expect(boardSource).not.toContain('guideTargetActive={activeGuideTargetedTokenIds.has(token.id)}');
        expect(boardSource).not.toContain("'0 0 0 2px rgba(255, 226, 161, 0.95)");
        expect(boardSource).not.toContain("'2px solid #ffe2a1'");
        expect(boardSource).toContain('const targetFocusRadius = activeCandidate ? 22 : 18;');
        expect(boardSource).toContain('if (!activeCandidate || candidate.targetFocusDisabled || pathPoints.length < 2) {');
        expect(boardSource).not.toContain('const guideLeadLength = targetsArmyTokens ? 74 : 88;');
        expect(boardSource).not.toContain('[targetGuideStartPoint, targetPoint],');
        expect(boardSource).not.toContain('targetsArmyTokens ? activeCandidate ? 14 : 12 : activeCandidate ? 14 : 12');
        expect(boardSource).toContain('const arrowPoints = pathPoints;');
        expect(boardSource).not.toContain('const linePath = buildQidahenGuideLinePath(buildQidahenGuideDisplayPoints(arrowPoints, activeCandidate ? 18 : 14));');
        expect(boardSource).toContain('const { linePath, headPath: arrowHeadPath } = buildQidahenGuideArrow(');
        expect(boardSource).toContain('data-testid={`qidahen-map-guide-line-${candidate.targetRegionId}`}');
        expect(boardSource).toContain('headPath: buildQidahenGuideArrowHeadPath(headCenter, headTangent, headLength, headWidth),');
        expect(boardSource).not.toContain('const wheelDispatchCandidateRegionIds = new Set(');
        expect(boardSource).toContain('const routeColor = activeCandidate ?');
        expect(boardSource).toContain('strokeWidth={activeCandidate ? 4 : 2.6}');
        expect(boardSource).toContain('opacity={activeCandidate ? 0.88 : 0.34}');
        expect(boardSource).toContain("mapSelectionGuide ? 'rgba(43,101,145,0.06)'");
        expect(boardSource).toContain('opacity={mapSelectionGuide ? 0.06 : 0.9}');
        expect(boardSource).toContain('fill={routeColor}');
        expect(boardSource).toContain('fill="none"');
        expect(boardSource).not.toContain('const targetFocusPadding = targetsArmyTokens ? activeCandidate ? 7 : 5 : 0;');
        expect(boardSource).toContain('const targetFocusLeft = targetPoint.x - targetFocusRadius;');
        expect(boardSource).toContain('const targetFocusRight = targetPoint.x + targetFocusRadius;');
        expect(boardSource).toContain('data-testid={`qidahen-map-guide-target-focus-${candidate.targetRegionId}`}');
        expect(boardSource).toContain('vectorEffect="non-scaling-stroke"');
        expect(boardSource).not.toContain('points={pointLabel}');
        expect(boardSource).not.toContain('const arrowHeadPath = buildQidahenGuideArrowHeadPath(pathPoints');
    });

    it('地图自动聚焦必须使用稳定目标键，并禁止把相同视角反复写回状态', () => {
        expect(boardSource).toContain('const autoFocusMapTargetRegionIdsKey = topLevelMapSelectionGuide?.candidates');
        expect(boardSource).toContain('const autoFocusMapTargetRegionIds = autoFocusMapTargetRegionIdsKey');
        expect(boardSource).toContain('autoFocusMapTargetRegionIdsKey.split');
        expect(boardSource).toContain('const tutorialMapFocusRegionId = getQidahenTutorialMapFocusRegionId(tutorialStep?.highlightTarget);');
        expect(boardSource).toContain('const tutorialMapFocusCandidateRegionId = tutorialMapFocusRegionId');
        expect(boardSource).toContain('const activeTargetRegionId = tutorialMapFocusCandidateRegionId');
        expect(boardSource).toContain('?? autoFocusMapTargetRegionIds[0]');
        expect(boardSource).toContain('autoFocusMapTargetRegionIdsKey,');
        expect(boardSource).toContain('tutorialMapFocusCandidateRegionId,');
        expect(boardSource).toContain('setMapViewport((currentViewport) => {');
        expect(boardSource).toContain('mapViewportBeforeAutoFocusRef.current = currentViewport;');
        expect(boardSource).toContain('setMapViewport(mapViewportBeforeAutoFocusRef.current);');
        expect(boardSource).toContain('mapViewportBeforeAutoFocusRef.current = null;');
        expect(boardSource).toContain('currentViewport.zoom === viewport.zoom');
        expect(boardSource).toContain('currentViewport.panX === viewport.panX');
        expect(boardSource).toContain('currentViewport.panY === viewport.panY');
        expect(boardSource).not.toContain('[topLevelMapSelectionGuide],');
        expect(boardSource).not.toContain('setMapViewport(viewport);');
    });

    for (const testId of REQUIRED_TEST_IDS) {
        it(`保留关键结构标识 ${testId}`, () => {
            expect(combinedBoardSource).toContain(testId);
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
