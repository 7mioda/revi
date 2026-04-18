import { auth } from '@clerk/nextjs/server'
import { createOctokitClient, getAuthenticatedUser } from '@revi/octokit'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

/** Returns headers with Authorization when a Clerk session token is available. */
async function apiHeaders(): Promise<Record<string, string>> {
  const { getToken } = await auth()
  const token = await getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function POST(req: Request) {
  const { token } = (await req.json()) as { token?: string }

  if (!token) {
    return Response.json({ message: 'token is required' }, { status: 400 })
  }

  let login: string
  try {
    const client = createOctokitClient(token)
    const user = await getAuthenticatedUser(client)
    login = user.login
  } catch {
    return Response.json(
      { message: 'Failed to authenticate with GitHub. Check that the token is valid.' },
      { status: 400 },
    )
  }

  const res = await fetch(`${API_URL}/profiles/${login}/sync`, {
    method: 'POST',
    headers: await apiHeaders(),
    body: JSON.stringify({ token }),
  })

  const body = (await res.json()) as unknown
  if (!res.ok) {
    return Response.json(body, { status: res.status })
  }

  return Response.json({ ...(body as object), username: login })
}
