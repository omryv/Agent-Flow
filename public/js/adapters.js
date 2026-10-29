/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';


// ── Shared helpers ────────────────────────────────────────────────────────────

function safeId(str) {
  return String(str).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'node';
}

function msDiff(start, end) {
  if (!start || !end) return undefined;
  const ms = new Date(end) - new Date(start);
  return isNaN(ms) || ms < 0 ? undefined : ms;
}

function truncate(obj, maxLen = 300) {
  if (obj == null) return '';
  let s;
  if (typeof obj === 'string') {
    s = obj;
  } else {
    try { s = JSON.stringify(obj); } catch { s = '[circular]'; }
  }
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

// ── Role / status inference ───────────────────────────────────────────────────

function inferRole(type = '', name = '') {
  const t = type.toLowerCase(), n = name.toLowerCase();
  if (t === 'llm'       || ['llm','openai','anthropic','gemini','generat','claude','gpt'].some(k => n.includes(k)))  return 'synthesize';
  if (t === 'retriever' || ['retriev','search','vector','embed','fetch','lookup'].some(k => n.includes(k)))          return 'retrieve';
  if (t === 'tool'      || ['tool','function','api','calculator','parser','exec'].some(k => n.includes(k)))          return 'tool';
  if (['plan','reason','think','route','decompos'].some(k => n.includes(k)))                                          return 'plan';
  if (['valid','check','guard','fact','verif'].some(k => n.includes(k)))                                              return 'validate';
  if (['output','response','final','format','answer'].some(k => n.includes(k)))                                       return 'output';
  return 'plan';
}

function inferStatus(error) {
  return error ? 'failed' : 'success';
}

// ── Format detection ──────────────────────────────────────────────────────────

/**
 * Returns 'langsmith' | 'langfuse' | 'weave' | null
 *
 * LangSmith : root object has `run_type`
 * LangFuse  : root object has `observations` array
 * Weave     : root object (or first element) has `op_name`
 */
function detectFormat(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.run_type === 'string') return 'langsmith';
  if (Array.isArray(obj.observations))  return 'langfuse';
  const probe = Array.isArray(obj) ? obj[0] : obj;
  if (probe && typeof probe.op_name === 'string') return 'weave';
  return null;
}

// ── LangSmith adapter ─────────────────────────────────────────────────────────
//
// Shape: { id, name, run_type, inputs, outputs, error,
//          start_time, end_time, child_runs[] }

function fromLangSmith(root) {
  const nodes = [], edges = [];
  let totalTokens = 0, failed = 0;

  function walk(run, parentId) {
    const id     = safeId(run.id || ('ls' + nodes.length));
    const role   = inferRole(run.run_type || '', run.name || '');
    const status = inferStatus(run.error);
    if (status === 'failed') failed++;

    const usage = run.outputs?.llm_output?.token_usage
               || run.extra?.usage_metadata
               || run.extra?.token_usage
               || {};
    totalTokens += usage.total_tokens || 0;

    const content = run.error
      ? String(run.error).slice(0, 300)
      : truncate(run.outputs ?? run.inputs);

    nodes.push({ id, name: run.name || run.run_type || 'Step',
                 role, status, content,
                 durationMs: msDiff(run.start_time, run.end_time) });

    if (parentId) edges.push({ from: parentId, to: id });
    (run.child_runs || []).forEach(c => walk(c, id));
  }

  walk(root, null);

  return _buildRun(
    safeId(root.id || ('run-' + Date.now())),
    root.name || 'LangSmith Import',
    root.start_time,
    nodes, edges,
    msDiff(root.start_time, root.end_time) || _sumMs(nodes),
    totalTokens, failed,
    truncate(root.outputs, 1000)
  );
}

// ── LangFuse adapter ──────────────────────────────────────────────────────────
//
// Shape: { id, name, timestamp,
//   observations: [{ id, type, name, input, output,
//                    startTime, endTime, parentObservationId, level }] }

