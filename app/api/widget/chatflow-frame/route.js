import { NextResponse } from 'next/server'
import { getBranding } from '@/lib/providers/branding-provider'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId || userId === 'default') {
      return new NextResponse('Missing or invalid userId parameter', { status: 400 })
    }

    const branding = await getBranding(userId)

    // Return HTML page that renders the chat widget iframe content
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${branding.businessName} - Chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${branding.fontFamily || 'Inter'}, system-ui, sans-serif;
      background: #f5f5f5;
    }
    #widget {
      width: 100%;
      height: 100vh;
      border: none;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    // This would hydrate the React widget component
    // For now, serve as a standalone page
    const branding = ${JSON.stringify(branding)};
    document.getElementById('root').innerHTML = '<p style="padding:20px;text-align:center;color:#666;">Chatflow Widget - Loading...</p>';

    // Redirect parent to close iframe mode if needed
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'chatflow-loaded', branding }, '*');
    }
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Widget frame error:', error)
    return new NextResponse('Widget failed to load', { status: 500 })
  }
}