'use client'

import { useChat } from 'ai/react'
import type { ToolInvocation } from 'ai'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import type { PersonaProfile } from './persona-chat'

const PURPOSE_OPTIONS = [
  'I want to review PRs more consistently across my team',
  'I want to share my review style so others can learn from it',
  'I want faster, more thorough code reviews',
  "I'm curious what patterns show up in my review history",
]

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG)                                                */
/* ------------------------------------------------------------------ */

function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <g clipPath="url(#send-clip)">
        <path d="M10.9507 18H12.9414V16.0052H10.9507V18Z" fill="currentColor"/>
        <path d="M10.9507 16.0206H12.9414V14.0258H10.9507V16.0206Z" fill="currentColor"/>
        <path d="M10.9507 14.0412H12.9414V12.0464H10.9507V14.0412Z" fill="currentColor"/>
        <path d="M10.9507 12.0619H12.9414V10.067H10.9507V12.0619Z" fill="currentColor"/>
        <path d="M8.97508 10.0825H10.9658V8.08763H8.97508V10.0825Z" fill="currentColor"/>
        <path d="M12.9263 10.0825H14.917V8.08763H12.9263V10.0825Z" fill="currentColor"/>
        <path d="M7.00047 12.0619H8.99121V10.067H7.00047V12.0619Z" fill="currentColor"/>
        <path d="M14.9009 12.0619H16.8916V10.067H14.9009V12.0619Z" fill="currentColor"/>
        <path d="M10.9507 8.10309H12.9414V6.10825H10.9507V8.10309Z" fill="currentColor"/>
      </g>
      <defs>
        <clipPath id="send-clip">
          <rect width="12" height="10" fill="currentColor" transform="matrix(0 -1 1 0 7 18)"/>
        </clipPath>
      </defs>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-[spin_1s_linear_infinite]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function maskIfToken(content: string): string {
  return /^(ghp_|github_pat_|ghs_|gho_|ghu_)\S+/.test(content.trim())
    ? '••••••••••••••••••••'
    : content
}

function toolLabel(inv: ToolInvocation): { text: string; running: boolean } | null {
  const running = inv.state === 'call' || inv.state === 'partial-call'
  if (!running && inv.state === 'result' && (inv.result as { error?: unknown } | undefined)?.error) {
    return null
  }
  switch (inv.toolName) {
    case 'fetch_comments':
      return { text: running ? 'Fetching your GitHub comments' : 'Comments fetched', running }
    case 'generate_skills':
      return { text: running ? 'Building your skill profile' : 'Skill profile ready', running }
    case 'review_pr':
      return { text: running ? 'Reviewing pull request' : 'Review posted', running }
    // pick_profile, sync_skills, and pick_persona are rendered as interactive components, not pills
    case 'pick_profile':
    case 'sync_skills':
    case 'pick_persona':
      return null
    default:
      return { text: inv.toolName, running }
  }
}

/* ------------------------------------------------------------------ */
/*  Types for inline tool components                                  */
/* ------------------------------------------------------------------ */

interface Profile {
  username: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  followers: number
}

type StepStatus = 'pending' | 'running' | 'done' | 'failed'

interface SyncStep {
  name: string
  status: StepStatus
  count?: number
  error?: string
}

interface SyncJob {
  status: 'pending' | 'running' | 'done' | 'failed'
  steps: SyncStep[]
}

type SyncState =
  | { phase: 'enter-token' }
  | { phase: 'syncing'; jobId: string; username: string; job: SyncJob | null }
  | { phase: 'done'; username: string }
  | { phase: 'error'; message: string }

const STEP_LABELS: Record<string, string> = {
  fetchActivity: 'Fetching GitHub activity',
  generatePreferences: 'Building preferences',
  generateCodingRules: 'Generating coding rules',
}

/* ------------------------------------------------------------------ */
/*  ProfilePickerTool — inline profile grid                           */
/* ------------------------------------------------------------------ */

