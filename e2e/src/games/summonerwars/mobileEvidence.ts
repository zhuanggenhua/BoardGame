import { createInitialSystemState } from '../../engine/pipeline';
import type { MatchState, RandomFn } from '../../engine/types';
import { createDeckByFactionId } from './config/factions';
import { SummonerWarsDomain } from './domain';
import { SW_SELECTION_EVENTS } from './domain/types';
import type { FactionId, PlayerId, SummonerWarsCore } from './domain/types';

type TestHarness = Window['__BG_TEST_HARNESS__'];

interface MobileEvidenceOptions {
    faction0?: FactionId;
    faction1?: FactionId;
}

const SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_TEXTS = [
    '在城门旁召唤近战单位并额外消耗魔力，先把中路前线顶稳。',
    '冠军从右翼斜切到外侧通道，给下一轮长程反击留出发力角度。',
    '后排弓手后撤半格，同时保持对中线桥头的连续压制。',
    '把受伤单位换到掩体后方，顺手把魔力线补到下一次召唤阈值。',
    '左翼建筑补位成功，敌方突进路线被迫改走更长的绕后路径。',
    '手牌里的事件先不交，继续攒资源等对手先暴露召唤师站位。',
    '前排压上后没有直接换血，而是优先卡住对面的逃跑格子。',
    '最后一步把冠军停在外圈威胁位，逼对手回合先处理这条线。',
    '右翼远程压制线已经形成，先维持火力覆盖，不急着把后排再往前送。',
    '对手魔力池明显见底，这回合优先补刀，不给他留翻盘用的弃牌空间。',
    '后场护卫横移半步把召唤师护住，避免被对面的突袭牌直接穿进中线。',
    '中间据点虽然暂时失守，但换来了两翼包夹角度，下一轮可以反吃回来。',
];

export const SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_ENTRY_COUNT =
    SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_TEXTS.length;

function createDeterministicRandom(randomValue = 0.5): RandomFn {
    return {
        shuffle: <T>(arr: T[]) => arr,
        random: () => randomValue,
        d: (max: number) => Math.ceil(max * randomValue) || 1,
        range: (min: number, max: number) => Math.floor(min + (max - min) * randomValue),
    };
}

function createInitializedCore(
    playerIds: PlayerId[],
    random: RandomFn,
    options?: MobileEvidenceOptions,
): SummonerWarsCore {
    const faction0 = options?.faction0 ?? 'necromancer';
    const faction1 = options?.faction1 ?? 'paladin';

    let core = SummonerWarsDomain.setup(playerIds, random);

    core = SummonerWarsDomain.reduce(core, {
        type: SW_SELECTION_EVENTS.FACTION_SELECTED,
        payload: { playerId: '0', factionId: faction0 },
        timestamp: 0,
    });
    core = SummonerWarsDomain.reduce(core, {
        type: SW_SELECTION_EVENTS.FACTION_SELECTED,
        payload: { playerId: '1', factionId: faction1 },
        timestamp: 0,
    });
    core = SummonerWarsDomain.reduce(core, {
        type: SW_SELECTION_EVENTS.PLAYER_READY,
        payload: { playerId: '1' },
        timestamp: 0,
    });
    core = SummonerWarsDomain.reduce(core, {
        type: SW_SELECTION_EVENTS.HOST_STARTED,
        payload: { playerId: '0' },
        timestamp: 0,
    });

    const shuffledDecks: Record<PlayerId, unknown[]> = {
        '0': [],
        '1': [],
    };
    for (const playerId of playerIds) {
        const factionId = playerId === '0' ? faction0 : faction1;
        const deckData = createDeckByFactionId(factionId);
        const deckWithIds = deckData.deck.map((card, index) => ({
            ...card,
            id: `${card.id}-${playerId}-${index}`,
        }));
        shuffledDecks[playerId] = random.shuffle(deckWithIds);
    }

    core = SummonerWarsDomain.reduce(core, {
        type: SW_SELECTION_EVENTS.SELECTION_COMPLETE,
        payload: {
            factions: { '0': faction0, '1': faction1 },
            shuffledDecks,
        },
        timestamp: 0,
    });

    return {
        ...core,
        currentPlayer: '0',
        phase: 'summon',
    };
}

export function createSummonerWarsMobileEvidenceActionLogEntries(timestamp = Date.now()) {
    return SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_TEXTS.map((text, index) => ({
        id: `mobile-log-entry-${index + 1}`,
        timestamp: timestamp - ((SUMMONER_WARS_MOBILE_EVIDENCE_ACTION_LOG_TEXTS.length - index - 1) * 1000),
        actorId: index % 2 === 0 ? '0' : '1',
        kind: 'TEST_LOG',
        segments: [
            {
                type: 'text' as const,
                text,
            },
        ],
    }));
}

export function createSummonerWarsMobileEvidenceState(
    options?: MobileEvidenceOptions,
): MatchState<SummonerWarsCore> {
    const playerIds: PlayerId[] = ['0', '1'];
    const random = createDeterministicRandom();
    const core = createInitializedCore(playerIds, random, options);
    const sys = createInitialSystemState(playerIds, []);

    return {
        core: {
            ...core,
            turnNumber: Math.max(core.turnNumber, 3),
        },
        sys: {
            ...sys,
            phase: core.phase,
            turnNumber: Math.max(core.turnNumber, 3),
            tutorial: {
                ...sys.tutorial,
                active: false,
                steps: [],
                step: null,
                stepIndex: 0,
                pendingAnimationAdvance: false,
            },
        },
    };
}

export function withSummonerWarsMobileEvidenceActionLog(
    state: MatchState<SummonerWarsCore>,
    timestamp = Date.now(),
): MatchState<SummonerWarsCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            actionLog: {
                ...state.sys.actionLog,
                maxEntries: state.sys.actionLog?.maxEntries ?? 50,
                entries: createSummonerWarsMobileEvidenceActionLogEntries(timestamp),
            },
        },
    };
}

export function injectSummonerWarsMobileEvidenceScene(
    harness: TestHarness,
    options?: MobileEvidenceOptions,
) {
    if (!harness?.state?.isRegistered?.()) {
        throw new Error('TestHarness 状态注入器未就绪');
    }

    harness.state.set(createSummonerWarsMobileEvidenceState(options));
}
