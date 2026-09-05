#!/usr/bin/env node
/**
 * scripts/cron-runner.mjs
 *
 * Reads CRON_PLAYBOOK.json from the project root and dispatches each job
 * against the configured base URL. Designed to be invoked from any external
 * scheduler (cron, GitHub Actions, Vercel Cron, k8s CronJob, etc.).
 *
 *   CHATFLOW_BASE_URL=https://app.example.com \
 *   CRON_TOKEN=xyz \
 *   node scripts/cron-runner.mjs
 *
 *   # or only one job:
 *   JOB=sweeps-all node scripts/cron-runner.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLAYBOOK_PATH = path.resolve(__dirname, '..', 'CRON_PLAYBOOK.json')

function loadPlaybook() {
  if (!fs.existsSync(PLAYBOOK_PATH)) {
    throw new Error(`Playbook not found: ${PLAYBOOK_PATH}`)
  }
  const raw = fs.readFileSync(PLAYBOOK_PATH, 'utf8')
  return JSON.parse(raw)
}

function resolveTemplate(str) {
  if (typeof str !== 'string') return str
  return str.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] || '')
}

async function runJob(job, baseUrl, token) {
  const url = `${baseUrl}${job.path}${job.query ? `?${job.query}` : ''}`
  const controller = new AbortController()
  const timeoutMs = (job.timeoutSeconds || 30) * 1000
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['x-cron-token'] = token
    const res = await fetch(url, {
      method: job.method || 'POST',
      headers,
      signal: controller.signal
    })
    const text = await res.text()
    const json = (() => {
      try { return JSON.parse(text) } catch { return { _raw: text } }
    })()
    return { ok: res.ok, status: res.status, data: json }
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message }
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  const playbook = loadPlaybook()
  const baseUrl = resolveTemplate(playbook.baseUrl) || process.env.CHATFLOW_BASE_URL
  const token = resolveTemplate(playbook.auth?.value) || process.env.CRON_TOKEN
  if (!baseUrl) throw new Error('CHATFLOW_BASE_URL is required')

  const wanted = process.env.JOB
  const jobs = wanted
    ? playbook.jobs.filter(j => j.name === wanted)
    : playbook.jobs
  if (jobs.length === 0) {
    console.error(`No matching jobs (filter: ${wanted || 'all'})`)
    process.exit(1)
  }

  const results = []
  for (const job of jobs) {
    const started = Date.now()
    const result = await runJob(job, baseUrl, token)
    results.push({ name: job.name, ms: Date.now() - started, ...result })
    console.log(`[${result.ok ? 'OK' : 'FAIL'}] ${job.name} ${result.status || ''} ${result.error || ''} (${Date.now() - started}ms)`)
  }

  if (process.env.CRON_VERBOSE) {
    console.log(JSON.stringify(results, null, 2))
  }
  const allOk = results.every(r => r.ok)
  process.exit(allOk ? 0 : 2)
}

main().catch(err => {
  console.error('[cron-runner]', err.message)
  process.exit(1)
})
