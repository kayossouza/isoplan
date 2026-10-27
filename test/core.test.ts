import { describe, expect, it } from 'vitest';
import { renderPlan, validateGraph, type Graph } from '../src/core';
import { crud, examples, llmAgent, saas } from '../demo/src/examples';

const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('renderPlan', () => {
    it('is deterministic', () => {
        const a = renderPlan(saas);
        const b = renderPlan(structuredClone(saas));
        expect(a).toEqual(b);
        expect(a.svg).toMatchSnapshot();
        expect(a.viewBox).toMatchSnapshot();
    });

    it.each(examples)('renders every node of $name exactly once', ({ graph }) => {
        const plan = renderPlan(graph);
        expect(count(plan.svg, 'class="iso-piece')).toBe(graph.nodes.length);
        expect(count(plan.svg, 'class="iso-label"')).toBe(graph.nodes.length);
        for (const node of graph.nodes) expect(count(plan.svg, `class="iso-label" data-id="${node.id}"`)).toBe(1);
        expect(plan.pieces.map((p) => p.n)).toEqual(graph.nodes.map((_, i) => i + 1));
        expect(new Set(plan.pieces.map((p) => p.id))).toEqual(new Set(graph.nodes.map((n) => n.id)));
    });

    it.each(examples)('draws one track per edge of $name', ({ graph }) => {
        const plan = renderPlan(graph);
        expect(count(plan.svg, 'class="iso-track"')).toBe(graph.edges.length);
        expect(plan.links).toHaveLength(graph.edges.length);
    });

    it.each(examples)('animates one flow per edge plus one per two-way edge of $name', ({ graph }) => {
        const plan = renderPlan(graph);
        const both = graph.edges.filter((e) => e.both).length;
        expect(both).toBeGreaterThan(0);
        expect(count(plan.svg, '<path class="iso-flow')).toBe(graph.edges.length + both);
        expect(count(plan.svg, 'class="iso-flow iso-flow-back"')).toBe(both);
    });

    it('runs the back flow over the reversed track', () => {
        const plan = renderPlan(crud);
        const d = (cls: string) => new RegExp(`class="${cls}" data-from="api" data-to="db" d="([^"]+)"`).exec(plan.svg)![1];
        const forward = d('iso-flow').slice(1).split('L');
        const back = d('iso-flow iso-flow-back').slice(1).split('L');
        expect(back).toEqual([...forward].reverse());
        expect(d('iso-track')).toBe(d('iso-flow'));
    });

    it('turns flows off and sets the speed', () => {
        const off = renderPlan(saas, { flows: false });
        expect(off.svg).not.toContain('iso-flow');
        expect(renderPlan(saas, { flowSpeed: 10 }).svg).toContain('--iso-flow-duration:2.000s');
        expect(() => renderPlan(saas, { flowSpeed: 0 })).toThrow(/flowSpeed/);
    });

    it('escapes < and " in every text it writes', () => {
        const graph: Graph = {
            zones: [{ id: 'z', label: 'Zone <b>"x"</b>' }],
            nodes: [
                { id: 'a"<', label: 'A <script>"hi"</script>', kind: 'api', zone: 'z' },
                { id: 'b', label: 'B', kind: 'external' },
            ],
            edges: [{ from: 'a"<', to: 'b', label: '<' }],
        };
        const { svg } = renderPlan(graph, { labels: { external: '"third" <parties>' } });
        expect(svg).not.toMatch(/<script|<b>|"hi"|"x"|"third"|<parties>/);
        expect(svg).toContain('A &lt;script&gt;&quot;hi&quot;&lt;/script&gt;');
        expect(svg).toContain('aria-label="1 A &lt;script&gt;&quot;hi&quot;&lt;/script&gt;"');
        expect(svg).toContain('data-id="a&quot;&lt;"');
        expect(svg).toContain('Zone &lt;b&gt;&quot;x&quot;&lt;/b&gt;');
        expect(svg).toContain('&quot;third&quot; &lt;parties&gt;');
    });

    it.each(examples)('returns a finite viewBox for $name', ({ graph }) => {
        const parts = renderPlan(graph).viewBox.split(' ').map(Number);
        expect(parts).toHaveLength(4);
        for (const v of parts) expect(Number.isFinite(v)).toBe(true);
        expect(parts[2]).toBeGreaterThan(0);
        expect(parts[3]).toBeGreaterThan(0);
    });

    it('defaults col to 0 and row to the order of appearance', () => {
        const explicit: Graph = { ...crud, nodes: crud.nodes.map((n, i) => ({ ...n, col: 0, row: i })) };
        expect(renderPlan(crud)).toEqual(renderPlan(explicit));
        const plan = renderPlan(crud);
        expect(plan.pieces.map((p) => p.id)).toEqual(['user', 'spa', 'api', 'db']);
        expect(plan.areas.map((a) => a.id)).toEqual(['_user', '_other']);
    });

    it('groups zone-less nodes into implicit areas with overridable names', () => {
        const plan = renderPlan(saas);
        expect(plan.areas.map((a) => a.id)).toEqual(['_user', 'edge', 'cloud', '_external', '_repo']);
        expect(plan.areas.find((a) => a.id === '_user')!.name).toBe('who uses it');
        expect(plan.svg).toContain('>external services</text>');
        expect(plan.svg).toContain('>code and delivery</text>');
        const pt = renderPlan(saas, { labels: { user: 'quem usa', external: 'serviços externos', repo: 'código e entrega' } });
        expect(pt.svg).toContain('>quem usa</text>');
        expect(pt.svg).toContain('>serviços externos</text>');
        expect(pt.svg).toContain('>código e entrega</text>');
    });

    it('draws inner zones as dashed blocks', () => {
        const plan = renderPlan(llmAgent);
        expect(count(plan.svg, 'class="iso-block"')).toBe(1);
        expect(plan.svg).toContain('class="iso-block-name"');
        expect(plan.svg).toContain('>Tools</text>');
        expect(plan.pieces.find((p) => p.id === 'search')!.area).toBe('runtime');
    });

    it('renders unknown kinds with the default shape', () => {
        const plan = renderPlan({ nodes: [{ id: 'x', label: 'X', kind: 'mainframe' }], edges: [] });
        expect(count(plan.svg, 'class="iso-piece"')).toBe(1);
    });
});

