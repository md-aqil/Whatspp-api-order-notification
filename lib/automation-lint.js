/**
 * Pre-send lint for outbound automation messages.
 *
 * Walks every step in a graph and reports:
 *   - broken placeholders  ({{unknown_var}}) without a corresponding value in
 *                            the context map
 *   - extra placeholders    (vars in context the message never uses — info)
 *   - character-limit risks (per WhatsApp / Instagram / Email)
 *   - missing channels      (a 'message' step with no channel set)
 *   - unreachable steps     (never referenced as a connection target)
 *   - duplicate step ids    (breaks the engine)
 *
 * Returns { ok, issues: [{ severity, code, stepId, message, fix }] }.
 */

const LIMITS = {
  whatsapp: 4096,
  whatsappInteractive: 1024,
  emailSubject: 120,
  emailBody: 50000
}

export function lintAutomation(automation = {}, context = {}) {
  const issues = []
  const steps = Array.isArray(automation.steps) ? automation.steps : []
  if (steps.length === 0) {
    issues.push({ severity: 'error', code: 'no_steps', stepId: null, message: 'Automation has no steps' })
    return { ok: false, issues }
  }

  // 1) duplicate step ids
  const ids = new Set()
  for (const s of steps) {
    if (!s.id) {
      issues.push({ severity: 'error', code: 'missing_step_id', stepId: null, message: 'A step is missing an id' })
    } else if (ids.has(s.id)) {
      issues.push({ severity: 'error', code: 'duplicate_step_id', stepId: s.id, message: `Step id ${s.id} is used more than once` })
    } else {
      ids.add(s.id)
    }
  }

  // 2) connection reachability + dead steps
  const referenced = new Set()
  for (const s of steps) {
    const conn = s.connections || {}
    for (const k of Object.keys(conn)) {
      const target = conn[k]
      if (target) referenced.add(target)
    }
  }
  // The first trigger step is always a starting node — count as "referenced"
  for (const s of steps) {
    if (s.type === 'trigger' && !referenced.has(s.id)) {
      referenced.add(s.id)
    }
  }
  for (const s of steps) {
    if (!referenced.has(s.id)) {
      issues.push({ severity: 'warning', code: 'unreachable_step', stepId: s.id, message: `Step "${s.title || s.id}" is not referenced by any connection (it will never run).` })
    }
  }

  // 3) message placeholders
  const placeholdersUsed = new Set()
  for (const s of steps) {
    if (s.type === 'message') {
      const channel = s.channel || 'whatsapp'
      let limit = LIMITS[channel] || LIMITS.whatsapp
      if (channel === 'whatsapp' && s.interactive) limit = LIMITS.whatsappInteractive
      if (!s.message) {
        issues.push({ severity: 'warning', code: 'empty_message', stepId: s.id, message: `Message step "${s.title || s.id}" has no body` })
        continue
      }
      if (s.message.length > limit) {
        issues.push({
          severity: 'warning', code: 'over_limit', stepId: s.id,
          message: `Message body is ${s.message.length} chars (limit ${limit} for ${channel}). WhatsApp will truncate.`,
          fix: 'Trim the message or split into two steps.'
        })
      }
      // collect placeholders
      const ph = extractPlaceholders(s.message)
      for (const p of ph) {
        placeholdersUsed.add(p)
        if (!Object.prototype.hasOwnProperty.call(context, p)) {
          issues.push({
            severity: 'error', code: 'unknown_placeholder', stepId: s.id,
            message: `Placeholder {{${p}}} has no value in the context. The customer will see literal {{${p}}}.`,
            fix: `Add a "${p}" field to the context, or set it inside an earlier step.`
          })
        }
      }
    } else if (s.type === 'interactive') {
      const body = s.message || ''
      const limit = LIMITS.whatsappInteractive
      if (body.length > limit) {
        issues.push({
          severity: 'warning', code: 'over_limit', stepId: s.id,
          message: `Interactive body is ${body.length} chars (limit ${limit}).`,
          fix: 'Shorten the prompt.'
        })
      }
      if (!s.options || s.options.length === 0) {
        issues.push({ severity: 'error', code: 'no_options', stepId: s.id, message: 'Interactive step has no options' })
      } else if (s.options.length > 3) {
        issues.push({ severity: 'warning', code: 'too_many_options', stepId: s.id, message: 'WhatsApp quick-reply supports max 3 buttons.' })
      }
    } else if (s.type === 'channel_post') {
      if (s.message && s.message.length > 4096) {
        issues.push({ severity: 'warning', code: 'over_limit', stepId: s.id, message: 'Channel post exceeds 4096 chars.' })
      }
    }
  }

  // 4) unused context vars (info)
  for (const k of Object.keys(context)) {
    if (!placeholdersUsed.has(k) && !looksLikeSystemKey(k)) {
      issues.push({ severity: 'info', code: 'unused_context', stepId: null, message: `Context key "${k}" is not used in any message.` })
    }
  }

  // 5) channel missing
  for (const s of steps) {
    if (s.type === 'message' && !s.channel) {
      issues.push({ severity: 'error', code: 'missing_channel', stepId: s.id, message: 'Message step is missing a channel' })
    }
  }

  const ok = !issues.some(i => i.severity === 'error')
  return { ok, issues }
}

function extractPlaceholders(text) {
  const out = new Set()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m
  while ((m = re.exec(String(text))) !== null) out.add(m[1])
  return out
}

function looksLikeSystemKey(k) {
  return k.startsWith('_') || k === 'optInConfirmedAt' || k === 'optedIn'
}