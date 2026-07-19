import { abilityText } from './abilityTextHelper';
import type { AbilityDef } from './abilities';

export const SHOUREN_ABILITIES: AbilityDef[] = [
  {
    id: 'shouren_recover',
    name: abilityText('shouren_recover', 'name'),
    description: abilityText('shouren_recover', 'description'),
    trigger: 'afterMove',
    effects: [],
  },
  {
    id: 'shouren_encourage',
    name: abilityText('shouren_encourage', 'name'),
    description: abilityText('shouren_encourage', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_blood_bond',
    name: abilityText('shouren_blood_bond', 'name'),
    description: abilityText('shouren_blood_bond', 'description'),
    trigger: 'afterAttack',
    effects: [{ type: 'custom', actionId: 'shouren_blood_bond' }],
  },
  {
    id: 'shouren_biting_frost',
    name: abilityText('shouren_biting_frost', 'name'),
    description: abilityText('shouren_biting_frost', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_frenzy_strike',
    name: abilityText('shouren_frenzy_strike', 'name'),
    description: abilityText('shouren_frenzy_strike', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_northern_magic',
    name: abilityText('shouren_northern_magic', 'name'),
    description: abilityText('shouren_northern_magic', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_slow',
    name: abilityText('shouren_slow', 'name'),
    description: abilityText('shouren_slow', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_bloody_rush',
    name: abilityText('shouren_bloody_rush', 'name'),
    description: abilityText('shouren_bloody_rush', 'description'),
    trigger: 'onSummon',
    effects: [],
  },
  {
    id: 'shouren_berserk',
    name: abilityText('shouren_berserk', 'name'),
    description: abilityText('shouren_berserk', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_primal_fury',
    name: abilityText('shouren_primal_fury', 'name'),
    description: abilityText('shouren_primal_fury', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_brute_impact',
    name: abilityText('shouren_brute_impact', 'name'),
    description: abilityText('shouren_brute_impact', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'shouren_reckless_strike',
    name: abilityText('shouren_reckless_strike', 'name'),
    description: abilityText('shouren_reckless_strike', 'description'),
    trigger: 'passive',
    effects: [],
  },
];
