import { NextResponse } from 'next/server'
import { generateEmbedding } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/mysql'

/**
 * Fetch a public URL, strip HTML, chunk into ~800-character windows, and
 * insert each chunk into the knowledge base with an embedding.
 *
 *   POST /api/knowledge-base/ingest-url
 *     body: { url, title?, chunkSize?, maxChunks? }
 *
 * Use this for one-off ingestion of product pages, FAQ articles, or policy
 * docs that should ground the AI in canonical copy.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const url = String(body.url || '').trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ success: false, error: 'valid url required' }, { status: 400 })
    }
    const title = (body.title || url).toString().slice(0, 256)
    const chunkSize = Math.min(Math.max(parseInt(body.chunkSize || 800, 10) || 800, 200), 4000)
    const maxChunks = Math.min(parseInt(body.maxChunks || 25, 10) || 25, 200)

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChatFlowKB/1.0 (+https://chatflow.local)' },
      redirect: 'follow'
    })
    if (!res.ok) {
      return NextResponse.json({ success: false, error: `fetch_failed_${res.status}` }, { status: 502 })
    }
    const html = await res.text()
    const text = stripHtml(html)
    const chunks = chunkText(text, chunkSize, maxChunks)

    let inserted = 0
    const errors = []
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      try {
        const embedding = await generateEmbedding(c)
        await query(
          `INSERT INTO knowledge_base (id, title, content, embedding, source, sourceUrl, chunkIndex, createdAt)
           VALUES (?, ?, ?, ?, 'url', ?, ?, NOW())`,
          [uuidv4(), `${title} (${i + 1}/${chunks.length})`, c, embedding ? JSON.stringify(embedding) : null, url, i]
        )
        inserted++
      } catch (e) {
        errors.push({ chunk: i, error: e.message })
      }
    }
    return NextResponse.json({ success: true, url, title, inserted, total: chunks.length, errors })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function stripHtml(html) {
  return String(html)
    // drop <script>/<style> blocks
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    // tags → space
    .replace(/<[^>]+>/g, ' ')
    // decode the most common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text, chunkSize, maxChunks) {
  if (!text) return []
  const out = []
  let i = 0
  while (i < text.length && out.length < maxChunks) {
    const end = Math.min(text.length, i + chunkSize)
    let slice = text.slice(i, end)
    // try to break on sentence boundary
    if (end < text.length) {
      const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '))
      if (lastStop > chunkSize * 0.5) slice = slice.slice(0, lastStop + 1)
    }
    if (slice.trim()) out.push(slice.trim())
    i += slice.length || chunkSize
  }
  return out
}