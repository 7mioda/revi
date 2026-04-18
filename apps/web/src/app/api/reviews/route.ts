import { auth } from '@clerk/nextjs/server'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

async function apiHeaders(): Promise<Record<string, string>> {
  const { getToken } = await auth()
  const token = await getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function POST(req: Request) {
  const body = await req.json() as unknown
  const res = await fetch(`${API_URL}/reviews`, {
    method: 'POST',
    headers: await apiHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json() as unknown
  return Response.json(data, { status: res.status })
}
