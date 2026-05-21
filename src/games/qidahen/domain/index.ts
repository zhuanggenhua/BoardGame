import type { DomainCore, PlayerId, RandomFn } from '../../../engine/types';
import { QIDAHEN_COMMANDS, validate } from './commands';
import type {
    QidahenCommand,
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
    QidahenFactionState,
} from './types';
import { QIDAHEN_MAP_REGIONS } from '../config/mapRegions';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const createFactionState = (
    id: QidahenFactionId,
    playerId: PlayerId,
    name: string,
    colorClass: string,
    troops: number,
    grain: number,
    landTax: number,
): QidahenFactionState => ({
    id,
    playerId,
    name,
    colorClass,
    troops,
    grain,
    landTax,
    handLimit: id === 'ming' ? 15 : 10,
    handCount: id === 'mongol' ? 4 : 5,
    actionDiamonds: id === 'jin' ? 2 : 3,
});

const createInitialCore = (playerIds: PlayerId[]): QidahenCore => {
    const normalizedPlayerIds = factionOrder.map((_, index) => playerIds[index] ?? String(index));
    const regionControllers: Record<string, QidahenFactionId | 'neutral'> = {
        datong: 'ming',
        baicheng: 'mongol',
        jinzhou: 'jin',
        shengjing: 'jin',
        beijing: 'ming',
    };
    const regionTroops: Record<string, number> = {
        datong: 3,
        baicheng: 2,
        jinzhou: 2,
        shengjing: 3,
        beijing: 2,
    };
    const regionPopulation: Record<string, number> = {
        datong: 6,
        baicheng: 4,
        jinzhou: 2,
        shengjing: 5,
        beijing: 6,
    };

    return {
        playerIds: normalizedPlayerIds,
        currentPlayer: normalizedPlayerIds[0],
        currentYear: '崇祯十六年 1643',
        turnLabel: '回合 6/20',
        actionWheelPosition: '调度',
        selectedRegionId: 'datong',
        factions: {
            ming: createFactionState('ming', normalizedPlayerIds[0], '大明', 'bg-[#8f2f24]', 18, 12, 70),
            mongol: createFactionState('mongol', normalizedPlayerIds[1], '蒙古', 'bg-[#6f4c24]', 16, 10, 65),
            jin: createFactionState('jin', normalizedPlayerIds[2], '后金', 'bg-[#244c6f]', 17, 11, 75),
        },
        regions: QIDAHEN_MAP_REGIONS.map((region) => ({
            id: region.id,
            name: region.name,
            type: region.type,
            controller: regionControllers[region.id] ?? 'neutral',
            x: region.labelPoint.x,
            y: region.labelPoint.y,
            adjacentRegionIds: region.adjacentRegionIds,
            movementCostByRegionId: region.movementCostByRegionId,
            troops: regionTroops[region.id] ?? 0,
            population: regionPopulation[region.id] ?? 0,
            note: region.note,
        })),
        pendingEffects: [
            { id: 'tax-datong', title: '大同 开发完成', detail: '获得 1 粮草，更新土地税赋', timer: '1' },
            { id: 'train-jinzhou', title: '锦州 训练完成', detail: '获得 2 兵力', timer: '1' },
        ],
        battlePreview: {
            regionName: '咸兴',
            attacker: 'ming',
            defender: 'mongol',
            attackerStrength: 3,
            defenderStrength: 2,
            phase: '交战',
        },
        handCards: [
            { id: 'transfer', title: '调兵遣将', cost: 2, type: '势力行动', text: '调动 2 个己方部队，可跨 1 区域。' },
            { id: 'tax', title: '征收赋税', cost: 1, type: '轮盘行动', text: '获得 2 粮草。' },
            { id: 'recruit', title: '招募新军', cost: 2, type: '手牌行动', text: '获得 2 兵力。' },
            { id: 'spy', title: '离间计', cost: 2, type: '事件', text: '使 1 个敌方部队士气 -2。' },
            { id: 'fire', title: '火攻', cost: 3, type: '战术', text: '对目标造成 2 伤害。' },
            { id: 'wall', title: '坚壁清野', cost: 2, type: '军备', text: '本回合 +2 防御。' },
        ],
        actionLog: [
            { id: 'log-1', faction: 'ming', text: '大明 对 咸兴 发起进攻。' },
            { id: 'log-2', faction: 'mongol', text: '蒙古 在 大同 进行调度。' },
            { id: 'log-3', faction: 'jin', text: '后金 在 山海关 进行逐补。' },
            { id: 'log-4', faction: 'ming', text: '大明 在 辽城 进行征兵。' },
            { id: 'log-5', faction: 'mongol', text: '蒙古 使用 计策【离间】。' },
        ],
    };
};

const now = () => Date.now();

export const QidahenDomain: DomainCore<QidahenCore, QidahenCommand, QidahenEvent> = {
    gameId: 'qidahen',

    setup: (playerIds: PlayerId[], _random: RandomFn): QidahenCore => createInitialCore(playerIds),

    validate,

    execute: (_state, command): QidahenEvent[] => {
        switch (command.type) {
            case QIDAHEN_COMMANDS.SELECT_REGION:
                return [{
                    type: 'REGION_SELECTED',
                    payload: {
                        regionId: command.payload.regionId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
                return [{
                    type: 'PREVIEW_ACTION_CONFIRMED',
                    payload: {
                        actionId: command.payload.actionId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            default:
                return [];
        }
    },

    reduce: (state, event): QidahenCore => {
        switch (event.type) {
            case 'REGION_SELECTED':
                return {
                    ...state,
                    selectedRegionId: event.payload.regionId,
                };
            case 'PREVIEW_ACTION_CONFIRMED':
                return {
                    ...state,
                    actionLog: [
                        {
                            id: `log-${event.timestamp}`,
                            faction: 'ming',
                            text: `已确认行动：${event.payload.actionId}`,
                        },
                        ...state.actionLog,
                    ].slice(0, 8),
                };
            default:
                return state;
        }
    },

    isGameOver: () => undefined,
};

export type { QidahenCommand, QidahenCommandMap, QidahenCore, QidahenEvent } from './types';
