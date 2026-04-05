export async function GET() {
  return new Response('', {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=86400'
    }
  })
}
