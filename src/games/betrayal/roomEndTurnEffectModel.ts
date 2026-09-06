import type { RandomFn } from '../../engine/types';
import { rollBetrayalPip } from './diceRules';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalRoomNode,
} from './game';
import type { BetrayalRoomDiscoveryTemplate } from './scenarioConfig';
import { rollTraitCheckWithDice } from './traitRollModel';
import {
    canUseBetrayalTraitorPowers,
    isBetrayalDamagingRoomEndTurnEffect,
} from './traitorPowerRules';

export type BetrayalRoomEndTurnEffect = NonNullable<BetrayalRoomDiscoveryTemplate['endTurnEffect']>;

export interface BetrayalRoomEndTurnEffectResult {
    kind: BetrayalRoomEndTurnEffect;
    playerId: string;
    roomId: string;
    roomName: string;
    destinationRoomId?: string;
    speedRoll?: number;
    speedRollDice?: number[];
    speedRollPassiveBonus?: number;
    physicalDamage?: number;
    ignoredByTraitorPower?: boolean;
}

function resolveRoomEndTurnEffect(room: BetrayalRoomNode | null | undefined): BetrayalRoomEndTurnEffect | undefined {
    return room?.state === 'discovered' ? room.endTurnEffect : undefined;
}

export function cloneBetrayalRoomEndTurnEffectResult(
    result: BetrayalRoomEndTurnEffectResult,
): BetrayalRoomEndTurnEffectResult {
    return {
        ...result,
        speedRollDice: result.speedRollDice ? [...result.speedRollDice] : undefined,
    };
}

export function resolveEndTurnRoomEffect(
    core: BetrayalCore,
    random: RandomFn,
): BetrayalRoomEndTurnEffectResult | null {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const effect = resolveRoomEndTurnEffect(currentRoom);
    if (!effect || !currentRoom) {
        return null;
    }
    const ignoreDamagingEffect = canUseBetrayalTraitorPowers(core, core.currentExplorer.playerId)
        && isBetrayalDamagingRoomEndTurnEffect(effect);

    if (effect === 'physicalDamage1') {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            physicalDamage: ignoreDamagingEffect ? undefined : 1,
            ignoredByTraitorPower: ignoreDamagingEffect,
        };
    }

    if (effect === 'moveToBasementLanding') {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            destinationRoomId: 'basement-landing',
        };
    }

    const speedRoll = rollTraitCheckWithDice(random, core.currentExplorer, 'speed', core);
    if (speedRoll.total >= 5) {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            speedRoll: speedRoll.total,
            speedRollDice: speedRoll.dice,
            speedRollPassiveBonus: speedRoll.passiveBonus,
        };
    }

    return {
        kind: effect,
        playerId: core.currentExplorer.playerId,
        roomId: currentRoom.id,
        roomName: currentRoom.name,
        destinationRoomId: 'basement-landing',
        speedRoll: speedRoll.total,
        speedRollDice: speedRoll.dice,
        speedRollPassiveBonus: speedRoll.passiveBonus,
        physicalDamage: ignoreDamagingEffect ? undefined : rollBetrayalPip(random),
        ignoredByTraitorPower: ignoreDamagingEffect,
    };
}

export function formatEndTurnRoomEffectLog(
    effect: BetrayalRoomEndTurnEffectResult,
    explorerName: BetrayalExplorerSummary['displayName'],
): string {
    if (effect.kind === 'physicalDamage1') {
        if (effect.ignoredByTraitorPower) {
            return `${explorerName}在${effect.roomName}结束回合，叛徒能力忽略房间伤害`;
        }
        return `${explorerName}在${effect.roomName}结束回合，承受 1 点物理伤害`;
    }
    if (effect.kind === 'moveToBasementLanding') {
        return `${explorerName}从${effect.roomName}滑落到地下室起始点`;
    }
    if (effect.destinationRoomId) {
        if (effect.ignoredByTraitorPower) {
            return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，坠落到地下室起始点，叛徒能力忽略坠落伤害`;
        }
        return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，坠落到地下室起始点并承受 ${effect.physicalDamage ?? 0} 点物理伤害`;
    }
    return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，没有坠落`;
}
