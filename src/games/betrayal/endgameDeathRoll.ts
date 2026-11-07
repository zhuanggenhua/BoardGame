import type { BetrayalCore } from './game';

/** Only expose public dice from the most recently retained death check.
 * It may predate the victory, so it must not be described as its cause. */
export function resolveEndgameDeathRoll(core: BetrayalCore) {
  const result = core.endgameResult;
  const roll = core.recentRoll;
  if (core.phase !== 'endgame' || result?.outcome !== 'traitor'
    || (result.hauntId !== 'mummy-rampage' && result.hauntId !== 'the-dust')
    || roll?.kind !== 'deathPrevention' || !roll.deathPrevention
    || !core.scenarioRuntime.deadExplorerPlayerIds.includes(roll.playerId)) return null;
  return {
    playerId: roll.playerId,
    dice: [...roll.dice],
    previousDice: roll.lastRabbitFootRerollPreviousDice ? [...roll.lastRabbitFootRerollPreviousDice] : null,
    total: roll.dice.reduce((sum, die) => sum + die, 0) + roll.passiveBonus,
    bonus: roll.passiveBonus,
    minTotal: roll.deathPrevention.minTotal,
  };
}
