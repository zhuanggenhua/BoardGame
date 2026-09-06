import { BETRAYAL_INITIAL_DECK_COUNTS } from './deckModel';
import { normalizeBetrayalDiceCount, rollBetrayalDicePips } from './diceRules';
import type { RandomFn } from '../../engine/types';
import { getAllExplorers } from './explorerReadModel';
import type { BetrayalCore, BetrayalDeckKind } from './game';
import type { UseEffectProfile } from './possessionEffects';

export interface BetrayalHauntRiskStatus {
    omenCount: number;
    requestedRollOmenCount: number;
    nextRollDiceCount: number;
    threshold: number;
    hauntStarted: boolean;
    nextOmenAutomatic: boolean;
    omenDeckRemaining: number;
}

export interface BetrayalHauntRollResult {
    dice: number[];
    total: number;
    threshold: number;
    triggered: boolean;
    automatic: boolean;
}

export type BetrayalNumberTrackKind =
    | 'haunt-risk'
    | 'haunt-objective'
    | 'haunt-resource';

export type BetrayalNumberTrackSource =
    | 'base-rule'
    | 'haunt-contract';

export interface BetrayalNumberTrackStatus {
    id: string;
    kind: BetrayalNumberTrackKind;
    label: string;
    labelKey?: string;
    value: number;
    min: number;
    max: number;
    targetValue: number | null;
    currentLabel: string;
    targetLabel: string | null;
    statusLabel: string;
    progressPercent: number;
    source: BetrayalNumberTrackSource;
    representativeOnly: boolean;
}

export function resolveBetrayalOmenCount(core: BetrayalCore): number {
    return Math.max(0, getAllExplorers(core).reduce((total, explorer) => (
        total + explorer.inventory.filter((item) => item.kind === 'omen').length
    ), 0));
}

export function resolveBetrayalHauntRisk(
    core: BetrayalCore,
    options: { additionalOmenCount?: number } = {},
): BetrayalHauntRiskStatus {
    const omenCount = resolveBetrayalOmenCount(core);
    const additionalOmenCount = Math.max(0, options.additionalOmenCount ?? 0);
    const requestedRollOmenCount = omenCount + additionalOmenCount;
    const nextRollOmenCount = omenCount + Math.max(1, additionalOmenCount);
    return {
        omenCount,
        requestedRollOmenCount,
        nextRollDiceCount: normalizeBetrayalDiceCount(nextRollOmenCount),
        threshold: core.scenarioRuntime.hauntRollThreshold,
        hauntStarted: core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered,
        nextOmenAutomatic: core.phase === 'preHaunt'
            && !core.scenarioRuntime.hauntTriggered
            && core.deckCounts.omen <= 1,
        omenDeckRemaining: core.deckCounts.omen,
    };
}

export function resolveHauntRoll(
    core: BetrayalCore,
    deckKind: BetrayalDeckKind,
    random: RandomFn,
): BetrayalHauntRollResult | null {
    if (core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered || deckKind !== 'omen') {
        return null;
    }
    const threshold = core.scenarioRuntime.hauntRollThreshold;
    const hauntRisk = resolveBetrayalHauntRisk(core, { additionalOmenCount: 1 });
    if (hauntRisk.nextOmenAutomatic) {
        return {
            dice: [],
            total: threshold,
            threshold,
            triggered: true,
            automatic: true,
        };
    }
    const dice = rollBetrayalDicePips(random, hauntRisk.nextRollDiceCount);
    const total = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        dice,
        total,
        threshold,
        triggered: total >= threshold,
        automatic: false,
    };
}

export function formatHauntRollDiscoveryDetail(hauntRoll: BetrayalHauntRollResult): string {
    if (hauntRoll.automatic) {
        return '预兆牌堆耗尽，自动触发作祟';
    }
    return `抽到预兆后进行作祟检定：总点数 ${hauntRoll.total}（${hauntRoll.dice.length} 颗骰子，${hauntRoll.triggered ? '已触发' : '未触发'}）`;
}

export function buildHauntRollThresholds(hauntRoll: BetrayalHauntRollResult): { min: number; label: string; effect: UseEffectProfile }[] {
    return [
        {
            min: hauntRoll.threshold,
            label: '作祟开始',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        },
        {
            min: 0,
            label: '未触发作祟',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        },
    ];
}

function clampBetrayalNumberTrackProgress(value: number, min: number, max: number): number {
    if (max <= min) {
        return value >= max ? 100 : 0;
    }
    const progress = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, Math.round(progress)));
}

function resolveBetrayalHauntRiskNumberTrack(core: BetrayalCore): BetrayalNumberTrackStatus {
    const risk = resolveBetrayalHauntRisk(core);
    const maxOmenCount = BETRAYAL_INITIAL_DECK_COUNTS.omen;
    const progressPercent = clampBetrayalNumberTrackProgress(risk.omenCount, 0, maxOmenCount);
    return {
        id: 'haunt-risk',
        kind: 'haunt-risk',
        label: '预兆状态',
        labelKey: 'board.status.hauntRiskLabel',
        value: risk.omenCount,
        min: 0,
        max: maxOmenCount,
        targetValue: maxOmenCount,
        currentLabel: `预兆 ${risk.omenCount}`,
        targetLabel: '牌堆末张',
        statusLabel: risk.hauntStarted
            ? '作祟已开始'
            : risk.nextOmenAutomatic
                ? '再抽预兆即作祟'
                : '预兆已发现',
        progressPercent,
        source: 'base-rule',
        representativeOnly: false,
    };
}

