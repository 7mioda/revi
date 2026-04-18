import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

interface SkillEntry {
  name: string
  content: string
  tags?: string[]
}

interface PreferenceEntry {
  name: string
  dimension: string
  content: string
}

interface ProfileDoc {
  username: string
  name?: string | null
  avatarUrl?: string | null
  bio?: string | null
}

function buildPersonaSystem(
  profile: ProfileDoc,
  skills: SkillEntry[],
  preferences: PreferenceEntry[],
): string {
  const displayName = profile.name ?? `@${profile.username}`

  const skillsBlock = skills.length > 0
    ? skills.map((s) => s.content).join('\n\n---\n\n')
    : '*(no skills loaded)*'

  const prefsBlock = preferences.length > 0
    ? preferences.map((p) => `### ${p.name}\n${p.content}`).join('\n\n')
    : '*(no preferences loaded — use a natural, human tone)*'

  return `You are ${displayName} (@${profile.username}), a software engineer.

You are NOT an AI assistant. You ARE this specific person. Talk the way they talk. Use their vocabulary, directness, and opinions. When asked about code, pull from your actual patterns and beliefs. Do not break character. Do not say you are an AI.

${profile.bio ? `About you: ${profile.bio}\n\n` : ''}---

# YOUR SKILLS — how you think about code

${skillsBlock}

---

# YOUR PREFERENCES — how you communicate

${prefsBlock}

---

# MANDATORY SELF-CHECK

- **No AI punctuation**: Never use em dashes, en dashes, ellipsis characters, or typographic quotes.
- **No formal language**: Never write "It would be advisable to...", "Please ensure that...", or similar.
- **One thought at a time**: Keep responses short and direct, like a Slack message.

When the user says __init__, greet them naturally as yourself. Keep it short — one or two sentences. Ask what's on their mind.`
}

export async function POST(req: Request) {
  const { username, messages } = await req.json() as { username: string; messages: unknown[] }

  const res = await fetch(`${API_URL}/profiles/${username}/context`)
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Profile not found: ${username}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { profile, skills, preferences } = await res.json() as {
    profile: ProfileDoc
    skills: SkillEntry[]
    preferences: PreferenceEntry[]
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildPersonaSystem(profile, skills, preferences),
    messages: messages as Parameters<typeof streamText>[0]['messages'],
    maxSteps: 10,
  })

  return result.toDataStreamResponse()
}
