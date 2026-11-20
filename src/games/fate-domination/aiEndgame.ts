import { FATE_MIN_MANA_TO_PLAY_SKILL_ATTACK, fateAttackManaCost } from './domain/attackSelection';
import { fateLocationResults } from './domain/battleAwards';
import { fateAfterBattleManaAwards } from './domain/environmentRules';
import { visibleFatePower } from './domain/playerView';
import { fateEliminationCandidatesForRound, nextFateSituation } from './domain/roundLifecycle';
import { FATE_MANA_PER_COMMAND_SPELL, capFateMana } from './domain/rules';
import type { FateDominationCore, PlayerState } from './domain/types';

const excalibur = (player: PlayerState) => player.skills.find(skill => skill.id.split(':')[0] === 'sc_saber_np');

export function canPlanFateFinalBattle(core: FateDominationCore, playerId: string) {
    const player = core.players[playerId];
    // 先行动时，威力与位置仍会被其他席的出牌和移动改变，不能按当前结果保证晋级。
    const actionSettled = core.playerIds.every(id => id === playerId || core.players[id].eliminated
        || !core.players[id].locationId || core.players[id].hasPassedAction);
    return core.round === 10 && core.phase === 'action' && player.locationId === 'miyama'
        && player.servantId === 'servant-saber' && Boolean(excalibur(player)) && actionSettled;
}

/** 当前已公开的战斗若立即结算，以晋级优先，再比较最后一战的宝具预算。 */
export function fatePenultimateBattleUtility(core: FateDominationCore, playerId: string) {
    const player = core.players[playerId];
    const skill = excalibur(player);
    if (!skill) return 0;
    const results = (['miyama', 'shinto', 'recon'] as const).flatMap(locationId => fateLocationResults(core, locationId,
        id => (id === playerId ? undefined : core.players[id].publicView?.power) ?? visibleFatePower(core, id, playerId)));
    if (fateEliminationCandidatesForRound(core, results).includes(playerId)) return 0;

    const currentBattleMana = fateAfterBattleManaAwards(core).reduce((sum, award) => sum + (award.playerId === playerId ? award.amount : 0), 0);
    const nextMana = capFateMana(player.masterId, player.mana + currentBattleMana + nextFateSituation(core).printedMana);
    const cost = fateAttackManaCost(player, skill.id, false, core.round + 1);
    const requiredMana = Math.max(FATE_MIN_MANA_TO_PLAY_SKILL_ATTACK, cost ?? Infinity);
    // 一次令咒足以补齐缺口时，保留这条路线。仍略优先无需花令咒的预算。
    const reserve = nextMana >= requiredMana ? 64
        : player.commandSpells > 0 && nextMana + FATE_MANA_PER_COMMAND_SPELL >= requiredMana ? 62 : 0;
    const battlePoints = results.reduce((sum, result) => sum + (result.playerId === playerId ? result.totalVictoryPoints : 0), 0);
    return 1000 + reserve + battlePoints * 4;
}
