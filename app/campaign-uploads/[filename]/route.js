import { readFile } from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const mimeTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf'
}

export async function GET(request, { params }) {
  try {
    const filename = params?.filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return new NextResponse('Invalid filename', { status: 400 })
    }

    const candidateDirs = [
      path.join(process.cwd(), 'public', 'campaign-uploads'),
      path.join(process.cwd(), '.next', 'standalone', 'public', 'campaign-uploads'),
      path.join(process.cwd(), '..', 'public', 'campaign-uploads'),
      '/var/www/lcsw/public/campaign-uploads',
      '/var/www/lcsw/.next/standalone/public/campaign-uploads'
    ]

    let foundPath = null
    for (const dir of candidateDirs) {
      const fullPath = path.join(dir, filename)
      if (fs.existsSync(fullPath)) {
        foundPath = fullPath
        break
      }
    }

    if (!foundPath) {
      return new NextResponse('Image not found', { status: 404 })
    }

    const fileBuffer = await readFile(foundPath)
    const ext = filename.split('.').pop().toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('[campaign-uploads] Error serving file:', error)
    return new NextResponse('Error serving image', { status: 500 })
  }
}
