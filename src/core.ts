// Isometric floor plan of a system architecture. Framework-free and SSR-safe:
// everything here builds strings, nothing touches the DOM.
//
// The projection, slabs, shapes and floor tracks are a faithful port of the
// plan that renders case-study HLDs on kinho.dev.

export const NODE_KINDS = [
    'user',
    'web',
    'api',
    'worker',
    'container',
    'function',
    'agent',
    'db',
    'cache',
    'queue',
    'storage',
    'external',
    'identity',
    'repo',
    'ci',
] as const;

/** Known node kinds. Any other string renders with the default shape. */
export type NodeKind = (typeof NODE_KINDS)[number];

export interface Zone {
    id: string;
    label: string;
    /** Parent zone id. Zones with a parent are drawn as dashed blocks on the parent's slab. */
    parent?: string | null;
}

export interface Node {
    id: string;
    label: string;
    /** Secondary line, shown in the info bar. */
    sub?: string;
    kind: NodeKind | (string & {});
    /** Zone id. Nodes without a zone go to an implicit area chosen by kind. */
    zone?: string | null;
    /** Column: nodes of a band with the same column share a sub-row. Default 0. */
    col?: number;
    /** Order inside the sub-row. Default: order of appearance in `nodes`. */
    row?: number;
}

export interface Edge {
    from: string;
    to: string;
    label?: string;
    /** Traffic goes both ways: the flow is animated in both directions. */
    both?: boolean;
}

export interface Graph {
    zones?: Zone[];
    nodes: Node[];
    edges: Edge[];
}

export interface AreaLabels {
    /** Area of zone-less `user` nodes. */
    user: string;
    /** Side area of zone-less `external` nodes. */
    external: string;
    /** Side area of zone-less `repo` and `ci` nodes. */
    repo: string;
}

export interface RenderOptions {
    /** Animated flows along every track. Default true. */
    flows?: boolean;
    /** Flow speed in SVG units per second. Default 48. */
    flowSpeed?: number;
    /** Names of the implicit areas. */
    labels?: Partial<AreaLabels>;
}

export interface Piece {
    id: string;
    /** Number shown on the plan, back to front. */
    n: number;
    label: string;
    sub?: string;
    kind: string;
    /** Area id: a top-level zone id or `_user`, `_external`, `_repo`, `_other`. */
    area: string;
}

export interface Link {
    from: string;
    to: string;
    label?: string;
    both: boolean;
}

export interface Plan {
    /** Inner SVG markup. Put it inside `<svg viewBox={viewBox}>`. */
    svg: string;
    viewBox: string;
    pieces: Piece[];
    links: Link[];
    areas: { id: string; name: string }[];
}

export const DEFAULT_LABELS: AreaLabels = {
    user: 'who uses it',
    external: 'external services',
    repo: 'code and delivery',
};

const DEFAULT_FLOW_SPEED = 48;
// Dash period of a flow path, in SVG units. Must match the keyframes in styles.css.
const FLOW_PERIOD = 20;

type Pt = [number, number];

interface FullNode extends Node {
    col: number;
    row: number;
}

