import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassiveActionOpportunityModal, type PassiveActionOpportunity } from '../PassiveActionOpportunityModal';

const translations: Record<string, string> = {
    'passiveOpportunity.title': '是否发动{{abilityName}}',
    'passiveOpportunity.badge': '攻击后可选能力',
    'passiveOpportunity.description': '本次攻击已经造成 {{damage}} 点伤害，现在可以发动 {{actionLabel}}。',
    'passiveOpportunity.damageLabel': '已造成伤害',
    'passiveOpportunity.damageValue': '{{damage}} 点',
    'passiveOpportunity.costLabel': '需要消耗',
    'passiveOpportunity.noCost': '免费',
    'passiveOpportunity.use': '发动{{actionLabel}}',
    'passiveOpportunity.skip': '不发动，继续',
    'passive.vampireLordBloodPower.name': '鲜血之力',
    'passive.vampireLordBloodPower.healShort': '吸血治疗',
    'passive.vampireLordBloodPower.heal': '拥有至少 4 个鲜血之力时，消耗 4 个鲜血之力，治疗等同于本次成功攻击造成的伤害',
    'tokens.blood_power.name': '鲜血之力',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            const template = translations[key] ?? key;
            return template.replace(/{{(\w+)}}/g, (_, name: string) => String(params?.[name] ?? ''));
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

const opportunity: PassiveActionOpportunity = {
    passive: {
        id: 'vampire-lord-blood-power',
        nameKey: 'passive.vampireLordBloodPower.name',
        actions: [],
    },
    action: {
        type: 'custom',
        labelKey: 'passive.vampireLordBloodPower.healShort',
        cpCost: 0,
        tokenCost: { tokenId: 'blood_power', amount: 4 },
        timing: 'ownRollPhase',
        descriptionKey: 'passive.vampireLordBloodPower.heal',
        customActionId: 'vampire-lord-blood-power-heal-attack-damage',
        requiresCurrentAttackDamageDealt: true,
    },
    actionIndex: 3,
    resolvedDamage: 7,
};

describe('PassiveActionOpportunityModal', () => {
    it('显示暂停原因、主动作和继续入口', () => {
        const onUse = vi.fn();
        const onSkip = vi.fn();

        render(
            <PassiveActionOpportunityModal
                opportunity={opportunity}
                canUse
                canSkip
                onUse={onUse}
                onSkip={onSkip}
            />,
        );

        expect(screen.getByTestId('dicethrone-passive-opportunity-modal')).toHaveTextContent('攻击后可选能力');
        expect(screen.getByTestId('dicethrone-passive-opportunity-modal')).toHaveTextContent('本次攻击已经造成 7 点伤害');
        expect(screen.getByTestId('dicethrone-passive-opportunity-modal')).toHaveTextContent('4 鲜血之力');

        fireEvent.click(screen.getByTestId('dicethrone-passive-opportunity-use-button'));
        fireEvent.click(screen.getByTestId('dicethrone-passive-opportunity-skip-button'));

        expect(onUse).toHaveBeenCalledTimes(1);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });
});
