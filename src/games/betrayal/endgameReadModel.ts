import { getAllExplorers } from './explorerReadModel';
import type {
    BetrayalCore,
    BetrayalEndgameResult,
    BetrayalPhase,
} from './game';
import type { BetrayalScenarioOutcome } from './scenarioConfig';

export type BetrayalEndgameTextStatus = 'inactive' | 'representative-only' | 'available' | 'missing-contract';
export type BetrayalEndgamePolicyStatus = 'inactive' | 'missing-contract' | 'scenario-specific';

export interface BetrayalEndgameReadModel {
    active: boolean;
    phase: BetrayalPhase;
    hauntId: BetrayalEndgameResult['hauntId'] | null;
    hauntTitle: string | null;
    outcome: BetrayalScenarioOutcome | null;
    winningSideLabel: string | null;
    winnerPlayerIds: string[];
    winnerNames: string[];
    traitorPlayerId: string | null;
    ifYouWinTextId: string | null;
    ifYouWinTextStatus: BetrayalEndgameTextStatus;
    ifYouWinTextAvailable: boolean;
    needsIfYouWinTextSource: boolean;
    simultaneousCompletionPolicyStatus: BetrayalEndgamePolicyStatus;
    tiePolicyStatus: BetrayalEndgamePolicyStatus;
    representativeOnly: boolean;
    ruleNotes: string[];
}

function formatBetrayalOutcomeLabel(outcome: BetrayalScenarioOutcome): string {
    switch (outcome) {
        case 'survivors':
            return '英雄';
        case 'traitor':
            return '叛徒';
        case 'solo':
            return '单人赢家';
        case 'haunt':
            return '作祟';
        default:
            return outcome;
    }
}

function isBetrayalIfYouWinTextAvailable(result: BetrayalEndgameResult): boolean {
    return (result.hauntId === 'the-dust' || result.hauntId === 'mummy-rampage') && (
        result.outcome === 'survivors' || result.outcome === 'traitor'
    );
}

function formatBetrayalIfYouWinSourceNote(result: BetrayalEndgameResult, available: boolean): string {
    if (!available) {
        return 'If You Win 原文尚未接入；当前只暴露可追踪的胜利文本合同 id。';
    }
    if (result.hauntId === 'mummy-rampage') {
        return '木乃伊 If You Win 胜利文本已接入。';
    }
    if (result.hauntId === 'the-dust') {
        return '灰尘 If You Win 胜利文本已接入。';
    }
    return 'If You Win 原文已接入。';
}

export function resolveBetrayalEndgameReadModel(core: BetrayalCore): BetrayalEndgameReadModel {
    const result = core.endgameResult;
    if (core.phase !== 'endgame' || !result) {
        return {
            active: false,
            phase: core.phase,
            hauntId: null,
            hauntTitle: null,
            outcome: null,
            winningSideLabel: null,
            winnerPlayerIds: [],
            winnerNames: [],
            traitorPlayerId: null,
            ifYouWinTextId: null,
            ifYouWinTextStatus: 'inactive',
            ifYouWinTextAvailable: false,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'inactive',
            tiePolicyStatus: 'inactive',
            representativeOnly: false,
            ruleNotes: [
                '当前还没有进入终局，不应展示 If You Win 胜利文本。',
            ],
        };
    }

    const explorers = getAllExplorers(core);
    const winnerNames = result.winners.map((playerId) => (
        explorers.find((explorer) => explorer.playerId === playerId)?.displayName ?? playerId
    ));
    const hasDustSpecificEndgamePolicy = result.hauntId === 'the-dust';
    const hasIfYouWinText = isBetrayalIfYouWinTextAvailable(result);
    return {
        active: true,
        phase: core.phase,
        hauntId: result.hauntId,
        hauntTitle: result.hauntTitle,
        outcome: result.outcome,
        winningSideLabel: formatBetrayalOutcomeLabel(result.outcome),
        winnerPlayerIds: [...result.winners],
        winnerNames,
        traitorPlayerId: result.traitorPlayerId || null,
        ifYouWinTextId: `${result.hauntId}.${result.outcome}.if-you-win`,
        ifYouWinTextStatus: hasIfYouWinText ? 'available' : 'representative-only',
        ifYouWinTextAvailable: hasIfYouWinText,
        needsIfYouWinTextSource: !hasIfYouWinText,
        simultaneousCompletionPolicyStatus: hasDustSpecificEndgamePolicy ? 'scenario-specific' : 'missing-contract',
        tiePolicyStatus: hasDustSpecificEndgamePolicy ? 'scenario-specific' : 'missing-contract',
        representativeOnly: true,
        ruleNotes: [
            '终局结果已记录胜方和获胜玩家。',
            formatBetrayalIfYouWinSourceNote(result, hasIfYouWinText),
            hasDustSpecificEndgamePolicy
                ? '灰尘按当前完成的结算事件收口：治愈成功立即英雄胜利；全员感染或死亡只在交换、伤害或死亡事件结算后触发叛徒胜利。'
                : '同时达成、平局或共享胜利处理仍需逐作祟合同接入。',
            '当前只证明代表作祟终局读模型，不代表 50 个作祟终局全部完成。',
        ],
    };
}
