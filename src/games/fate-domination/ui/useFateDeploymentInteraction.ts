import { useState } from 'react';
import type { MatchState } from '../../../engine/types';
import { validate } from '../domain/commands';
import { nextFateDeploymentSlot } from '../domain/deployment';
import { FATE_LOCATION_ORDER, type FateDominationCore, type FateDominationCommand, type LocationId } from '../domain';

/** 部署候选与选中只在客户端；确认时仍提交正式部署命令。 */
export function useFateDeploymentInteraction(state: MatchState<FateDominationCore>, playerId: string | null) {
    const scope = `${playerId}:${state.core.round}:${state.core.phase}:${state.core.currentPlayerId}:${state.sys.undo.rollbackRevision ?? 0}`;
    const [selection, setSelection] = useState<{scope:string;target:LocationId;slot:number|null|undefined} | null>(null);
    const targets = playerId ? FATE_LOCATION_ORDER.filter(locationId => validate(state, {type:'DEPLOY_MASTER',playerId,payload:{locationId}}).valid) : [];
    const chosen: FateDominationCommand | null = playerId && selection?.scope===scope ? {type:'DEPLOY_MASTER',playerId,payload:{locationId:selection.target,...(selection.slot===undefined?{}:{deploymentSlot:selection.slot})}} : null;
    const command = chosen && validate(state,chosen).valid ? chosen : null;
    const target = command?.type==='DEPLOY_MASTER' ? command.payload.locationId : null;
    const slot = target ? selection?.slot === undefined ? nextFateDeploymentSlot(state.core,target) : selection.slot : null;
    return {targets,target,slot,command,cancel:()=>setSelection(null),select:(id:LocationId,slot?:number|null)=>{if(targets.includes(id))setSelection({scope,target:id,slot});}};
}
