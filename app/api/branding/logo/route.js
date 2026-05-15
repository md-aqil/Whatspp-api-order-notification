import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { query } from '@/lib/postgres'
import { getBranding, updateLogo } from '@/lib/providers/branding-provider'
import { verifyToken } from '@/lib/auth'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
const maxBytes = 2 * 1024 * 1024 // 2MB

function extensionFor(type) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/svg+xml') return 'svg'
  return 'jpg'
}

async function getUserIdFromRequest(request) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) return null
  try {
    const payload = verifyToken(accessToken)
    return payload?.id || null
  } catch (e) {
    return null
  }
}

export async function POST(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, and SVG images are supported' }, { status: 400 })
    }

    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'Image must be 2MB or smaller' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'branding-logos')
    await mkdir(uploadDir, { recursive: true })

    const extension = extensionFor(file.type)
    const fileName = `logo-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
    const filePath = path.join(uploadDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())

    await writeFile(filePath, buffer)

    const relativeUrl = `/branding-logos/${fileName}`
    const absoluteUrl = new URL(relativeUrl, request.nextUrl.origin).toString()

    // Update branding in DB
    await updateLogo(userId, absoluteUrl)

    return NextResponse.json({
      success: true,
      url: absoluteUrl,
      relativeUrl
    })
  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
  }
}