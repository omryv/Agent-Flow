'use strict';

function makeSampleData() {
  const nodes = [
    { id: 'n1', role: 'input',      name: 'User Query',     content: 'What were the main causes of the French Revolution?', status: 'success', durationMs: 12 },
    { id: 'n2', role: 'retrieve',   name: 'Vector Search',  content: 'Retrieved 8 passages from history corpus. Top-k similarity 0.87.', status: 'success', durationMs: 340 },
    { id: 'n3', role: 'retrieve',   name: 'Web Search',     content: 'Fetched 3 Wikipedia articles on French Revolution, Ancien Régime, Estates-General.', status: 'success', durationMs: 520 },
    { id: 'n4', role: 'plan',       name: 'Reasoning Plan', content: '1. Identify structural causes\n2. Summarise financial crisis\n3. Discuss Enlightenment ideology\n4. Synthesise into a coherent answer', status: 'success', durationMs: 290 },
    { id: 'n5', role: 'tool',       name: 'Date Calculator',content: 'Resolved "before 1789" → range 1750–1789', status: 'success', durationMs: 18 },
    { id: 'n6', role: 'synthesize', name: 'Draft Answer',   content: 'The French Revolution had three interlocking causes: fiscal bankruptcy of the crown, widespread famine and grain price spikes following the 1788 harvest failure, and…', status: 'success', durationMs: 1240 },
    { id: 'n7', role: 'validate',   name: 'Fact Check',     content: 'All claims verified against corpus. Confidence score: 0.91. No hallucinations detected.', status: 'success', durationMs: 380 },
    { id: 'n8', role: 'output',     name: 'Final Response', content: 'Response formatted and returned to user. 412 tokens.', status: 'success', durationMs: 30 },
  ];
  const edges = [
    { from: 'n1', to: 'n2' }, { from: 'n1', to: 'n3' },
    { from: 'n2', to: 'n4' }, { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' }, { from: 'n4', to: 'n6' },
    { from: 'n5', to: 'n6' }, { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'n8' },
  ];
  const run1 = {
    id: 'run-1',
    name: 'History QA — French Revolution',
    createdAt: '2025-04-24T09:12:00Z',
    nodes, edges,
    metrics: { totalMs: 2830, tokens: 1142, nodes: nodes.length, successful: 8, failed: 0 },
    finalAnswer: "The French Revolution (1789–1799) was triggered by a convergence of three forces: fiscal collapse of the monarchy under Louis XVI, whose treasury was bankrupted by war debts and Versailles expenditure; agrarian crisis following the catastrophic 1788 harvest, which drove bread prices beyond the reach of urban workers; and Enlightenment ideology that delegitimised absolutism in favour of popular sovereignty.",
    counterfactuals: [
      {
        id: 'cf-1',
        name: 'Skip Fact-Check Step',
        description: 'What if the validate node had been skipped — would the answer differ significantly?',
        nodeOverrides: {
          'n7': { status: 'skipped', content: 'Fact-check skipped. Confidence unevaluated.' }
        },
        metrics: { totalMs: 2450, tokens: 1090, nodes: 8, successful: 7, failed: 0 },
        finalAnswer: "The French Revolution emerged from fiscal insolvency of the crown, harvest failures of 1788 causing bread riots, and Enlightenment political theory. Louis XVI's inability to reform tax policy led to the convening of the Estates-General, triggering a constitutional crisis that transformed into full revolution.",
      },
      {
        id: 'cf-2',
        name: 'Web Search Fails',
        description: 'What if the web search node had failed — relying only on the vector corpus?',
        nodeOverrides: {
          'n3': { status: 'failed',  content: 'Web search request timed out. No Wikipedia articles retrieved.' },
          'n6': { status: 'success', content: 'Draft synthesised from vector corpus only. Fewer external citations available.' }
        },
        metrics: { totalMs: 2310, tokens: 980, nodes: 8, successful: 6, failed: 1 },
        finalAnswer: "Based on the available corpus, the French Revolution arose from the monarchy's financial crisis, social inequality under the Ancien Régime, and political exclusion of the bourgeoisie.",
      }
    ]
  };

  const nodes2 = [
    { id: 'n1', role: 'input',      name: 'User Query',      content: 'Summarise the latest earnings call for ACME Corp.', status: 'success', durationMs: 8 },
    { id: 'n2', role: 'retrieve',   name: 'Doc Retrieval',   content: 'Loaded Q3 2024 earnings transcript (42 pages, 31k tokens).', status: 'success', durationMs: 190 },
    { id: 'n3', role: 'plan',       name: 'Extraction Plan', content: '1. Revenue + YoY growth\n2. Guidance revision\n3. Key exec quotes\n4. Risks cited', status: 'success', durationMs: 180 },
    { id: 'n4', role: 'tool',       name: 'Number Parser',   content: 'Extracted 28 financial figures. Normalised to USD millions.', status: 'success', durationMs: 55 },
    { id: 'n5', role: 'synthesize', name: 'Summary Draft',   content: 'Revenue $1.34B (+12% YoY). Guidance raised. CFO highlighted supply-chain headwinds…', status: 'success', durationMs: 890 },
    { id: 'n6', role: 'validate',   name: 'Number Check',    content: 'Cross-checked 14 key figures against raw transcript. 2 minor discrepancies corrected.', status: 'success', durationMs: 210 },
    { id: 'n7', role: 'output',     name: 'Final Summary',   content: 'Formatted bullet summary. 280 tokens.', status: 'success', durationMs: 22 },
  ];
  const edges2 = [
    { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' }, { from: 'n3', to: 'n5' },
    { from: 'n4', to: 'n5' }, { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'n7' },
  ];
  const run2 = {
    id: 'run-2',
    name: 'Earnings Call Summary',
    createdAt: '2025-04-24T10:45:00Z',
    nodes: nodes2, edges: edges2,
    metrics: { totalMs: 1555, tokens: 540, nodes: 7, successful: 7, failed: 0 },
    finalAnswer: "ACME Corp Q3 2024: Revenue $1.34B (+12% YoY, beat consensus by $40M). Full-year guidance raised to $5.2–5.4B. CEO cited AI-driven efficiency gains. CFO flagged supply-chain normalisation as tailwind, but noted FX headwinds of ~$30M. Operating margin expanded 80 bps to 18.4%. Free cash flow $310M.",
    counterfactuals: []
  };

  return {
    runs: [run1, run2],
    activeRunId: 'run-1',
    selectedNodeId: null,
    activeTab: 'graph',
    activeCounterfactual: null,
  };
}

function validateRunSchema(obj) {
  if (typeof obj !== 'object' || obj === null) return 'Root must be an object.';
  if (typeof obj.id !== 'string' || !SAFE_ID_RE.test(obj.id)) return 'Missing or invalid "id".';
  if (typeof obj.name !== 'string' || !obj.name || obj.name.length > 200) return '"name" must be a string (max 200 chars).';
  if (!Array.isArray(obj.nodes)) return '"nodes" must be an array.';
  if (!Array.isArray(obj.edges)) return '"edges" must be an array.';
  if (obj.nodes.length > 500)    return 'Too many nodes (max 500).';
  if (obj.edges.length > 2000)   return 'Too many edges (max 2000).';
  for (let i = 0; i < obj.nodes.length; i++) {
    const n = obj.nodes[i];
    if (typeof n.id !== 'string' || !SAFE_ID_RE.test(n.id))          return `Node ${i}: invalid "id".`;
    if (typeof n.name !== 'string' || !n.name || n.name.length > 200) return `Node ${i}: invalid "name".`;
    if (typeof n.content !== 'string')                                 return `Node ${i}: "content" must be a string.`;
    if (n.content.length > 10000)                                      return `Node ${i}: content too long.`;
    if (n.role   !== undefined && !ROLE_KEYS.includes(n.role))         return `Node ${i}: invalid role.`;
    if (n.status !== undefined && !STATUS_KEYS.includes(n.status))     return `Node ${i}: invalid status.`;
    if (n.durationMs !== undefined && (typeof n.durationMs !== 'number' || n.durationMs < 0)) return `Node ${i}: invalid durationMs.`;
  }
  for (let i = 0; i < obj.edges.length; i++) {
    const e = obj.edges[i];
    if (typeof e.from !== 'string' || !SAFE_ID_RE.test(e.from)) return `Edge ${i}: invalid "from".`;
    if (typeof e.to   !== 'string' || !SAFE_ID_RE.test(e.to))   return `Edge ${i}: invalid "to".`;
  }
  if (obj.counterfactuals !== undefined) {
    if (!Array.isArray(obj.counterfactuals)) return '"counterfactuals" must be an array.';
    for (let i = 0; i < obj.counterfactuals.length; i++) {
      const cf = obj.counterfactuals[i];
      if (typeof cf.id !== 'string' || !SAFE_ID_RE.test(cf.id))  return `CF ${i}: invalid "id".`;
      if (typeof cf.name !== 'string' || !cf.name)                return `CF ${i}: invalid "name".`;
      if (typeof cf.nodeOverrides !== 'object' || !cf.nodeOverrides) return `CF ${i}: invalid "nodeOverrides".`;
    }
  }
  return null;
}