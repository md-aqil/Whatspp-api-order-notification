import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/mysql'
import { diffAutomations } from '@/lib/automation-diff'
import { defaultAutomations } from '@/lib/automation-defaults'

/**
 * POST /api/admin/automations/diff
 *   body: {
 *     leftId?:  string          — id of automation in DB (left side)
 *     rightId?: string          — id of automation in DB (right side)
 *     left?:   Automation      — raw graph (left side, for previews)
 *     right?:  Automation
 *   }
 *
 * Either ids OR raw graphs are accepted. The diff is purely structural and
 * makes no assumptions about ordering.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    let left = body.left
    let right = body.right
    if (body.leftId) left = await loadAutomation(body.leftId)
    if (body.rightId) right = await loadAutomation(body.rightId)
    if (!left || !right) {
      return NextResponse.json({ success: false, error: 'left and right required' }, { status: 400 })
    }
    const diff = diffAutomations(left, right)
    return NextResponse.json({ success: true, ...diff })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  // Convenience: ?leftId=default-x&rightId=default-y compares two defaults
  const url = new URL(request.url)
  const leftId = url.searchParams.get('leftId')
  const rightId = url.searchParams.get('rightId')
  if (!leftId || !rightId) {
    return NextResponse.json({ success: false, error: 'leftId and rightId required' }, { status: 400 })
  }
  let left = await loadAutomation(leftId)
  let right = await loadAutomation(rightId)
  if (!left) left = defaultAutomations.find(a => a.id === leftId) || null
  if (!right) right = defaultAutomations.find(a => a.id === rightId) || null
  if (!left || !right) {
    return NextResponse.json({ success: false, error: 'automation not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, ...diffAutomations(left, right) })
}

async function loadAutomation(id) {
  try {
    const row = await queryOne(`SELECT id, name, steps FROM automations WHERE id = ? LIMIT 1`, [id])
    if (!row) return null
    let steps = row.steps
    if (typeof steps === 'string') {
      try { steps = JSON.parse(steps) } catch (e) { steps = [] }
    }
    return { id: row.id, name: row.name, steps: Array.isArray(steps) ? steps : [] }
  } catch (e) {
    return null
  }
}