import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CSSProperties } from 'react';
import { MageWarsMageSelectionGate } from '../ui/MageSelectionGate';
import { resolveMageWarsLocalSetup } from '../runtimeAdapter';
import {
    MAGE_WARS_SAVED_SPELLBOOK_LIMIT,
    MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY,
} from '../domain/savedSpellbooks';
import { getMageWarsDefaultSpellbookEntries } from '../roomSetup';

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        i18n: { language: 'zh-CN' },
        t: (key: string, params?: Record<string, string | number>) => {
            const labels: Record<string, string> = {
                'setup.mageSelection.eyebrow': '标准起始法术书',
                'setup.mageSelection.title': '选择双方法术书',
                'setup.mageSelection.description': '为双方各直接选择一本法术书；每本法术书已绑定法师，确认后按所选书初始化开局。',
                'setup.mageSelection.confirm': '确认法术书并开始',
                'setup.mageSelection.seats': '双方用书',
                'setup.mageSelection.mageGrid': '可选法术书',
                'setup.mageSelection.summary': '选书摘要',
                'setup.mageSelection.spellbookLibrary': '法术书库',
                'setup.mageSelection.activeSpellbookAria': '可选法术书库',
                'setup.mageSelection.activeSpellbookTitle': '选中法术书',
                'setup.mageSelection.editCurrentSpellbook': '编辑选中书',
                'setup.mageSelection.spellbookLibraryHelp': '标准起始书和命名副本同屏同级；点击一本书会同时绑定对应法师。',
                'setup.mageSelection.standardSpellbook': '标准起始书',
                'setup.mageSelection.newSpellbook': '新建法术书',
                'setup.mageSelection.newSpellbookAria': '选择绑定法师后新建法术书',
                'setup.mageSelection.newSpellbookMageAria': '选择新建法术书绑定的法师',
                'setup.mageSelection.newSpellbookMageTitle': '选择新书绑定法师',
                'setup.mageSelection.newSpellbookMageDescription': '选择一名法师作为新法术书的训练规则和标准起始书来源。',
                'setup.mageSelection.newSpellbookMageDraftSource': '标准起始书底稿',
                'setup.mageSelection.diyBadge': 'DIY',
                'setup.mageSelection.edit': '编辑',
                'setup.mageSelection.delete': '删除',
                'setup.seat0Mage.label': 'P1 法术书',
                'setup.seat1Mage.label': 'P2 法术书',
                'spellbookBuilder.eyebrow': '法师战争 / 法术书构筑器',
                'spellbookBuilder.title': '法术书构筑',
                'spellbookBuilder.mageContextAria': '{{mage}}，查看法师规则卡',
                'spellbookBuilder.viewMageAbilityCard': '能力牌',
                'spellbookBuilder.libraryAria': '法术书库',
                'spellbookBuilder.libraryTitle': '法术书库',
                'spellbookBuilder.libraryDescription': '标准起始书和命名副本同级；新建先选择绑定法师',
                'spellbookBuilder.importList': '导入列表',
                'spellbookBuilder.savedListAria': '法术书库列表',
                'spellbookBuilder.standardSpellbook': '标准起始书',
                'spellbookBuilder.newSpellbook': '新建法术书',
                'spellbookBuilder.newSpellbookAria': '选择绑定法师后新建法术书',
                'spellbookBuilder.newSpellbookHint': '先选绑定法师',
                'spellbookBuilder.diyBadge': 'DIY',
                'spellbookBuilder.selectedBookStatus': '已选中',
                'spellbookBuilder.selectBookStatus': '选择',
                'spellbookBuilder.saveNameLabel': '法术书名称',
                'spellbookBuilder.saveNamePlaceholder': '命名副本名称',
                'spellbookBuilder.saveAsNew': '另存新书',
                'spellbookBuilder.updateSaved': '更新选中副本',
                'spellbookBuilder.capacityAria': '法术书容量与构筑限制',
                'spellbookBuilder.abilityCardLimit': '能力牌上限',
                'spellbookBuilder.currentCompositionLabel': '书内构成',
                'spellbookBuilder.poolAria': '法术牌库',
                'spellbookBuilder.poolTitle': '法术牌库',
                'spellbookBuilder.poolDescription': '点卡牌加入；数量和移除在右侧清单处理',
                'spellbookBuilder.filterAria': '法术筛选',
                'spellbookBuilder.searchPlaceholder': '搜索法术',
                'spellbookBuilder.searchAria': '搜索法术',
                'spellbookBuilder.typeFilterAria': '类型筛选',
                'spellbookBuilder.schoolFilterAria': '学派筛选',
                'spellbookBuilder.schoolAll': '学派 / 元素：全部',
                'spellbookBuilder.levelFilterAria': '等级筛选',
                'spellbookBuilder.manaFilterAria': '法力费用筛选',
                'spellbookBuilder.statusFilterAria': '状态筛选',
                'spellbookBuilder.cardStatusRestricted': '不可加入',
                'spellbookBuilder.cardStatusAtLimit': '已达上限；先从清单移除',
                'spellbookBuilder.cardStatusInBook': '已在书内',
                'spellbookBuilder.cardStatusAdd': '加入',
                'spellbookBuilder.currentListAria': '法术书清单',
                'spellbookBuilder.currentListTitle': '法术书清单',
                'spellbookBuilder.currentListDescription': '真实缩略、数量上限与本条占用',
                'spellbookBuilder.scrollWholeBook': '滚动查看整本书',
                'spellbookBuilder.back': '返回',
                'spellbookBuilder.confirm': '确认法术书',
                'spellbookBuilder.mageDetailAria': '法师规则卡',
                'spellbookBuilder.mageDetailDescription': '这份构筑按这张法师能力牌的训练方向计算。需要更换法师时，返回选书页选择另一本绑定对应法师的法术书。',
                'spellbookBuilder.trainedDirection': '受训方向',
                'spellbookBuilder.opposedDirection': '相斥方向',
                'spellbookBuilder.currentListLabel': '法术书清单',
                'spellbookBuilder.none': '无',
                'spellbookBuilder.close': '关闭',
                'spellbookBuilder.type.all': '类型：全部',
                'spellbookBuilder.type.attack': '攻击',
                'spellbookBuilder.type.enchantment': '结界',
                'spellbookBuilder.type.creature': '生物',
                'spellbookBuilder.type.conjuration': '魔物',
                'spellbookBuilder.type.incantation': '咒语',
                'spellbookBuilder.type.equipment': '装备',
                'spellbookBuilder.type.wall': '墙体',
                'spellbookBuilder.level.all': '等级：全部',
                'spellbookBuilder.legality.all': '状态：全部',
                'spellbookBuilder.legality.addable': '可加入',
                'spellbookBuilder.legality.inBook': '书内',
                'spellbookBuilder.legality.restricted': '不可加入',
                'spellbookBuilder.manaFilter.all': '法力：全部',
                'spellbookBuilder.manaFilter.variable': '法力：X',
                'spellbookBuilder.training.trained': '受训',
                'spellbookBuilder.training.untrained': '未受训',
                'spellbookBuilder.training.opposed': '相斥',
            };
            if (key === 'setup.mageSelection.spellbookCardSummary') return `${params?.count} 张`;
            if (key === 'setup.mageSelection.savedLimit') return `${params?.count} / ${params?.limit} 本`;
            if (key === 'setup.mageSelection.savedLimitReached') return `已达 ${params?.limit} 本`;
            if (key === 'setup.mageSelection.spellbookCount') return `法术书 ${params?.count}`;
            if (key === 'setup.mageSelection.summaryLine') return `法术书 ${params?.spellbook} 张`;
            if (key === 'setup.mageSelection.newSpellbookMageOptionAria') return `用 ${params?.mage} 新建法术书`;
            if (key === 'spellbookBuilder.standardPresetSummary') return `${params?.count}张 · 规则书预设`;
            if (key === 'spellbookBuilder.savedCopySummary') return `${params?.count}张 · 命名副本`;
            if (key === 'spellbookBuilder.savedLimit') return `${params?.count} / ${params?.limit} 本`;
            if (key === 'spellbookBuilder.savedLimitReached') return `已达 ${params?.limit} 本`;
            if (key === 'spellbookBuilder.loadSavedAria') return `载入 ${params?.name}`;
            if (key === 'spellbookBuilder.deleteSavedAria') return `删除 ${params?.name}`;
            if (key === 'spellbookBuilder.pointsUsed') return `法术点 ${params?.used} / ${params?.limit}`;
            if (key === 'spellbookBuilder.currentComposition') return `${params?.cards} 张 / ${params?.entries} 条`;
            if (key === 'spellbookBuilder.filteredCount') return `${params?.filtered} / ${params?.total} 张`;
            if (key === 'spellbookBuilder.cardStatusPointBlocked') return `需 ${params?.points} 点；先腾出容量`;
            if (key === 'spellbookBuilder.cardTitle') return `${params?.name}：${params?.status}`;
            if (key === 'spellbookBuilder.cardAria') return `${params?.name}，${params?.status}`;
            if (key === 'spellbookBuilder.visibleRange') return `显示 ${params?.range} / ${params?.total} 条`;
            if (key === 'spellbookBuilder.schoolTrainingSummary') return `${params?.schools} · ${params?.training}`;
            if (key === 'spellbookBuilder.pointsCompact') return `${params?.points}点`;
            if (key === 'spellbookBuilder.level.value') return `等级：${params?.value}`;
            if (key === 'spellbookBuilder.manaFilter.range') return `法力：${params?.value}`;
            if (key === 'spellbookBuilder.removeCardAria') return `移除 ${params?.name}`;
            if (key === 'spellbookBuilder.addCardAria') return `加入 ${params?.name}`;
            if (key === 'spellbookBuilder.status.saved') return `已保存 ${params?.name}`;
            if (key === 'spellbookBuilder.status.newDraft') return '已准备另存新书';
            if (key === 'spellbookBuilder.status.limitReached') return `最多保存 ${params?.limit} 本法术书`;
            if (key === 'spellbookBuilder.status.updated') return `已更新 ${params?.name}`;
            if (key === 'spellbookBuilder.status.loadedSaved') return `已载入 ${params?.name}`;
            if (key === 'spellbookBuilder.status.deleted') return `已删除 ${params?.name}`;
            return labels[key]?.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params?.[token] ?? '')) ?? key;
        },
    }),
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({
        className,
        style,
        title,
    }: {
        className?: string;
        style?: CSSProperties;
        title?: string;
    }) => (
        <div
            data-testid="mock-card-preview"
            data-card-atlas-frame="true"
            data-card-atlas-aspect-ratio={String(style?.aspectRatio ?? '')}
            data-card-title={title ?? ''}
            className={className}
            style={style}
        />
    ),
}));

