// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IsoPlan } from '../src/IsoPlan';
import { saas } from '../demo/src/examples';

afterEach(cleanup);

const piece = (c: HTMLElement, id: string) => c.querySelector<SVGGElement>(`.iso-piece[data-id="${id}"]`)!;
const lit = (c: HTMLElement, selector: string) =>
    [...c.querySelectorAll(`${selector}.is-on`)].map((t) => `${t.getAttribute('data-from')}>${t.getAttribute('data-to')}`);

describe('<IsoPlan>', () => {
    it('renders an accessible svg with focusable pieces', () => {
        const { container } = render(<IsoPlan graph={saas} title="SaaS architecture" />);
        const svg = screen.getByRole('img', { name: 'SaaS architecture' });
        expect(svg.querySelector('title')!.textContent).toBe('SaaS architecture');
        const pieces = container.querySelectorAll('.iso-piece');
        expect(pieces).toHaveLength(saas.nodes.length);
        for (const p of pieces) {
            expect(p.getAttribute('tabindex')).toBe('0');
            expect(p.getAttribute('role')).toBe('button');
            expect(p.getAttribute('aria-label')).toMatch(/^\d+ /);
        }
        expect(container.querySelector('.iso-stats')!.textContent).toBe('14 pieces13 links5 areas');
    });

    it('lights the hovered piece, its tracks, its flows and its linked pieces', () => {
        const { container } = render(<IsoPlan graph={saas} title="t" />);
        const scene = container.querySelector('.iso-scene')!;
        fireEvent.mouseOver(piece(container, 'queue'));
        expect(scene.getAttribute('data-on')).toBe('queue');
        expect(lit(container, '.iso-track').sort()).toEqual(['api>queue', 'queue>mailer']);
        expect(lit(container, '.iso-flow').sort()).toEqual(['api>queue', 'queue>mailer']);
        expect(piece(container, 'queue').classList.contains('is-on')).toBe(true);
        expect([...container.querySelectorAll('.iso-piece.is-linked')].map((p) => p.getAttribute('data-id')).sort()).toEqual(['api', 'mailer']);
        expect(container.querySelector('.iso-label[data-id="api"]')!.classList.contains('is-linked')).toBe(true);

        fireEvent.mouseLeave(scene);
        expect(scene.hasAttribute('data-on')).toBe(false);
        expect(lit(container, '.iso-track')).toEqual([]);
    });

    it('lights both flows of a two-way edge', () => {
        const { container } = render(<IsoPlan graph={saas} title="t" />);
        fireEvent.mouseOver(piece(container, 'cache'));
        expect(lit(container, '.iso-flow')).toEqual(['api>cache', 'api>cache']);
    });

    it('shows the piece and its links in the info bar', () => {
        const { container } = render(<IsoPlan graph={saas} title="t" />);
        const info = container.querySelector('.iso-info')!;
        expect(info.textContent).toBe('Hover or focus a piece: it lights up with its links.');
        fireEvent.focusIn(piece(container, 'api'));
        const n = (id: string) => container.querySelector(`.iso-piece[data-id="${id}"]`)!.getAttribute('aria-label');
        expect(info.textContent).toBe(
            `#${n('api')!.split(' ')[0]} API · REST + auth · calls: ${n('cache')} (sessions), ${n('db')} (SQL), ${n('queue')} (enqueue)` +
                ` · called by: ${n('web')} (JSON), ${n('ci')} (deploy)`,
        );
    });

    it('omits empty link labels and accepts custom copy', () => {
        const graph = { nodes: [{ id: 'a', label: 'A', kind: 'user' }, { id: 'b', label: 'B', kind: 'web' }], edges: [{ from: 'a', to: 'b' }] };
        const { container } = render(<IsoPlan graph={graph} title="t" copy={{ out: 'saem para', number: 'nº ' }} />);
        fireEvent.mouseOver(piece(container, 'a'));
        expect(container.querySelector('.iso-info')!.textContent).toBe('nº 1 A · saem para: 2 B');
    });

    it('calls onSelect on click and on Enter', () => {
        const onSelect = vi.fn();
        const { container } = render(<IsoPlan graph={saas} title="t" onSelect={onSelect} />);
        fireEvent.click(piece(container, 'db'));
        fireEvent.keyDown(piece(container, 'web'), { key: 'Enter' });
        fireEvent.keyDown(piece(container, 'web'), { key: 'a' });
        expect(onSelect.mock.calls.map(([p]) => p.id)).toEqual(['db', 'web']);
    });

    it('opens full screen in a portal and closes it with Escape', () => {
        const { container } = render(<IsoPlan graph={saas} title="t" theme="light" />);
        expect(container.querySelector('.isoplan')!.getAttribute('data-theme')).toBe('light');
        fireEvent.click(screen.getByRole('button', { name: '[full screen]' }));
        const full = document.body.querySelector('.isoplan.is-full')!;
        expect(full.parentElement).toBe(document.body);
        expect(document.body.style.overflow).toBe('hidden');
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(document.body.querySelector('.isoplan.is-full')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('hides the toggle and the flows when asked', () => {
        const { container } = render(<IsoPlan graph={saas} title="t" expandable={false} flows={false} />);
        expect(container.querySelector('.iso-toggle')).toBeNull();
        expect(container.querySelector('.iso-flow')).toBeNull();
    });
});