function fromLangFuse(trace) {
  const obs  = [...(trace.observations || [])].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );
  const nodes = [], edges = [];
  let totalTokens = 0, failed = 0;
  const idMap = {};   // langfuse id → safe id

  // Virtual root
  const rootId = safeId(trace.id || 'root');
  idMap['__root__'] = rootId;
  nodes.push({ id: rootId, name: trace.name || 'Trace',
               role: 'input', status: 'success',
               content: truncate(trace.input || '') });

  obs.forEach((ob, i) => {
    const id = safeId(ob.id || ('lf' + i));
    idMap[ob.id] = id;
    const status = (ob.level === 'ERROR' || ob.statusMessage) ? 'failed' : 'success';
    if (status === 'failed') failed++;

    const usage = ob.usage || {};
    totalTokens += usage.totalTokens || usage.total_tokens || 0;

    nodes.push({
      id,
      name:      ob.name || ob.type || 'Step',
      role:      inferRole(ob.type || '', ob.name || ''),
      status,
      content:   truncate(ob.output ?? ob.input),
      durationMs: msDiff(ob.startTime, ob.endTime),
    });

    const parentSafe = ob.parentObservationId
      ? (idMap[ob.parentObservationId] || rootId)
      : rootId;
    edges.push({ from: parentSafe, to: id });
  });

  const totalMs = obs.length
    ? Math.max(0, new Date(obs.at(-1).endTime) - new Date(obs[0].startTime))
    : 0;
  const lastOut = [...obs].reverse().find(o => o.output);

  return _buildRun(
    safeId(trace.id || ('run-' + Date.now())),
    trace.name || 'LangFuse Import',
    trace.timestamp,
    nodes, edges, totalMs, totalTokens, failed,
    lastOut ? truncate(lastOut.output, 1000) : ''
  );
}

// ── W&B Weave adapter ─────────────────────────────────────────────────────────
//
// Shape A – nested:  { id, op_name, display_name, inputs, output,
//                      started_at, ended_at, exception, children[] }
// Shape B – flat:    Array of calls where each has parent_id

function fromWeave(raw) {
  const root     = Array.isArray(raw) ? raw[0] : raw;
  const flatList = Array.isArray(raw) && raw[0]?.parent_id !== undefined ? raw : null;

  const nodes = [], edges = [];
  let totalTokens = 0, failed = 0;

  function opName(op) {
    const m = String(op || '').match(/\/op\/([^:/]+)/);
    return m ? m[1] : String(op || 'step').split('/').pop().split(':')[0];
  }

  if (flatList) {
    // Flat export from Weave query API
    const idMap = {};
    flatList.forEach((call, i) => {
      const id = safeId(call.id || ('wv' + i));
      idMap[call.id] = id;
      const name   = call.display_name || opName(call.op_name);
      const status = inferStatus(call.exception);
      if (status === 'failed') failed++;
      const usage = call.output?.usage || call.summary?.usage || {};
      totalTokens += usage.total_tokens || usage.totalTokens || 0;
      nodes.push({ id, name, role: inferRole('', name), status,
                   content: truncate(call.output ?? call.inputs),
                   durationMs: msDiff(call.started_at, call.ended_at) });
    });
    flatList.forEach(call => {
      if (call.parent_id && idMap[call.parent_id])
        edges.push({ from: idMap[call.parent_id], to: idMap[call.id] });
    });
  } else {
    // Nested children
    function walk(call, parentId) {
      const id   = safeId(call.id || ('wv' + nodes.length));
      const name = call.display_name || opName(call.op_name);
      const status = inferStatus(call.exception);
      if (status === 'failed') failed++;
      const usage = call.output?.usage || call.summary?.usage || {};
      totalTokens += usage.total_tokens || usage.totalTokens || 0;
      nodes.push({ id, name, role: inferRole('', name), status,
                   content: truncate(call.output ?? call.inputs),
                   durationMs: msDiff(call.started_at, call.ended_at) });
      if (parentId) edges.push({ from: parentId, to: id });
      (call.children || []).forEach(c => walk(c, id));
    }
    walk(root, null);
  }

  return _buildRun(
    safeId(root.id || ('run-' + Date.now())),
    root.display_name || opName(root.op_name) || 'Weave Import',
    root.started_at,
    nodes, edges,
    msDiff(root.started_at, root.ended_at) || _sumMs(nodes),
    totalTokens, failed,
    truncate(root.output, 1000)
  );
}

// ── Internal factory ──────────────────────────────────────────────────────────

function _buildRun(id, name, createdAt, nodes, edges, totalMs, tokens, failed, finalAnswer) {
  return {
    id, name,
    createdAt: createdAt || new Date().toISOString(),
    nodes, edges,
    metrics: {
      totalMs:    Math.max(0, totalMs || 0),
      tokens:     tokens || 0,
      nodes:      nodes.length,
      successful: Math.max(0, nodes.length - failed),
      failed:     Math.max(0, failed),
    },
    finalAnswer: finalAnswer || '',
    counterfactuals: [],
  };
}

function _sumMs(nodes) {
  return nodes.reduce((s, n) => s + (n.durationMs || 0), 0);
}

// ── Public API ────────────────────────────────────────────────────────────────

function importFromThirdParty(obj) {
  const fmt = detectFormat(obj);
  if (!fmt) return { error: 'Unrecognised format. Expected LangSmith, LangFuse, or W&B Weave JSON.' };
  try {
    const run = fmt === 'langsmith' ? fromLangSmith(obj)
              : fmt === 'langfuse'  ? fromLangFuse(obj)
              :                       fromWeave(obj);
    return { run, format: fmt };
  } catch (e) {
    return { error: 'Adapter error: ' + e.message };
  }
}