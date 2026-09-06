import type { BetrayalMonsterSummary, BetrayalTraitKey } from "./game";
import { TRAIT_LABEL_LOCAL } from "./traitTrackSurface";

export const MONSTER_DETAIL_TRAIT_ORDER: readonly BetrayalTraitKey[] = [
  "might",
  "speed",
  "sanity",
  "knowledge",
];

export function resolveMonsterTraitValue(
  monster: BetrayalMonsterSummary,
  trait: BetrayalTraitKey,
): number | null {
  if (trait === "might") return monster.might;
  if (trait === "speed") return monster.speed;
  if (trait === "sanity") return monster.sanity ?? null;
  return monster.knowledge ?? null;
}

export function formatMonsterTraitSummary(
  monster: BetrayalMonsterSummary,
): string {
  return MONSTER_DETAIL_TRAIT_ORDER.map((trait) => {
    const value = resolveMonsterTraitValue(monster, trait);
    return value === null ? null : `${TRAIT_LABEL_LOCAL[trait]} ${value}`;
  })
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
