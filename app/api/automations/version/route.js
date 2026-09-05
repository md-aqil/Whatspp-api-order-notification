import { NextResponse } from 'next/server'
import { defaultAutomations, getDefaultsVersion } from '@/lib/automation-defaults'
import { getDefaultsFingerprint } from '@/lib/automation-defaults-fingerprint'

/**
 * GET /api/automations/version
 *   → returns the version + fingerprint of the defaults shipped with this build.
 *
 *   ?includeDefaults=true   → also return the full default graph
 *
 * Clients (admin UI, deployment scripts) can compare fingerprints to decide
 * whether to refresh.
 */
export async function GET(request) {
  const url = new URL(request.url)
  const includeDefaults = url.searchParams.get('includeDefaults') === 'true'
  const idFilter = url.searchParams.get('id')
  const summary = {
    version: getDefaultsVersion(),
    fingerprint: getDefaultsFingerprint(),
    count: defaultAutomations.length,
    ids: defaultAutomations.map(a => a.id)
  }
  const doc = { success: true, ...summary }
  if (idFilter) {
    doc.default = defaultAutomations.find(a => a.id === idFilter) || null
  }
  if (includeDefaults) {
    doc.defaults = defaultAutomations
  }
  return NextResponse.json(doc)
}