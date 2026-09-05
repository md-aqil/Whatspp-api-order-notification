// Service layer for Automation API calls
// Centralises fetch logic used by the UI components.
// All functions return a Promise that resolves to JSON (or throws on error).

export async function loadAutomations() {
  const r = await fetch('/api/automations');
  if (!r.ok) throw new Error('Failed to load automations');
  return r.json();
}

export async function saveAutomations(automations, { keepalive = false, silent = false } = {}) {
  const r = await fetch('/api/automations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ automations }),
    keepalive,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Save failed: ${txt}`);
  }
  // Caller may show toast; we just resolve.
  return r.json();
}

export async function loadTemplates() {
  const r = await fetch('/api/whatsapp-templates');
  if (!r.ok) throw new Error('Failed to load templates');
  return r.json();
}

export async function loadWebhookLogs(limit = 100) {
  const r = await fetch(`/api/webhook-logs?limit=${limit}`);
  if (!r.ok) throw new Error('Failed to load webhook logs');
  return r.json();
}

export async function loadWaConfig() {
  const r = await fetch('/api/wa-config');
  if (!r.ok) throw new Error('Failed to load WA config');
  return r.json();
}

export async function loadGoogleSheets() {
  const r = await fetch('/api/integrations/google/spreadsheets');
  if (!r.ok) throw new Error('Failed to load spreadsheets');
  return r.json();
}

export async function loadSheets(spreadsheetId) {
  const r = await fetch(`/api/integrations/google/sheets?spreadsheetId=${spreadsheetId}`);
  if (!r.ok) throw new Error('Failed to load sheets');
  return r.json();
}
