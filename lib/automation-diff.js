/**
 * Automation graph diff.
 *
 * Compares two automation graphs (steps + connections) and reports a
 * structured diff:
 *   - steps added / removed
 *   - steps with config changes
 *   - connection added / removed (per step)
 *
 * Tolerates re-orderings of the `steps[]` array by indexing on `step.id`.
 * Designed to be cheap to run in CI / pre-deploy.
 */
export function diffAutomations(left = {}, right = {}) {
  const leftSteps = (left.steps || []).filter(s => s && s.id)
  const rightSteps = (right.steps || []).filter(s => s && s.id)
  const leftById = new Map(leftSteps.map(s => [s.id, s]))
  const rightById = new Map(rightSteps.map(s => [s.id, s]))

  const added = []
  const removed = []
  const changed = []
  const unchanged = []

  for (const [id, rStep] of rightById) {
    if (!leftById.has(id)) {
      added.push({ id, type: rStep.type, title: rStep.title })
      continue
    }
    const lStep = leftById.get(id)
    const diffs = []
    if ((lStep.type || '') !== (rStep.type || '')) diffs.push({ field: 'type', from: lStep.type, to: rStep.type })
    if (JSON.stringify(lStep.config || {}) !== JSON.stringify(rStep.config || {})) diffs.push({ field: 'config', from: lStep.config, to: rStep.config })
    if ((lStep.message || '') !== (rStep.message || '')) diffs.push({ field: 'message', from: lStep.message, to: rStep.message })
    const lConn = lStep.connections || {}
    const rConn = rStep.connections || {}
    const connKeys = new Set([...Object.keys(lConn), ...Object.keys(rConn)])
    for (const key of connKeys) {
      if (lConn[key] !== rConn[key]) {
        diffs.push({ field: `connections.${key}`, from: lConn[key] || null, to: rConn[key] || null })
      }
    }
    if (diffs.length === 0) {
      unchanged.push({ id, type: rStep.type })
    } else {
      changed.push({ id, type: rStep.type, title: rStep.title, diffs })
    }
  }

  for (const [id, lStep] of leftById) {
    if (!rightById.has(id)) removed.push({ id, type: lStep.type, title: lStep.title })
  }

  const summary = {
    totalLeft: leftSteps.length,
    totalRight: rightSteps.length,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    unchanged: unchanged.length
  }

  const breaking = []
  for (const r of removed) breaking.push({ kind: 'step_removed', id: r.id, type: r.type })
  for (const c of changed) {
    for (const d of c.diffs) {
      if (d.field === 'type' || d.field === 'connections.main' || d.field === 'connections.fallback') {
        breaking.push({ kind: 'breaking_change', id: c.id, field: d.field, from: d.from, to: d.to })
      }
    }
  }

  return {
    summary,
    breaking,
    steps: { added, removed, changed, unchanged }
  }
}