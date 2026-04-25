/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence. All rights reserved.
 * Proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is prohibited.
 */
'use strict';



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
  const nodeIds = new Set(obj.nodes.map(n => n.id));
  for (let i = 0; i < obj.edges.length; i++) {
    const e = obj.edges[i];
    if (!nodeIds.has(e.from)) return `Edge ${i}: "from" references unknown node "${e.from}".`;
    if (!nodeIds.has(e.to))   return `Edge ${i}: "to" references unknown node "${e.to}".`;
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