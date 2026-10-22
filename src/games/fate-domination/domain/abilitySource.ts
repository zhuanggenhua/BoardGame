import { FATE_ATTACK_BY_ID } from '../data';
import type { PlayerState, SkillDefinition } from './types';
/** The same source projection serves commands and card affordances. */
export function resolveFateAbilitySource(player:PlayerState,id:string):{skill:SkillDefinition;definitionId:string;active:boolean}|undefined {
 const skill=player.skills.find(item=>item.id===id);
 if(skill)return {skill,definitionId:skill.isMasterSkill ? `${player.masterId}_${skill.id.split(':')[0]}` : skill.id.split(':')[0],active:player.activeSkills.includes(id)||skill.isMasterSkill===true};
 const card=player.hand.find(item=>item.id===id);const definition=card&&FATE_ATTACK_BY_ID[card.definitionId];
 return card&&definition?{skill:{id,name:definition.name,type:definition.type,cost:definition.manaCost,power:definition.basePower,desc:definition.desc},definitionId:definition.id,active:player.activeAttackIds.includes(id)&&!(player.faceDownAttackIds??[]).includes(id)}:undefined;
}
export const fateAbilityUsageKey=(sourceId:string,phase:string)=>`${sourceId}:${phase}`;

/** Kirei's form is derived from the current identity, never a second mutable flag. */
export const fateKireiForm = (player:PlayerState):'supervisor'|'executor' => player.servantId && !player.isRevealed ? 'supervisor' : 'executor';
