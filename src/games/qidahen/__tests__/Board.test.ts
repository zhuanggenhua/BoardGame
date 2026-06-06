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
    'data-testid="qidahen-runtime-region-graph"',
    'data-testid={`qidahen-runtime-region-edge-${edge.id}`}',
    "import qidahenRegionMaskUrl from './data/region-mask.png?url'",
    'QIDAHEN_REGION_GRAPH_EDGES',
    'QIDAHEN_REGION_ID_BY_MASK_COLOR',
    'getQidahenDirectedPassage',
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
    '开垦',
    '军屯',
    '征兵',
    '训练',
    '外交',
    '雇佣',
    '进攻',
    '调度',
    '新年 &gt;&gt;&gt;',
    '年中',
    'data-testid="qidahen-raid-intent"',
    'data-testid="qidahen-post-battle-selection"',
    'data-testid={`qidahen-post-battle-choice-${choice.id}`}',
    'data-testid="qidahen-wheel-dispatch-selection"',
    'data-testid={`qidahen-wheel-dispatch-target-${candidate.targetRuntimeRegionId}`}',
    'data-testid="qidahen-actions-zone"',
    'data-testid="qidahen-action-rail"',
    'data-testid={`qidahen-action-${action.id}`}',
    'data-testid="qidahen-turn-banner"',
    'data-testid="qidahen-bottom-dock"',
    'data-testid="qidahen-draw-anchor"',
    'data-testid="qidahen-hand-zone"',
    'data-ui-role="qidahen-hand-dock"',
    'data-testid="qidahen-hand-row"',
    'onExecuteAction',
    'data-testid={`qidahen-hand-card-${card.id}`}',
    'data-testid="qidahen-discard-anchor"',
    'data-testid="qidahen-resolve-pending-action"',
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
    '已选',
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

describe('Qidahen Board 结构门禁', () => {
    it('纪年卡预览继续绑定纪年图集而不是蒙古图集', () => {
        expect(cardAtlasSource).toContain("image: 'qidahen/cards/atlases/chronology-deck-atlas'");
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
