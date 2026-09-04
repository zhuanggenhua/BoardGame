import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalTraitKey,
} from "./game";
import { TRAIT_DAMAGE_ORDER } from "./traitPresentation";

export const BETRAYAL_ATTACK_IMPACT_FLASH_RESET_MS = 2200;
export const BETRAYAL_ATTACK_IMPACT_SLASH_DURATION_MS = 1100;
export const BETRAYAL_ATTACK_IMPACT_SLASH_ACTIVE_MS = 1150;
export const BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS = 1200;
export const BETRAYAL_ATTACK_IMPACT_COMPLETE_MS = 1800;
export const BETRAYAL_ATTACK_IMPACT_SLASH_COLOR = "rgba(255, 95, 72, 0.96)";
export const BETRAYAL_ATTACK_IMPACT_PULSE_COLOR = "rgba(220, 38, 38, 0.9)";

export type BetrayalAttackImpactTraitLoss = {
  trait: BetrayalTraitKey;
  amount: number;
};

export type BetrayalAttackImpactState = {
  playerId: string;
  damageKind: "physical" | "mental";
  role: "attacker" | "defender";
  damageAmount: number;
  losses: BetrayalAttackImpactTraitLoss[];
};

function resolveAttackImpactTraitLosses(
  before: Record<BetrayalTraitKey, number> | undefined,
  after: Record<BetrayalTraitKey, number> | undefined,
  ignoredLosses: Partial<Record<BetrayalTraitKey, number>> = {},
): BetrayalAttackImpactTraitLoss[] {
  if (!before || !after) {
    return [];
  }
  return TRAIT_DAMAGE_ORDER.map((trait) => ({
    trait,
    amount: Math.max(
      0,
      (before[trait] ?? 0) - (after[trait] ?? 0) - (ignoredLosses[trait] ?? 0),
    ),
  })).filter((entry) => entry.amount > 0);
}

function buildAttackImpactState(options: {
  playerId: string | undefined;
  role: BetrayalAttackImpactState["role"];
  damageKind: BetrayalAttackImpactState["damageKind"];
  damageAmount: number;
  traitsBeforeDamage: Record<BetrayalTraitKey, number> | undefined;
  traitsAfterDamage: Record<BetrayalTraitKey, number> | undefined;
  ignoredLosses?: Partial<Record<BetrayalTraitKey, number>>;
}): BetrayalAttackImpactState | null {
  if (!options.playerId) {
    return null;
  }
  const losses = resolveAttackImpactTraitLosses(
    options.traitsBeforeDamage,
    options.traitsAfterDamage,
    options.ignoredLosses,
  );
  if (options.damageAmount <= 0 && losses.length === 0) {
    return null;
  }
  return {
    playerId: options.playerId,
    role: options.role,
    damageKind: options.damageKind,
    damageAmount: options.damageAmount,
    losses,
  };
}

export function resolveAttackImpactByPlayerId(
  core: BetrayalCore,
  explorers: BetrayalExplorerSummary[],
): Map<string, BetrayalAttackImpactState> {
  const impactByPlayerId = new Map<string, BetrayalAttackImpactState>();
  const recentRoll = core.recentRoll;
  if (recentRoll?.kind !== "attackRoll" || !recentRoll.attack) {
    return impactByPlayerId;
  }

  const { attack } = recentRoll;
  const defender = attack.defenderPlayerId
    ? explorers.find(
        (explorer) => explorer.playerId === attack.defenderPlayerId,
      )
    : null;
  const defenderImpact = buildAttackImpactState({
    playerId: defender?.playerId,
    role: "defender",
    damageKind: attack.damageKind,
    damageAmount: attack.previousDamageToDefender,
    traitsBeforeDamage: attack.defenderTraitsBeforeDamage,
    traitsAfterDamage: defender?.traits,
  });
  if (defenderImpact) {
    impactByPlayerId.set(defenderImpact.playerId, defenderImpact);
  }

  const attacker = explorers.find(
    (explorer) => explorer.playerId === recentRoll.playerId,
  );
  const attackerImpact = buildAttackImpactState({
    playerId: attacker?.playerId,
    role: "attacker",
    damageKind: attack.damageKind,
    damageAmount: attack.previousDamageToAttacker,
    traitsBeforeDamage: attack.attackerTraitsBeforeDamage,
    traitsAfterDamage: attacker?.traits,
    ignoredLosses: { speed: attack.weaponSpeedCost ?? 0 },
  });
  if (attackerImpact) {
    impactByPlayerId.set(attackerImpact.playerId, attackerImpact);
  }

  return impactByPlayerId;
}
