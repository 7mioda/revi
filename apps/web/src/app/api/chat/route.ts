import { anthropic } from '@ai-sdk/anthropic'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { buildSystem } from './agent.prompt'
import type { UserContext } from './agent.prompt'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

/** Fetches Clerk user data and extracts the fields the agent needs. */
async function getUserContext(userId: string): Promise<UserContext> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const name = user.firstName
    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
    : (user.username ?? null)

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )

  const githubAccount = user.externalAccounts.find(
    (a) => a.provider === 'github',
  )

  return {
    name,
    email: primaryEmail?.emailAddress ?? null,
    githubUsername: githubAccount?.username ?? null,
  }
}

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
  const { messages } = await req.json()

  const { userId } = await auth()
  const userCtx = userId ? await getUserContext(userId) : { name: null, email: null, githubUsername: null }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildSystem(userCtx),
    messages,
    tools: {
      get_activity_summary: tool({
        description:
          'Get a summary of Revi activity since the user last visited. Call this once at the start of the conversation in response to __init__, before greeting the user, when githubUsername is known.',
        parameters: z.object({}),
        execute: async () => {
          console.log('get_activity_summary', userId)
          if (!userId) return { firstTime: true }
          try {
            const client = await clerkClient()
            const user = await client.users.getUser(userId)
            const githubUsername = '7mioda'
            const meta = user.publicMetadata as Record<string, unknown>
            const lastSeenAt = meta.lastSeenAt as string | undefined
            const now = new Date().toISOString()
            void client.users.updateUser(userId, {
              publicMetadata: { ...meta, lastSeenAt: now },
            })
            console.log('lastSeenAt', lastSeenAt)
            console.log('githubUsername', githubUsername)
            if (!lastSeenAt || !githubUsername) return { firstTime: true }
            const res = await fetch(
              `${API_URL}/profiles/${githubUsername}/activity-summary?since=${encodeURIComponent(lastSeenAt)}`,
            )
            console.log('res', res)
            if (!res.ok) return { firstTime: true }
            const data = await res.json() as unknown
            return { firstTime: false, since: lastSeenAt, githubUsername, ...(data as object) }
          } catch {
            return { firstTime: true }
          }
        },
      }),
      fetch_comments: tool({
        description:
          "Fetch and save the user's GitHub comments. Call immediately after receiving the GitHub token.",
        parameters: z.object({
          token: z.string().describe("The user's GitHub personal access token"),
        }),
        execute: async ({ token }) => {
          try {
            const res = await fetch(`${API_URL}/me/comments`, {
              method: 'POST',
              headers: await apiHeaders(),
              body: JSON.stringify({ token }),
            })
            const body = await res.json() as unknown
            if (!res.ok) return { error: (body as { message?: string }).message ?? `HTTP ${res.status}` }
            return body
          } catch (err) {
            return { error: String(err) }
          }
        },
      }),
      generate_skills: tool({
        description:
          'Generate a skill profile from stored comments. Call immediately after fetch_comments succeeds.',
        parameters: z.object({
          userId: z.string().describe('GitHub login from the fetch_comments result'),
          username: z.string().describe('GitHub login / display name'),
        }),
        execute: async ({ userId, username }) => {
          try {
            const res = await fetch(`${API_URL}/skills`, {
              method: 'POST',
              headers: await apiHeaders(),
              body: JSON.stringify({ userId, username }),
            })
            const body = await res.json() as unknown
            if (!res.ok) return { error: (body as { message?: string }).message ?? `HTTP ${res.status}` }
            return body
          } catch (err) {
            return { error: String(err) }
          }
        },
      }),
      pick_profile: tool({
        description:
          'Show the user a list of saved reviewer profiles so they can pick one. Call this immediately when the user wants to review a PR. Do not ask for a username — just call this tool and the interface will handle it.',
        parameters: z.object({}),
      }),
      pick_persona: tool({
        description:
          'Show the user a list of profiles they can have a conversation with. Call this when the user wants to talk to one of the engineers in Revi — not for PR review, but for a chat.',
        parameters: z.object({}),
      }),
      sync_skills: tool({
        description:
          'Prompt the user to enter their GitHub personal access token and sync their skill profile. Call this immediately when the user wants to upload or refresh their skills. Do not ask for the token yourself — just call this tool.',
        parameters: z.object({}),
      }),
      review_pr: tool({
        description: 'Review a pull request using the generated skill profile and post it to GitHub.',
        parameters: z.object({
          owner: z.string().describe('GitHub repository owner'),
          repo: z.string().describe('GitHub repository name'),
          pullNumber: z.number().int().positive().describe('Pull request number'),
          userId: z.string().optional().describe('GitHub login to scope skill lookup'),
          username: z.string().optional().describe('Profile username from the pick_profile tool'),
        }),
        execute: async ({ owner, repo, pullNumber, userId, username }) => {
          try {
            const res = await fetch(`${API_URL}/reviews`, {
              method: 'POST',
              headers: await apiHeaders(),
              body: JSON.stringify({ owner, repo, pullNumber, post: true, username }),
            })
            const body = await res.json() as unknown
            if (!res.ok) return { error: (body as { message?: string }).message ?? `HTTP ${res.status}` }
            return body
          } catch (err) {
            return { error: String(err) }
          }
        },
      }),
    },
    maxSteps: 20,
  })

  return result.toDataStreamResponse()
}