describe('validateGraph', () => {
    const base = (): Graph => structuredClone(crud);
    const cases: [string, (g: Graph) => void, RegExp][] = [
        ['unknown edge start', (g) => g.edges.push({ from: 'nope', to: 'db' }), /edges\[3\] starts at unknown node "nope"/],
        ['unknown edge end', (g) => g.edges.push({ from: 'db', to: 'nope' }), /edges\[3\] ends at unknown node "nope"/],
        ['duplicate node id', (g) => g.nodes.push({ id: 'api', label: 'API 2', kind: 'api' }), /duplicate node id "api"/],
        ['empty nodes', (g) => ((g.nodes = []), (g.edges = [])), /nodes is empty/],
        ['missing edges', (g) => delete (g as Partial<Graph>).edges, /edges must be an array/],
        ['node without kind', (g) => delete (g.nodes[0] as { kind?: string }).kind, /nodes\[0\] needs a string "id", "label" and "kind"/],
        ['non-numeric col', (g) => (g.nodes[0].col = NaN), /non-numeric "col"/],
        ['unknown zone', (g) => (g.nodes[0].zone = 'mars'), /node "user" is in unknown zone "mars"/],
        ['duplicate zone id', (g) => (g.zones = [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }]), /duplicate zone id "a"/],
        ['unknown parent', (g) => (g.zones = [{ id: 'a', label: 'A', parent: 'b' }]), /zone "a" has unknown parent "b"/],
        ['parent cycle', (g) => (g.zones = [{ id: 'a', label: 'A', parent: 'b' }, { id: 'b', label: 'B', parent: 'a' }]), /parent cycle/],
        ['reserved zone id', (g) => (g.zones = [{ id: '_user', label: 'A' }]), /reserved/],
    ];
    it.each(cases)('rejects %s', (_, mutate, message) => {
        const g = base();
        mutate(g);
        expect(() => validateGraph(g)).toThrow(message);
        expect(() => renderPlan(g)).toThrow(message);
    });

    it('accepts the examples', () => {
        for (const { graph } of examples) expect(() => validateGraph(graph)).not.toThrow();
    });
});
