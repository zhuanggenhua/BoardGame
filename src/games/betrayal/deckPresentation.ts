import type { BetrayalCore, BetrayalDeckKind } from "./game";

type BetrayalTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export type DeckAssetMap = Record<BetrayalDeckKind, string>;

export type DeckTrayItem = {
  id: string;
  kind: BetrayalDeckKind;
  label: string;
  count: number;
  asset: string;
};

const BETRAYAL_DECK_KINDS: BetrayalDeckKind[] = ["omen", "item", "event"];

export function buildDeckItems(
  core: BetrayalCore,
  t: BetrayalTranslation,
  deckAssets: DeckAssetMap,
): DeckTrayItem[] {
  return BETRAYAL_DECK_KINDS.map((kind) => ({
    id: `deck-${kind}`,
    kind,
    label: t(`board.decks.${kind}`),
    count: core.deckCounts[kind],
    asset: deckAssets[kind],
  }));
}

export function buildDiscardItems(
  core: BetrayalCore,
  t: BetrayalTranslation,
  deckAssets: DeckAssetMap,
): DeckTrayItem[] {
  return BETRAYAL_DECK_KINDS.map((kind) => ({
    id: `discard-${kind}`,
    kind,
    label: `${t(`board.decks.${kind}`)} · ${t("board.sections.discard")}`,
    count: core.discardCounts[kind],
    asset: deckAssets[kind],
  }));
}
