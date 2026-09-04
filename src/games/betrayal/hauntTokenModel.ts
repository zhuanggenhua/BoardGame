import {
    type BetrayalCore,
    type BetrayalRoomMarkerToken,
} from './game';
import { resolveBetrayalDeathStateSummary } from './deathStateReadModel';
import { findExplorerByPlayerId } from './explorerReadModel';
import { findMummyMonster } from './hauntScenarioReadModel';
import { resolveBetrayalMonsterStatuses } from './monsterReadModel';

export type BetrayalHauntTokenInstanceKind =
    | 'room-marker'
    | 'haunt-objective'
    | 'haunt-resource'
    | 'monster'
    | 'corpse'
    | 'sickness';

export type BetrayalHauntTokenInstanceVisibility =
    | 'public'
    | 'owner-only';

export type BetrayalHauntTokenInstanceSource =
    | 'base-rule'
    | 'room-effect'
    | 'event-effect'
    | 'haunt-contract'
    | 'monster-box'
    | 'death-rule';

export interface BetrayalHauntTokenInstanceSummary {
    id: string;
    kind: BetrayalHauntTokenInstanceKind;
    label: string;
    labelKey?: string;
    roomId: string | null;
    roomName: string | null;
    ownerPlayerId: string | null;
    ownerName: string | null;
    visibility: BetrayalHauntTokenInstanceVisibility;
    visibleToPlayerIds: string[];
    value: number | null;
    valueHidden: boolean;
    asset: string | null;
    status: string | null;
    source: BetrayalHauntTokenInstanceSource;
    representativeOnly: boolean;
    ruleNotes: string[];
}

function formatBetrayalRoomMarkerTokenLabel(token: BetrayalRoomMarkerToken): string {
    switch (token) {
        case 'obstacle':
            return '障碍物';
        case 'secretPassage':
            return '秘密通道';
        case 'blessing':
            return '祝福';
        default:
            return token;
    }
}

function createBetrayalHauntTokenInstance(
    core: BetrayalCore,
    token: Omit<BetrayalHauntTokenInstanceSummary, 'visibleToPlayerIds'> & { visibleToPlayerIds?: string[] },
): BetrayalHauntTokenInstanceSummary {
    return {
        ...token,
        visibleToPlayerIds: token.visibleToPlayerIds ?? [...core.playerIds],
    };
}

