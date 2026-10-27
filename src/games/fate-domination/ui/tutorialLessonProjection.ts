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
        case 'DEPLOY_MASTER': return {...lesson(place==='workshop'?'deployment':'battleDeployment', `${location} · ${place==='workshop'?'2魔力点位':'地利点位'}。`, `fate-deployment-${place}`),family:`${base.family}-${place==='workshop'?'workshop':'battlefield'}`};
        case 'MOVE_PLAYER': return lesson('movement', ['miyama','shinto'].includes(place) ? `点本人棋子开始移动；本次前往${location}争夺事件战果。` : `点本人棋子开始移动；本次目的地：${location}。`, 'fate-map');
        case 'CONFIRM_ATTACK': {
            const names = (payload.cardIds as string[]).map(id => `${resolveFateAttack(player, id)?.definition.name ?? '攻击牌'}（${(payload.faceDownIds as string[]).includes(id) ? '暗置' : '明置'}）`).join('、');
            const mixed = cardIdsKind(player, payload.cardIds as string[]) !== 'ordinary';
            const faceDown = (payload.faceDownIds as string[]).length > 0;
            const battleLocation = player.locationId === 'miyama' || player.locationId === 'shinto';
            return { ...lesson(faceDown ? battleLocation ? 'battlefieldDarkAttack' : 'darkAttack' : mixed ? 'mixedAttack' : 'normalAttack', names+'。', 'fate-hand'),
                family: `${base.family}-${cardIdsKind(player, payload.cardIds as string[])}-${(payload.faceDownIds as string[]).length}` };
        }
        case 'PLAY_SKILL': {
            const skill = player.skills.find(skill => skill.id === payload.skillId);
            const goal:FateLessonId = skill?.isMasterSkill ? 'masterAbility' : String(payload.skillId).startsWith('sc_iskandar_1') ? 'riding' : 'actionAbility';
            const described=lesson(goal, skill?.isMasterSkill ? '点本人头像查看御主能力。' : undefined, skill?.isMasterSkill ? 'fate-self' : 'fate-hand');
            described.fateCopy.ability={...(skill?.isMasterSkill?{masterId:player.masterId}:{servantId:player.servantId}),skillId:String(payload.skillId).split(':')[0],...(goal==='riding'?{clause:'action' as const}:{})};
            described.content=fateTutorialText(described.fateCopy);
            return { ...described,
                family: `${base.family}-${String(payload.skillId).split(':')[0]}` };
        }
        case 'USE_COMMAND_SPELL': return { ...lesson(payload.effect==='mana'?'sealMana':payload.effect==='battle'?'sealBattle':'sealMove', payload.effect === 'move' ? `令咒移动 · ${location}。` : payload.effect==='mana'?'恢复魔力。':'强化战斗。', 'fate-self'), family: `${base.family}-${payload.effect}` };
        case 'SYS_INTERACTION_CANCEL': return lesson('ridingChoice', undefined, 'fate-hand');
        case 'SYS_INTERACTION_RESPOND': return {
            ...lesson(Array.isArray(payload.optionIds) ? 'ridingChoice' : 'postBattle', Array.isArray(payload.optionIds)?(payload.optionIds as string[]).map(id=>resolveFateAttack(player,id)?.definition.name).join('、')+'。':undefined,
                Array.isArray(payload.optionIds) ? 'fate-hand' : 'fate-post-battle'),
            family: `choice-${String((state.sys.interaction.current?.data as { sourceId?: string })?.sourceId)}-${Array.isArray(payload.optionIds) ? payload.optionIds.length : payload.optionId}` };
        case 'PASS_ACTION': return lesson('endAction');
        case 'RESOLVE_LOCATION': return lesson('settlement');
        default: return lesson(core.phase === 'preparation' ? 'preparation' : core.phase === 'battle' ? 'battle' : 'phaseOrder');
    }
}
