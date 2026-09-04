import type {
    BetrayalCore,
    BetrayalHauntType,
} from './game';
import { findExplorerByPlayerId } from './explorerReadModel';
import { resolveBloodFromStoneSetupPlacementPlan } from './bloodFromStoneSetupReadModel';
import {
    resolveBetrayalHauntRevealResolution,
    type BetrayalHauntRevealResolution,
} from './scenarioConfig';
import {
    findMagicCameraHolderPlayerId,
    findStrangeAmuletHolder,
    HELPING_HANDS_STRANGE_AMULET_EFFECT_ID,
} from './hauntScenarioReadModel';

export type BetrayalHauntRevealPublicStepId =
    | 'heroes-intro'
    | 'heroes-setup'
    | 'traitor-intro'
    | 'traitor-setup';

export interface BetrayalHauntRevealPublicStep {
    id: BetrayalHauntRevealPublicStepId;
    side: 'heroes' | 'traitor';
    kind: 'intro' | 'setup';
}

export type BetrayalHauntSetupQueueEntryId =
    | 'assign-revealer-traitor'
    | 'traitor-remains-in-game'
    | 'heal-and-boost-traitor'
    | 'prepare-jack-spirit-tokens'
    | 'place-mummy-and-sarcophagus'
    | 'place-girl-token'
    | 'prepare-mummy-knowledge-tokens'
    | 'monster-card-left-of-traitor'
    | 'first-player-left-of-traitor'
    | 'announce-hidden-traitor'
    | 'deal-secret-sickness-tokens'
    | 'recover-strange-amulet'
    | 'place-troll-hands'
    | 'monster-card-left-of-revealer'
    | 'prepare-research-tokens'
    | 'first-player-left-of-revealer'
    | 'mirror-revealer-falls-silent'
    | 'deal-secret-mirror-combination'
    | 'place-mirror-beings'
    | 'place-phantom-photographers'
    | 'recover-magic-camera'
    | 'deal-hero-essence-tokens'
    | 'announce-no-traitor'
    | 'place-stone-cherubs-on-explorers'
    | 'place-additional-stone-cherubs';

export type BetrayalHauntSetupQueueEntryStatus =
    | 'resolved'
    | 'manual-check';

export interface BetrayalHauntSetupQueueEntry {
    id: BetrayalHauntSetupQueueEntryId;
    side: 'all' | 'heroes' | 'traitor';
    status: BetrayalHauntSetupQueueEntryStatus;
}

export type BetrayalHauntSetupProgressStatus =
    | 'inactive'
    | 'resolved'
    | 'manual-check-required';

export interface BetrayalHauntSetupProgressSummary {
    active: boolean;
    hauntCardNumber: number | null;
    status: BetrayalHauntSetupProgressStatus;
    entries: BetrayalHauntSetupQueueEntry[];
    totalCount: number;
    resolvedCount: number;
    manualCheckCount: number;
    manualCheckEntryIds: BetrayalHauntSetupQueueEntryId[];
    needsFormalConfirmationCommand: boolean;
    representativeOnly: boolean;
    ruleNotes: string[];
}

export type BetrayalHauntSetupCommandPreviewStatus =
    | 'inactive'
    | 'ready'
    | 'manual-check-required'
    | 'unknown-haunt';

export type BetrayalHauntSetupCommandPreviewAction =
    | 'assign-traitor'
    | 'confirm-state'
    | 'assign-first-player'
    | 'announce-hidden-role'
    | 'deal-secret-tokens'
    | 'recover-card'
    | 'place-monster-tokens'
    | 'prepare-token-pool'
    | 'confirm-reference-placement';

export type BetrayalHauntSetupCommandPreviewGap =
    | 'formal-command'
    | 'ui-confirmation'
    | 'reference-card-ui'
    | 'token-placement-command'
    | 'room-selection'
    | 'secret-visibility'
    | 'communication-limitation'
    | 'full-haunt-definition';

export interface BetrayalHauntSetupCommandPreview {
    entryId: BetrayalHauntSetupQueueEntryId;
    side: BetrayalHauntSetupQueueEntry['side'];
    queueStatus: BetrayalHauntSetupQueueEntryStatus;
    action: BetrayalHauntSetupCommandPreviewAction;
    label: string;
    targetPlayerIds: string[];
    targetRoomIds: string[];
    targetCardIds: string[];
    targetMonsterIds: string[];
    targetLabels: string[];
    alreadyApplied: boolean;
    canConfirmFromCurrentState: boolean;
    requiresManualConfirmation: boolean;
    evidence: string[];
    contractGaps: BetrayalHauntSetupCommandPreviewGap[];
    previewOnly: true;
}

