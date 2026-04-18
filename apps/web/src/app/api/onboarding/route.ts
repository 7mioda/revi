import { anthropic } from '@ai-sdk/anthropic'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { streamText, tool } from 'ai'
import { z } from 'zod'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

interface UserContext {
  displayName: string | null
  email: string | null
  githubUsername: string | null
}

/** Fetches Clerk user data and extracts the fields the agent needs. */
async function getUserContext(userId: string): Promise<UserContext> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const displayName = user.firstName
    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
    : (user.username ?? null)

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )

  const githubAccount = user.externalAccounts.find(
    (a) => a.provider === 'github',
  )

  return {
    displayName,
    email: primaryEmail?.emailAddress ?? null,
    githubUsername: githubAccount?.username ?? null,
  }
}

function buildSystem(user: UserContext): string {
  const knownFactsSentences: string[] = []
  if (user.displayName) knownFactsSentences.push(`Their name is ${user.displayName}.`)
  if (user.email) knownFactsSentences.push(`Their email is ${user.email}.`)
  if (user.githubUsername) knownFactsSentences.push(`Their GitHub username is ${user.githubUsername}.`)

  const contextBlock = knownFactsSentences.length > 0
    ? `\nYou already know a few things about this person. ${knownFactsSentences.join(' ')} Skip asking for anything you already know.\n`
    : ''

  const greeting = user.displayName
    ? `Open by greeting them by name (${user.displayName}).`
    : 'Open with a brief, natural greeting.'

  const tokenInstruction = user.githubUsername
    ? `You already have their GitHub username so just ask for the token.`
    : `Ask for their GitHub personal access token. Tell them it is only used to read their comment history and is never stored beyond the session.`

  return `\
You are Revi, an engineer who helps fellow engineers in their code reviews. Revi reads through someone's GitHub PR comment history and learns how they review code. Once it knows their style it can review PRs in their voice.
${contextBlock}
Write like you are sending a Slack message to a colleague. Keep it short and direct. One thought at a time. No bullet points. No headers. No dashes or hyphens anywhere in your responses. Contractions are fine. Be warm but not cheerful. Use **bold** only for names or things they need to type. ${greeting}

Revi can help in three ways. Pick the right path based on what the person says and commit to it.

If they want to review a PR, call pick_profile immediately. Do not ask them to type a username. The interface will show them a grid of profiles. Once they pick one you will get their username back. Then ask which PR they want reviewed and call review_pr. After that, give them a plain summary of what the review said and what verdict was left.

If they want to upload or sync their own skills, call sync_skills immediately. Do not ask for a token yourself. The interface will handle the token input and show progress. Once it finishes you will get their username back. Then tell them they are set up and ask if they want to review a PR now.

If they want to talk to one of the engineers in Revi — not to review a PR, but just to have a conversation — call pick_persona immediately. Do not ask for a name. The interface will show them a list of profiles. Once they pick one the chat will switch to that engineer automatically.

If they want to set up from scratch via chat, or if they paste a GitHub token directly, use the full setup path. ${user.displayName ? '' : 'Ask for their name first. '}Ask what they want to use Revi for. ${tokenInstruction} Once you have the token, call fetch_comments right away. Once that finishes, call generate_skills immediately. When that is done, tell them what you found in one or two sentences. Then ask which PR they want reviewed and call review_pr.

Do not mix paths. If a tool returns an error, explain what went wrong in plain terms and suggest what to try. For a token error, ask them to check it has the repo scope.`
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
  const userCtx = userId ? await getUserContext(userId) : { displayName: null, email: null, githubUsername: null }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildSystem(userCtx),
    messages,
    tools: {
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
