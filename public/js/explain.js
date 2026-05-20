// Human-readable explanations of revisions.
// Mirrors logic_engine/explain.py.

function explainRevision(revision, maxCollateralShown) {
  if (maxCollateralShown === undefined) maxCollateralShown = 10;
  const q = revision.targetQuery;
  const verb = revision.targetTruth ? 'satisfy' : 'falsify';
  const lines = ['To ' + verb + ' \'' + q + '\', the proposed edit (cost=' + revision.cost + '):'];

  if (revision.editsRemoved.size > 0) {
    lines.push('');
    lines.push('  Remove:');
    const removed = Array.from(revision.editsRemoved.values()).sort(function(a, b) {
      return a.toString().localeCompare(b.toString());
    });
    for (const f of removed) lines.push('    \u2212 ' + f);
  }

  if (revision.editsAdded.size > 0) {
    lines.push('');
    lines.push('  Add:');
    const added = Array.from(revision.editsAdded.values()).sort(function(a, b) {
      return a.toString().localeCompare(b.toString());
    });
    for (const f of added) lines.push('    + ' + f);
  }

  const targetKey = q.source + '>' + q.target;
  let sideEffects;
  let label;
  if (revision.targetTruth) {
    sideEffects = Array.from(revision.entailmentsGained)
      .filter(function(e) { return e !== targetKey; })
      .sort();
    label = 'New entailments introduced';
  } else {
    sideEffects = Array.from(revision.entailmentsLost)
      .filter(function(e) { return e !== targetKey; })
      .sort();
    label = 'Other entailments lost';
  }

  lines.push('');
  lines.push('  Collateral: ' + sideEffects.length);
  if (sideEffects.length > 0) {
    lines.push('  ' + label + ':');
    for (const entailment of sideEffects.slice(0, maxCollateralShown)) {
      const parts = entailment.split('>');
      const s = parts[0];
      const t = parts[1];
      lines.push('    \u00b7 ' + s + ' > ' + t);
    }
    if (sideEffects.length > maxCollateralShown) {
      lines.push('    \u00b7 ... and ' + (sideEffects.length - maxCollateralShown) + ' more');
    }
  }
  return lines.join('\n');
}

function explainAll(revisions) {
  if (revisions.length === 0) {
    return 'No revision needed \u2014 query already has the desired truth value.';
  }
  const blocks = [];
  for (let i = 0; i < revisions.length; i++) {
    const r = revisions[i];
    const header = '=== Option ' + (i + 1) + ' (cost=' + r.cost + ', collateral=' + r.collateral + ') ===';
    blocks.push(header + '\n' + explainRevision(r));
  }
  return blocks.join('\n\n');
}
