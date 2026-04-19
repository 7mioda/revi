import { anthropic } from '@ai-sdk/anthropic'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createDataStreamResponse, streamText, tool, type JSONValue } from 'ai'
import { z } from 'zod'
import { buildSystem, buildPersonaSystem } from './agent.prompt'
import type { UserContext, PersonaContext, PersonaAnnotation } from './agent.prompt'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

/** Extracts @username mentions from free text. Matches GitHub-style logins. */
function extractMentions(text: string): string[] {
  const matches = text.match(/(?:^|\s)@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}))/g)
  if (!matches) return []
  const usernames = matches.map((m) => m.trim().slice(1))
  return Array.from(new Set(usernames))
}

/** Flattens an AI SDK message's content to plain text. */
function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: 'text'; text: string } =>
        typeof p === 'object' && p !== null && (p as { type?: unknown }).type === 'text',
      )
      .map((p) => p.text)
      .join(' ')
  }
  return ''
}

/**
 * Finds the active persona by walking user messages from newest to oldest
 * and returning the most recent @mention. Once a sub-agent is engaged it
 * stays engaged until the user mentions someone else.
 */
function activeMention(
  messages: Array<{ role: string; content: unknown }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role !== 'user') continue
    const mentions = extractMentions(messageText(m.content))
    if (mentions.length > 0) return mentions[0]!
  }
  return null
}

/** Fetches persona context (profile + skills + preferences) from the API. */
async function fetchPersonaContext(username: string): Promise<PersonaContext | null> {
  try {
    const res = await fetch(`${API_URL}/profiles/${encodeURIComponent(username)}/context`)
    if (!res.ok) return null
    return (await res.json()) as PersonaContext
  } catch {
    return null
  }
}

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

  // If any user message in the thread mentions @username, the most recent one
  // wins and that persona stays engaged for follow-ups until the user mentions
  // someone else.
  const mention = activeMention(messages)
  if (mention) {
    const personaCtx = await fetchPersonaContext(mention)
    if (personaCtx) {
      const annotation: PersonaAnnotation = {
        persona: {
          username: personaCtx.profile.username,
          name: personaCtx.profile.name ?? null,
          avatarUrl: personaCtx.profile.avatarUrl ?? null,
          avatar: personaCtx.profile.avatar ?? null,
        },
      }
      return createDataStreamResponse({
        execute: (dataStream) => {
          // Tag the streamed assistant message so the client can render the
          // persona's avatar next to it via `message.annotations`.
          dataStream.writeMessageAnnotation(annotation as unknown as JSONValue)
          const personaResult = streamText({
            model: anthropic('claude-sonnet-4-6'),
            system: buildPersonaSystem(personaCtx, userCtx),
            messages,
            maxSteps: 5,
          })
          personaResult.mergeIntoDataStream(dataStream)
        },
      })
    }
  }

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
            if (!lastSeenAt || !githubUsername) return { firstTime: true }
            const res = await fetch(
              `${API_URL}/profiles/${githubUsername}/activity-summary?since=${encodeURIComponent(lastSeenAt)}`,
            )
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
