import type { AbilityModeState } from './useGameEvents';

type BannerTranslate = (key: string, options?: Record<string, unknown>) => string;

export function getAbilityModeBannerFallbackText(
  t: BannerTranslate,
  abilityMode: AbilityModeState,
): string {
  if (abilityMode.abilityId === 'fortress_power' && abilityMode.step === 'selectCard') {
    return t('cardSelector.fortressPower');
  }

  if (abilityMode.abilityId === 'huijin_call_guards' && abilityMode.step === 'selectCard') {
    return t('cardSelector.huijinCallGuards');
  }

  if (abilityMode.abilityId === 'huijin_call_guards' && abilityMode.step === 'selectPosition') {
    return t('interaction.sw.huijinCallGuardsPosition');
  }

  if (abilityMode.abilityId === 'huijin_ram' && abilityMode.step === 'selectUnit') {
    return t('interaction.sw.huijinRamTarget');
  }

  if (abilityMode.abilityId === 'huijin_ram' && abilityMode.step === 'selectPushDirection') {
    return t('interaction.sw.huijinRamPosition');
  }

  if (abilityMode.abilityId === 'huijin_quick_shot' && abilityMode.step === 'selectUnit') {
    return t('interaction.sw.huijinQuickShot');
  }

  if (abilityMode.abilityId === 'telekinesis_instead' && abilityMode.step === 'selectUnit') {
    const abilityName = t('statusBanners.abilityNames.telekinesis_instead');
    return t('statusBanners.afterAttack.message', { ability: abilityName });
  }

  if (abilityMode.abilityId === 'high_telekinesis_instead' && abilityMode.step === 'selectUnit') {
    const abilityName = t('statusBanners.abilityNames.high_telekinesis_instead');
    return t('statusBanners.afterAttack.message', { ability: abilityName });
  }

  return '';
}
