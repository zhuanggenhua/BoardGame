import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { useOverflowArmyDialog } from '../ui/useOverflowArmyDialog';

function Fixture({ context, regions }: { context: string; regions: string[] }) {
    const dialog = useOverflowArmyDialog(context, regions);
    return <>
        {regions.map(id => <button key={id} onClick={() => dialog.open(id)}>打开 {id}</button>)}
        {dialog.regionId ? <MagnifyOverlay isOpen onClose={() => dialog.close(dialog.regionId!)}
            overlayTestId="army-view" closeLabel="关闭">
            <div data-testid="army-region">{dialog.regionId}</div>
        </MagnifyOverlay> : null}
    </>;
}

it('依次关闭两个地区后不循环弹出，可重开，进入新交互后重新提示', () => {
    const view = render(<Fixture context="turn-1" regions={['A', 'B']} />);
    expect(screen.getByTestId('army-region')).toHaveTextContent('A');
    fireEvent.click(screen.getByTestId('army-view-close'));
    expect(screen.getByTestId('army-region')).toHaveTextContent('B');
    fireEvent.click(screen.getByTestId('army-view-close'));
    expect(screen.queryByTestId('army-region')).toBeNull();
    fireEvent.click(screen.getByText('打开 A'));
    expect(screen.getByTestId('army-region')).toHaveTextContent('A');
    fireEvent.click(screen.getByTestId('army-view-close'));
    expect(screen.queryByTestId('army-region')).toBeNull();
    view.rerender(<Fixture context="turn-2" regions={['A', 'B']} />);
    expect(screen.getByTestId('army-region')).toHaveTextContent('A');
});
