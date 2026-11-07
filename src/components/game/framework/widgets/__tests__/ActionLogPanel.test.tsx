/* @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionLogPanel } from '../ActionLogPanel';
import type { ActionLogRow } from '../../../utils/actionLogFormat';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'hud.actionLog.empty' ? 'No action log' : key }) }));
afterEach(cleanup);
const row: ActionLogRow = { id: 'public-entry', actorId: '0', timeLabel: '12:34:56', playerLabel: 'Alice', text: 'Public action', segments: [{ type: 'text', text: 'Public action' }] };

describe('shared action-log list presentation', () => {
  it('keeps supplied order, player labels and time metadata', () => {
    render(<ActionLogPanel rows={[{ ...row, id: 'second', playerLabel: 'Bob' }, row]} locale="en" />);
    const rows = screen.getAllByTestId('hud-action-log-row');
    expect(rows[0]).toHaveTextContent('Bob'); expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[0]).toHaveTextContent('12:34:56'); expect(rows[1]).toHaveTextContent('Public action');
  });
  it('preserves game-specific card lookup context and readable fallback', () => {
    const getCardPreviewRef = vi.fn(() => null);
    render(<ActionLogPanel rows={[{ ...row, segments: [{ type: 'card', cardId: 'internal-book', previewText: 'Mage Book' }] }]} locale="en" getCharacterId={() => 'wizard'} getCardPreviewRef={getCardPreviewRef} cardPreviewMaxDim={400} />);
    expect(getCardPreviewRef).toHaveBeenCalledWith('internal-book', { playerId: '0', characterId: 'wizard' });
    expect(screen.getByTestId('hud-action-log-row')).toHaveTextContent('Mage Book');
    expect(screen.getByTestId('hud-action-log-row')).not.toHaveTextContent('internal-book');
  });
  it('uses the existing empty state without fabricating entries', () => {
    render(<ActionLogPanel rows={[]} />);
    expect(screen.getByText('No action log')).toBeInTheDocument();
    expect(screen.queryByTestId('hud-action-log-row')).not.toBeInTheDocument();
  });
});
