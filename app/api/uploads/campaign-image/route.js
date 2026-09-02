import { mkdir, writeFile } from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxBytes = 10 * 1024 * 1024

function extensionFor(type) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    let files = formData.getAll('files')
    if (!files || files.length === 0) {
      const single = formData.get('file')
      if (single && typeof single !== 'string') {
        files = [single]
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'At least one image file is required' }, { status: 400 })
    }

    // Determine upload directory
    const candidates = [
      path.join(process.cwd(), 'public', 'campaign-uploads'),
      path.join(process.cwd(), '..', 'public', 'campaign-uploads'),
      '/var/www/lcsw/public/campaign-uploads'
    ]

    let uploadDir = candidates[0]
    for (const cand of candidates) {
      try {
        await mkdir(cand, { recursive: true })
        uploadDir = cand
        break
      } catch (e) {}
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const uploadedUrls = []

    for (const file of files) {
      if (!file || typeof file === 'string') continue

      if (!allowedTypes.has(file.type)) {
        continue
      }

      if (file.size > maxBytes) {
        continue
      }

      const extension = extensionFor(file.type)
      const fileName = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
      const filePath = path.join(uploadDir, fileName)
      const buffer = Buffer.from(await file.arrayBuffer())

      await writeFile(filePath, buffer)

      const relativeUrl = `/campaign-uploads/${fileName}`
      const absoluteUrl = new URL(relativeUrl, baseUrl).toString()
      uploadedUrls.push(absoluteUrl)
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'No valid JPG, PNG, or WebP images under 10MB could be uploaded' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      url: uploadedUrls[0],
      urls: uploadedUrls
    })
  } catch (error) {
    console.error('Image upload failed:', error)
    return NextResponse.json({ error: `Failed to upload image: ${error.message}` }, { status: 500 })
  }
}