interface Box {
    id: string;
    name: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

const C = Math.cos(Math.PI / 6);
const S = 46;
// Slabs are stacked bands: each top-level zone is a band, sub-rows follow the
// node columns and pieces run along x in row order. Third parties and delivery
// sit in a column to the right.
const STEP = 2.4;
const MIN_SLOTS = 4;
const SUBROW = 2.2;
const GAP = 0.9;
const PAD = 0.95;
// Extra floor on the left of each band, so the next band's pieces never sit under the band name.
const LEFT = 1.3;
const SLAB_DEPTH = -0.28;

const P = (x: number, y: number, z = 0): Pt => [(x - y) * C * S, ((x + y) * S) / 2 - z * S];
const f = (n: number) => n.toFixed(1);
const points = (a: Pt[]) => a.map((p) => f(p[0]) + ' ' + f(p[1])).join('L');
const polygon = (a: Pt[]) => 'M' + points(a) + 'Z';
const polyline = (a: Pt[]) => 'M' + points(a);

/** Escapes text for SVG content and attribute values. */
export const escapeXml = (s: string) =>
    String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

// ---------- validation ----------

/** Throws an Error with a clear message when the graph cannot be drawn. */
export function validateGraph(graph: Graph): void {
    if (!graph || typeof graph !== 'object') throw new Error('isoplan: graph must be an object.');
    if (!Array.isArray(graph.nodes)) throw new Error('isoplan: graph.nodes must be an array.');
    if (!Array.isArray(graph.edges)) throw new Error('isoplan: graph.edges must be an array.');
    if (graph.zones !== undefined && !Array.isArray(graph.zones)) throw new Error('isoplan: graph.zones must be an array.');
    if (graph.nodes.length === 0) throw new Error('isoplan: graph.nodes is empty; add at least one node.');

    const zones = new Map<string, Zone>();
    for (const [i, zone] of (graph.zones ?? []).entries()) {
        if (!zone || typeof zone.id !== 'string' || typeof zone.label !== 'string')
            throw new Error(`isoplan: zones[${i}] needs a string "id" and "label".`);
        if (zone.id.startsWith('_')) throw new Error(`isoplan: zone id "${zone.id}" is reserved; ids starting with "_" name the implicit areas.`);
        if (zones.has(zone.id)) throw new Error(`isoplan: duplicate zone id "${zone.id}".`);
        zones.set(zone.id, zone);
    }
    for (const zone of zones.values()) {
        if (zone.parent == null) continue;
        if (!zones.has(zone.parent)) throw new Error(`isoplan: zone "${zone.id}" has unknown parent "${zone.parent}".`);
        const seen = new Set([zone.id]);
        for (let z = zones.get(zone.parent); z; z = z.parent == null ? undefined : zones.get(z.parent)) {
            if (seen.has(z.id)) throw new Error(`isoplan: zone "${zone.id}" is part of a parent cycle.`);
            seen.add(z.id);
        }
    }

    const ids = new Set<string>();
    for (const [i, node] of graph.nodes.entries()) {
        if (!node || typeof node.id !== 'string' || typeof node.label !== 'string' || typeof node.kind !== 'string')
            throw new Error(`isoplan: nodes[${i}] needs a string "id", "label" and "kind".`);
        if (ids.has(node.id)) throw new Error(`isoplan: duplicate node id "${node.id}".`);
        if (node.zone != null && !zones.has(node.zone)) throw new Error(`isoplan: node "${node.id}" is in unknown zone "${node.zone}".`);
        for (const key of ['col', 'row'] as const)
            if (node[key] !== undefined && !Number.isFinite(node[key]))
                throw new Error(`isoplan: node "${node.id}" has a non-numeric "${key}".`);
        ids.add(node.id);
    }
    for (const [i, edge] of graph.edges.entries()) {
        if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string')
            throw new Error(`isoplan: edges[${i}] needs a string "from" and "to".`);
        if (!ids.has(edge.from)) throw new Error(`isoplan: edges[${i}] starts at unknown node "${edge.from}".`);
        if (!ids.has(edge.to)) throw new Error(`isoplan: edges[${i}] ends at unknown node "${edge.to}".`);
    }
}

// ---------- shapes ----------

function box(x: number, y: number, w: number, dd: number, h: number, z = 0) {
    const t = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + dd, z + h), P(x, y + dd, z + h)];
    const l = [P(x, y + dd, z), P(x + w, y + dd, z), P(x + w, y + dd, z + h), P(x, y + dd, z + h)];
    const r = [P(x + w, y, z), P(x + w, y + dd, z), P(x + w, y + dd, z + h), P(x + w, y, z + h)];
    return `<path class="iso-face iso-left" d="${polygon(l)}"/><path class="iso-face iso-right" d="${polygon(r)}"/><path class="iso-face iso-top" d="${polygon(t)}"/>`;
}

function cylinder(cx: number, cy: number, r: number, h: number, rings: number[]) {
    const rx = r * C * S * Math.SQRT2;
    const ry = (r * S * Math.SQRT2) / 2;
    const [bx, by] = P(cx, cy, 0);
    const [, ty] = P(cx, cy, h);
    let o = `<path class="iso-face iso-left" d="M${f(bx - rx)} ${f(ty)}L${f(bx - rx)} ${f(by)}A${f(rx)} ${f(ry)} 0 0 0 ${f(bx + rx)} ${f(by)}L${f(bx + rx)} ${f(ty)}Z"/>`;
    for (const z of rings) {
        const [, zy] = P(cx, cy, z);
        o += `<path class="iso-deco" d="M${f(bx - rx)} ${f(zy)}A${f(rx)} ${f(ry)} 0 0 0 ${f(bx + rx)} ${f(zy)}"/>`;
    }
    o += `<path class="iso-face iso-top" d="M${f(bx - rx)} ${f(ty)}A${f(rx)} ${f(ry)} 0 1 0 ${f(bx + rx)} ${f(ty)}A${f(rx)} ${f(ry)} 0 1 0 ${f(bx - rx)} ${f(ty)}Z"/>`;
    return o;
}