export function resolveBetrayalNumberTracks(core: BetrayalCore): BetrayalNumberTrackStatus[] {
    const tracks: BetrayalNumberTrackStatus[] = [
        resolveBetrayalHauntRiskNumberTrack(core),
    ];
    if (core.phase !== 'haunt' || !core.scenarioRuntime.hauntTriggered) {
        return tracks;
    }
    if (core.scenarioRuntime.hauntCardNumber === 1 && core.scenarioRuntime.mummy) {
        const value = core.scenarioRuntime.mummy.knowledgeTokenCount;
        tracks.push({
            id: 'mummy-knowledge-tokens',
            kind: 'haunt-objective',
            label: '知识标记',
            labelKey: 'board.status.mummyKnowledgeTokensLabel',
            value,
            min: 0,
            max: 2,
            targetValue: 2,
            currentLabel: `${value}/2`,
            targetLabel: '2 枚知识标记',
            statusLabel: value >= 2
                ? '驱逐法术已就绪'
                : value >= 1
                    ? '继续学习驱逐法术'
                    : '寻找木乃伊真名',
            progressPercent: clampBetrayalNumberTrackProgress(value, 0, 2),
            source: 'haunt-contract',
            representativeOnly: true,
        });
    } else if (core.scenarioRuntime.hauntCardNumber === 1) {
        const value = core.scenarioRuntime.exorcismCircleRoomIds.length;
        tracks.push({
            id: 'crimson-jack-exorcism-circles',
            kind: 'haunt-objective',
            label: '驱魔圈',
            labelKey: 'board.status.exorcismCirclesLabel',
            value,
            min: 0,
            max: 2,
            targetValue: 2,
            currentLabel: `${value}/2`,
            targetLabel: '2 个驱魔圈',
            statusLabel: value >= 2 ? '驱魔圈已就绪' : '继续研究驱魔',
            progressPercent: clampBetrayalNumberTrackProgress(value, 0, 2),
            source: 'haunt-contract',
            representativeOnly: true,
        });
    }
    if (core.scenarioRuntime.hauntCardNumber === 3 && core.scenarioRuntime.dust) {
        const value = core.scenarioRuntime.dust.researchRoomIds.length;
        tracks.push({
            id: 'dust-research-tokens',
            kind: 'haunt-objective',
            label: '研究 token',
            labelKey: 'board.status.dustResearchTokensLabel',
            value,
            min: 0,
            max: 8,
            targetValue: 8,
            currentLabel: `${value}/8`,
            targetLabel: '治愈检定加值',
            statusLabel: `治愈检定 +${value * 2}`,
            progressPercent: clampBetrayalNumberTrackProgress(value, 0, 8),
            source: 'haunt-contract',
            representativeOnly: true,
        });
    }
    if (core.scenarioRuntime.hauntCardNumber === 33 && core.scenarioRuntime.magicCamera) {
        const magicCamera = core.scenarioRuntime.magicCamera;
        const photographerCount = magicCamera.phantomPhotographerIds.length;
        const killedPhotographerCount = magicCamera.killedPhantomPhotographerIds.length;
        tracks.push({
            id: 'magic-camera-hero-objective',
            kind: 'haunt-objective',
            label: '英雄目标',
            labelKey: 'board.status.magicCameraHeroObjectiveLabel',
            value: killedPhotographerCount + (magicCamera.cameraDestroyed ? 1 : 0),
            min: 0,
            max: photographerCount + 1,
            targetValue: photographerCount + 1,
            currentLabel: `${killedPhotographerCount}/${photographerCount}`,
            targetLabel: '摄影师全灭 + 相机摧毁',
            statusLabel: magicCamera.cameraDestroyed
                ? '相机已摧毁'
                : '相机未摧毁',
            progressPercent: clampBetrayalNumberTrackProgress(
                killedPhotographerCount + (magicCamera.cameraDestroyed ? 1 : 0),
                0,
                photographerCount + 1,
            ),
            source: 'haunt-contract',
            representativeOnly: true,
        });
        const capturedEssenceCount = magicCamera.capturedEssencePlayerIds.length;
        const totalEssenceCount = magicCamera.heroEssencePlayerIds.length + capturedEssenceCount;
        tracks.push({
            id: 'magic-camera-essence-captured',
            kind: 'haunt-resource',
            label: 'Essence',
            labelKey: 'board.status.magicCameraEssenceLabel',
            value: capturedEssenceCount,
            min: 0,
            max: totalEssenceCount,
            targetValue: totalEssenceCount,
            currentLabel: `${capturedEssenceCount}/${totalEssenceCount}`,
            targetLabel: '英雄 Essence',
            statusLabel: capturedEssenceCount > 0 ? '叛徒已夺取 Essence' : 'Essence 仍在英雄手上',
            progressPercent: clampBetrayalNumberTrackProgress(capturedEssenceCount, 0, totalEssenceCount),
            source: 'haunt-contract',
            representativeOnly: true,
        });
    }
    return tracks;
}
