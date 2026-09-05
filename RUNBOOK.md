# ChatFlow Operator Runbook

A short, opinionated guide for keeping the automation fleet healthy.

## 1. Daily health checks

```bash
# Are webhooks still flowing?
curl -s "$BASE_URL/api/webhooks/health?hours=24" | jq .

# Is the cron runner running?
curl -s "$BASE_URL/api/cron/last-run" | jq .
```

`/api/webhooks/health` returns `health: "degraded"` when nothing has been received in 6h+ — investigate immediately. Common causes: Shopify webhook secret rotation, Meta 24h ping drop, or a firewall rule blocking the integration.

## 2. Sweep schedule (recommended)

| Job | Cadence | Endpoint |
|---|---|---|
| All sweeps (one-shot) | every 6h | `POST /api/cron/run-all` |
| Silence sweep | hourly | `POST /api/customer/silence-sweep?days=24` |
| Customer sweep (win-back / birthday / tier) | daily 09:00 | `POST /api/customer/sweep?types=win_back,birthday,tier_upgrade` |
| Reorder sweep (hour-optimised) | every 6h | `POST /api/reorder/sweep?optimize=true&limit=100` |

Run the bundled CLI runner:

```bash
CHATFLOW_BASE_URL=https://app.example.com \
CRON_TOKEN=xyz \
node scripts/cron-runner.mjs
```

`?token=` is required if `CRON_TOKEN` is set on the server.

## 3. Replaying a missed sweep

```bash
# Re-run the last 6h of win-back logic only
curl -X POST "$BASE_URL/api/customer/sweep?userId=default&type=win_back&daysAgo=60"
```

The endpoints are idempotent for messages (the outbound layer deduplicates via `outbound_idempotency`), so re-running is safe.

## 4. Rolling back an automation

The default templates are immutable in code but overridable in the database (saved in the same `automations` table the dashboard writes to). To disable a default without editing code:

```sql
UPDATE automations SET status = 'disabled' WHERE id = 'default-XXX';
```

To restore, set `status = 'active'`. The original copy lives in `lib/automation-defaults.js` — re-running the migration with `INSERT … ON DUPLICATE KEY UPDATE` will not overwrite.

## 5. Common incidents

| Symptom | Likely cause | First action |
|---|---|---|
| Webhook health `degraded` | Shopify or Meta secret rotation | Re-save integrations in `/dashboard/settings`, replay the last 1h from the source |
| `outbound_idempotency.duplicatesSuppressed` is high | Retry loop on a 5xx | Inspect `messages` for `status = 'error'`, fix upstream, re-run cron |
| `customer.clv_milestone` firing on every order | `customer_segments.totalSpent` already above threshold on first order | Confirm `previousTotal` snapshot is being read; not a bug per se, but consider tightening `DEFAULT_CLV_MILESTONES` |
| AB-test variants look skewed (90/10) | Hash function `simpleHash` is colliding | Re-arm with new `experimentKey`; existing assignments are sticky on purpose |

## 6. Smoke test

```bash
node --check scripts/cron-runner.mjs
curl -s "$BASE_URL/api/cron/playbook" | jq .
```

## 7. Roll back a schema migration

Every new table is `CREATE TABLE IF NOT EXISTS`, so re-running the migration is a no-op. To safely remove an experimental table:

```sql
RENAME TABLE experimental_table TO experimental_table_bak_$(date +%Y%m%d);
```

…and drop the backup after 7 days.

## 8. Who to ping

- Customer-success plays: `#cs-automation` Slack channel
- Outbound failures: `#platform-whatsapp`
- Schema changes: DBA on call via PagerDuty