const frontWindow = (x0: number, yf: number, z0: number, w: number, h: number) =>
    `<path class="iso-window" d="${polygon([P(x0, yf, z0), P(x0 + w, yf, z0), P(x0 + w, yf, z0 + h), P(x0, yf, z0 + h)])}"/>`;
const sideWindow = (xf: number, y0: number, z0: number, dd: number, h: number) =>
    `<path class="iso-window" d="${polygon([P(xf, y0, z0), P(xf, y0 + dd, z0), P(xf, y0 + dd, z0 + h), P(xf, y0, z0 + h)])}"/>`;

function clock(x: number, y: number, z: number) {
    const [cx, cy] = P(x, y, z);
    const rx = 0.25 * C * S * Math.SQRT2;
    const ry = (0.25 * S * Math.SQRT2) / 2;
    return `<ellipse class="iso-deco" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/><path class="iso-deco" d="M${f(cx)} ${f(cy)}L${f(cx)} ${f(cy - ry * 0.8)}M${f(cx)} ${f(cy)}L${f(cx + rx * 0.55)} ${f(cy + 1)}"/>`;
}

/** Shape per node kind; returns [svg, top height]. */
function shape(kind: string, x: number, y: number): [string, number] {
    const a = 0.42;
    switch (kind) {
        case 'api':
        case 'agent': {
            const w = 1.3, dd = 0.9, h = 1.35, x0 = x - w / 2, y0 = y - dd / 2;
            let g = box(x0, y0, w, dd, h);
            for (let r = 0; r < 3; r++)
                for (let c = 0; c < 4; c++) g += frontWindow(x0 + 0.12 + c * 0.3, y0 + dd, 0.22 + r * 0.38, 0.18, 0.2);
            for (let r = 0; r < 3; r++) g += sideWindow(x0 + w, y0 + 0.2, 0.22 + r * 0.38, 0.5, 0.2);
            if (kind === 'agent') {
                const [tx, ty] = P(x, y, h);
                g += `<path class="iso-deco" d="M${f(tx)} ${f(ty)}L${f(tx)} ${f(ty - 16)}"/><circle class="iso-deco" cx="${f(tx)}" cy="${f(ty - 19)}" r="3"/>`;
            }
            return [g, kind === 'agent' ? h + 0.45 : h];
        }
        case 'web': {
            let g = box(x - a, y - a, 2 * a, 2 * a, 1.1);
            g += frontWindow(x - a + 0.1, y + a, 0.16, 0.27, 0.8) + frontWindow(x + 0.05, y + a, 0.16, 0.27, 0.8);
            g += sideWindow(x + a, y - a + 0.12, 0.66, 0.6, 0.3);
            return [g, 1.1];
        }
        case 'user': {
            let g = box(x - 0.4, y - 0.3, 0.8, 0.6, 0.08);
            g += box(x - 0.4, y - 0.3, 0.8, 0.08, 0.62, 0.08);
            g += frontWindow(x - 0.32, y - 0.22, 0.16, 0.64, 0.46);
            return [g, 0.7];
        }
        case 'db':
        case 'cache':
            return [cylinder(x, y, 0.4, kind === 'db' ? 0.75 : 0.5, kind === 'db' ? [0.25, 0.5] : [0.25]), kind === 'db' ? 0.75 : 0.5];
        case 'queue': {
            let g = '';
            for (let i = 0; i < 3; i++) g += box(x - 0.45, y - 0.38, 0.9, 0.76, 0.14, i * 0.21);
            return [g, 0.56];
        }
        case 'storage':
        case 'repo':
            return [
                box(x - 0.46, y - 0.42, 0.92, 0.84, 0.16) +
                    box(x - 0.36, y - 0.32, 0.72, 0.64, 0.16, 0.16) +
                    box(x - 0.26, y - 0.22, 0.52, 0.44, 0.16, 0.32),
                0.48,
            ];
        case 'function':
        case 'worker':
        case 'ci':
            return [box(x - a, y - a, 2 * a, 2 * a, 0.6) + clock(x, y, 0.6), 0.6];
        case 'container': {
            let g = '';
            for (let i = 0; i < 2; i++) g += box(x - 0.5 + i * 0.12, y - 0.36 - i * 0.12, 0.9, 0.62, 0.32, i * 0.34);
            return [g, 0.68];
        }
        default:
            return [box(x - a, y - a, 2 * a, 2 * a, 0.75) + sideWindow(x + a, y - 0.18, 0.44, 0.36, 0.14), 0.75];
    }
}

