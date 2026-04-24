'use strict';

function layoutNodes(nodes, edges) {
  const nodeW = 220, nodeH = 120, padX = 60, padY = 50;
  const inDegree = {};
  const adj      = {};
  nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
  edges.forEach(e => {
    inDegree[e.to] = (inDegree[e.to] || 0) + 1;
    adj[e.from].push(e.to);
  });

  // Kahn's BFS — layer by layer
  const layers = [];
  let queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const visited = new Set();
  while (queue.length) {
    layers.push([...queue]);
    const next = [];
    queue.forEach(id => {
      visited.add(id);
      adj[id].forEach(child => {
        inDegree[child]--;
        if (inDegree[child] === 0 && !visited.has(child)) next.push(child);
      });
    });
    queue = next;
  }
  nodes.forEach(n => { if (!visited.has(n.id)) layers.push([n.id]); });

  const positions = {};
  const startX = 40, startY = 40;
  layers.forEach((layer, li) => {
    const totalH  = layer.length * nodeH + (layer.length - 1) * padY;
    const offsetY = Math.max(startY, (600 - totalH) / 2);
    layer.forEach((id, i) => {
      positions[id] = {
        x: startX + li * (nodeW + padX),
        y: offsetY + i  * (nodeH + padY),
      };
    });
  });
  return positions;
}