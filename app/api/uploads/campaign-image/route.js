import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxBytes = 5 * 1024 * 1024

function extensionFor(type) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are supported' }, { status: 400 })
    }

    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'campaign-uploads')
    await mkdir(uploadDir, { recursive: true })

    const extension = extensionFor(file.type)
    const fileName = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
    const filePath = path.join(uploadDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())

    await writeFile(filePath, buffer)

    const relativeUrl = `/campaign-uploads/${fileName}`
    const absoluteUrl = new URL(relativeUrl, request.nextUrl.origin).toString()

    return NextResponse.json({
      success: true,
      url: absoluteUrl,
      relativeUrl
    })
  } catch (error) {
    console.error('Campaign image upload failed:', error)
    return NextResponse.json({ error: 'Failed to upload campaign image' }, { status: 500 })
  }
}
