/*! AgentFlow — Copyright (c) 2026 Visigence. SPDX-License-Identifier: Apache-2.0 */
'use strict';

// Built-in example run, loaded by "Try an example" on the empty screen.
// Pure data in the native schema; tests/example.test.js validates it.

const EXAMPLE_RUN = {
  id: 'example-support-agent',
  name: 'Example: customer support agent',
  createdAt: '2026-10-29T09:00:00Z',
  nodes: [
    { id: 'question', name: 'Customer question', role: 'input', status: 'success', durationMs: 0,
      content: 'My order #4821 still has not arrived. Can I get a refund?' },
    { id: 'understand', name: 'Understand the request', role: 'plan', status: 'success', durationMs: 420,
      content: 'Intent: refund for a late order. Needed: the order status and the refund policy.' },
    { id: 'order', name: 'Look up the order', role: 'tool', status: 'success', durationMs: 610,
      content: 'Order #4821 shipped 9 days ago. Carrier status: delayed.' },
    { id: 'policy', name: 'Search the refund policy', role: 'retrieve', status: 'success', durationMs: 380,
      content: 'Found: "Orders delayed more than 7 days qualify for a full refund."' },
    { id: 'eligibility', name: 'Check eligibility', role: 'validate', status: 'success', durationMs: 90,
      content: '9 days late is more than the 7-day limit, so the order qualifies for a full refund.' },
    { id: 'draft', name: 'Write the reply', role: 'synthesize', status: 'success', durationMs: 3250,
      content: 'Sorry about the wait! Order #4821 is 9 days late, so it qualifies for a full refund. ' +
               'I have issued it, and the money will be back in 3 to 5 business days.' },
    { id: 'answer', name: 'Send the answer', role: 'output', status: 'success', durationMs: 70,
      content: 'Reply sent to the customer.' },
  ],
  edges: [
    { from: 'question', to: 'understand' },
    { from: 'understand', to: 'order' },
    { from: 'understand', to: 'policy' },
    { from: 'order', to: 'eligibility' },
    { from: 'policy', to: 'eligibility' },
    { from: 'eligibility', to: 'draft' },
    { from: 'draft', to: 'answer' },
  ],
  metrics: { totalMs: 4820, tokens: 1930, nodes: 7, successful: 7, failed: 0 },
  finalAnswer: 'Sorry about the wait! Order #4821 is 9 days late, so it qualifies for a full refund. ' +
               'I have issued it, and the money will be back in 3 to 5 business days.',
  counterfactuals: [
    {
      id: 'example-policy-down',
      name: 'What if the policy search had failed?',
      description: 'The agent cannot find the refund policy, so it cannot confirm the refund and hands the case to a person.',
      nodeOverrides: {
        policy: { status: 'failed', durationMs: 2000, content: 'Search timed out. No policy documents returned.' },
        eligibility: { status: 'skipped', durationMs: 0, content: 'Skipped: there is no policy to check against.' },
        draft: { durationMs: 1900,
                 content: 'Sorry about the wait! I have passed your refund request to our support team, ' +
                          'and they will reply within 24 hours.' },
      },
      metrics: { totalMs: 5000, tokens: 1240, successful: 5, failed: 1 },
      finalAnswer: 'Sorry about the wait! I have passed your refund request to our support team, ' +
                   'and they will reply within 24 hours.',
    },
    {
      id: 'example-delivered',
      name: 'What if the order showed as delivered?',
      description: 'Same question, but the order lookup returns a different fact, and the answer changes completely.',
      nodeOverrides: {
        order: { content: 'Order #4821 was marked as delivered 2 days ago.' },
        eligibility: { content: 'Delivered orders do not qualify for a late-delivery refund.' },
        draft: { durationMs: 3040,
                 content: 'Our records show order #4821 was delivered 2 days ago. If it is not with you, ' +
                          'I have opened a missing-package investigation and we will update you within 48 hours.' },
      },
      metrics: { totalMs: 4610, tokens: 1780 },
      finalAnswer: 'Our records show order #4821 was delivered 2 days ago. If it is not with you, ' +
                   'I have opened a missing-package investigation and we will update you within 48 hours.',
    },
  ],
};
