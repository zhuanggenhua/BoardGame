import type {MatchState,Command} from '../../../engine/types';
import type {FateDominationCore} from '../domain';
import {resolveFateAttack} from '../domain/attackSelection';
import {fateTutorialText} from '../tutorialText';
import {fateLessonCopy,type FateLessonId} from '../tutorialLessons';

const cardIdsKind = (player: FateDominationCore['players'][string], ids: string[]) => {
    const kinds = new Set(ids.map(id => resolveFateAttack(player, id)?.kind));
    return kinds.size > 1 ? 'mixed' : kinds.has('skill') ? 'skills' : 'ordinary';
};

export function describeFateTutorialAction(state: MatchState<FateDominationCore>, command: Command) {
    const { core } = state;
    const payload = command.payload as Record<string, unknown>;
    const player = core.players[command.playerId];
    const place = String(payload.locationId ?? payload.targetLocationId ?? '');
    const location = core.battlefield[place as keyof typeof core.battlefield]?.label ?? '';
    const base = { target: 'fate-phase', family: `${core.phase}-${command.type}` };
    const lesson = (goal:FateLessonId, input?: string, target = base.target) => {
        const fateCopy = fateLessonCopy(goal,input && command.playerId==='0'?{text:input,owner:command.type}:undefined);
        return { ...base, target, fateCopy, content: fateTutorialText(fateCopy) };
    };
    switch (command.type) {
        case 'SELECT_MASTER':
        case 'SELECT_SERVANT': return lesson('phaseOrder');
        case 'DEPLOY_MASTER': return {...lesson(place==='workshop'?'deployment':'battleDeployment', place==='workshop'?`这次部署到${location}，取得点位标注的魔力。`:`这次部署到${location}的可用地利点，为战力结算取得地利。`, `fate-deployment-${place}`),family:`${base.family}-${place==='workshop'?'workshop':'battlefield'}`};
        case 'MOVE_PLAYER': return lesson('movement', ['miyama','shinto'].includes(place) ? `点本人棋子开始移动；本次前往${location}争夺事件战果。` : `点本人棋子开始移动；本次目的地：${location}。`, 'fate-map');
        case 'CONFIRM_ATTACK': {
            const names = (payload.cardIds as string[]).map(id => `${resolveFateAttack(player, id)?.definition.name ?? '攻击牌'}（${(payload.faceDownIds as string[]).includes(id) ? '暗置' : '明置'}）`).join('、');
            const mixed = cardIdsKind(player, payload.cardIds as string[]) !== 'ordinary';
            const faceDown = (payload.faceDownIds as string[]).length > 0;
            const battleLocation = player.locationId === 'miyama' || player.locationId === 'shinto';
            return { ...lesson(faceDown ? battleLocation ? 'battlefieldDarkAttack' : 'darkAttack' : mixed ? 'mixedAttack' : 'normalAttack', faceDown?`本次打出${names}；将有费用的普通牌暗置，为后续行动保留魔力。`:`本次打出${names}，建立本轮攻击。`, 'fate-hand'),
                family: `${base.family}-${cardIdsKind(player, payload.cardIds as string[])}-${(payload.faceDownIds as string[]).length}` };
        }
        case 'PLAY_SKILL': {
            const skill = player.skills.find(skill => skill.id === payload.skillId);
            const attack = player.hand.find(card=>card.id===payload.skillId);
            const goal:FateLessonId = skill?.isMasterSkill ? 'masterAbility' : String(payload.skillId).startsWith('sc_iskandar_1') ? 'riding' : 'actionAbility';
            const described=lesson(goal, skill?.isMasterSkill ? (player.masterId==='m_waver'&&skill.id.split(':')[0]==='s2'?`现在使用“${skill.name}”补充手牌，为本轮出牌增加选择。`:`现在使用“${skill.name}”，按能力说明完成本次行动。`) : attack&&location?`现在发动已打出的“${resolveFateAttack(player,attack.id)?.definition.name}”，沿箭头前往${location}。`:undefined, skill?.isMasterSkill ? 'fate-master-abilities' : 'fate-hand');
            described.fateCopy.ability={...(skill?.isMasterSkill?{masterId:player.masterId}:attack?{attackId:attack.definitionId}:{servantId:player.servantId}),skillId:attack?.definitionId??String(payload.skillId).split(':')[0],...(goal==='riding'?{clause:'action' as const}:{})};
            described.content=fateTutorialText(described.fateCopy);
            return { ...described,
                family: `${base.family}-${String(payload.skillId).split(':')[0]}` };
        }
        case 'USE_COMMAND_SPELL': return { ...lesson(payload.effect==='mana'?'sealMana':payload.effect==='battle'?'sealBattle':'sealMove', payload.effect === 'move' ? `使用令咒移动至${location}。` : payload.effect==='mana'?(player.mana<4?'目前需要两枚令咒才能补足技能攻击的魔力。先使用一枚恢复魔力。':'现在使用一枚令咒恢复魔力，使魔力达到技能攻击所需的8点门槛。'):'使用一枚令咒强化本轮战斗。', 'fate-self'), family: `${base.family}-${payload.effect}` };
        case 'SYS_INTERACTION_CANCEL': return lesson('ridingChoice', undefined, 'fate-hand');
        case 'SYS_INTERACTION_RESPOND': return {
            ...lesson(Array.isArray(payload.optionIds) ? 'ridingChoice' : 'postBattle', Array.isArray(payload.optionIds)?'这次用'+(payload.optionIds as string[]).map(id=>resolveFateAttack(player,id)?.definition.name).join('、')+'追加攻击。':undefined,
                Array.isArray(payload.optionIds) ? 'fate-hand' : 'fate-post-battle'),
            family: `choice-${String((state.sys.interaction.current?.data as { sourceId?: string })?.sourceId)}-${Array.isArray(payload.optionIds) ? payload.optionIds.length : payload.optionId}` };
        case 'PASS_ACTION': return lesson('endAction');
        case 'RESOLVE_LOCATION': return lesson('settlement');
        default: return lesson(core.phase === 'preparation' ? 'preparation' : core.phase === 'battle' ? 'battle' : 'phaseOrder');
    }
}
