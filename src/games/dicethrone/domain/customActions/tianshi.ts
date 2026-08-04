/** 炽天使专属行动处理器。复杂规则在这里进入领域交互，而不是散落在 UI。 */

import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import type { DiceThroneEvent } from '../types';

const notImplementedYet = (_context: CustomActionContext): DiceThroneEvent[] => [];

const TIANSHi_ACTION_IDS = [
    'tianshi-use-flight',
    'tianshi-divine-arrival-upkeep',
    'tianshi-dazzle-roll',
    'tianshi-divine-purification',
    'tianshi-divine-punishment',
    'tianshi-triumphant-return-roll',
    'tianshi-angelic-cloak',
    'tianshi-holy-strike-card',
    'tianshi-angelic-tactics-card',
    'tianshi-gospel-arrival-card',
    'tianshi-divine-command-card',
    'tianshi-divine-protection-card',
    'tianshi-takeoff-card',
    'tianshi-cherub-card',
    'tianshi-divine-arbitration-card',
    'tianshi-supreme-holiness-card',
    'tianshi-ascension-card',
] as const;

export function registerTianshiCustomActions(): void {
    for (const actionId of TIANSHi_ACTION_IDS) {
        registerCustomActionHandler(actionId, notImplementedYet, { categories: ['other'] });
    }
}