export interface BetrayalHauntSetupCommandPreviewSummary {
    active: boolean;
    hauntCardNumber: number | null;
    status: BetrayalHauntSetupCommandPreviewStatus;
    previews: BetrayalHauntSetupCommandPreview[];
    readyCount: number;
    manualCheckCount: number;
    manualCheckEntryIds: BetrayalHauntSetupQueueEntryId[];
    needsFormalConfirmationCommand: boolean;
    representativeOnly: boolean;
    ruleNotes: string[];
}

export interface BetrayalHauntSecretBoundary {
    heroBookVisibleTo: 'heroes' | 'all';
    traitorBookVisibleTo: 'traitor' | 'none';
    revealOnUse: boolean;
}

export interface BetrayalHauntRevealProtocol {
    active: boolean;
    hauntCardNumber: number | null;
    hauntType: BetrayalHauntType;
    publicSteps: BetrayalHauntRevealPublicStep[];
    setupQueue: BetrayalHauntSetupQueueEntry[];
    secretBoundary: BetrayalHauntSecretBoundary;
}

export function resolveHauntRevealResolutionForTrigger(
    core: BetrayalCore,
    triggeringCard: { id?: string | null; name?: string | null } | null | undefined,
    hauntCardNumberOverride?: number,
): BetrayalHauntRevealResolution {
    return resolveBetrayalHauntRevealResolution({
        scenarioCardId: core.proposedScenarioCardId,
        triggeringOmen: triggeringCard,
        hauntCardNumberOverride,
    });
}

const SUPPORTED_SETUP_PREVIEW_HAUNT_CARD_NUMBERS = [1, 3, 5, 7, 12, 33];

const BETRAYAL_HERO_PUBLIC_HAUNT_STEPS: BetrayalHauntRevealPublicStep[] = [
    { id: 'heroes-intro', side: 'heroes', kind: 'intro' },
    { id: 'heroes-setup', side: 'heroes', kind: 'setup' },
];

const BETRAYAL_TRAITOR_PUBLIC_HAUNT_STEPS: BetrayalHauntRevealPublicStep[] = [
    { id: 'traitor-intro', side: 'traitor', kind: 'intro' },
    { id: 'traitor-setup', side: 'traitor', kind: 'setup' },
];

const CRIMSON_JACK_HAUNT_SETUP_QUEUE: BetrayalHauntSetupQueueEntry[] = [
    { id: 'assign-revealer-traitor', side: 'all', status: 'resolved' },
    { id: 'traitor-remains-in-game', side: 'all', status: 'resolved' },
    { id: 'heal-and-boost-traitor', side: 'traitor', status: 'resolved' },
    { id: 'monster-card-left-of-traitor', side: 'all', status: 'manual-check' },
    { id: 'prepare-jack-spirit-tokens', side: 'all', status: 'manual-check' },
    { id: 'first-player-left-of-traitor', side: 'all', status: 'resolved' },
];

const MUMMY_HAUNT_SETUP_QUEUE: BetrayalHauntSetupQueueEntry[] = [
    { id: 'assign-revealer-traitor', side: 'all', status: 'resolved' },
    { id: 'traitor-remains-in-game', side: 'all', status: 'resolved' },
    { id: 'place-mummy-and-sarcophagus', side: 'all', status: 'resolved' },
    { id: 'place-girl-token', side: 'all', status: 'resolved' },
    { id: 'prepare-mummy-knowledge-tokens', side: 'heroes', status: 'manual-check' },
    { id: 'monster-card-left-of-traitor', side: 'all', status: 'manual-check' },
    { id: 'first-player-left-of-traitor', side: 'all', status: 'resolved' },
];

const DUST_HAUNT_SETUP_QUEUE: BetrayalHauntSetupQueueEntry[] = [
    { id: 'announce-hidden-traitor', side: 'all', status: 'resolved' },
    { id: 'deal-secret-sickness-tokens', side: 'all', status: 'resolved' },
    { id: 'monster-card-left-of-revealer', side: 'all', status: 'manual-check' },
    { id: 'first-player-left-of-revealer', side: 'all', status: 'resolved' },
    { id: 'prepare-research-tokens', side: 'all', status: 'manual-check' },
];

const HELPING_HANDS_HAUNT_SETUP_QUEUE: BetrayalHauntSetupQueueEntry[] = [
    { id: 'recover-strange-amulet', side: 'all', status: 'resolved' },
    { id: 'monster-card-left-of-revealer', side: 'all', status: 'manual-check' },
    { id: 'place-troll-hands', side: 'all', status: 'resolved' },
    { id: 'first-player-left-of-revealer', side: 'all', status: 'resolved' },
];

