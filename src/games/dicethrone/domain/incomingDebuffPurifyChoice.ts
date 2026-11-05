/**
 * Serialized choice IDs are kept stable so an interaction already in flight
 * remains resolvable while the choice is shared by incoming debuffs.
 */
export const INCOMING_DEBUFF_PURIFY_CHOICE_SOURCE_ID = 'daze-extra-attack-response';
export const INCOMING_DEBUFF_USE_PURIFY_CUSTOM_ID = 'daze-extra-attack-use-purify';
export const INCOMING_DEBUFF_DECLINE_PURIFY_CUSTOM_ID = 'daze-extra-attack-continue';

/** Backward-compatible names for older saved prompts and existing consumers. */
export const DAZE_EXTRA_ATTACK_CHOICE_SOURCE_ID = INCOMING_DEBUFF_PURIFY_CHOICE_SOURCE_ID;
export const DAZE_EXTRA_ATTACK_USE_PURIFY_CUSTOM_ID = INCOMING_DEBUFF_USE_PURIFY_CUSTOM_ID;
export const DAZE_EXTRA_ATTACK_CONTINUE_CUSTOM_ID = INCOMING_DEBUFF_DECLINE_PURIFY_CUSTOM_ID;
