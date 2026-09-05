import { NextResponse } from 'next/server'

/**
 * GET /api/cron/playbook
 *
 * Returns a list of recommended cron jobs to run against this ChatFlow
 * instance. External schedulers (e.g. GitHub Actions, Vercel Cron, cron-job.org)
 * can poll this endpoint to discover the latest required schedule.
 *
 * The list is intentionally declarative — each entry has a `path` (relative
 * to the deployment base URL) and a `cadence` expression. A job runner can
 * convert `cadence` into its own scheduler format.
 */
const PLAYBOOK = [
  {
    name: 'sweeps',
    description: 'Run all customer + reorder + CLV sweeps (alias for /api/cron/run-all)',
    path: '/api/cron/run-all',
    method: 'POST',
    cadence: 'every_6_hours',
    auth: '?token=$CRON_TOKEN'
  },
  {
    name: 'silence-sweep',
    description: 'Detect customers that have gone silent for 24h+ and fire win-back events',
    path: '/api/customer/silence-sweep',
    method: 'POST',
    cadence: 'hourly'
  },
  {
    name: 'customer-sweep',
    description: 'Find win-back / birthday / tier-upgrade candidates',
    path: '/api/customer/sweep',
    method: 'POST',
    cadence: 'daily_at_09:00',
    params: '?types=win_back,birthday,tier_upgrade'
  },
  {
    name: 'reorder-sweep',
    description: 'Fire shopify.reorder_due for consumables whose window elapsed',
    path: '/api/reorder/sweep',
    method: 'POST',
    cadence: 'every_6_hours',
    params: '?optimize=true&limit=100'
  }
]

export async function GET() {
  return NextResponse.json({ success: true, version: 1, jobs: PLAYBOOK })
}