export function resolveBetrayalHauntTokenInstances(core: BetrayalCore): BetrayalHauntTokenInstanceSummary[] {
    const tokens: BetrayalHauntTokenInstanceSummary[] = [];
    const roomById = new Map(core.rooms.map((room) => [room.id, room]));

    for (const room of core.rooms) {
        for (const markerToken of room.markerTokens ?? []) {
            tokens.push(createBetrayalHauntTokenInstance(core, {
                id: `room-marker-${room.id}-${markerToken}`,
                kind: 'room-marker',
                label: formatBetrayalRoomMarkerTokenLabel(markerToken),
                roomId: room.id,
                roomName: room.name,
                ownerPlayerId: null,
                ownerName: null,
                visibility: 'public',
                value: null,
                valueHidden: false,
                asset: null,
                status: 'placed',
                source: markerToken === 'obstacle'
                    ? 'room-effect'
                    : markerToken === 'blessing'
                        ? 'event-effect'
                        : 'base-rule',
                representativeOnly: false,
                ruleNotes: markerToken === 'obstacle'
                    ? ['障碍物所在房间的离开移动成本提高。']
                    : markerToken === 'blessing'
                        ? ['祝福所在房间的属性检定额外增加 1 颗骰子。']
                        : ['秘密通道标记之间按规则视为额外相连。'],
            }));
        }
    }

    const mummy = core.scenarioRuntime.mummy;
    if (mummy) {
        const sarcophagusRoom = roomById.get(mummy.sarcophagusRoomId);
        tokens.push(createBetrayalHauntTokenInstance(core, {
            id: 'mummy-sarcophagus',
            kind: 'haunt-objective',
            label: '石棺',
            labelKey: 'board.hauntTokens.sarcophagus',
            roomId: mummy.sarcophagusRoomId,
            roomName: sarcophagusRoom?.name ?? null,
            ownerPlayerId: null,
            ownerName: null,
            visibility: 'public',
            value: null,
            valueHidden: false,
            asset: null,
            status: 'placed',
            source: 'haunt-contract',
            representativeOnly: true,
            ruleNotes: ['1 号作祟「木乃伊横行」：石棺是木乃伊目标返回地点。'],
        }));
        const girlHolder = mummy.girlHolderPlayerId
            ? findExplorerByPlayerId(core, mummy.girlHolderPlayerId)
            : null;
        const mummyMonster = mummy.girlHeldByMummy ? findMummyMonster(core) : null;
        const girlTokenRoomId = mummy.girlHeldByMummy
            ? (mummyMonster?.roomId ?? mummy.sarcophagusRoomId)
            : girlHolder?.roomId ?? mummy.girlRoomId;
        if (girlTokenRoomId) {
            const girlRoom = roomById.get(girlTokenRoomId);
            tokens.push(createBetrayalHauntTokenInstance(core, {
                id: 'mummy-girl-token',
                kind: 'haunt-resource',
                label: '女孩',
                labelKey: 'board.hauntTokens.girl',
                roomId: girlTokenRoomId,
                roomName: girlRoom?.name ?? null,
                ownerPlayerId: girlHolder?.playerId ?? null,
                ownerName: girlHolder?.displayName ?? (mummy.girlHeldByMummy ? '木乃伊' : null),
                visibility: 'public',
                value: null,
                valueHidden: false,
                asset: 'betrayal/tokens/haunts/mummy-girl.svg',
                status: mummy.girlHeldByMummy ? 'held-by-mummy' : girlHolder ? 'held-by-player' : 'placed',
                source: 'haunt-contract',
                representativeOnly: true,
                ruleNotes: ['1 号作祟「木乃伊横行」：女孩预兆旁置后由公开 SVG token 代表；被探索者或木乃伊持有时仍公开追踪。'],
            }));
        }
    }

    for (const roomId of core.scenarioRuntime.exorcismCircleRoomIds) {
        const room = roomById.get(roomId);
        tokens.push(createBetrayalHauntTokenInstance(core, {
            id: `crimson-jack-exorcism-circle-${roomId}`,
            kind: 'haunt-objective',
            label: '驱魔圈',
            labelKey: 'board.hauntTokens.exorcismCircle',
            roomId,
            roomName: room?.name ?? null,
            ownerPlayerId: null,
            ownerName: null,
            visibility: 'public',
            value: null,
            valueHidden: false,
            asset: null,
            status: 'placed',
            source: 'haunt-contract',
            representativeOnly: true,
            ruleNotes: ['1 号作祟代表链：驱魔圈是英雄目标进度地点。'],
        }));
    }

    const dust = core.scenarioRuntime.dust;
    if (dust) {
        for (const [playerId, sicknessTokens] of Object.entries(dust.sicknessTokensByPlayerId)) {
            const owner = findExplorerByPlayerId(core, playerId);
            for (const sicknessToken of sicknessTokens) {
                tokens.push(createBetrayalHauntTokenInstance(core, {
                    id: `dust-sickness-${playerId}-${sicknessToken.id}`,
                    kind: 'sickness',
                    label: '疾病标记',
                    labelKey: 'board.hauntTokens.sickness',
                    roomId: null,
                    roomName: null,
                    ownerPlayerId: playerId,
                    ownerName: owner?.displayName ?? null,
                    visibility: 'owner-only',
                    visibleToPlayerIds: [playerId],
                    value: sicknessToken.value,
                    valueHidden: sicknessToken.value === null,
                    asset: null,
                    status: dust.permanentTraitorPlayerIds.includes(playerId) ? 'permanent-traitor' : 'held',
                    source: 'haunt-contract',
                    representativeOnly: true,
                    ruleNotes: [
                        '3 号作祟代表链：疾病标记数字只对持有者本人可见。',
                        '玩家视图已把其他玩家的疾病标记数字遮蔽为 null。',
                    ],
                }));
            }
        }
        for (const roomId of dust.researchRoomIds) {
            const room = roomById.get(roomId);
            tokens.push(createBetrayalHauntTokenInstance(core, {
                id: `dust-research-token-${roomId}`,
                kind: 'haunt-objective',
                label: '研究 token',
                labelKey: 'board.hauntTokens.researchToken',
                roomId,
                roomName: room?.name ?? null,
                ownerPlayerId: null,
                ownerName: null,
                visibility: 'public',
                value: null,
                valueHidden: false,
                asset: null,
                status: 'placed',
                source: 'haunt-contract',
                representativeOnly: true,
                ruleNotes: ['3 号作祟代表链：研究 token 会提高治愈检定加值。'],
            }));
        }
    }

    const monsterById = new Map(core.monsters.map((monster) => [monster.id, monster]));
    for (const monsterStatus of resolveBetrayalMonsterStatuses(core)) {
        const monster = monsterById.get(monsterStatus.monsterId);
        const room = monsterStatus.roomId ? roomById.get(monsterStatus.roomId) : undefined;
        tokens.push(createBetrayalHauntTokenInstance(core, {
            id: `monster-${monsterStatus.monsterId}`,
            kind: 'monster',
            label: monsterStatus.name,
            roomId: monsterStatus.roomId,
            roomName: room?.name ?? null,
            ownerPlayerId: null,
            ownerName: null,
            visibility: 'public',
            value: null,
            valueHidden: false,
            asset: monster?.tokenAsset ?? null,
            status: monsterStatus.status,
            source: 'monster-box',
            representativeOnly: true,
            ruleNotes: [
                ...monsterStatus.ruleNotes,
                '怪物 token 目录来自现有怪物运行态；完整 50 个作祟怪物放置仍需逐作祟接入。',
            ],
        }));
    }

    for (const corpse of resolveBetrayalDeathStateSummary(core).corpses) {
        tokens.push(createBetrayalHauntTokenInstance(core, {
            id: `corpse-${corpse.playerId}`,
            kind: 'corpse',
            label: `${corpse.displayName}尸体`,
            roomId: corpse.roomId,
            roomName: corpse.roomName,
            ownerPlayerId: corpse.playerId,
            ownerName: corpse.displayName,
            visibility: 'public',
            value: corpse.itemCount + corpse.omenCount,
            valueHidden: false,
            asset: null,
            status: corpse.lootedThisTurn ? 'looted-this-turn' : 'lootable',
            source: 'death-rule',
            representativeOnly: false,
            ruleNotes: [
                ...corpse.ruleNotes,
                '尸体 token 目录只表达死亡探索者倒伏和可搜刮状态，不删除死亡角色。',
            ],
        }));
    }

    const magicCamera = core.scenarioRuntime.magicCamera;
    if (magicCamera) {
        for (const playerId of magicCamera.heroEssencePlayerIds) {
            const owner = findExplorerByPlayerId(core, playerId);
            tokens.push(createBetrayalHauntTokenInstance(core, {
                id: `magic-camera-essence-hero-${playerId}`,
                kind: 'haunt-resource',
                label: 'Essence',
                labelKey: 'board.hauntTokens.essence',
                roomId: owner?.roomId ?? null,
                roomName: owner ? roomById.get(owner.roomId)?.name ?? null : null,
                ownerPlayerId: playerId,
                ownerName: owner?.displayName ?? null,
                visibility: 'public',
                value: null,
                valueHidden: false,
                asset: null,
                status: 'held-by-hero',
                source: 'haunt-contract',
                representativeOnly: true,
                ruleNotes: ['33 号作祟代表链：英雄 Essence 是叛徒需要夺取的作祟资源。'],
            }));
        }
        for (const playerId of magicCamera.capturedEssencePlayerIds) {
            const owner = findExplorerByPlayerId(core, playerId);
            tokens.push(createBetrayalHauntTokenInstance(core, {
                id: `magic-camera-essence-captured-${playerId}`,
                kind: 'haunt-resource',
                label: 'Essence',
                labelKey: 'board.hauntTokens.essence',
                roomId: null,
                roomName: null,
                ownerPlayerId: playerId,
                ownerName: owner?.displayName ?? null,
                visibility: 'public',
                value: null,
                valueHidden: false,
                asset: null,
                status: 'captured-by-traitor',
                source: 'haunt-contract',
                representativeOnly: true,
                ruleNotes: ['33 号作祟代表链：已夺取 Essence 计入叛徒资源进度。'],
            }));
        }
    }

    return tokens;
}