const UPON_REFLECTION_HAUNT_SETUP_QUEUE: BetrayalHauntSetupQueueEntry[] = [
    { id: 'announce-no-traitor', side: 'all', status: 'resolved' },
    { id: 'mirror-revealer-falls-silent', side: 'all', status: 'manual-check' },
    { id: 'deal-secret-mirror-combination', side: 'all', status: 'manual-check' },
    { id: 'place-mirror-beings', side: 'all', status: 'resolved' },
    { id: 'monster-card-left-of-revealer', side: 'all', status: 'manual-check' },
    { id: 'first-player-left-of-revealer', side: 'all', status: 'resolved' },
];

const MAGIC_CAMERA_HAUNT_SETUP_QUEUE: BetrayalHauntSetupQueueEntry[] = [
    { id: 'traitor-remains-in-game', side: 'all', status: 'resolved' },
    { id: 'place-phantom-photographers', side: 'traitor', status: 'resolved' },
    { id: 'recover-magic-camera', side: 'traitor', status: 'resolved' },
    { id: 'deal-hero-essence-tokens', side: 'heroes', status: 'resolved' },
    { id: 'first-player-left-of-traitor', side: 'all', status: 'resolved' },
];

function createBloodFromStoneHauntSetupQueue(core: BetrayalCore): BetrayalHauntSetupQueueEntry[] {
    const plan = resolveBloodFromStoneSetupPlacementPlan(core);
    return [
        { id: 'announce-no-traitor', side: 'all', status: 'resolved' },
        { id: 'place-stone-cherubs-on-explorers', side: 'all', status: 'resolved' },
        {
            id: 'place-additional-stone-cherubs',
            side: 'all',
            status: plan.pendingPlayerChoiceCount > 0 ? 'manual-check' : 'resolved',
        },
        { id: 'monster-card-left-of-revealer', side: 'all', status: 'manual-check' },
        { id: 'first-player-left-of-revealer', side: 'all', status: 'resolved' },
    ];
}

function cloneHauntSetupQueue(queue: BetrayalHauntSetupQueueEntry[]): BetrayalHauntSetupQueueEntry[] {
    return queue.map((entry) => ({ ...entry }));
}

function isSupportedSetupPreviewHauntCardNumber(hauntCardNumber: number | null | undefined): boolean {
    return SUPPORTED_SETUP_PREVIEW_HAUNT_CARD_NUMBERS.includes(hauntCardNumber ?? -1);
}

export function resolveHauntSetupQueueWithEntryStatus(
    core: BetrayalCore,
    entryId: BetrayalHauntSetupQueueEntryId,
    status: BetrayalHauntSetupQueueEntryStatus,
): BetrayalHauntSetupQueueEntry[] {
    const existingQueue = core.scenarioRuntime.hauntSetupQueue.length > 0
        ? core.scenarioRuntime.hauntSetupQueue
        : resolveBetrayalHauntSetupQueue(core);
    return existingQueue.map((entry) => (
        entry.id === entryId ? { ...entry, status } : { ...entry }
    ));
}

export function resolveBetrayalHauntSetupQueue(core: BetrayalCore): BetrayalHauntSetupQueueEntry[] {
    if (core.phase !== 'haunt' || !core.scenarioRuntime.hauntTriggered) {
        return [];
    }
    const existingQueue = core.scenarioRuntime.hauntSetupQueue ?? [];
    if (existingQueue.length > 0) {
        return cloneHauntSetupQueue(existingQueue);
    }
    switch (core.scenarioRuntime.hauntCardNumber) {
        case 1:
            return cloneHauntSetupQueue(
                core.scenarioRuntime.hauntScenarioCardId === 'mummy-rampage'
                    ? MUMMY_HAUNT_SETUP_QUEUE
                    : CRIMSON_JACK_HAUNT_SETUP_QUEUE,
            );
        case 3:
            return cloneHauntSetupQueue(DUST_HAUNT_SETUP_QUEUE);
        case 5:
            return cloneHauntSetupQueue(createBloodFromStoneHauntSetupQueue(core));
        case 7:
            return cloneHauntSetupQueue(UPON_REFLECTION_HAUNT_SETUP_QUEUE);
        case 12:
            return cloneHauntSetupQueue(HELPING_HANDS_HAUNT_SETUP_QUEUE);
        case 33:
            return cloneHauntSetupQueue(MAGIC_CAMERA_HAUNT_SETUP_QUEUE);
        default:
            return [];
    }
}