function slab(A: Box) {
    const { x0, y0, x1, y1 } = A;
    const z = SLAB_DEPTH;
    const t = [P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)];
    const l = [P(x0, y1, z), P(x1, y1, z), P(x1, y1, 0), P(x0, y1, 0)];
    const r = [P(x1, y0, z), P(x1, y1, z), P(x1, y1, 0), P(x1, y0, 0)];
    let g = `<path class="iso-slab-side" d="${polygon(l)}"/><path class="iso-slab-side" d="${polygon(r)}"/><path class="iso-slab-top" d="${polygon(t)}"/>`;
    for (let i = Math.ceil(x0); i < x1; i++) {
        const p = P(i, y0), q = P(i, y1);
        g += `<line class="iso-grid" x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}"/>`;
    }
    for (let j = Math.ceil(y0); j < y1; j++) {
        const p = P(x0, j), q = P(x1, j);
        g += `<line class="iso-grid" x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}"/>`;
    }
    return g;
}

// ---------- layout ----------

interface Layout {
    areas: Box[];
    areaOf: Record<string, string>;
    blocks: Box[];
    xy: Record<string, Pt>;
    corridors: number[];
}

function layout(zones: Zone[], nodes: FullNode[], labels: AreaLabels): Layout {
    const zoneById = new Map(zones.map((z) => [z.id, z]));
    const top = (zoneId: string | null | undefined): string | null => {
        let z = zoneId == null ? undefined : zoneById.get(zoneId);
        while (z?.parent != null) z = zoneById.get(z.parent);
        return z?.id ?? null;
    };
    const groups = new Map<string, { name: string; side: boolean; nodes: FullNode[] }>();
    const areaOf: Record<string, string> = {};
    for (const node of nodes) {
        const zone = top(node.zone);
        let key: string, name: string, side = false;
        if (zone) {
            key = zone;
            name = zoneById.get(zone)!.label;
        } else {
            const kind = node.kind === 'ci' ? 'repo' : node.kind;
            key = kind === 'user' || kind === 'external' || kind === 'repo' ? `_${kind}` : '_other';
            name = key === '_other' ? '' : labels[key.slice(1) as keyof AreaLabels];
            side = key === '_external' || key === '_repo';
        }
        areaOf[node.id] = key;
        if (!groups.has(key)) groups.set(key, { name, side, nodes: [] });
        groups.get(key)!.nodes.push(node);
    }
    const meanCol = (g: { nodes: FullNode[] }) => g.nodes.reduce((sum, n) => sum + n.col, 0) / g.nodes.length;
    const entries = [...groups.entries()];
    const main = entries.filter(([, g]) => !g.side).sort((a, b) => meanCol(a[1]) - meanCol(b[1]));
    const side = entries.filter(([, g]) => g.side).sort((a, b) => meanCol(a[1]) - meanCol(b[1]));

    // Sub-rows: one per column inside the band, pieces in row order.
    const rowsOf = (list: FullNode[], perRow?: number) => {
        if (perRow) {
            const sorted = [...list].sort((a, b) => a.col - b.col || a.row - b.row);
            return Array.from({ length: Math.ceil(sorted.length / perRow) }, (_, i) => sorted.slice(i * perRow, (i + 1) * perRow));
        }
        const cols = [...new Set(list.map((n) => n.col))].sort((a, b) => a - b);
        return cols.map((c) => list.filter((n) => n.col === c).sort((a, b) => a.row - b.row));
    };
    const xy: Record<string, Pt> = {};
    const areas: Box[] = [];
    const corridors: number[] = [-PAD - 0.4];
    const width = Math.max(...main.flatMap(([, g]) => rowsOf(g.nodes).map((r) => r.length)), MIN_SLOTS);
    let y = 0;
    for (const [id, g] of main) {
        const rows = rowsOf(g.nodes);
        rows.forEach((row, i) => {
            // Spread each sub-row over the whole band.
            const span = (width - 1) * STEP;
            row.forEach((n, j) => (xy[n.id] = [row.length === 1 ? span / 2 : (j * span) / (row.length - 1), y + i * SUBROW]));
            if (i > 0) corridors.push(y + (i - 0.5) * SUBROW);
        });
        const y1 = y + (rows.length - 1) * SUBROW;
        areas.push({ id, name: g.name, x0: -PAD - LEFT, y0: y - PAD, x1: (width - 1) * STEP + PAD, y1: y1 + PAD });
        corridors.push(y1 + PAD + GAP / 2);
        y = y1 + 2 * PAD + GAP;
    }
    const sx = (width - 1) * STEP + PAD + 1.3;
    let sy = 0;
    for (const [id, g] of side) {
        const rows = rowsOf(g.nodes, 2);
        rows.forEach((row, i) => row.forEach((n, j) => (xy[n.id] = [sx + PAD + j * STEP, sy + i * SUBROW])));
        const y1 = sy + (rows.length - 1) * SUBROW;
        const cols = Math.max(...rows.map((r) => r.length));
        areas.push({ id, name: g.name, x0: sx, y0: sy - PAD, x1: sx + PAD * 2 + (cols - 1) * STEP, y1: y1 + PAD });
        sy = y1 + 2 * PAD + GAP;
    }
    // Inner zones are drawn as dashed blocks on their slab.
    const inside = (zoneId: string | null | undefined, target: string) => {
        let z = zoneId == null ? undefined : zoneById.get(zoneId);
        while (z && z.id !== target) z = z.parent == null ? undefined : zoneById.get(z.parent);
        return z?.id === target;
    };
    const blocks = zones
        .filter((zone) => zone.parent != null)
        .map((zone): Box | null => {
            const members = nodes.filter((n) => inside(n.zone, zone.id));
            if (!members.length) return null;
            const pts = members.map((n) => xy[n.id]);
            return {
                id: zone.id,
                name: zone.label,
                x0: Math.min(...pts.map((q) => q[0])) - 0.75,
                y0: Math.min(...pts.map((q) => q[1])) - 0.75,
                x1: Math.max(...pts.map((q) => q[0])) + 0.75,
                y1: Math.max(...pts.map((q) => q[1])) + 0.75,
            };
        })
        .filter((q): q is Box => q !== null);
    return { areas, areaOf, blocks, xy, corridors: [...new Set(corridors)].sort((a, b) => a - b) };
}

