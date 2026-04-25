'use strict';

const { createAppContext } = require('./helpers/loadContext');

let ctx;
beforeEach(() => { ctx = createAppContext(); });

// ── layoutNodes() ─────────────────────────────────────────────────────────────
//
// Constants from layout.js (not accessible via ctx, derived from source):
//   nodeW = 220, nodeH = 120, padX = 60, padY = 50
//   startX = 40,  startY = 40
//
// Layer x: startX + layerIndex * (nodeW + padX) = 40 + layerIndex * 280
// Layer y (k nodes in layer):
//   totalH  = k * 120 + (k-1) * 50 = 170k - 50
//   offsetY = max(40, (600 - totalH) / 2)
//   node[i] = offsetY + i * (nodeH + padY) = offsetY + i * 170

const NODE_W   = 220;
const NODE_H   = 120;
const PAD_X    = 60;
const PAD_Y    = 50;
const START_X  = 40;
const CANVAS_H = 600;

function expectedX(layerIndex) {
  return START_X + layerIndex * (NODE_W + PAD_X);
}

function expectedOffsetY(nodesInLayer) {
  const totalH = nodesInLayer * NODE_H + Math.max(0, nodesInLayer - 1) * PAD_Y;
  return Math.max(40, (CANVAS_H - totalH) / 2);
}

describe('layoutNodes()', () => {
  test('returns empty object for empty node list', () => {
    expect(ctx.layoutNodes([], [])).toEqual({});
  });

  test('positions a single node in layer 0 at vertical center', () => {
    const positions = ctx.layoutNodes([{ id: 'A' }], []);
    expect(positions).toHaveProperty('A');
    expect(positions.A.x).toBe(expectedX(0));
    expect(positions.A.y).toBe(expectedOffsetY(1));
  });

  test('positions two disconnected nodes both in layer 0', () => {
    const positions = ctx.layoutNodes(
      [{ id: 'A' }, { id: 'B' }],
      []
    );
    // Both have in-degree 0 → same layer
    expect(positions.A.x).toBe(expectedX(0));
    expect(positions.B.x).toBe(expectedX(0));
    // A is first, B is second in the layer
    const offsetY = expectedOffsetY(2);
    expect(positions.A.y).toBe(offsetY);
    expect(positions.B.y).toBe(offsetY + NODE_H + PAD_Y);
  });

  test('places nodes in sequential layers for a linear chain A→B', () => {
    const positions = ctx.layoutNodes(
      [{ id: 'A' }, { id: 'B' }],
      [{ from: 'A', to: 'B' }]
    );
    expect(positions.A.x).toBe(expectedX(0));
    expect(positions.B.x).toBe(expectedX(1));
    // Both layers have 1 node
    expect(positions.A.y).toBe(expectedOffsetY(1));
    expect(positions.B.y).toBe(expectedOffsetY(1));
  });

  test('places nodes in sequential layers for A→B→C', () => {
    const positions = ctx.layoutNodes(
      [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }]
    );
    expect(positions.A.x).toBe(expectedX(0));
    expect(positions.B.x).toBe(expectedX(1));
    expect(positions.C.x).toBe(expectedX(2));
  });

  test('diverging fan-out: A → B and A → C', () => {
    const positions = ctx.layoutNodes(
      [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }]
    );
    // A is root (layer 0), B and C share layer 1
    expect(positions.A.x).toBe(expectedX(0));
    expect(positions.B.x).toBe(expectedX(1));
    expect(positions.C.x).toBe(expectedX(1));
    // B and C should have different y positions
    expect(positions.B.y).not.toBe(positions.C.y);
  });

  test('converging fan-in: A → C and B → C', () => {
    const positions = ctx.layoutNodes(
      [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      [{ from: 'A', to: 'C' }, { from: 'B', to: 'C' }]
    );
    // A and B are roots (layer 0), C has in-degree 2 and lands in layer 1
    expect(positions.A.x).toBe(expectedX(0));
    expect(positions.B.x).toBe(expectedX(0));
    expect(positions.C.x).toBe(expectedX(1));
  });

  test('returns a position for every node', () => {
    const nodes = [
      { id: 'n1' }, { id: 'n2' }, { id: 'n3' }, { id: 'n4' },
    ];
    const edges = [
      { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n4' },
    ];
    const positions = ctx.layoutNodes(nodes, edges);
    nodes.forEach(n => expect(positions).toHaveProperty(n.id));
  });

  test('all x coordinates are non-negative', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }];
    const positions = ctx.layoutNodes(nodes, edges);
    Object.values(positions).forEach(p => expect(p.x).toBeGreaterThanOrEqual(0));
  });

  test('all y coordinates are non-negative', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }];
    const positions = ctx.layoutNodes(nodes, edges);
    Object.values(positions).forEach(p => expect(p.y).toBeGreaterThanOrEqual(0));
  });

  test('nodes with cycle still receive positions (fallback placement)', () => {
    // A → B, B → A: neither has in-degree 0 — the BFS stalls,
    // so the post-pass adds each unvisited node as its own layer.
    const positions = ctx.layoutNodes(
      [{ id: 'A' }, { id: 'B' }],
      [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }]
    );
    expect(positions).toHaveProperty('A');
    expect(positions).toHaveProperty('B');
    // They end up in different layers, so different x values
    expect(positions.A.x).not.toBe(positions.B.x);
  });

  test('node with no outgoing edges ends up at the rightmost layer', () => {
    // Linear: A → B → C.  C is a sink and must have the largest x.
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }];
    const positions = ctx.layoutNodes(nodes, edges);
    expect(positions.C.x).toBeGreaterThan(positions.B.x);
    expect(positions.B.x).toBeGreaterThan(positions.A.x);
  });

  test('diamond graph: A→B, A→C, B→D, C→D', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    const positions = ctx.layoutNodes(nodes, edges);
    expect(positions.A.x).toBe(expectedX(0));
    // B and C are in layer 1
    expect(positions.B.x).toBe(expectedX(1));
    expect(positions.C.x).toBe(expectedX(1));
    // D must be to the right of B and C
    expect(positions.D.x).toBeGreaterThan(positions.B.x);
  });

  test('sample data nodes can be laid out without error', () => {
    const { runs } = ctx.makeSampleData();
    runs.forEach(run => {
      const positions = ctx.layoutNodes(run.nodes, run.edges);
      run.nodes.forEach(n => {
        expect(positions).toHaveProperty(n.id);
        expect(typeof positions[n.id].x).toBe('number');
        expect(typeof positions[n.id].y).toBe('number');
      });
    });
  });
});
