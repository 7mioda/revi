const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export async function GET() {
  const res = await fetch(`${API_URL}/profiles`)
  const body = await res.json() as unknown
  return Response.json(body, { status: res.status })
}
