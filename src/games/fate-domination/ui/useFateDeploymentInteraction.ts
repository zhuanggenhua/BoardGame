import type { MatchState } from '../../../engine/types';
import { validate } from '../domain/commands';
import { FATE_LOCATION_ORDER, type FateDominationCore, type FateDominationCommand, type LocationId } from '../domain';

/** 地点点击与拖放共享正式命令；部署没有第二层待确认草稿。 */
export function useFateDeploymentInteraction(state: MatchState<FateDominationCore>, playerId: string | null) {
    const commandFor = (locationId:LocationId,deploymentSlot?:number|null):FateDominationCommand|null => playerId ? {type:'DEPLOY_MASTER',playerId,payload:{locationId,...(deploymentSlot===undefined?{}:{deploymentSlot})}} : null;
    const targets = playerId ? FATE_LOCATION_ORDER.filter(locationId => validate(state, {type:'DEPLOY_MASTER',playerId,payload:{locationId}}).valid) : [];
    return {targets,commandFor};
}
