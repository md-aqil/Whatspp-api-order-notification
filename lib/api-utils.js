import { NextResponse } from 'next/server'
import { requireRequestUserId, resolveRequestUserId } from './request-user'

export const handleCORS = (response) => {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export function parseRequest(request) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') || ''
  const pathParts = path.split('/').filter(Boolean)
  const route = '/' + pathParts.join('/')
  const method = request.method
  
  return { url, path, pathParts, route, method }
}

export function errorResponse(message, status = 500) {
  return handleCORS(NextResponse.json({ error: message }, { status }))
}

export function successResponse(data) {
  return handleCORS(NextResponse.json(data))
}
