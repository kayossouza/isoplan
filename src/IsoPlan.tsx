import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { escapeXml, renderPlan, type AreaLabels, type Graph, type Piece } from './core';

/** On-screen text of the component. Override any key for i18n. */
export interface IsoPlanCopy {
    /** Shown in the info bar while nothing is highlighted. */
    hint: string;
    /** Prefix of the outgoing links. */
    out: string;
    /** Prefix of the incoming links. */
    in: string;
    /** Prefix of the piece number. */
    number: string;
    pieces: string;
    links: string;
    areas: string;
    expand: string;
    close: string;
}

export const DEFAULT_COPY: IsoPlanCopy = {
    hint: 'Hover or focus a piece: it lights up with its links.',
    out: 'calls',
    in: 'called by',
    number: '#',
    pieces: 'pieces',
    links: 'links',
    areas: 'areas',
    expand: 'full screen',
    close: 'close',
};

export interface IsoPlanProps {
    graph: Graph;
    /** Accessible name of the drawing. */
    title: string;
    /** Default "neon". */
    theme?: 'neon' | 'light';
    /** Animated flows along every track. Default true. */
    flows?: boolean;
    /** Flow speed in SVG units per second. Default 48. */
    flowSpeed?: number;
    /** Names of the implicit areas. */
    labels?: Partial<AreaLabels>;
    copy?: Partial<IsoPlanCopy>;
    /** Shows the full screen toggle. Default true. */
    expandable?: boolean;
    /** Called when a piece is clicked or activated with Enter or Space. */
    onSelect?: (piece: Piece) => void;
    className?: string;
}

// Hovering or focusing a piece lights it, its tracks, its flows and the pieces it talks to.
export function IsoPlan({
    graph,
    title,
    theme = 'neon',
    flows = true,
    flowSpeed,
    labels,
    copy: copyOverride,
    expandable = true,
    onSelect,
    className,
}: IsoPlanProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState<string | null>(null);
    const [full, setFull] = useState(false);
    const plan = useMemo(
        () => renderPlan(graph, { flows, flowSpeed, labels }),
        [graph, flows, flowSpeed, labels?.user, labels?.external, labels?.repo],
    );
    const copy = { ...DEFAULT_COPY, ...copyOverride };
    const byId = useMemo(() => new Map(plan.pieces.map((p) => [p.id, p])), [plan]);
    const select = useRef(onSelect);
    select.current = onSelect;

    useEffect(() => {
        if (!full) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && setFull(false);
        window.addEventListener('keydown', close);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', close);
            document.body.style.overflow = '';
        };
    }, [full]);

    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const idOf = (event: Event) => (event.target as Element).closest?.('[data-id]')?.getAttribute('data-id') ?? null;
        const pick = (event: Event) => {
            const id = idOf(event);
            if (id) setOn(id);
        };
        const clear = () => setOn(null);
        const activate = (event: Event) => {
            const id = idOf(event);
            const piece = id ? byId.get(id) : undefined;
            if (piece) select.current?.(piece);
        };
        const key = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            if (!(event.target as Element).classList?.contains('iso-piece')) return;
            event.preventDefault();
            activate(event);
        };
        root.addEventListener('mouseover', pick);
        root.addEventListener('focusin', pick);
        root.addEventListener('mouseleave', clear);
        root.addEventListener('focusout', clear);
        root.addEventListener('click', activate);
        root.addEventListener('keydown', key);
        return () => {
            root.removeEventListener('mouseover', pick);
            root.removeEventListener('focusin', pick);
            root.removeEventListener('mouseleave', clear);
            root.removeEventListener('focusout', clear);
            root.removeEventListener('click', activate);
            root.removeEventListener('keydown', key);
        };
    }, [full, byId]);

    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const linked = new Set<string>();
        root.querySelectorAll('.iso-track, .iso-flow').forEach((track) => {
            const a = track.getAttribute('data-from');
            const b = track.getAttribute('data-to');
            const lit = on !== null && (a === on || b === on);
            track.classList.toggle('is-on', lit);
            if (lit) linked.add(a === on ? b! : a!);
        });
        root.querySelectorAll('.iso-piece, .iso-label').forEach((el) => {
            const id = el.getAttribute('data-id')!;
            el.classList.toggle('is-on', id === on);
            el.classList.toggle('is-linked', linked.has(id));
        });
        if (on) root.setAttribute('data-on', on);
        else root.removeAttribute('data-on');
    }, [on, full, plan]);

    const current = on ? byId.get(on) : undefined;
    const out = current ? plan.links.filter((l) => l.from === current.id) : [];
    const inn = current ? plan.links.filter((l) => l.to === current.id) : [];
    const name = (id: string) => {
        const p = byId.get(id);
        return p ? `${p.n} ${p.label}` : id;
    };
    const list = (items: { id: string; label?: string }[]) =>
        items.map((l) => (l.label ? `${name(l.id)} (${l.label})` : name(l.id))).join(', ');

    const view = (
        <div className={['isoplan', full ? 'is-full' : '', className ?? ''].filter(Boolean).join(' ')} data-theme={theme}>
            <div className="iso-bar">
                <div className="iso-info" aria-live="polite">
                    {current ? (
                        <>
                            <span className="iso-info-num">
                                {copy.number}
                                {current.n}
                            </span>{' '}
                            <b className="iso-info-name">{current.label}</b>
                            {current.sub && <span className="iso-info-sub"> · {current.sub}</span>}
                            {out.length > 0 && (
                                <span className="iso-info-links">
                                    {' '}
                                    · {copy.out}: {list(out.map((l) => ({ id: l.to, label: l.label })))}
                                </span>
                            )}
                            {inn.length > 0 && (
                                <span className="iso-info-links">
                                    {' '}
                                    · {copy.in}: {list(inn.map((l) => ({ id: l.from, label: l.label })))}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="iso-info-hint">{copy.hint}</span>
                    )}
                </div>
                {expandable && (
                    <button type="button" className="iso-toggle" aria-pressed={full} onClick={() => setFull(!full)}>
                        [{full ? copy.close : copy.expand}]
                    </button>
                )}
            </div>
            <div className="iso-viewport">
                <div ref={ref} className="iso-scene">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox={plan.viewBox}
                        role="img"
                        aria-label={title}
                        dangerouslySetInnerHTML={{ __html: `<title>${escapeXml(title)}</title>${plan.svg}` }}
                    />
                </div>
            </div>
            <div className="iso-stats">
                <span>
                    <b>{plan.pieces.length}</b> {copy.pieces}
                </span>
                <span>
                    <b>{plan.links.length}</b> {copy.links}
                </span>
                <span>
                    <b>{plan.areas.length}</b> {copy.areas}
                </span>
            </div>
        </div>
    );
    // A transformed or blurred ancestor would trap position: fixed, so full screen renders on <body>.
    return full ? createPortal(view, document.body) : view;
}