export function resolveBetrayalHauntSetupProgress(core: BetrayalCore): BetrayalHauntSetupProgressSummary {
    const active = core.phase === 'haunt' && core.scenarioRuntime.hauntTriggered;
    const entries = active ? resolveBetrayalHauntSetupQueue(core) : [];
    const resolvedEntries = entries.filter((entry) => entry.status === 'resolved');
    const manualCheckEntries = entries.filter((entry) => entry.status === 'manual-check');
    return {
        active,
        hauntCardNumber: active ? core.scenarioRuntime.hauntCardNumber : null,
        status: !active
            ? 'inactive'
            : manualCheckEntries.length > 0
                ? 'manual-check-required'
                : 'resolved',
        entries,
        totalCount: entries.length,
        resolvedCount: resolvedEntries.length,
        manualCheckCount: manualCheckEntries.length,
        manualCheckEntryIds: manualCheckEntries.map((entry) => entry.id),
        needsFormalConfirmationCommand: active && manualCheckEntries.length > 0,
        representativeOnly: active && (
            core.scenarioRuntime.hauntResolutionRepresentativeOnly
            || !isSupportedSetupPreviewHauntCardNumber(core.scenarioRuntime.hauntCardNumber)
        ),
        ruleNotes: active
            ? [
                'setup 进度读模型只汇总当前队列状态，不执行 setup。',
                'manual-check 表示仍缺正式确认命令、UI 承接或逐作祟自动放置实现。',
            ]
            : ['作祟尚未开始，没有 setup 队列。'],
    };
}

