
import { describe, it, expect, vi } from 'vitest';
import { NotFound } from '../NotFound';

// Mock Dependencies
vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(),
}));

vi.mock('../components/common/SEO', () => ({
    SEO: () => null,
}));

describe('NotFound Page', () => {
    it('Should be a valid React Component', () => {
        expect(NotFound).toBeDefined();
        expect(typeof NotFound).toBe('function');
    });

    it('Should be named NotFound', () => {
        expect(NotFound.name).toBe('NotFound');
    });
});
