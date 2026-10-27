import { useMemo, useState } from 'react';
import { IsoPlan, renderPlan, validateGraph, type Graph } from 'isoplan';
import css from '../../src/styles.css?raw';
import { examples } from './examples';

type Theme = 'neon' | 'light';

const pretty = (graph: Graph) => JSON.stringify(graph, null, 2);

function parse(text: string): { graph?: Graph; error?: string } {
    try {
        const graph = JSON.parse(text) as Graph;
        validateGraph(graph);
        return { graph };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}

// A standalone SVG carries the stylesheet, so it looks the same outside the page.
function standaloneSvg(graph: Graph, theme: Theme, title: string) {
    const plan = renderPlan(graph);
    const safeTitle = title.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${plan.viewBox}" class="isoplan iso-scene" data-theme="${theme}" role="img"><title>${safeTitle}</title><style>${css}</style>${plan.svg}</svg>`;
}

export function App() {
    const [exampleId, setExampleId] = useState(examples[0].id);
    const [text, setText] = useState(pretty(examples[0].graph));
    const [theme, setTheme] = useState<Theme>('neon');
    const [copied, setCopied] = useState('');
    const parsed = useMemo(() => parse(text), [text]);
    const [lastGood, setLastGood] = useState<Graph>(examples[0].graph);
    if (parsed.graph && parsed.graph !== lastGood) setLastGood(parsed.graph);
    const title = `${examples.find((e) => e.id === exampleId)?.name ?? 'Custom'} architecture`;

    const pick = (id: string) => {
        const example = examples.find((e) => e.id === id)!;
        setExampleId(id);
        setText(pretty(example.graph));
    };

    const copySvg = async () => {
        try {
            await navigator.clipboard.writeText(standaloneSvg(lastGood, theme, title));
            setCopied('SVG copied');
        } catch {
            setCopied('Copy failed: clipboard not available');
        }
        setTimeout(() => setCopied(''), 2000);
    };

    return (
        <div className="demo" data-theme={theme}>
            <header className="demo-header">
                <h1>
                    isoplan <span>playground</span>
                </h1>
                <p>Any system architecture as an isometric floor plan, with the path each thing travels.</p>
                <nav>
                    <a href="https://github.com/kayossouza/isoplan">★ Star on GitHub</a>
                    <a href="https://www.npmjs.com/package/isoplan">npm</a>
                </nav>
            </header>
            <div className="demo-toolbar">
                <div className="demo-group" role="group" aria-label="Examples">
                    {examples.map((e) => (
                        <button key={e.id} type="button" aria-pressed={exampleId === e.id} onClick={() => pick(e.id)}>
                            {e.name}
                        </button>
                    ))}
                </div>
                <div className="demo-group" role="group" aria-label="Theme">
                    {(['neon', 'light'] as const).map((t) => (
                        <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                            {t}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={copySvg}>
                    Copy SVG
                </button>
                <span className="demo-status" aria-live="polite">
                    {copied}
                </span>
            </div>
            <main className="demo-main">
                <section className="demo-editor">
                    <label htmlFor="graph-json">Graph JSON</label>
                    <textarea
                        id="graph-json"
                        spellCheck={false}
                        value={text}
                        onChange={(event) => {
                            setExampleId('custom');
                            setText(event.target.value);
                        }}
                    />
                    <p className={parsed.error ? 'demo-error' : 'demo-ok'} role={parsed.error ? 'alert' : undefined}>
                        {parsed.error ? `Not drawn: ${parsed.error}` : 'Valid graph.'}
                    </p>
                </section>
                <section className="demo-plan">
                    <IsoPlan graph={lastGood} title={title} theme={theme} />
                </section>
            </main>
        </div>
    );
}