// Tracks run at right angles on the floor, through the corridor between tiers.
function route(a: Pt, b: Pt, corridors: number[]): Pt[] {
    const [ax, ay] = a;
    const [bx, by] = b;
    const lo = Math.min(ay, by), hi = Math.max(ay, by), mid = (ay + by) / 2;
    const between = corridors.filter((c) => c > lo + 0.2 && c < hi - 0.2);
    const my = between.length
        ? between.reduce((m, c) => (Math.abs(c - mid) < Math.abs(m - mid) ? c : m))
        : corridors.find((c) => c > hi + 0.2) ?? hi + 0.9;
    return [[ax, ay], [ax, my], [bx, my], [bx, by]];
}

// ---------- render ----------

const SHADED_KINDS = new Set(['external', 'user', 'repo', 'ci']);

/** Lays out the graph and returns the SVG markup plus the data behind it. */
export function renderPlan(graph: Graph, options: RenderOptions = {}): Plan {
    validateGraph(graph);
    const labels = { ...DEFAULT_LABELS, ...options.labels };
    const flows = options.flows ?? true;
    const speed = options.flowSpeed ?? DEFAULT_FLOW_SPEED;
    if (!(speed > 0)) throw new Error('isoplan: flowSpeed must be a positive number.');

    const zones = graph.zones ?? [];
    const nodes: FullNode[] = graph.nodes.map((n, i) => ({ ...n, col: n.col ?? 0, row: n.row ?? i }));
    const { areas, areaOf, blocks, xy, corridors } = layout(zones, nodes, labels);
    const pos = (n: { id: string }): Pt => xy[n.id];
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // Back to front: slabs farther from the viewer first.
    const areaOrder = [...areas].sort((p, q) => p.x0 + p.y0 - (q.x0 + q.y0));
    let o = '';
    for (const A of areaOrder) o += slab(A);
    for (const Q of blocks)
        o += `<path class="iso-block" d="${polygon([P(Q.x0, Q.y0, 0.01), P(Q.x1, Q.y0, 0.01), P(Q.x1, Q.y1, 0.01), P(Q.x0, Q.y1, 0.01)])}"/>`;

    let flowPaths = '';
    for (const e of graph.edges) {
        const pts = route(pos(byId.get(e.from)!), pos(byId.get(e.to)!), corridors).map((p) => P(p[0], p[1], 0.02));
        const ends = `data-from="${escapeXml(e.from)}" data-to="${escapeXml(e.to)}"`;
        o += `<path class="iso-track" ${ends} d="${polyline(pts)}"/>`;
        if (flows) {
            flowPaths += `<path class="iso-flow" ${ends} d="${polyline(pts)}"/>`;
            if (e.both) flowPaths += `<path class="iso-flow iso-flow-back" ${ends} d="${polyline([...pts].reverse())}"/>`;
        }
    }
    // Flows sit on the floor above the tracks, so the pieces hide them where they pass under.
    if (flows) o += `<g class="iso-flows" style="--iso-flow-duration:${(FLOW_PERIOD / speed).toFixed(3)}s">${flowPaths}</g>`;

    // Numbering follows the slabs, back to front, then along each slab.
    const order = [...nodes].sort((p, q) => {
        const [px, py] = pos(p), [qx, qy] = pos(q);
        return px + py - (qx + qy) || px - qx;
    });
    const numbered = areaOrder.flatMap((A) =>
        nodes.filter((n) => areaOf[n.id] === A.id).sort((p, q) => pos(p)[1] - pos(q)[1] || pos(p)[0] - pos(q)[0]),
    );
    const num: Record<string, number> = Object.fromEntries(numbered.map((n, i) => [n.id, i + 1]));

    const height: Record<string, number> = {};
    const extremes: Pt[] = [];
    for (const n of order) {
        const [x, y] = pos(n);
        const [g, h] = shape(n.kind, x, y);
        height[n.id] = h;
        const ext = SHADED_KINDS.has(n.kind) ? ' iso-ext' : '';
        o += `<g class="iso-piece${ext}" data-id="${escapeXml(n.id)}" tabindex="0" role="button" aria-label="${num[n.id]} ${escapeXml(n.label)}">${g}</g>`;
    }

    let names = '';
    // Area names sit outside the slab: left of the main bands, right of the side column.
    for (const A of areas) {
        for (const c of [P(A.x0, A.y0), P(A.x1, A.y0), P(A.x1, A.y1, SLAB_DEPTH), P(A.x0, A.y1, SLAB_DEPTH)]) extremes.push(c);
        if (!A.name) continue;
        const width = A.name.length * 12.5 + 8;
        if (A.id === '_external' || A.id === '_repo') {
            const [x, y] = P(A.x1, A.y0);
            names += `<text class="iso-area-name" x="${f(x + 12)}" y="${f(y + 2)}">${escapeXml(A.name)}</text>`;
            extremes.push([x + 12 + width, y - 18]);
        } else {
            const [x, y] = P(A.x0, A.y1);
            names += `<text class="iso-area-name" x="${f(x - 12)}" y="${f(y + 6)}" text-anchor="end">${escapeXml(A.name)}</text>`;
            extremes.push([x - 12 - width, y - 14]);
        }
    }
    for (const Q of blocks) {
        const [x, y] = P(Q.x1, Q.y1);
        names += `<text class="iso-block-name" x="${f(x)}" y="${f(y + 16)}" text-anchor="middle">${escapeXml(Q.name)}</text>`;
    }
    let tags = '';
    for (const n of order) {
        const [x, y] = pos(n);
        const [lx, ly] = P(x, y, height[n.id]);
        const width = (String(num[n.id]).length + 1 + n.label.length) * 10.4 + 8;
        extremes.push([lx - width / 2, ly - 26], [lx + width / 2, ly]);
        tags += `<text class="iso-label" data-id="${escapeXml(n.id)}" x="${f(lx)}" y="${f(ly - 9)}" text-anchor="middle"><tspan class="iso-num">${num[n.id]}</tspan> ${escapeXml(n.label)}</text>`;
    }
    o += names + tags;

    const xs = extremes.map((p) => p[0]), ys = extremes.map((p) => p[1]);
    const m = 24;
    const vx = Math.min(...xs) - m, vy = Math.min(...ys) - m;
    const viewBox = `${f(vx)} ${f(vy)} ${f(Math.max(...xs) - vx + m)} ${f(Math.max(...ys) - vy + m)}`;

    return {
        svg: o,
        viewBox,
        pieces: numbered.map((n) => ({ id: n.id, n: num[n.id], label: n.label, sub: n.sub, kind: n.kind, area: areaOf[n.id] })),
        links: graph.edges.map((e) => ({ from: e.from, to: e.to, label: e.label, both: !!e.both })),
        areas: areaOrder.map((A) => ({ id: A.id, name: A.name })),
    };
}
