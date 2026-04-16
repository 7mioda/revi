import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool } from 'ai'
import { z } from 'zod'

const SYSTEM = `\
You are the Revi onboarding assistant. Revi is a PR review voice cloner — it learns a developer's code review style from their GitHub comment history.

Collect the following in order, one at a time. Be brief and friendly. Do not ask multiple questions at once.

1. The user's name.
2. What brings them to Revi and how they hope it can help them.
3. Their GitHub personal access token. Explain that it's used to read their PR comments and is never stored long-term.

Once you have all three pieces of information, call the complete_onboarding tool immediately.`

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SYSTEM,
    messages,
    tools: {
      complete_onboarding: tool({
        description:
          'Call this once you have collected the name, purpose, and GitHub token from the user.',
        parameters: z.object({
          name: z.string().describe("The user's name"),
          purpose: z.string().describe('What the user hopes to achieve with Revi'),
          githubToken: z.string().describe("The user's GitHub personal access token"),
        }),
      }),
    },
    maxSteps: 10,
  })

  return result.toDataStreamResponse()
}
