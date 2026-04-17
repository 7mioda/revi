import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool } from 'ai'
import { z } from 'zod'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

const SYSTEM = `\
You are the Revi onboarding assistant. Revi is a PR review voice cloner that learns a developer's code review style from their GitHub comment history.

Follow these steps in order. Be brief, warm, and conversational. Do not ask multiple questions at once. Write in plain, natural language. Never use dashes or em-dashes to separate clauses. Use short sentences instead.

FORMAT: Use markdown to structure your responses. Use **bold** for emphasis on key terms, names, or important info. Use bullet points or numbered lists when listing multiple items. Keep paragraphs short (1-2 sentences max).

STEP 1: Collect info (one question at a time)
1. Ask for the user's name.
2. Ask what brings them to Revi and how they hope it can help.
3. Ask for their GitHub personal access token. Explain that it's used only to read their PR comment history.

STEP 2: Fetch comments
Once you have the token, call fetch_comments immediately. Do not ask for confirmation. Tell the user you're about to fetch their GitHub comment history.

STEP 3: Generate skills
Once fetch_comments succeeds, call generate_skills immediately. Do not ask for confirmation. Tell the user you're building their review style profile from the comments found. Pass the "user" field from the fetch_comments result as both userId and username.

STEP 4: Ask for a PR to review
Once generate_skills succeeds, briefly summarize what was built (e.g. "Your profile is ready! I found X skills from your comment history."). Then ask which pull request they'd like reviewed. Accept a GitHub URL (https://github.com/owner/repo/pull/42) or plain owner, repo, and PR number.

STEP 5: Review the PR
Extract owner, repo, and pull number from the user's response and call review_pr. Pass the same userId used in generate_skills. Tell the user the review is being posted.

STEP 6: Summarize
Once review_pr succeeds, tell the user the review has been posted and give a one-paragraph plain-language summary of the verdict and key findings.

ERROR HANDLING:
If any tool result contains an "error" field, stop and explain the problem in plain language. Suggest a fix where possible (e.g. if the token is invalid, ask them to check it has the "repo" scope).`

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SYSTEM,
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
              headers: { 'Content-Type': 'application/json' },
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
              headers: { 'Content-Type': 'application/json' },
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
      review_pr: tool({
        description: 'Review a pull request using the generated skill profile and post it to GitHub.',
        parameters: z.object({
          owner: z.string().describe('GitHub repository owner'),
          repo: z.string().describe('GitHub repository name'),
          pullNumber: z.number().int().positive().describe('Pull request number'),
          userId: z.string().optional().describe('GitHub login to scope skill lookup'),
        }),
        execute: async ({ owner, repo, pullNumber, userId }) => {
          try {
            const res = await fetch(`${API_URL}/reviews`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ owner, repo, pullNumber, post: true, userId }),
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