function uniqueBetrayalStrings(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function formatBetrayalPlayerTargetLabel(core: BetrayalCore, playerId: string): string {
    const explorer = findExplorerByPlayerId(core, playerId);
    return explorer ? `${explorer.displayName}（玩家${playerId}）` : `玩家${playerId}`;
}

function formatBetrayalRoomTargetLabel(core: BetrayalCore, roomId: string): string {
    const room = core.rooms.find((candidate) => candidate.id === roomId);
    return room ? `${room.name}（${roomId}）` : roomId;
}

function formatBetrayalMonsterTargetLabel(core: BetrayalCore, monsterId: string): string {
    const monster = core.monsters.find((candidate) => candidate.id === monsterId);
    return monster ? `${monster.name}（${monsterId}）` : monsterId;
}

function createBetrayalHauntSetupCommandPreview(
    core: BetrayalCore,
    entry: BetrayalHauntSetupQueueEntry,
): BetrayalHauntSetupCommandPreview {
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
    const revealerPlayerId = core.scenarioRuntime.hauntRevealerPlayerId;
    const firstPlayerId = core.scenarioRuntime.nextHauntPlayerId
        ?? core.scenarioRuntime.hauntFirstPlayerResolution?.nextPlayerId
        ?? null;
    const hasFormalSetupConfirmation =
        core.scenarioRuntime.hauntCardNumber === 3
        && (
            entry.id === 'monster-card-left-of-revealer'
            || entry.id === 'prepare-research-tokens'
        );
    const baseGaps: BetrayalHauntSetupCommandPreviewGap[] =
        hasFormalSetupConfirmation ? [] : ['formal-command', 'ui-confirmation'];
    let action: BetrayalHauntSetupCommandPreviewAction = 'confirm-state';
    let label = entry.id;
    let targetPlayerIds: string[] = [];
    let targetRoomIds: string[] = [];
    let targetCardIds: string[] = [];
    let targetMonsterIds: string[] = [];
    let targetLabels: string[] = [];
    let evidence: string[] = [];
    let extraGaps: BetrayalHauntSetupCommandPreviewGap[] = [];

    switch (entry.id) {
        case 'assign-revealer-traitor':
            action = 'assign-traitor';
            label = '确认作祟揭秘者成为叛徒';
            targetPlayerIds = uniqueBetrayalStrings([traitorPlayerId ?? revealerPlayerId]);
            evidence = traitorPlayerId
                ? [`${formatBetrayalPlayerTargetLabel(core, traitorPlayerId)}已写入叛徒状态。`]
                : ['当前没有公开叛徒玩家。'];
            break;
        case 'traitor-remains-in-game':
            action = 'confirm-state';
            label = '确认叛徒仍留在游戏中';
            targetPlayerIds = uniqueBetrayalStrings([traitorPlayerId]);
            evidence = traitorPlayerId
                ? [`${formatBetrayalPlayerTargetLabel(core, traitorPlayerId)}仍是存活探索者。`]
                : ['当前作祟没有公开叛徒。'];
            break;
        case 'heal-and-boost-traitor':
            action = 'confirm-state';
            label = '确认叛徒治疗和强化已应用';
            targetPlayerIds = uniqueBetrayalStrings([traitorPlayerId]);
            evidence = traitorPlayerId
                ? [`${formatBetrayalPlayerTargetLabel(core, traitorPlayerId)}的作祟强化由当前属性轨状态承接。`]
                : ['没有可确认的公开叛徒强化目标。'];
            break;
        case 'announce-no-traitor':
            action = 'confirm-state';
            label = '公开确认本作祟没有叛徒';
            evidence = ['顽石之血是合作作祟，当前运行态没有叛徒玩家。'];
            break;
        case 'place-stone-cherubs-on-explorers': {
            action = 'place-monster-tokens';
            label = '每名探索者所在房间各放 1 个石像小天使';
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            targetPlayerIds = plan.explorerPlacements
                .map((placement) => placement.playerId)
                .filter((playerId): playerId is string => Boolean(playerId));
            targetRoomIds = plan.explorerPlacements.map((placement) => placement.roomId);
            targetMonsterIds = plan.explorerPlacements.map((placement) => placement.monsterId);
            evidence = plan.explorerPlacements.length > 0
                ? [`已按探索者位置放置 ${plan.explorerPlacements.length} 个石像小天使。`]
                : ['尚未能从当前探索者位置派生石像小天使放置。'];
            extraGaps = ['token-placement-command'];
            break;
        }
        case 'place-additional-stone-cherubs': {
            action = 'place-monster-tokens';
            label = '额外石像小天使优先放在英雄视线外';
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            targetRoomIds = plan.automaticExtraPlacements.map((placement) => placement.roomId);
            targetMonsterIds = plan.automaticExtraPlacements.map((placement) => placement.monsterId);
            evidence = [
                `按玩家数需要额外 ${plan.additionalStoneCherubCount} 个石像小天使。`,
                plan.automaticExtraPlacements.length > 0
                    ? `已自动放到视线外房间：${targetRoomIds.map((roomId) => formatBetrayalRoomTargetLabel(core, roomId)).join('、')}。`
                    : '当前没有足够的视线外房间可自动放置。',
                plan.pendingPlayerChoiceCount > 0
                    ? `还剩 ${plan.pendingPlayerChoiceCount} 个必须由玩家在屋内合法房间中选择放置。`
                    : '额外石像小天使均已满足视线外优先放置。',
            ];
            extraGaps = plan.pendingPlayerChoiceCount > 0
                ? ['token-placement-command', 'room-selection']
                : ['token-placement-command'];
            break;
        }
        case 'place-mummy-and-sarcophagus': {
            action = 'place-monster-tokens';
            label = '放置木乃伊和石棺';
            const mummy = core.scenarioRuntime.mummy;
            if (mummy) {
                targetRoomIds = [mummy.sarcophagusRoomId];
                targetMonsterIds = [mummy.mummyMonsterId];
                evidence = [
                    `木乃伊和石棺已放在${formatBetrayalRoomTargetLabel(core, mummy.sarcophagusRoomId)}。`,
                ];
            } else {
                evidence = ['木乃伊 setup 状态尚未写入。'];
            }
            extraGaps = ['token-placement-command'];
            break;
        }
        case 'place-girl-token': {
            action = 'place-monster-tokens';
            label = '放置女孩标记';
            const mummy = core.scenarioRuntime.mummy;
            targetRoomIds = uniqueBetrayalStrings([mummy?.girlRoomId]);
            evidence = mummy?.girlRoomId
                ? [`女孩标记已放在${formatBetrayalRoomTargetLabel(core, mummy.girlRoomId)}。`]
                : ['当前没有可放置女孩标记的已发现房间，需人工确认。'];
            extraGaps = ['token-placement-command', 'room-selection'];
            break;
        }
        case 'prepare-mummy-knowledge-tokens':
            action = 'prepare-token-pool';
            label = '准备 2 枚知识标记';
            evidence = [
                `当前英雄已取得 ${core.scenarioRuntime.mummy?.knowledgeTokenCount ?? 0}/2 枚知识标记。`,
            ];
            extraGaps = ['token-placement-command'];
            break;
        case 'prepare-jack-spirit-tokens':
            action = 'prepare-token-pool';
            label = '准备杰克之灵和驱魔相关 token';
            targetRoomIds = [...core.scenarioRuntime.exorcismCircleRoomIds];
            evidence = targetRoomIds.length > 0
                ? [`已放置驱魔圈：${targetRoomIds.map((roomId) => formatBetrayalRoomTargetLabel(core, roomId)).join('、')}。`]
                : ['驱魔圈和杰克之灵 token 仍需 setup 确认。'];
            extraGaps = ['token-placement-command', 'room-selection'];
            break;
        case 'monster-card-left-of-traitor':
            action = 'confirm-reference-placement';
            label = '把怪物参考卡放在叛徒左侧';
            targetPlayerIds = uniqueBetrayalStrings([traitorPlayerId]);
            evidence = targetPlayerIds.length > 0
                ? [`参考卡锚点：${targetPlayerIds.map((playerId) => formatBetrayalPlayerTargetLabel(core, playerId)).join('、')}。`]
                : ['没有可用于摆放怪物参考卡的公开叛徒锚点。'];
            extraGaps = ['reference-card-ui'];
            break;
        case 'monster-card-left-of-revealer':
            action = 'confirm-reference-placement';
            label = '把怪物参考卡放在作祟揭秘者左侧';
            targetPlayerIds = uniqueBetrayalStrings([revealerPlayerId]);
            evidence = targetPlayerIds.length > 0
                ? [`参考卡锚点：${targetPlayerIds.map((playerId) => formatBetrayalPlayerTargetLabel(core, playerId)).join('、')}。`]
                : ['没有可用于摆放怪物参考卡的揭秘者锚点。'];
            extraGaps = ['reference-card-ui'];
            break;
        case 'first-player-left-of-traitor':
            action = 'assign-first-player';
            label = '确认叛徒左侧玩家先行动';
            targetPlayerIds = uniqueBetrayalStrings([firstPlayerId]);
            evidence = firstPlayerId
                ? [`作祟首玩家已解析为${formatBetrayalPlayerTargetLabel(core, firstPlayerId)}。`]
                : ['作祟首玩家仍未写入运行态。'];
            break;
        case 'first-player-left-of-revealer':
            action = 'assign-first-player';
            label = '确认作祟揭秘者左侧玩家先行动';
            targetPlayerIds = uniqueBetrayalStrings([firstPlayerId]);
            evidence = firstPlayerId
                ? [`作祟首玩家已解析为${formatBetrayalPlayerTargetLabel(core, firstPlayerId)}。`]
                : ['作祟首玩家仍未写入运行态。'];
            break;
        case 'announce-hidden-traitor':
            action = 'announce-hidden-role';
            label = '公开说明本局存在隐藏叛徒';
            evidence = ['隐藏叛徒身份不进公开叛徒书入口，只保留各自秘密信息边界。'];
            extraGaps = ['secret-visibility'];
            break;
        case 'deal-secret-sickness-tokens': {
            action = 'deal-secret-tokens';
            label = '秘密分发疾病 token';
            const sicknessByPlayerId = core.scenarioRuntime.dust?.sicknessTokensByPlayerId ?? {};
            targetPlayerIds = core.playerIds.filter((playerId) => (sicknessByPlayerId[playerId]?.length ?? 0) > 0);
            evidence = targetPlayerIds.length > 0
                ? [`已给 ${targetPlayerIds.length} 名玩家各自分发隐藏疾病 token。`]
                : ['疾病 token 尚未分发到玩家。'];
            extraGaps = ['secret-visibility'];
            break;
        }
        case 'prepare-research-tokens': {
            action = 'prepare-token-pool';
            label = '准备研究 token 池';
            targetRoomIds = [...(core.scenarioRuntime.dust?.researchRoomIds ?? [])];
            evidence = targetRoomIds.length > 0
                ? [`已放置研究 token：${targetRoomIds.map((roomId) => formatBetrayalRoomTargetLabel(core, roomId)).join('、')}。`]
                : ['研究 token 池仍需 setup 确认，后续由寻找解药行动放置到对应房间。'];
            extraGaps = ['token-placement-command', 'room-selection'];
            break;
        }
        case 'mirror-revealer-falls-silent':
            action = 'confirm-state';
            label = '确认作祟揭秘者倒伏并保持镜中沉默';
            targetPlayerIds = uniqueBetrayalStrings([revealerPlayerId]);
            evidence = revealerPlayerId
                ? [`作祟揭秘者：${formatBetrayalPlayerTargetLabel(core, revealerPlayerId)}。`]
                : ['作祟揭秘者仍未写入运行态。'];
            extraGaps = ['communication-limitation', 'ui-confirmation'];
            break;
        case 'deal-secret-mirror-combination':
            action = 'deal-secret-tokens';
            label = '秘密记录 Trait / Omen / Room 组合';
            targetPlayerIds = uniqueBetrayalStrings([revealerPlayerId]);
            if (core.scenarioRuntime.uponReflection?.secretCombination) {
                evidence = ['秘密组合已写入作祟揭秘者私密状态。'];
                extraGaps = ['secret-visibility'];
            } else {
                evidence = ['正确属性、预兆和房间组合仍需私密状态与可见性接入。'];
                extraGaps = ['secret-visibility', 'full-haunt-definition'];
            }
            break;
        case 'place-mirror-beings': {
            action = 'place-monster-tokens';
            label = '在入口大厅放置镜中怪物';
            targetMonsterIds = core.monsters
                .filter((monster) => monster.definitionId === 'upon-reflection-mirror-being')
                .map((monster) => monster.id);
            targetRoomIds = uniqueBetrayalStrings(targetMonsterIds.map((monsterId) => (
                core.monsters.find((monster) => monster.id === monsterId)?.roomId
            )));
            evidence = targetMonsterIds.length > 0
                ? [`已放置镜中怪物：${targetMonsterIds.map((monsterId) => formatBetrayalMonsterTargetLabel(core, monsterId)).join('、')}。`]
                : ['镜中怪物尚未放置。'];
            extraGaps = ['token-placement-command'];
            break;
        }
        case 'recover-strange-amulet': {
            action = 'recover-card';
            label = '找出奇异护符并交给持有人';
            const amuletHolder = findStrangeAmuletHolder(core);
            targetPlayerIds = uniqueBetrayalStrings([amuletHolder?.playerId]);
            targetCardIds = [HELPING_HANDS_STRANGE_AMULET_EFFECT_ID];
            evidence = [
                amuletHolder
                    ? `奇异护符当前由${formatBetrayalPlayerTargetLabel(core, amuletHolder.playerId)}持有。`
                    : '奇异护符当前没有持有人。',
                core.scenarioRuntime.helpingHands?.strangeAmuletFoundDuringSetup
                    ? '奇异护符是在 setup 中从物品牌堆找出。'
                    : '奇异护符已在玩家持有区，setup 不应从牌堆重复拿取。',
            ];
            break;
        }
        case 'place-troll-hands': {
            action = 'place-monster-tokens';
            label = '放置两只巨魔手';
            targetMonsterIds = [...(core.scenarioRuntime.helpingHands?.trollHandIds ?? [])];
            targetRoomIds = uniqueBetrayalStrings(targetMonsterIds.map((monsterId) => (
                core.monsters.find((monster) => monster.id === monsterId)?.roomId
            )));
            evidence = targetMonsterIds.length > 0
                ? [`已放置巨魔手：${targetMonsterIds.map((monsterId) => formatBetrayalMonsterTargetLabel(core, monsterId)).join('、')}。`]
                : ['巨魔手尚未放置。'];
            extraGaps = ['token-placement-command'];
            break;
        }
        case 'place-phantom-photographers': {
            action = 'place-monster-tokens';
            label = '放置幻影摄影师';
            targetMonsterIds = [...(core.scenarioRuntime.magicCamera?.phantomPhotographerIds ?? [])];
            targetRoomIds = uniqueBetrayalStrings(targetMonsterIds.map((monsterId) => (
                core.monsters.find((monster) => monster.id === monsterId)?.roomId
            )));
            evidence = targetMonsterIds.length > 0
                ? [`已放置幻影摄影师：${targetMonsterIds.map((monsterId) => formatBetrayalMonsterTargetLabel(core, monsterId)).join('、')}。`]
                : ['幻影摄影师尚未放置。'];
            extraGaps = ['token-placement-command'];
            break;
        }
        case 'recover-magic-camera': {
            action = 'recover-card';
            label = '找出魔法相机并交给叛徒';
            const cameraHolderPlayerId = core.scenarioRuntime.magicCamera?.cameraHolderPlayerId
                ?? findMagicCameraHolderPlayerId(core);
            targetPlayerIds = uniqueBetrayalStrings([cameraHolderPlayerId]);
            targetCardIds = ['camera'];
            evidence = cameraHolderPlayerId
                ? [`魔法相机当前由${formatBetrayalPlayerTargetLabel(core, cameraHolderPlayerId)}持有。`]
                : ['魔法相机当前没有持有人，需要人工确认。'];
            break;
        }
        case 'deal-hero-essence-tokens':
            action = 'deal-secret-tokens';
            label = '给每名英雄分发 Essence token';
            targetPlayerIds = [...(core.scenarioRuntime.magicCamera?.heroEssencePlayerIds ?? [])];
            evidence = targetPlayerIds.length > 0
                ? [`已给 ${targetPlayerIds.length} 名英雄分发 Essence token。`]
                : ['英雄 Essence token 尚未分发。'];
            break;
        default:
            extraGaps = ['full-haunt-definition'];
            evidence = ['该 setup 步骤还没有逐作祟命令预览合同。'];
            break;
    }

    targetLabels = uniqueBetrayalStrings([
        ...targetLabels,
        ...targetPlayerIds.map((playerId) => formatBetrayalPlayerTargetLabel(core, playerId)),
        ...targetRoomIds.map((roomId) => formatBetrayalRoomTargetLabel(core, roomId)),
        ...targetCardIds,
        ...targetMonsterIds.map((monsterId) => formatBetrayalMonsterTargetLabel(core, monsterId)),
    ]);

    return {
        entryId: entry.id,
        side: entry.side,
        queueStatus: entry.status,
        action,
        label,
        targetPlayerIds,
        targetRoomIds,
        targetCardIds,
        targetMonsterIds,
        targetLabels,
        alreadyApplied: entry.status === 'resolved',
        canConfirmFromCurrentState: entry.status === 'resolved',
        requiresManualConfirmation: entry.status === 'manual-check',
        evidence,
        contractGaps: uniqueBetrayalStrings([
            ...baseGaps,
            ...extraGaps,
        ]) as BetrayalHauntSetupCommandPreviewGap[],
        previewOnly: true,
    };
}

export function resolveBetrayalHauntSetupCommandPreviews(
    core: BetrayalCore,
): BetrayalHauntSetupCommandPreviewSummary {
    const active = core.phase === 'haunt' && core.scenarioRuntime.hauntTriggered;
    const entries = active ? resolveBetrayalHauntSetupQueue(core) : [];
    const previews = entries.map((entry) => createBetrayalHauntSetupCommandPreview(core, entry));
    const manualCheckEntryIds = previews
        .filter((preview) => preview.requiresManualConfirmation)
        .map((preview) => preview.entryId);
    const status: BetrayalHauntSetupCommandPreviewStatus = !active
        ? 'inactive'
        : previews.length === 0
            ? 'unknown-haunt'
            : manualCheckEntryIds.length > 0
                ? 'manual-check-required'
                : 'ready';
    return {
        active,
        hauntCardNumber: active ? core.scenarioRuntime.hauntCardNumber : null,
        status,
        previews,
        readyCount: previews.filter((preview) => preview.canConfirmFromCurrentState).length,
        manualCheckCount: manualCheckEntryIds.length,
        manualCheckEntryIds,
        needsFormalConfirmationCommand: active && previews.length > 0,
        representativeOnly: active && (
            core.scenarioRuntime.hauntResolutionRepresentativeOnly
            || !isSupportedSetupPreviewHauntCardNumber(core.scenarioRuntime.hauntCardNumber)
        ),
        ruleNotes: active
            ? [
                'setup 命令预览只列出后续正式命令应确认或写入的对象，不直接修改状态。',
                'resolved 只表示当前运行态已有证据，仍需要正式确认命令和 UI 承接才能关闭 setup。',
                'manual-check 表示仍缺 token 放置、参考卡摆放、房间选择或秘密可见性等人工步骤。',
            ]
            : ['作祟尚未开始，没有 setup 命令预览。'],
    };
}

function resolveBetrayalHauntType(core: BetrayalCore): BetrayalHauntType {
    if (!core.scenarioRuntime.hauntTriggered || core.phase !== 'haunt') {
        return 'one-traitor';
    }
    if (core.scenarioRuntime.hauntTraitorResolution) {
        return core.scenarioRuntime.hauntTraitorResolution.teamModel;
    }
    return core.scenarioRuntime.traitorPlayerId ? 'one-traitor' : 'hidden-traitor';
}

export function resolveBetrayalHauntRevealProtocol(core: BetrayalCore): BetrayalHauntRevealProtocol {
    const active = core.phase === 'haunt' && core.scenarioRuntime.hauntTriggered;
    const hauntType = resolveBetrayalHauntType(core);
    const hasTraitorBook = active && hauntType === 'one-traitor';
    return {
        active,
        hauntCardNumber: core.scenarioRuntime.hauntCardNumber,
        hauntType,
        publicSteps: active
            ? [
                ...BETRAYAL_HERO_PUBLIC_HAUNT_STEPS,
                ...(hasTraitorBook ? BETRAYAL_TRAITOR_PUBLIC_HAUNT_STEPS : []),
            ]
            : [],
        setupQueue: active ? resolveBetrayalHauntSetupQueue(core) : [],
        secretBoundary: {
            heroBookVisibleTo: hauntType === 'one-traitor' ? 'heroes' : 'all',
            traitorBookVisibleTo: hasTraitorBook ? 'traitor' : 'none',
            revealOnUse: true,
        },
    };
}
