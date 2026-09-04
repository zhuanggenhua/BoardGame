import type { BetrayalTraitKey } from "./game";

export const BETRAYAL_TRAIT_MARKER_ASSETS = {
  might: "betrayal/markers/might",
  speed: "betrayal/markers/speed",
  knowledge: "betrayal/markers/knowledge",
  sanity: "betrayal/markers/sanity",
} satisfies Record<BetrayalTraitKey, string>;
