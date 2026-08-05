import type { AbilityModeState } from './useGameEvents';

type BannerTranslate = (key: string, options?: Record<string, unknown>) => string;

const SHOUREN_POSITION_BANNER_KEYS: Record<string, string> = {
  shouren_bloody_rush: 'interaction.sw.shourenBloodyRushPosition',
  shouren_berserk: 'interaction.sw.shourenBerserkPosition',
  shouren_brute_impact: 'interaction.sw.shourenBruteImpact',
  shouren_primal_fury: 'interaction.sw.shourenPrimalFuryPosition',
};

const YONGHENG_BANNER_KEYS: Record<string, Partial<Record<AbilityModeState['step'], string>>> = {
  yongheng_draw: {
    selectChoice: 'interaction.sw.yonghengDraw',
  },
  yongheng_mental_invasion: {
    selectUnit: 'interaction.sw.yonghengMentalInvasion',
  },
  yongheng_collision: {
    selectUnit: 'interaction.sw.yonghengCollisionTarget',
    selectPushDirection: 'interaction.sw.yonghengCollisionPosition',
  },
  yongheng_warning: {
    selectCards: 'interaction.sw.yonghengWarningCard',
    selectPosition: 'interaction.sw.yonghengWarningPosition',
  },
  yongheng_application: {
    selectCards: 'interaction.sw.yonghengApplicationCard',
    selectUnit: 'interaction.sw.yonghengApplicationTarget',
  },
  yongheng_arouse_fear: {
    selectCards: 'interaction.sw.yonghengForcedDiscard',
  },
  yongheng_punish: {
    selectCards: 'interaction.sw.yonghengForcedDiscard',
  },
  yongheng_continuance: {
    selectChoice: 'interaction.sw.yonghengContinuance',
  },
};

const SHADOW_BANNER_KEYS: Record<string, Partial<Record<AbilityModeState['step'], string>>> = {
  shadow_return_to_shadow: {
    selectUnit: 'interaction.sw.shadowReturnToShadow',
  },
  shadow_judgment: {
    selectUnit: 'interaction.sw.shadowJudgmentTarget',
    selectChoice: 'interaction.sw.shadowJudgmentAmount',
  },
  shadow_tear_the_veil: {
    selectUnit: 'interaction.sw.shadowTearTheVeilUnit',
    selectPosition: 'interaction.sw.shadowTearTheVeilGate',
    selectNewPosition: 'interaction.sw.shadowTearTheVeilPosition',
  },
  shadow_forbidden_knowledge: {
    selectPosition: 'interaction.sw.shadowForbiddenKnowledgeTarget',
  },
  shadow_feint: {
    selectPosition: 'interaction.sw.shadowFeintPosition',
  },
  shadow_shadow_summon: {
    selectPosition: 'interaction.sw.shadowSummonTarget',
    selectNewPosition: 'interaction.sw.shadowSummonPosition',
  },
  shadow_sudden_assault: {
    selectPosition: 'interaction.sw.shadowSuddenAssaultPosition',
  },
};

export function getAbilityModeBannerFallbackText(
  t: BannerTranslate,
  abilityMode: AbilityModeState,
): string {
  if (abilityMode.abilityId === 'fortress_power' && abilityMode.step === 'selectCard') {
    return t('cardSelector.fortressPower');
  }

  if (abilityMode.abilityId === 'huijin_call_guards' && abilityMode.step === 'selectUnit') {
    return t('interaction.sw.huijinCallGuardsTarget');
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

  if (abilityMode.abilityId === 'mogu_decay' && abilityMode.step === 'selectUnit') {
    return t('interaction.sw.moguDecayTarget');
  }

  const yonghengBannerKey = YONGHENG_BANNER_KEYS[abilityMode.abilityId]?.[abilityMode.step];
  if (yonghengBannerKey) {
    return t(yonghengBannerKey);
  }

  const shadowBannerKey = SHADOW_BANNER_KEYS[abilityMode.abilityId]?.[abilityMode.step];
  if (shadowBannerKey) {
    return t(shadowBannerKey);
  }

  const shourenPositionBannerKey = SHOUREN_POSITION_BANNER_KEYS[abilityMode.abilityId];
  if (shourenPositionBannerKey && abilityMode.step === 'selectPosition') {
    return t(shourenPositionBannerKey);
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
