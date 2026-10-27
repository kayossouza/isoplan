import type { Graph } from '../../src/core';

export const saas: Graph = {
    zones: [
        { id: 'edge', label: 'Edge' },
        { id: 'cloud', label: 'Cloud (production)' },
        { id: 'jobs', label: 'Background jobs', parent: 'cloud' },
    ],
    nodes: [
        { id: 'customer', label: 'Customer', sub: 'browser', kind: 'user', col: 0, row: 0 },
        { id: 'admin', label: 'Admin', sub: 'back office', kind: 'user', col: 0, row: 1 },
        { id: 'web', label: 'Web app', sub: 'Next.js', kind: 'web', zone: 'edge', col: 1, row: 0 },
        { id: 'cdn', label: 'CDN', sub: 'static assets', kind: 'storage', zone: 'edge', col: 1, row: 1 },
        { id: 'api', label: 'API', sub: 'REST + auth', kind: 'api', zone: 'cloud', col: 2, row: 0 },
        { id: 'cache', label: 'Cache', sub: 'Redis', kind: 'cache', zone: 'cloud', col: 2, row: 1 },
        { id: 'db', label: 'Database', sub: 'Postgres', kind: 'db', zone: 'cloud', col: 2, row: 2 },
        { id: 'queue', label: 'Queue', sub: 'SQS', kind: 'queue', zone: 'jobs', col: 3, row: 0 },
        { id: 'mailer', label: 'Mailer', sub: 'worker', kind: 'worker', zone: 'jobs', col: 3, row: 1 },
        { id: 'billing-job', label: 'Billing', sub: 'cron', kind: 'function', zone: 'jobs', col: 3, row: 2 },
        { id: 'stripe', label: 'Stripe', sub: 'payments', kind: 'external', col: 4, row: 0 },
        { id: 'email', label: 'Email provider', kind: 'external', col: 4, row: 1 },
        { id: 'repo', label: 'GitHub', sub: 'monorepo', kind: 'repo', col: 4, row: 2 },
        { id: 'ci', label: 'CI/CD', sub: 'deploys on merge', kind: 'ci', col: 4, row: 3 },
    ],
    edges: [
        { from: 'customer', to: 'web', label: 'HTTPS' },
        { from: 'admin', to: 'web', label: 'HTTPS' },
        { from: 'web', to: 'cdn', label: 'assets' },
        { from: 'web', to: 'api', label: 'JSON' },
        { from: 'api', to: 'cache', label: 'sessions', both: true },
        { from: 'api', to: 'db', label: 'SQL', both: true },
        { from: 'api', to: 'queue', label: 'enqueue' },
        { from: 'queue', to: 'mailer', label: 'jobs' },
        { from: 'mailer', to: 'email', label: 'send' },
        { from: 'billing-job', to: 'stripe', label: 'charge' },
        { from: 'billing-job', to: 'db', label: 'invoices' },
        { from: 'repo', to: 'ci', label: 'push' },
        { from: 'ci', to: 'api', label: 'deploy' },
    ],
};

export const llmAgent: Graph = {
    zones: [
        { id: 'app', label: 'Application' },
        { id: 'runtime', label: 'Agent runtime' },
        { id: 'tools', label: 'Tools', parent: 'runtime' },
        { id: 'data', label: 'Data' },
    ],
    nodes: [
        { id: 'person', label: 'Person', sub: 'chat UI', kind: 'user', col: 0, row: 0 },
        { id: 'chat', label: 'Chat app', sub: 'React', kind: 'web', zone: 'app', col: 1, row: 0 },
        { id: 'gateway', label: 'Gateway', sub: 'auth + rate limit', kind: 'api', zone: 'app', col: 1, row: 1 },
        { id: 'orchestrator', label: 'Orchestrator', sub: 'plans and calls tools', kind: 'agent', zone: 'runtime', col: 2, row: 0 },
        { id: 'memory', label: 'Memory', sub: 'conversation state', kind: 'cache', zone: 'runtime', col: 2, row: 1 },
        { id: 'search', label: 'Search tool', kind: 'function', zone: 'tools', col: 3, row: 0 },
        { id: 'booking', label: 'Booking tool', kind: 'function', zone: 'tools', col: 3, row: 1 },
        { id: 'vectors', label: 'Vector store', sub: 'embeddings', kind: 'db', zone: 'data', col: 4, row: 0 },
        { id: 'docs', label: 'Documents', sub: 'object storage', kind: 'storage', zone: 'data', col: 4, row: 1 },
        { id: 'events', label: 'Events', sub: 'telemetry', kind: 'queue', zone: 'data', col: 4, row: 2 },
        { id: 'llm', label: 'LLM provider', kind: 'external', col: 5, row: 0 },
        { id: 'calendar', label: 'Calendar API', kind: 'external', col: 5, row: 1 },
    ],
    edges: [
        { from: 'person', to: 'chat', label: 'messages', both: true },
        { from: 'chat', to: 'gateway', label: 'stream' },
        { from: 'gateway', to: 'orchestrator', label: 'turn' },
        { from: 'orchestrator', to: 'llm', label: 'prompt', both: true },
        { from: 'orchestrator', to: 'memory', label: 'state', both: true },
        { from: 'orchestrator', to: 'search', label: 'tool call' },
        { from: 'orchestrator', to: 'booking', label: 'tool call' },
        { from: 'search', to: 'vectors', label: 'similarity' },
        { from: 'search', to: 'docs', label: 'fetch' },
        { from: 'booking', to: 'calendar', label: 'book' },
        { from: 'orchestrator', to: 'events', label: 'session events' },
    ],
};

// No zones, no col/row: the default layout keeps nodes in order of appearance.
export const crud: Graph = {
    nodes: [
        { id: 'user', label: 'User', kind: 'user' },
        { id: 'spa', label: 'SPA', kind: 'web' },
        { id: 'api', label: 'API', kind: 'api' },
        { id: 'db', label: 'Database', kind: 'db' },
    ],
    edges: [
        { from: 'user', to: 'spa' },
        { from: 'spa', to: 'api', label: 'REST' },
        { from: 'api', to: 'db', label: 'SQL', both: true },
    ],
};

export const examples: { id: string; name: string; graph: Graph }[] = [
    { id: 'saas', name: 'SaaS', graph: saas },
    { id: 'agent', name: 'LLM agent', graph: llmAgent },
    { id: 'crud', name: 'Simple CRUD', graph: crud },
];
