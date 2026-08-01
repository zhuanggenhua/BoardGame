import type { DiceThroneConfigReviewRow } from '../games/dicethrone/config/configReviewAdapter';

export type DiceThroneConfigReviewTranslateFn = (key: string, options?: Record<string, unknown>) => string;

function tr(
  translate: DiceThroneConfigReviewTranslateFn,
  key: string,
  defaultValue: string,
  options: Record<string, unknown> = {},
): string {
  return translate(key, { ...options, defaultValue });
}

export function formatDiceThroneConfigReviewDiceFaceName(
  row: DiceThroneConfigReviewRow,
  translate: DiceThroneConfigReviewTranslateFn,
): string {
  const characterName = tr(translate, `characters.${row.characterId}`, row.characterId);
  const diceValue = row.diceValue ?? '';
  const symbols = (row.diceSymbols ?? [])
    .map((symbol) => tr(translate, `dice.face.${symbol}`, symbol))
    .filter(Boolean)
    .join('、');
  return symbols
    ? `${characterName}骰面 ${diceValue}（${symbols}）`
    : `${characterName}骰面 ${diceValue}`;
}
