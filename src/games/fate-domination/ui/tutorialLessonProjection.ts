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
        case 'DEPLOY_MASTER': return {...lesson(place==='workshop'?'deployment':'battleDeployment', `这次选择${location}的亮起点位。`, `fate-deployment-${place}`),family:`${base.family}-${place==='workshop'?'workshop':'battlefield'}`};
        case 'MOVE_PLAYER': return lesson('movement', `点棋盘上的韦伯，选择${location}，再确认移动${['miyama','shinto'].includes(place)?'，前往战场争夺事件战果':''}。`, 'fate-pawn-0');
        case 'CONFIRM_ATTACK': {
            const names = (payload.cardIds as string[]).map(id => `${resolveFateAttack(player, id)?.definition.name ?? '攻击牌'}（${(payload.faceDownIds as string[]).includes(id) ? '暗置' : '明置'}）`).join('、');
            const mixed = cardIdsKind(player, payload.cardIds as string[]) !== 'ordinary';
            const faceDown = (payload.faceDownIds as string[]).length > 0;
            const battleLocation = player.locationId === 'miyama' || player.locationId === 'shinto';
            const darkNames=(payload.faceDownIds as string[]).map(id=>resolveFateAttack(player,id)?.definition.name).join('、');
            const faceUpNames=(payload.cardIds as string[]).filter(id=>!(payload.faceDownIds as string[]).includes(id)).map(id=>resolveFateAttack(player,id)?.definition.name).join('、');
            return { ...lesson(faceDown ? battleLocation ? 'battlefieldDarkAttack' : 'darkAttack' : mixed ? 'mixedAttack' : 'normalAttack', faceDown?`${faceUpNames?`先明置选择${faceUpNames}，再切换`:'切换'}“暗置选牌”选择${darkNames}，为后续行动保留魔力。`:`点选${names}；再点已选牌可撤回，选齐后点“确认攻击”。`, 'fate-hand'),
                family: `${base.family}-${faceDown ? battleLocation ? 'battlefield-dark' : 'dark' : 'face-up'}` };
        }
        case 'PLAY_SKILL': {
            const skill = player.skills.find(skill => skill.id === payload.skillId);
            const attack = player.hand.find(card=>card.id===payload.skillId);
            const goal:FateLessonId = skill?.isMasterSkill ? 'masterAbility' : String(payload.skillId).startsWith('sc_iskandar_1') ? 'riding' : 'actionAbility';
            const described=lesson(goal, skill?.isMasterSkill ? `使用“${skill.name}”。` : attack&&location?`发动已打出的“${resolveFateAttack(player,attack.id)?.definition.name}”，前往${location}。`:undefined, skill?.isMasterSkill ? `fate-master-ability-${String(payload.skillId)}` : 'fate-hand');
            described.fateCopy.ability={...(skill?.isMasterSkill?{masterId:player.masterId}:attack?{attackId:attack.definitionId}:{servantId:player.servantId}),skillId:attack?.definitionId??String(payload.skillId).split(':')[0],...(goal==='riding'?{clause:'action' as const}:{})};
            described.content=fateTutorialText(described.fateCopy);
            return { ...described,
                family: `${base.family}-${String(payload.skillId).split(':')[0]}` };
        }
        case 'USE_COMMAND_SPELL': return { ...lesson(payload.effect==='mana'?'sealMana':payload.effect==='battle'?'sealBattle':'sealMove', payload.effect === 'move' ? `使用令咒移动至${location}。` : payload.effect==='mana'?'点令咒，选择“恢复魔力”并确认，为打出“骑乘”补充魔力。':'使用一枚令咒强化本轮战斗。', 'fate-self-seals'), family: `${base.family}-${payload.effect}` };
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
