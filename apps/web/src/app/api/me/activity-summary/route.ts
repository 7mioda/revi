import { auth, clerkClient } from '@clerk/nextjs/server'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const githubUsername =
    user.externalAccounts.find((a) => a.provider === 'github')?.username ?? null
  const meta = user.publicMetadata as Record<string, unknown>
  const lastSeenAt = meta.lastSeenAt as string | undefined
  const now = new Date().toISOString()

  // Advance lastSeenAt for the next visit (fire-and-forget)
  void client.users.updateUser(userId, {
    publicMetadata: { ...meta, lastSeenAt: now },
  })

  if (!lastSeenAt || !githubUsername) {
    return Response.json({ firstTime: true })
  }

  try {
    const res = await fetch(
      `${API_URL}/profiles/${githubUsername}/activity-summary?since=${encodeURIComponent(lastSeenAt)}`,
    )
    if (!res.ok) return Response.json({ firstTime: true })
    const data = await res.json()
    return Response.json({ firstTime: false, since: lastSeenAt, githubUsername, ...data })
  } catch {
    return Response.json({ firstTime: true })
  }
}