function ProfilePickerTool({
  toolCallId,
  addToolResult,
  onSelect,
}: {
  toolCallId: string
  addToolResult: (args: { toolCallId: string; result: unknown }) => void
  onSelect?: (p: Profile) => void
}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(false)

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json() as Promise<Profile[]>)
      .then(setProfiles)
      .catch(() => setError('Could not load profiles.'))
  }, [])

  function handleSelect(p: Profile) {
    if (selected) return
    setSelected(true)
    if (onSelect) {
      onSelect(p)
      addToolResult({ toolCallId, result: { username: p.username, name: p.name } })
    } else {
      addToolResult({ toolCallId, result: { username: p.username, name: p.name } })
    }
  }

  if (error) {
    return <p className="text-sm text-gray-500">{error}</p>
  }

  if (!profiles) {
    return <PixelLoader />
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-gray-500">No profiles yet. Upload your skills first.</p>
  }

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${selected ? 'pointer-events-none opacity-50' : ''}`}>
      {profiles.map((p) => (
        <button
          key={p.username}
          type="button"
          onClick={() => handleSelect(p)}
          className="flex items-start gap-3 border border-gray-200 p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt={p.username} width={32} height={32} className="shrink-0 object-cover" />
          ) : (
            <div className="h-8 w-8 shrink-0 bg-gray-100" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{p.name ?? p.username}</p>
            <p className="text-xs text-gray-400">@{p.username}</p>
            {p.bio && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{p.bio}</p>}
          </div>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SyncSkillsTool — token input + progress                           */
/* ------------------------------------------------------------------ */

function SyncSkillsTool({
  toolCallId,
  addToolResult,
}: {
  toolCallId: string
  addToolResult: (args: { toolCallId: string; result: unknown }) => void
}) {
  const [state, setState] = useState<SyncState>({ phase: 'enter-token' })
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start polling when syncing phase begins
  useEffect(() => {
    if (state.phase !== 'syncing') return
    const { jobId } = state

    async function poll() {
      try {
        const res = await fetch(`/api/profiles/jobs/${jobId}`)
        if (!res.ok) return
        const job = (await res.json()) as SyncJob
        setState((prev) => {
          if (prev.phase !== 'syncing') return prev
          if (job.status === 'done') {
            if (pollRef.current) clearInterval(pollRef.current)
            return { phase: 'done', username: prev.username }
          }
          if (job.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current)
            const failedStep = job.steps.find((s) => s.status === 'failed')
            return { phase: 'error', message: failedStep?.error ?? 'Sync failed. Try again.' }
          }
          return { ...prev, job }
        })
      } catch {
        // transient — keep polling
      }
    }

    void poll()
    pollRef.current = setInterval(() => void poll(), 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === 'syncing' ? (state as { jobId: string }).jobId : null])

  // Call addToolResult exactly once when done
  useEffect(() => {
    if (state.phase === 'done') {
      addToolResult({ toolCallId, result: { username: state.username } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setTokenError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/profiles/sync-from-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = (await res.json()) as { jobId?: string; username?: string; message?: string }
      if (!res.ok) { setTokenError(body.message ?? `Request failed (${res.status})`); return }
      setState({ phase: 'syncing', jobId: body.jobId!, username: body.username!, job: null })
    } catch (err) {
      setTokenError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (state.phase === 'enter-token') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Needs the <span className="font-medium text-gray-700">repo</span> scope. Never stored beyond this request.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
          <div className="flex flex-1 items-center border border-gray-200 pl-3 pr-2 transition-colors hover:border-gray-300 focus-within:border-gray-400">
            <span className="mr-2 text-gray-300"><LockIcon /></span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_••••••••••••"
              autoComplete="off"
              autoFocus
              disabled={submitting}
              className="flex-1 bg-transparent py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !token.trim()}
            className="border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-40"
          >
            {submitting ? 'Connecting…' : 'Upload'}
          </button>
        </form>
        {tokenError && <p className="text-sm text-red-500">{tokenError}</p>}
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ phase: 'enter-token' })}
          className="border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          Try again
        </button>
      </div>
    )
  }

  if (state.phase === 'syncing') {
    const steps = state.job?.steps ?? []
    return (
      <div className="space-y-2">
        {steps.length === 0 ? (
          <p className="text-sm text-gray-400">Starting up…</p>
        ) : (
          steps.map((step) => (
            <div key={step.name} className="flex items-center gap-2 border border-gray-100 px-3 py-1.5">
              <span className={step.status === 'failed' ? 'text-red-500' : 'text-gray-900'}>
                {step.status === 'running' && <SpinnerIcon />}
                {step.status === 'done' && <CheckIcon />}
                {(step.status === 'pending' || step.status === 'failed') && (
                  <span className="inline-block h-3.5 w-3.5 border border-gray-300" />
                )}
              </span>
              <span className={`text-xs ${step.status === 'pending' ? 'text-gray-400' : step.status === 'failed' ? 'text-red-600' : 'text-gray-700'}`}>
                {STEP_LABELS[step.name] ?? step.name}
                {step.status === 'done' && step.count != null && (
                  <span className="ml-1 text-gray-400">({step.count})</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    )
  }

  // done phase — addToolResult already called via useEffect
  return <p className="text-sm text-gray-500">Sync complete for @{state.username}.</p>
}

/* ------------------------------------------------------------------ */
/*  Markdown renderer (shared between intro and chat)                */
/* ------------------------------------------------------------------ */

const mdComponents: React.ComponentProps<typeof Markdown>['components'] = {
  h1: 'span', h2: 'span', h3: 'span', h4: 'span', h5: 'span', h6: 'span',
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 text-sm">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto bg-gray-100 p-3 text-sm last:mb-0">{children}</pre>,
  a: ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

/* ------------------------------------------------------------------ */
/*  Pixel loader                                                      */
/* ------------------------------------------------------------------ */

const LOADER_PX = 3
const LOADER_GAP = 2
const LOADER_FRAMES = [
  [[1,1,1],[0,0,1],[0,0,0]],
  [[0,0,1],[0,0,1],[0,0,1]],
  [[0,0,0],[0,0,1],[1,1,1]],
  [[0,0,0],[1,0,0],[1,1,1]],
  [[1,0,0],[1,0,0],[1,0,0]],
  [[1,1,1],[1,0,0],[0,0,0]],
]

function PixelLoader() {
  const [f, setF] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setF(i => (i + 1) % LOADER_FRAMES.length), 120)
    return () => clearInterval(id)
  }, [])

  const s = 3 * LOADER_PX + 2 * LOADER_GAP
  return (
    <div className="flex items-center px-1 py-2">
      <svg width={s} height={s}>
        {LOADER_FRAMES[f]?.map((row, y) =>
          row.map((on, x) =>
            on ? <rect key={`${x}${y}`} x={x * (LOADER_PX + LOADER_GAP)} y={y * (LOADER_PX + LOADER_GAP)} width={LOADER_PX} height={LOADER_PX} fill="#000" /> : null
          )
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Logo                                                              */
/* ------------------------------------------------------------------ */

function ReviLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 100 100" fill="none" shapeRendering="crispEdges" aria-label="Revi">
      <rect x="19" y="59" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="19" y="75" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="19" y="11" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="35" y="11" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="19" y="27" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="19" y="43" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="35" y="43" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="51" y="11" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="67" y="27" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="51" y="43" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="51" y="59" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="67" y="43" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="67" y="75" width="14.125" height="14.125" fill="#2F3030"/>
      <rect x="67" y="11" width="14.125" height="14.125" fill="#2F3030"/>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function OnboardingChat() {
  const {
    messages,
    input: mainInput,
    handleInputChange: mainHandleInputChange,
    handleSubmit: mainHandleSubmit,
    append,
    isLoading: mainIsLoading,
    addToolResult,
  } = useChat({ api: '/api/onboarding' })

  const [personaProfile, setPersonaProfile] = useState<PersonaProfile | null>(null)

  const {
    messages: personaMessages,
    input: personaInput,
    handleInputChange: personaHandleInputChange,
    handleSubmit: personaHandleSubmit,
    append: personaAppend,
    isLoading: personaIsLoading,
  } = useChat({
    api: '/api/persona',
    body: { username: personaProfile?.username ?? '' },
  })

  const hasPersonaInited = useRef(false)

  // Auto-init persona when profile is selected
  useEffect(() => {
    if (!personaProfile || hasPersonaInited.current) return
    hasPersonaInited.current = true
    void personaAppend({ role: 'user', content: '__init__' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaProfile])

  const isLoading = mainIsLoading || personaIsLoading
  const input = personaProfile ? personaInput : mainInput
  const handleInputChange = personaProfile ? personaHandleInputChange : mainHandleInputChange
  const handleSubmit = personaProfile ? personaHandleSubmit : mainHandleSubmit

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isTokenStep, setIsTokenStep] = useState(false)
  const [isPurposeStep, setIsPurposeStep] = useState(false)
  const hasGreeted = useRef(false)

  // ── Intro phase state machine ──────────────────────────────────────
  // 'streaming' → greeting is being received
  // 'ready'     → stream done, buttons visible
  // 'done'      → button was clicked, chat layout shown
  const [introPhase, setIntroPhase] = useState<'streaming' | 'ready' | 'done'>('streaming')
  const [introVisible, setIntroVisible] = useState(true)

  // Trigger initial AI greeting on mount
  useEffect(() => {
    if (hasGreeted.current) return
    hasGreeted.current = true
    void append({ role: 'user', content: '__init__' })
  }, [append])

  // Scroll to bottom on new messages (chat phase only)
  useEffect(() => {
    if (introPhase === 'done') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, personaMessages, introPhase])

  // streaming → ready: first message finished loading
  useEffect(() => {
    if (
      introPhase === 'streaming' &&
      !isLoading &&
      visibleMessages.some((m) => m.role === 'assistant')
    ) {
      setIntroPhase('ready')
    }
  // visibleMessages is derived below — intentionally using messages as dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, introPhase, messages])

  // Auto-focus input when chat layout appears
  useEffect(() => {
    if (introPhase === 'done') {
      inputRef.current?.focus()
    }
  }, [introPhase])

  // Detect current step from last assistant message (chat phase)
  useEffect(() => {
    if (introPhase !== 'done') return
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant && typeof lastAssistant.content === 'string') {
      const text = lastAssistant.content
      setIsTokenStep(/token/i.test(text))
      const userMessageCount = messages.filter((m) => m.role === 'user' && m.content !== '__init__').length
      setIsPurposeStep(
        userMessageCount >= 1 &&
        /brings you|hoping.*help|help.*you/i.test(text) &&
        !/token/i.test(text)
      )
    }
  }, [messages, introPhase])

  function handleStartChat(message?: string) {
    setIntroVisible(false)
    setTimeout(() => {
      setIntroPhase('done')
      if (message) void append({ role: 'user', content: message })
    }, 300)
  }

  function selectOption(option: string) {
    void append({ role: 'user', content: option })
  }

  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && m.content === '__init__'),
  )

  const visiblePersonaMessages = personaMessages.filter(
    (m) => !(m.role === 'user' && m.content === '__init__'),
  )

  // Combined list for rendering — main messages first, then persona
  const allVisibleMessages = [
    ...visibleMessages.map((m) => ({ msg: m, source: 'main' as const })),
    ...visiblePersonaMessages.map((m) => ({ msg: m, source: 'persona' as const })),
  ]

  const firstAssistantMsg = visibleMessages.find((m) => m.role === 'assistant')
  const firstAssistantText = typeof firstAssistantMsg?.content === 'string' ? firstAssistantMsg.content : null

  /* ── Intro phase layout ─────────────────────────────────────────── */
  if (introPhase !== 'done') {
    return (
      <main
        className={`min-h-screen flex items-center justify-center bg-white px-8 font-[var(--font-inter)] transition-opacity duration-300 ${
          introVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="w-full max-w-2xl">
          {/* Greeting text streams in */}
          {firstAssistantText ? (
            <div
              className="text-base leading-relaxed text-gray-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              style={{ animation: 'intro-fade-in 1.2s ease-out' }}
            >
              <Markdown components={mdComponents}>{firstAssistantText}</Markdown>
            </div>
          ) : (
            <PixelLoader />
          )}

          {/* Action buttons — fade in once streaming ends */}
          <div
            className={`mt-8 flex items-center justify-between transition-opacity duration-500 ${
              introPhase === 'ready' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleStartChat('I want to review a PR')}
                className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
              >
                Review a PR
              </button>
              <button
                type="button"
                onClick={() => handleStartChat('I want to upload my skills')}
                className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
              >
                Build my profile
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleStartChat()}
              className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              Talk
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </main>
    )
  }

  /* ── Chat phase layout ──────────────────────────────────────────── */
  return (
    <main
      className="flex min-h-screen flex-col bg-white font-[var(--font-inter)]"
      style={{ animation: 'message-in 0.3s ease-out' }}
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center px-6">
        <ReviLogo />
      </header>

      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-44">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {allVisibleMessages.map(({ msg, source }) => {
            const textContent = typeof msg.content === 'string' ? msg.content : null
            const invocations = msg.toolInvocations ?? []
            const isPersonaAssistant = source === 'persona' && msg.role === 'assistant'

            return (
              <div
                key={`${source}-${msg.id}`}
                className="flex flex-col gap-2"
                style={{ animation: 'message-in 0.3s ease-out' }}
              >
                {textContent && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {isPersonaAssistant && (
                      <div className="mr-2 mt-0.5 shrink-0">
                        {personaProfile?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={personaProfile.avatarUrl}
                            alt={personaProfile.name ?? personaProfile.username}
                            width={24}
                            height={24}
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-6 w-6 bg-gray-200" />
                        )}
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] text-base leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gray-100 px-4 py-2.5 text-gray-900 font-[var(--font-inter)]'
                          : 'text-gray-800 font-[var(--font-inter)]'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <Markdown components={mdComponents}>{textContent}</Markdown>
                        </div>
                      ) : maskIfToken(textContent)}
                    </div>
                  </div>
                )}
                {invocations.map((inv) => {
                  // Interactive tool: profile picker (PR review)
                  if (inv.toolName === 'pick_profile' && inv.state === 'call') {
                    return (
                      <div key={inv.toolCallId} className="flex justify-start">
                        <div className="w-full max-w-[75%]">
                          <ProfilePickerTool toolCallId={inv.toolCallId} addToolResult={addToolResult} />
                        </div>
                      </div>
                    )
                  }
                  // Interactive tool: persona picker (Talk flow)
                  if (inv.toolName === 'pick_persona' && inv.state === 'call') {
                    return (
                      <div key={inv.toolCallId} className="flex justify-start">
                        <div className="w-full max-w-[75%]">
                          <ProfilePickerTool
                            toolCallId={inv.toolCallId}
                            addToolResult={addToolResult}
                            onSelect={(p) => setPersonaProfile({ username: p.username, name: p.name, avatarUrl: p.avatarUrl })}
                          />
                        </div>
                      </div>
                    )
                  }
                  // Interactive tool: sync skills
                  if (inv.toolName === 'sync_skills' && inv.state === 'call') {
                    return (
                      <div key={inv.toolCallId} className="flex justify-start">
                        <div className="w-full max-w-[75%]">
                          <SyncSkillsTool toolCallId={inv.toolCallId} addToolResult={addToolResult} />
                        </div>
                      </div>
                    )
                  }
                  // Result state for interactive tools: AI message handles the follow-up
                  if (inv.toolName === 'pick_profile' || inv.toolName === 'sync_skills' || inv.toolName === 'pick_persona') return null
                  // Standard pill for server-executed tools
                  const status = toolLabel(inv)
                  if (!status) return null
                  return (
                    <div key={inv.toolCallId} className="flex justify-start">
                      <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
                        {status.running ? (
                          <span className="text-gray-900"><SpinnerIcon /></span>
                        ) : (
                          <span className="text-gray-900"><CheckIcon /></span>
                        )}
                        {status.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {isLoading && !allVisibleMessages.some(({ msg }) => msg.role === 'assistant' && msg.id === allVisibleMessages[allVisibleMessages.length - 1]?.msg.id && typeof msg.content === 'string' && msg.content) && (
            <div
              className="flex justify-start"
              style={{ animation: 'message-in 0.3s ease-out' }}
            >
              {personaIsLoading && personaProfile ? (
                <div className="flex items-start gap-2">
                  {personaProfile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={personaProfile.avatarUrl} alt={personaProfile.name ?? personaProfile.username} width={24} height={24} className="mt-2 shrink-0 object-cover" />
                  ) : (
                    <div className="mt-2 h-6 w-6 shrink-0 bg-gray-200" />
                  )}
                  <PixelLoader />
                </div>
              ) : (
                <PixelLoader />
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pb-6 pt-4">
        <div className="mx-auto max-w-2xl">
          {/* Purpose quick-select — only in main chat, not during persona */}
          {isPurposeStep && !isLoading && !personaProfile && (
            <div className="mb-4 flex flex-col gap-1">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectOption(opt)}
                  className="flex items-center gap-3 px-3 py-3 text-left text-base text-gray-900 transition-colors hover:bg-gray-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M4 5v6a4 4 0 0 0 4 4h8" />
                    <polyline points="13 11 17 15 13 19" />
                  </svg>
                  {opt}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex min-h-14 items-center gap-2 border border-gray-200 bg-white pl-4 pr-3 py-3 transition-colors hover:border-gray-300">
            {isTokenStep && !personaProfile && (
              <span className="text-gray-300"><LockIcon /></span>
            )}
            <input
              ref={inputRef}
              type={isTokenStep && !personaProfile ? 'password' : 'text'}
              value={input}
              onChange={handleInputChange}
              placeholder={isTokenStep && !personaProfile ? 'ghp_••••••••••••' : 'Reply'}
              disabled={isLoading}
              autoComplete={isTokenStep && !personaProfile ? 'off' : 'on'}
              className="flex-1 bg-transparent h-10 text-base text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center bg-black text-white transition-all hover:bg-gray-800 disabled:opacity-30"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