vi.mock('../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({
        className,
        style,
        alt,
        title,
        ...rest
    }: {
        className?: string;
        style?: CSSProperties;
        alt?: string;
        title?: string;
    }) => (
        <img
            data-testid="mock-optimized-image"
            className={className}
            style={style}
            alt={alt ?? ''}
            title={title}
            {...rest}
        />
    ),
}));

function renderGate(onConfirm = vi.fn()) {
    render(
        <MageWarsMageSelectionGate
            mode="local"
            searchParams={new URLSearchParams()}
            initialSetup={resolveMageWarsLocalSetup({ searchParams: new URLSearchParams() })}
            onConfirm={onConfirm}
        />,
    );
    return onConfirm;
}

function countText(root: HTMLElement, pattern: RegExp): number {
    return Array.from((root.textContent ?? '').matchAll(pattern)).length;
}

describe('MageWarsMageSelectionGate spellbook builder', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('shows spellbooks as the primary selection objects instead of separate mage cards', () => {
        renderGate();

        const library = screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list');
        expect(screen.getByRole('heading', { name: '选择双方法术书' })).toBeInTheDocument();
        expect(screen.queryByTestId('mage-wars-mage-selection-card-beastmaster_apprentice')).toBeNull();
        expect(screen.queryByTestId('mage-wars-mage-selection-card-priestess_apprentice')).toBeNull();
        expect(within(library).getAllByTestId('mage-wars-mage-selection-standard-spellbook')).toHaveLength(4);
        expect(within(library).getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toHaveTextContent('新建法术书');
        expect(within(library).getByTestId('mage-wars-mage-selection-new-spellbook-entry'))
            .toHaveAttribute('data-saved-spellbook-limit', String(MAGE_WARS_SAVED_SPELLBOOK_LIMIT));
        expect(library).not.toHaveTextContent('暂无命名副本');
        expect(within(library).getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice')).toHaveTextContent('标准起始书');
        expect(within(library).getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice')).toHaveTextContent('兽王');
        expect(library.querySelector('[data-testid^="mage-wars-mage-selection-edit-standard-spellbook-"]')).toBeNull();
        expect(screen.queryByText('编辑并另存')).toBeNull();
        expect(library.textContent).not.toMatch(/点击使用|已使用/u);
    });

    it('opens a standard-based spellbook library without seat, detail, xN, blank, or duplicate overall capacity owners', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));

        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(builder).toBeVisible();
        expect(builder).toHaveAttribute('data-saved-spellbook-limit', String(MAGE_WARS_SAVED_SPELLBOOK_LIMIT));
        expect(within(builder).getByText('法术书构筑')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-type')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-school')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-level')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-mana')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-legality')).toBeInTheDocument();

        expect(builder.textContent).not.toMatch(/席位|\bP1\b|\bP2\b|xN|兽王标准书|当前法师：|当前法术书|当前法师法术书库|编辑当前书|更新当前副本|给当前书取名|新书从当前书|新书从选中书|从选中书新建|从选中书保存命名副本|当前书内|详情|缺图|DIY 法术书|空白自组|还没有 DIY/u);
        expect(builder.textContent).not.toMatch(/全部卡牌/u);
        expect(countText(builder, /法术点/g)).toBe(1);
        expect(countText(builder, /120\s*\/\s*120/g)).toBe(1);
        expect(countText(builder, /兽王/g)).toBeLessThanOrEqual(1);
        const typeOptions = Array.from(
            within(builder).getByTestId('mage-wars-spellbook-builder-filter-type').querySelectorAll('option'),
        ).map((option) => option.textContent ?? '');
        expect(typeOptions).toEqual(expect.arrayContaining(['类型：全部', '攻击', '结界', '生物', '魔物', '咒语', '装备', '墙体']));
        const manaOptions = Array.from(
            within(builder).getByTestId('mage-wars-spellbook-builder-filter-mana').querySelectorAll('option'),
        ).map((option) => option.textContent ?? '');
        expect(manaOptions).toEqual(expect.arrayContaining(['法力：全部', '法力：0-2', '法力：3-5', '法力：6-8', '法力：9+', '法力：X']));
        const schoolOptions = Array.from(
            within(builder).getByTestId('mage-wars-spellbook-builder-filter-school').querySelectorAll('option'),
        ).map((option) => option.textContent ?? '');
        expect(schoolOptions).toEqual(expect.arrayContaining(['自然', '火焰', '圣光', '黑暗']));
        expect(schoolOptions).not.toEqual(expect.arrayContaining(['蝙蝠', '手套', '靴子', '传送门', '胸甲']));
        expect(builder.querySelector('[data-testid="mage-wars-spellbook-builder-scope-filters"]')).toBeNull();
        expect(builder.querySelectorAll('.mage-context[data-mage-detail-open]').length).toBe(1);
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-mage-detail-cue')).toBeInTheDocument();
        expect(builder.textContent).not.toMatch(/点击查看能力牌/u);
        expect(builder.querySelectorAll('[data-testid^="mage-wars-spellbook-builder-mage-option-"]').length).toBe(0);
        expect(builder.querySelector('.mage-detail-trigger')).toBeNull();
        expect(builder.querySelector('[data-testid="mage-wars-spellbook-builder-blank"]')).toBeNull();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook')).toBeEnabled();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-name')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-new')).toHaveTextContent('另存新书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-card-pool-grid'))
            .toHaveAttribute('data-min-card-width-rem', '10.5');
        expect(within(builder).queryByTestId('mage-wars-spellbook-builder-saved-list')).toBeNull();
        expect(builder.textContent).not.toMatch(/标准起始书和命名副本同级|真实缩略、数量上限|滚动查看整本书|数量：1级|成本：受训/u);
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-library-toggle'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('标准起始书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).not.toHaveTextContent('暂无命名副本');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook-entry')).toHaveTextContent('新建法术书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-limit'))
            .toHaveTextContent(`0 / ${MAGE_WARS_SAVED_SPELLBOOK_LIMIT} 本`);
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-standard')).toHaveAttribute('data-active', 'true');

        const deckRows = within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row');
        expect(deckRows.length).toBeGreaterThan(20);
        for (const row of deckRows.slice(0, 8)) {
            expect(
                row.querySelector('[data-card-atlas-frame="true"], img[data-card-fallback]'),
            ).not.toBeNull();
            expect(row.textContent).toMatch(/\d+\s*\/\s*\d+/u);
            expect(row.textContent).toMatch(/\d+点/u);
        }
    });

    it('uses the active mage itself to open rule-card details', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-mage-context'));

        const detail = within(builder).getByTestId('mage-wars-spellbook-builder-mage-detail');
        expect(detail).toBeVisible();
        expect(within(detail).getByTestId('mock-card-preview')).toHaveAttribute('data-card-title', '兽王');
        expect(detail).toHaveTextContent('受训方向');
        expect(detail).toHaveTextContent('相斥方向');
    });

    it('opens a new named spellbook draft from the selection-page plus entry', () => {
        renderGate();

        const library = screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list');
        fireEvent.click(within(library).getByTestId('mage-wars-mage-selection-new-spellbook-entry'));

        const picker = screen.getByTestId('mage-wars-new-spellbook-mage-picker');
        expect(picker).toBeVisible();
        expect(picker).toHaveTextContent('选择新书绑定法师');
        expect(within(picker).getAllByTestId(/mage-wars-new-spellbook-mage-option-/u)).toHaveLength(4);
        expect(screen.queryByTestId('mage-wars-spellbook-builder')).toBeNull();
        fireEvent.click(within(picker).getByTestId('mage-wars-new-spellbook-mage-option-priestess_apprentice'));

        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(builder).toBeVisible();
        expect(builder).toHaveAttribute('data-mage-id', 'priestess_apprentice');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status'))
            .toHaveTextContent('已准备另存新书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-name')).toHaveValue('');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-update-saved')).toBeDisabled();
        expect(within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row'))
            .toHaveLength(getMageWarsDefaultSpellbookEntries('priestess_apprentice').length);

        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-library-toggle'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-standard')).toHaveAttribute('data-active', 'false');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook-entry')).toHaveAttribute('data-active', 'true');

        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '从加号新建的书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            mageId: 'priestess_apprentice',
            name: '从加号新建的书',
        });
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status'))
            .toHaveTextContent('已保存 从加号新建的书');
    });

    it('routes the builder plus entry through mage selection before creating a new spellbook', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        let builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(builder).toHaveAttribute('data-mage-id', 'beastmaster_apprentice');
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook'));

        const picker = screen.getByTestId('mage-wars-new-spellbook-mage-picker');
        expect(picker).toBeVisible();
        fireEvent.click(within(picker).getByTestId('mage-wars-new-spellbook-mage-option-wizard_apprentice'));

        builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(builder).toHaveAttribute('data-mage-id', 'wizard_apprentice');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-name')).toHaveValue('');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status'))
            .toHaveTextContent('已准备另存新书');
        expect(within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row'))
            .toHaveLength(getMageWarsDefaultSpellbookEntries('wizard_apprentice').length);
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '巫师新书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            mageId: 'wizard_apprentice',
            name: '巫师新书',
        });
    });

    it('disables new spellbook entry points when ten named spellbooks are saved', () => {
        window.localStorage.setItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY, JSON.stringify(
            Array.from({ length: MAGE_WARS_SAVED_SPELLBOOK_LIMIT }, (_, index) => ({
                id: `saved-${index + 1}`,
                mageId: index % 2 === 0 ? 'beastmaster_apprentice' : 'priestess_apprentice',
                name: `命名法术书 ${index + 1}`,
                entries: [{ spellCardId: 2906, count: 1 }],
                createdAt: `2026-08-28T00:00:${String(index).padStart(2, '0')}.000Z`,
                updatedAt: `2026-08-28T00:00:${String(index).padStart(2, '0')}.000Z`,
            })),
        ));
        renderGate();

        const selectionNewEntry = screen.getByTestId('mage-wars-mage-selection-new-spellbook-entry');
        expect(selectionNewEntry).toBeDisabled();
        expect(selectionNewEntry).toHaveTextContent(`已达 ${MAGE_WARS_SAVED_SPELLBOOK_LIMIT} 本`);

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook')).toBeDisabled();
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '不能保存的第十一本' },
        });
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-new')).toBeDisabled();
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-library-toggle'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook-entry')).toBeDisabled();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-limit'))
            .toHaveTextContent(`${MAGE_WARS_SAVED_SPELLBOOK_LIMIT} / ${MAGE_WARS_SAVED_SPELLBOOK_LIMIT} 本`);
    });

    it('saves a named spellbook copy from the selected mage standard spellbook and sends it into setupData', () => {
        const onConfirm = renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王标准命名书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));

        const standardEntries = getMageWarsDefaultSpellbookEntries('beastmaster_apprentice');
        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            mageId: 'beastmaster_apprentice',
            name: '兽王标准命名书',
        });
        expect(stored[0].entries).toHaveLength(standardEntries.length);
        expect(stored[0].entries.reduce((total: number, entry: { count: number }) => total + entry.count, 0)).toBe(67);
        expect(stored[0].entries).toContainEqual({ spellCardId: 2906, count: 2 });
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status')).toHaveTextContent('已保存 兽王标准命名书');
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-library-toggle'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('标准起始书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-spellbook')).toHaveTextContent('兽王标准命名书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-spellbook-diy-badge'))
            .toHaveTextContent('DIY');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-update-saved')).toBeEnabled();

        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-standard'));
        expect(within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row').length).toBeGreaterThan(20);
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-library-toggle'));
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-spellbook'));
        const deckRows = within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row');
        expect(deckRows).toHaveLength(standardEntries.length);
        const lynxRow = deckRows.find((row) => row.getAttribute('data-source-card-id') === '2906');
        expect(lynxRow).toBeTruthy();
        expect(lynxRow).toHaveTextContent('2 / 6');

        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-confirm'));
        expect(screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list')).toHaveTextContent('标准起始书');
        expect(screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list')).toHaveTextContent('兽王标准命名书');
        expect(within(screen.getByTestId('mage-wars-mage-selection-saved-spellbook'))
            .getByTestId('mage-wars-mage-selection-saved-spellbook-diy-badge'))
            .toHaveTextContent('DIY');
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute(
            'data-saved-spellbook-id',
            stored[0].id,
        );
        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-confirm'));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const submittedEntries = onConfirm.mock.calls[0][0].setupData.mageWarsSeat0SpellbookEntries;
        expect(submittedEntries).toHaveLength(standardEntries.length);
        expect(submittedEntries).toContainEqual({ spellCardId: 2906, count: 2 });
    });

    it('lets a selected saved spellbook update the original or save a separate new copy', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        let builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '原始命名书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        const originalId = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]')[0].id;
        fireEvent.click(within(builder).getByText('返回'));

        const savedList = screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list');
        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-edit-saved-spellbook'));
        builder = screen.getByTestId('mage-wars-spellbook-builder');
        const lynxRow = builder.querySelector('[data-testid="mage-wars-spellbook-builder-deck-row"][data-source-card-id="2906"]') as HTMLElement;
        fireEvent.click(within(lynxRow).getByLabelText(/移除/u));
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '原书已更新' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-update-saved'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status')).toHaveTextContent('已更新 原书已更新');

        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '另存的新书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        expect(stored).toHaveLength(2);
        expect(stored.map((spellbook: { name: string }) => spellbook.name))
            .toEqual(['另存的新书', '原书已更新']);
        expect(stored.map((spellbook: { id: string }) => spellbook.id)).toContain(originalId);
        expect(new Set(stored.map((spellbook: { id: string }) => spellbook.id)).size).toBe(2);
    });

    it('keeps saved spellbooks scoped to the mage selected before opening the builder', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        let builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王标准副本' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        fireEvent.click(within(builder).getByText('返回'));

        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice'));
        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        builder = screen.getByTestId('mage-wars-spellbook-builder');

        expect(builder).toHaveAttribute('data-mage-id', 'priestess_apprentice');
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-library-toggle'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('标准起始书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).not.toHaveTextContent('兽王标准副本');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).not.toHaveTextContent('暂无命名副本');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-new-spellbook-entry'))
            .toHaveTextContent('新建法术书');
    });

    it('surfaces standard and named spellbooks on the same selection-page library for direct use, edit, and delete', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        let builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王命名副本' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        fireEvent.click(within(builder).getByText('返回'));

        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        const savedId = stored[0].id as string;
        const savedList = screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list');
        expect(savedList).toHaveTextContent('标准起始书');
        expect(savedList).toHaveTextContent('兽王命名副本');
        expect(within(savedList).getByTestId('mage-wars-mage-selection-saved-spellbook-diy-badge'))
            .toHaveTextContent('DIY');
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', savedId);

        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice'));
        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice'));
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', '');
        expect(screen.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice')
            .closest('[data-testid="mage-wars-mage-selection-standard-spellbook"]'))
            .toHaveAttribute('data-active', 'true');
        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-use-saved-spellbook'));
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveTextContent('法术书 67 张');
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', savedId);

        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-edit-saved-spellbook'));
        builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-name')).toHaveValue('兽王命名副本');
        const lynxRow = builder.querySelector('[data-testid="mage-wars-spellbook-builder-deck-row"][data-source-card-id="2906"]') as HTMLElement;
        expect(lynxRow).toHaveTextContent('2 / 6');
        fireEvent.click(within(lynxRow).getByLabelText(/移除/u));
        expect(lynxRow).toHaveTextContent('1 / 6');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王命名更新书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-update-saved'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status')).toHaveTextContent('已更新 兽王命名更新书');
        fireEvent.click(within(builder).getByText('返回'));
        expect(savedList).toHaveTextContent('兽王命名更新书');
        expect(savedList).toHaveTextContent('66 张');

        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-delete-saved-spellbook'));
        expect(savedList).toHaveTextContent('标准起始书');
        expect(savedList).not.toHaveTextContent('暂无命名副本');
        expect(within(savedList).getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toHaveTextContent('新建法术书');
        expect(JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]')).toEqual([]);
    });
});
